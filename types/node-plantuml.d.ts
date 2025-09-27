declare module "node-plantuml" {
  export function generate(
    src: string,
    options?: { format?: "svg" | "png" }
  ): { out: NodeJS.ReadableStream; err?: NodeJS.ReadableStream };
}
