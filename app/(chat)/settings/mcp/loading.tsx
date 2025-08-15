import { MCPServerSkeleton } from '@/components/options/mcp-server-skeleton';

export default function MCPSettingsLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-semibold">MCP Servers</h1>
          <p className="text-sm text-muted-foreground">
            Manage Model Context Protocol servers to extend AI capabilities
          </p>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <div className="p-4 max-w-4xl mx-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">MCP Servers</h3>
              <div className="h-6 w-12 bg-muted rounded animate-pulse" />
            </div>
            <div className="grid gap-2">
              {[1, 2, 3].map((i) => (
                <MCPServerSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}