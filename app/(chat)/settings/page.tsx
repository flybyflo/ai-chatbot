"use client";

export const dynamic = "force-dynamic";

import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";

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
    name: "Loadouts",
    description:
      "Create and manage loadouts to quickly configure tools and agents.",
    href: "/settings/loadouts",
    cta: "Manage Loadouts",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-blue-100 dark:from-purple-950/20 dark:to-blue-900/20" />
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
  {
    Icon: () => null,
    name: "A2A Servers",
    description: "Configure and manage A2A agent card servers.",
    href: "/settings/a2a-servers",
    cta: "Configure Servers",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/20 dark:to-orange-900/20" />
    ),
    className: "lg:col-span-1",
  },
  {
    Icon: () => null,
    name: "A2A Agents",
    description: "Browse agent capabilities and registry.",
    href: "/settings/a2a-agents",
    cta: "View Agents",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-950/20 dark:to-amber-900/20" />
    ),
    className: "lg:col-span-1",
  },
  {
    Icon: () => null,
    name: "A2A Tasks",
    description: "Monitor task execution and artifacts.",
    href: "/settings/a2a-tasks",
    cta: "View Tasks",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-red-100 dark:from-orange-950/20 dark:to-red-900/20" />
    ),
    className: "lg:col-span-1",
  },
  {
    Icon: () => null,
    name: "A2A Events",
    description: "Debug A2A protocol interactions.",
    href: "/settings/a2a-events",
    cta: "View Events",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-rose-50 to-pink-100 dark:from-rose-950/20 dark:to-pink-900/20" />
    ),
    className: "lg:col-span-1",
  },
  {
    Icon: () => null,
    name: "Auth & Tokens",
    description: "Mint MCP tokens and inspect Better Auth session details.",
    href: "/settings/auth",
    cta: "Open Console",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-950/20 dark:to-slate-900/20" />
    ),
    className: "lg:col-span-1",
  },
];

export default function SettingsPage() {
  return (
    <div className="mb-8">
      <h1 className="font-bold text-3xl text-foreground">Settings</h1>
      <p className="my-2 text-muted-foreground">
        Configure your AI assistant and manage your preferences.
      </p>

      <BentoGrid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {settingsFeatures.map((feature) => (
          <BentoCard key={feature.name} {...feature} />
        ))}
      </BentoGrid>
    </div>
  );
}
