"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useA2AServers } from "@/hooks/use-a2a-servers";
import { useMCPServers } from "@/hooks/use-mcp-servers";

const breadcrumbMap: Record<string, string> = {
  "/settings": "Settings",
  "/settings/memory": "Memory",
  "/settings/loadouts": "Loadouts",
  "/settings/mcp-servers": "MCP Servers",
  "/settings/a2a-servers": "A2A Servers",
  "/settings/a2a-agents": "A2A Agents",
  "/settings/a2a-tasks": "A2A Tasks",
  "/settings/a2a-events": "A2A Events",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { servers: mcpServers } = useMCPServers();
  const { servers: a2aServers } = useA2AServers();

  // Generate breadcrumbs based on current path
  const generateBreadcrumbs = () => {
    const segments = pathname.split("/").filter(Boolean);
    const breadcrumbs = [
      { href: "/", label: "Home" },
      { href: "/settings", label: "Settings" },
    ];

    // Add dynamic segments
    let currentPath = "/settings";
    for (let i = 1; i < segments.length; i++) {
      currentPath += `/${segments[i]}`;

      // Handle MCP server detail pages
      if (
        currentPath.startsWith("/settings/mcp-servers/") &&
        segments.length > 3
      ) {
        const serverId = segments[3];
        const server = mcpServers.find((s) => s.id === serverId);
        const label = server?.name || "MCP Server";
        breadcrumbs.push({
          href: currentPath,
          label,
        });
      } else if (
        currentPath.startsWith("/settings/a2a-servers/") &&
        segments.length > 3
      ) {
        // Handle A2A server detail pages
        const serverId = segments[3];
        const server = a2aServers.find((s) => s.id === serverId);
        const label = server?.name || "A2A Server";
        breadcrumbs.push({
          href: currentPath,
          label,
        });
      } else {
        const label = breadcrumbMap[currentPath] || segments[i];
        breadcrumbs.push({
          href: currentPath,
          label,
        });
      }
    }

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <div className="flex h-dvh min-w-0 flex-col bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-4 md:p-6">
          <div className="mb-6">
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((breadcrumb, index) => (
                  <div className="flex items-center" key={breadcrumb.href}>
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {index === breadcrumbs.length - 1 ? (
                        <BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link href={breadcrumb.href}>{breadcrumb.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </div>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
