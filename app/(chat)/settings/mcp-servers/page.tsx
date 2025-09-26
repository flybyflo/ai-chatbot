import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { MCPServerManager } from "@/components/mcp-server-manager";

export default async function MCPServersPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex h-dvh min-w-0 flex-col bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-4 md:p-6">
          <MCPServerManager />
        </div>
      </div>
    </div>
  );
}
