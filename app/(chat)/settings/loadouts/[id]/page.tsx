"use client";

import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLoadouts } from "@/hooks/use-loadouts";
import { useAllTools } from "@/hooks/use-tools";

const PRESET_COLORS = [
  "#8b5cf6", // purple
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#6366f1", // indigo
  "#14b8a6", // teal
];

export default function LoadoutEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const { loadouts, updateLoadout } = useLoadouts();
  const { tools: allTools } = useAllTools();

  const loadout = loadouts.find((l) => l.id === resolvedParams.id);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#8b5cf6");
  const [tags, setTags] = useState("");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Separate tools by type
  const localTools = useMemo(
    () => allTools.filter((tool) => tool.type === "local"),
    [allTools]
  );

  const mcpTools = useMemo(
    () => allTools.filter((tool) => tool.type === "mcp"),
    [allTools]
  );

  const agentTools = useMemo(
    () => allTools.filter((tool) => tool.type === "a2a"),
    [allTools]
  );

  useEffect(() => {
    if (loadout) {
      setName(loadout.name);
      setDescription(loadout.description || "");
      setColor(loadout.color || "#8b5cf6");
      setTags(loadout.tags?.join(", ") || "");
      setSelectedTools(loadout.selectedTools || []);
    }
  }, [loadout]);

  // Auto-save function
  const autoSave = useCallback(async () => {
    if (!loadout || !name.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await updateLoadout({
        id: loadout.id,
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        selectedTools,
      });
      setLastSaved(new Date());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to auto-save loadout"
      );
    } finally {
      setIsSaving(false);
    }
  }, [loadout, name, description, color, tags, selectedTools, updateLoadout]);

  // Trigger auto-save on changes
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 1000); // Auto-save after 1 second of inactivity

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [autoSave]);

  const handleToolToggle = (toolId: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolId)
        ? prev.filter((id) => id !== toolId)
        : [...prev, toolId]
    );
  };

  if (!loadout) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 font-semibold text-lg">Loadout not found</h2>
          <Button asChild size="sm">
            <Link href="/settings/loadouts">Back to Loadouts</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div
          className="size-12 rounded-lg"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1">
          <h1 className="font-bold text-2xl">Edit Loadout</h1>
          <p className="text-muted-foreground">
            Configure tools and agents for this loadout
          </p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          {isSaving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : lastSaved ? (
            <>
              <Check className="size-4 text-green-500" />
              <span>Saved</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="space-y-6 rounded-lg border p-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Basic Information</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                onChange={(e) => setName(e.target.value)}
                value={name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                onChange={(e) => setTags(e.target.value)}
                placeholder="research, prod, dev"
                value={tags}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this loadout..."
              rows={2}
              value={description}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  className="size-10 rounded-lg border-2 transition-all hover:scale-110"
                  key={presetColor}
                  onClick={() => setColor(presetColor)}
                  style={{
                    backgroundColor: presetColor,
                    borderColor:
                      color === presetColor ? "currentColor" : "transparent",
                  }}
                  type="button"
                />
              ))}
              <Input
                className="w-24"
                id="color"
                onChange={(e) => setColor(e.target.value)}
                type="color"
                value={color}
              />
            </div>
          </div>
        </div>

        {/* Local Tools */}
        <div className="space-y-4 border-border border-t pt-6">
          <h2 className="font-semibold text-lg">Local Tools</h2>
          <div className="grid gap-3">
            {localTools.map((tool) => (
              <div className="flex items-center space-x-2" key={tool.id}>
                <Checkbox
                  checked={selectedTools.includes(tool.id)}
                  id={tool.id}
                  onCheckedChange={() => handleToolToggle(tool.id)}
                />
                <label
                  className="cursor-pointer text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  htmlFor={tool.id}
                >
                  <div className="font-medium">{tool.name}</div>
                  {tool.description && (
                    <div className="text-muted-foreground text-xs">
                      {tool.description}
                    </div>
                  )}
                </label>
              </div>
            ))}
            {localTools.length === 0 && (
              <p className="text-center text-muted-foreground text-sm">
                No local tools available
              </p>
            )}
          </div>
        </div>

        {/* MCP Tools */}
        <div className="space-y-4 border-border border-t pt-6">
          <h2 className="font-semibold text-lg">MCP Tools</h2>
          <div className="grid gap-3">
            {mcpTools.map((tool) => (
              <div className="flex items-center space-x-2" key={tool.id}>
                <Checkbox
                  checked={selectedTools.includes(tool.id)}
                  id={tool.id}
                  onCheckedChange={() => handleToolToggle(tool.id)}
                />
                <label
                  className="cursor-pointer text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  htmlFor={tool.id}
                >
                  <div className="font-medium">{tool.name}</div>
                  {tool.description && (
                    <div className="text-muted-foreground text-xs">
                      {tool.description}
                    </div>
                  )}
                </label>
              </div>
            ))}
            {mcpTools.length === 0 && (
              <p className="text-center text-muted-foreground text-sm">
                No MCP tools available
              </p>
            )}
          </div>
        </div>

        {/* A2A Agents */}
        <div className="space-y-4 border-border border-t pt-6">
          <h2 className="font-semibold text-lg">A2A Agents</h2>
          <div className="grid gap-3">
            {agentTools.map((tool) => (
              <div className="flex items-center space-x-2" key={tool.id}>
                <Checkbox
                  checked={selectedTools.includes(tool.id)}
                  id={tool.id}
                  onCheckedChange={() => handleToolToggle(tool.id)}
                />
                <label
                  className="cursor-pointer text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  htmlFor={tool.id}
                >
                  <div className="font-medium">{tool.name}</div>
                  {tool.description && (
                    <div className="text-muted-foreground text-xs">
                      {tool.description}
                    </div>
                  )}
                </label>
              </div>
            ))}
            {agentTools.length === 0 && (
              <p className="text-center text-muted-foreground text-sm">
                No A2A agents available
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
