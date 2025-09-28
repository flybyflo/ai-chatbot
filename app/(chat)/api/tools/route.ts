import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getAllTools } from "@/lib/ai/tools";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    // Get tools for the authenticated user (if any)
    const userId = session?.user?.id;
    const { tools, mcpRegistry } = await getAllTools(userId);

    return Response.json({
      tools: Object.keys(tools),
      mcpRegistry,
    });
  } catch (error) {
    console.error("Failed to fetch tools:", error);
    return Response.json({ error: "Failed to fetch tools" }, { status: 500 });
  }
}
