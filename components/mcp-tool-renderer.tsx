"use client";

import type { MCPProgressNotification } from "@/lib/ai/mcp/progress-types";
import { MCPProgressIndicator } from "./mcp-progress-indicator";

type MCPToolRendererProps = {
  toolName: string;
  serverName: string;
  output: any;
  progressData?: MCPProgressNotification;
  isInProgress?: boolean;
};

export function MCPToolRenderer({
  toolName,
  serverName,
  output,
  progressData,
  isInProgress = false,
}: MCPToolRendererProps) {
  console.log("🎨 MCPToolRenderer:", {
    toolName,
    serverName,
    output,
    progressData,
    isInProgress,
  });

  // Show progress indicator if tool is in progress
  if (isInProgress && progressData) {
    return <MCPProgressIndicator progress={progressData} />;
  }

  // Handle different MCP tool types with custom UI
  const renderToolOutput = () => {
    switch (toolName) {
      case "greet":
        console.log("🎨 Rendering GreetingToolUI");
        return <GreetingToolUI output={output} progressData={progressData} />;

      default:
        console.log("🎨 Rendering GenericToolUI");
        return (
          <GenericToolUI
            output={output}
            progressData={progressData}
            toolName={toolName}
          />
        );
    }
  };

  return renderToolOutput();
}

function GreetingToolUI({
  output,
  progressData,
}: {
  output: any;
  progressData?: MCPProgressNotification;
}) {
  // Extract the greeting message from the MCP output
  const message =
    output?.structuredContent?.result ||
    output?.content?.[0]?.text ||
    (typeof output === "string" ? output : "Hello!");

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-muted">
          <span className="text-sm">👋</span>
        </div>
        <div>
          <h3 className="font-medium text-foreground text-sm">Greeting</h3>
          <p className="text-muted-foreground text-xs">MCP Tool Response</p>
        </div>
      </div>

      {progressData && (
        <div className="w-full">
          <MCPProgressIndicator progress={progressData} />
        </div>
      )}

      <div className="w-full">
        <p className="text-foreground">{message}</p>
      </div>
    </div>
  );
}

function GenericToolUI({
  toolName,
  output,
  progressData,
}: {
  toolName: string;
  output: any;
  progressData?: MCPProgressNotification;
}) {
  const displayOutput = () => {
    if (typeof output === "string") {
      return output;
    }

    // Try to extract meaningful content from structured output
    if (output?.structuredContent?.result) {
      return output.structuredContent.result;
    }

    if (output?.content?.[0]?.text) {
      return output.content[0].text;
    }

    // Fallback to JSON
    return JSON.stringify(output, null, 2);
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-muted">
          <span className="text-sm">🔧</span>
        </div>
        <div>
          <h3 className="font-medium text-foreground text-sm capitalize">
            {toolName}
          </h3>
          <p className="text-muted-foreground text-xs">MCP Tool Response</p>
        </div>
      </div>

      {progressData && (
        <div className="w-full">
          <MCPProgressIndicator progress={progressData} />
        </div>
      )}

      <div className="w-full">
        <div className="text-foreground">
          {typeof displayOutput() === "string" ? (
            <p className="whitespace-pre-wrap">{displayOutput()}</p>
          ) : (
            <pre className="overflow-x-auto font-mono text-muted-foreground text-xs">
              {JSON.stringify(displayOutput(), null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
