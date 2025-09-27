import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const settingsFeatures = [
  {
    Icon: () => null,
    name: "Memory Management",
    description:
      "Manage your chat memory and personal context for better AI interactions.",
    href: "/settings/memory",
    cta: "Manage Memory",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/20 dark:to-indigo-900/20" />
    ),
    className: "lg:col-span-1",
  },
  {
    Icon: () => null,
    name: "MCP Servers",
    description:
      "Configure and manage Model Context Protocol servers for extended functionality.",
    href: "/settings/mcp-servers",
    cta: "Configure Servers",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950/20 dark:to-emerald-900/20" />
    ),
    className: "lg:col-span-1",
  },
];

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex h-dvh min-w-0 flex-col bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-4 md:p-6">
          <div className="mb-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Settings</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="mb-8">
            <h1 className="font-bold text-3xl text-foreground">Settings</h1>
            <p className="mt-2 text-muted-foreground">
              Configure your AI assistant and manage your preferences.
            </p>
          </div>

          <BentoGrid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
            {settingsFeatures.map((feature) => (
              <BentoCard key={feature.name} {...feature} />
            ))}
          </BentoGrid>
        </div>
      </div>
    </div>
  );
}
