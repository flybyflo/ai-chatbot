"use client";

import type { ToolUIPart } from "ai";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  CopyIcon,
  XCircleIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./code-block";

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn("not-prose w-full rounded-[1.3rem] bg-sidebar", className)}
    {...props}
  />
);

export type ToolHeaderProps = {
  type: string;
  state: ToolUIPart["state"];
  className?: string;
  inputParams?: Record<string, any>;
};

const getStatusBadge = (status: ToolUIPart["state"]) => {
  const labels = {
    "input-streaming": "Pending",
    "input-available": "Running",
    "output-available": "Completed",
    "output-error": "Error",
  } as const;

  const icons = {
    "input-streaming": <CircleIcon className="size-4" />,
    "input-available": <ClockIcon className="size-4 animate-pulse" />,
    "output-available": <CheckCircleIcon className="size-4 text-green-600" />,
    "output-error": <XCircleIcon className="size-4 text-red-600" />,
  } as const;

  return (
    <Badge
      className="flex items-center gap-1 rounded-full text-xs"
      variant="secondary"
    >
      {icons[status]}
      <span>{labels[status]}</span>
    </Badge>
  );
};

export const ToolHeader = ({
  className,
  type,
  state,
  inputParams,
  ...props
}: ToolHeaderProps) => (
  <CollapsibleTrigger
    className={cn(
      "flex w-full min-w-0 items-center justify-between gap-2 p-3",
      className
    )}
    {...props}
  >
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="truncate pl-2 font-medium text-sm">{type}</span>
      {inputParams && Object.keys(inputParams).length > 0 && (
        <div className="-ml-1">
          <Badge className="text-xs" variant="secondary">
            {Object.entries(inputParams)
              .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
              .join(", ")}
          </Badge>
        </div>
      )}
    </div>
    <div className="flex shrink-0 items-center gap-2">
      {getStatusBadge(state)}
      <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
    </div>
  </CollapsibleTrigger>
);

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 w-full text-popover-foreground outline-hidden data-[state=closed]:animate-out data-[state=open]:animate-in",
      className
    )}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolUIPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => {
  const jsonString = JSON.stringify(input, null, 2);
  const shouldTruncate = jsonString.length > 20;

  const truncatedJson = shouldTruncate
    ? `${jsonString.slice(0, 20)}...`
    : jsonString;

  return (
    <div
      className={cn("w-full space-y-2 overflow-hidden p-4", className)}
      {...props}
    >
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        Parameters
      </h4>
      <div className="w-full rounded-md bg-muted/50">
        <CodeBlock code={truncatedJson} language="json" />
      </div>
    </div>
  );
};

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ReactNode;
  errorText: ToolUIPart["errorText"];
};

export const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  const [isCopied, setIsCopied] = useState(false);

  if (!(output || errorText)) {
    return null;
  }

  // Extract the JSON string from the output if it's a CodeBlock with JSON
  const extractJsonFromOutput = (outputNode: ReactNode): string | null => {
    if (React.isValidElement(outputNode)) {
      const children = outputNode.props.children;
      if (React.isValidElement(children) && children.type === CodeBlock) {
        return (children.props as { code: string }).code;
      }
    }
    return null;
  };

  const jsonString = extractJsonFromOutput(output);
  const shouldTruncate = jsonString && jsonString.split("\n").length > 100;

  const copyFullOutput = async () => {
    if (!jsonString) {
      return;
    }

    try {
      await navigator.clipboard.writeText(jsonString);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <div className={cn("w-full space-y-2 p-4", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {errorText ? "Error" : "Result"}
      </h4>
      <div
        className={cn(
          "w-full overflow-x-auto rounded-md text-xs [&_table]:w-full",
          errorText
            ? "bg-destructive/10 text-destructive"
            : "bg-muted/50 text-foreground"
        )}
      >
        {errorText && <div>{errorText}</div>}
        {output && (
          <div>
            {shouldTruncate ? (
              <div className="rounded-md bg-muted/50 p-4">
                <div className="mb-3 text-muted-foreground text-sm">
                  Output is too large to display (
                  {jsonString?.split("\n").length} lines)
                </div>
                <div className="flex justify-end">
                  <Button
                    className="text-xs"
                    onClick={copyFullOutput}
                    size="sm"
                    variant="outline"
                  >
                    {isCopied ? (
                      <>
                        <CheckCircleIcon className="mr-1 size-3" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <CopyIcon className="mr-1 size-3" />
                        Copy Full Output
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div>{output}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
