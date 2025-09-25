import { getAllTools } from "@/lib/ai/tools";

export async function GET() {
  try {
    const { tools, mcpRegistry } = await getAllTools();

    return Response.json({
      tools: Object.keys(tools),
      mcpRegistry,
    });
  } catch (error) {
    console.error("Failed to fetch tools:", error);
    return Response.json({ error: "Failed to fetch tools" }, { status: 500 });
  }
}
