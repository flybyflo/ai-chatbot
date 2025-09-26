import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const START_RE = /@startuml/i;
const END_RE = /@enduml/i;

const plantUmlSchema = z.object({
  code: z.string().min(1, "PlantUML code is required"),
  format: z.enum(["svg", "png"]).default("svg"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, format } = plantUmlSchema.parse(body);

    // Ensure code has @startuml/@enduml wrappers
    const trimmed = code.trim();
    const hasStart = START_RE.test(trimmed);
    const hasEnd = END_RE.test(trimmed);
    const wrapped =
      hasStart && hasEnd ? trimmed : `@startuml\n${trimmed}\n@enduml`;

    // Dynamic import and use named export per local type declaration
    const { generate } = await import("node-plantuml");

    // Generate diagram using stream API
    const gen = generate(wrapped, { format });
    const chunks: Uint8Array[] = [];
    const buffer: Buffer = await new Promise((resolve, reject) => {
      gen.out.on("data", (chunk: Uint8Array) => {
        chunks.push(chunk);
      });
      gen.out.on("end", () => {
        resolve(Buffer.concat(chunks.map((c) => Buffer.from(c))));
      });
      gen.out.on("error", (err: unknown) => {
        reject(err);
      });
    });

    // Return appropriate response based on format
    if (format === "svg") {
      return new NextResponse(buffer.toString("utf-8"), {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        },
      });
    }
    const pngBytes = Uint8Array.from(buffer);
    return new NextResponse(pngBytes, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
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
