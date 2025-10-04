import { spawn } from "node:child_process";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PLANTUML_FORMATS, type PlantUMLFormat } from "@/lib/enums";

export const runtime = "nodejs";

const START_RE = /@startuml/i;
const END_RE = /@enduml/i;

const plantUmlSchema = z.object({
  code: z.string().min(1, "PlantUML code is required"),
  format: z
    .enum([PLANTUML_FORMATS.SVG, PLANTUML_FORMATS.PNG])
    .default(PLANTUML_FORMATS.SVG),
});

function renderWithPlantumlCli(
  uml: string,
  format: PlantUMLFormat,
  debug: boolean
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const bin = process.env.PLANTUML_BIN || "plantuml";
    const args = [
      format === PLANTUML_FORMATS.SVG ? "-tsvg" : "-tpng",
      "-pipe",
      "-charset",
      "UTF-8",
    ];
    if (debug) {
      process.stdout.write(`[plantuml] spawn ${bin} ${args.join(" ")}\n`);
    }
    const child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });
    const outChunks: Uint8Array[] = [];
    const errChunks: Uint8Array[] = [];
    child.stdout.on("data", (d: Uint8Array) => outChunks.push(d));
    child.stderr.on("data", (d: Uint8Array) => errChunks.push(d));
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (debug && errChunks.length > 0) {
        const errText = Buffer.concat(
          errChunks.map((c) => Buffer.from(c))
        ).toString("utf-8");
        process.stdout.write(`[plantuml] cli stderr:\n${errText}\n`);
      }
      if (code !== 0) {
        reject(new Error(`plantuml exited with code ${code}`));
        return;
      }
      resolve(Buffer.concat(outChunks.map((c) => Buffer.from(c))));
    });
    child.stdin.end(uml, "utf-8");
  });
}

function renderWithJavaJar(
  uml: string,
  format: PlantUMLFormat,
  debug: boolean
): Promise<Buffer> {
  const jarPath = process.env.PLANTUML_JAR;
  if (!jarPath) {
    throw new Error("PLANTUML_JAR not set");
  }
  return new Promise((resolve, reject) => {
    const args = [
      "-jar",
      jarPath,
      format === PLANTUML_FORMATS.SVG ? "-tsvg" : "-tpng",
      "-pipe",
      "-charset",
      "UTF-8",
    ];
    if (debug) {
      process.stdout.write(`[plantuml] spawn java ${args.join(" ")}\n`);
    }
    const child = spawn("java", args, { stdio: ["pipe", "pipe", "pipe"] });
    const outChunks: Uint8Array[] = [];
    const errChunks: Uint8Array[] = [];
    child.stdout.on("data", (d: Uint8Array) => outChunks.push(d));
    child.stderr.on("data", (d: Uint8Array) => errChunks.push(d));
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (debug && errChunks.length > 0) {
        const errText = Buffer.concat(
          errChunks.map((c) => Buffer.from(c))
        ).toString("utf-8");
        process.stdout.write(`[plantuml] java stderr:\n${errText}\n`);
      }
      if (code !== 0) {
        reject(new Error(`java exited with code ${code}`));
        return;
      }
      resolve(Buffer.concat(outChunks.map((c) => Buffer.from(c))));
    });
    child.stdin.end(uml, "utf-8");
  });
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const debugHeader = request.headers.get("x-debug") === "1";
    const debugQuery = url.searchParams.get("debug") === "1";
    const debugEnv = process.env.DEBUG_PLANTUML === "1";
    const debug = debugHeader || debugQuery || debugEnv;

    const body = await request.json();
    const { code, format } = plantUmlSchema.parse(body);
    if (debug) {
      process.stdout.write(
        `[plantuml] request format=${format} codeLength=${code?.length ?? 0}\n`
      );
    }

    // Ensure code has @startuml/@enduml wrappers
    const trimmed = code.trim();
    const hasStart = START_RE.test(trimmed);
    const hasEnd = END_RE.test(trimmed);
    const wrapped =
      hasStart && hasEnd ? trimmed : `@startuml\n${trimmed}\n@enduml`;
    if (debug && (!hasStart || !hasEnd)) {
      process.stdout.write(
        `[plantuml] wrapping added: startPresent=${hasStart} endPresent=${hasEnd}\n`
      );
    }

    // Try local CLI first, then optional JAR, then node-plantuml
    let buffer: Buffer | undefined;
    let durMs = 0;
    const startCli = Date.now();
    try {
      buffer = await renderWithPlantumlCli(wrapped, format, debug);
      durMs = Date.now() - startCli;
      if (debug) {
        process.stdout.write(`[plantuml] cli render ok in ${durMs}ms\n`);
      }
    } catch (cliErr) {
      if (debug) {
        process.stdout.write(
          `[plantuml] cli failed: ${cliErr instanceof Error ? cliErr.message : String(cliErr)}\n`
        );
      }
    }
    if (!buffer || buffer.length === 0) {
      const startJar = Date.now();
      try {
        buffer = await renderWithJavaJar(wrapped, format, debug);
        durMs = Date.now() - startJar;
        if (debug) {
          process.stdout.write(`[plantuml] jar render ok in ${durMs}ms\n`);
        }
      } catch (jarErr) {
        if (debug) {
          process.stdout.write(
            `[plantuml] jar failed: ${jarErr instanceof Error ? jarErr.message : String(jarErr)}\n`
          );
        }
      }
    }
    if (!buffer || buffer.length === 0) {
      // Dynamic import and use named export per local type declaration
      const { generate } = await import("node-plantuml");
      const gen = generate(wrapped, { format });
      const chunks: Uint8Array[] = [];
      const stderrChunks: Uint8Array[] = [];
      const startLib = Date.now();
      buffer = await new Promise((resolve, reject) => {
        gen.out.on("data", (chunk: Uint8Array) => {
          chunks.push(chunk);
        });
        gen.out.on("end", () => {
          resolve(Buffer.concat(chunks.map((c) => Buffer.from(c))));
        });
        gen.out.on("error", (err: unknown) => {
          reject(err);
        });
        if ((gen as any)?.err && typeof (gen as any).err.on === "function") {
          (gen as any).err.on("data", (chunk: Uint8Array) => {
            stderrChunks.push(chunk);
          });
        }
      });
      durMs = Date.now() - startLib;
      if (stderrChunks.length > 0 && debug) {
        const stderrText = Buffer.concat(
          stderrChunks.map((c) => Buffer.from(c))
        ).toString("utf-8");
        process.stdout.write(
          `[plantuml] node-plantuml stderr after ${durMs}ms:\n${stderrText}\n`
        );
      }
    }
    if (!buffer || buffer.length === 0) {
      if (debug) {
        process.stdout.write(
          `[plantuml] empty output after ${durMs}ms (likely missing Java or Graphviz)\n`
        );
      }
      return NextResponse.json(
        {
          error: "PlantUML rendering failed",
          message:
            "No output produced by PlantUML. Ensure Java (JRE/JDK) and Graphviz 'dot' are installed and available on PATH.",
        },
        { status: 500 }
      );
    }

    // Return appropriate response based on format
    if (format === PLANTUML_FORMATS.SVG) {
      const svg = (buffer as Buffer).toString("utf-8");
      return new NextResponse(svg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Content-Length": String(Buffer.byteLength(svg)),
          "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        },
      });
    }
    const pngBytes = Uint8Array.from(buffer as Buffer);
    return new NextResponse(pngBytes, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(pngBytes.byteLength),
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to render PlantUML diagram",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
