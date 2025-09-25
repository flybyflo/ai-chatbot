"use client";

import {
  transformerNotationDiff,
  transformerNotationFocus,
} from "@shikijs/transformers";
import { diffLines } from "diff";
import { FileIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type CodeComparisonProps = {
  beforeCode: string;
  afterCode: string;
  language: string;
  filename: string;
  lightTheme: string;
  darkTheme: string;
  highlightColor?: string;
};

// Top-level regex to detect any focused/diff classes in highlighted HTML
const FOCUS_CLASS_REGEX = /(\bfocused\b|\bfocus\b|\badd\b|\bremove\b|\bdiff\b)/;

export function CodeComparison({
  beforeCode,
  afterCode,
  language,
  filename,
  lightTheme,
  darkTheme,
  highlightColor = "#ff3333",
}: CodeComparisonProps) {
  const { theme, systemTheme } = useTheme();
  const [highlightedBefore, setHighlightedBefore] = useState("");
  const [highlightedAfter, setHighlightedAfter] = useState("");
  const [hasLeftFocus, setHasLeftFocus] = useState(false);
  const [hasRightFocus, setHasRightFocus] = useState(false);
  const beforeRef = useRef<HTMLDivElement | null>(null);
  const afterRef = useRef<HTMLDivElement | null>(null);

  const selectedTheme = useMemo(() => {
    const currentTheme = theme === "system" ? systemTheme : theme;
    return currentTheme === "dark" ? darkTheme : lightTheme;
  }, [theme, systemTheme, darkTheme, lightTheme]);

  useEffect(() => {
    if (highlightedBefore || highlightedAfter) {
      setHasLeftFocus(FOCUS_CLASS_REGEX.test(highlightedBefore));
      setHasRightFocus(FOCUS_CLASS_REGEX.test(highlightedAfter));
    }
  }, [highlightedBefore, highlightedAfter]);

  useEffect(() => {
    async function highlightCode() {
      try {
        const { codeToHtml } = await import("shiki");
        const { transformerNotationHighlight } = await import(
          "@shikijs/transformers"
        );

        // Compute line-based diff and annotate changed lines so shiki transformers
        // can apply classes: .add, .remove, and .focused for hover effects.
        const changes = diffLines(beforeCode ?? "", afterCode ?? "");
        const leftLines: string[] = [];
        const rightLines: string[] = [];

        for (const change of changes) {
          const lines = change.value.split("\n");
          const slice = lines.at(-1) === "" ? lines.slice(0, -1) : lines;

          if (change.added) {
            for (const ln of slice) {
              rightLines.push(`${ln} // [!code ++] [!code focus]`);
            }
          } else if (change.removed) {
            for (const ln of slice) {
              leftLines.push(`${ln} // [!code --] [!code focus]`);
            }
          } else {
            for (const ln of slice) {
              leftLines.push(ln);
              rightLines.push(ln);
            }
          }
        }

        const annotatedBefore = leftLines.join("\n");
        const annotatedAfter = rightLines.join("\n");

        const before = await codeToHtml(annotatedBefore, {
          lang: language,
          theme: selectedTheme,
          transformers: [
            transformerNotationHighlight({ matchAlgorithm: "v3" }),
            transformerNotationDiff({ matchAlgorithm: "v3" }),
            transformerNotationFocus({ matchAlgorithm: "v3" }),
          ],
        });
        const after = await codeToHtml(annotatedAfter, {
          lang: language,
          theme: selectedTheme,
          transformers: [
            transformerNotationHighlight({ matchAlgorithm: "v3" }),
            transformerNotationDiff({ matchAlgorithm: "v3" }),
            transformerNotationFocus({ matchAlgorithm: "v3" }),
          ],
        });
        setHighlightedBefore(before);
        setHighlightedAfter(after);
      } catch (error) {
        console.error("Error highlighting code:", error);
        setHighlightedBefore(`<pre>${beforeCode}</pre>`);
        setHighlightedAfter(`<pre>${afterCode}</pre>`);
      }
    }
    highlightCode();
  }, [beforeCode, afterCode, language, selectedTheme]);

  const renderCode = (
    code: string,
    highlighted: string,
    side: "before" | "after"
  ) => {
    if (highlighted) {
      return (
        <div
          className={cn(
            "h-full w-full overflow-auto bg-background font-mono text-xs",
            "[&>pre]:!w-screen [&>pre]:h-full [&>pre]:py-2",
            "[&>pre>code]:!inline-block [&>pre>code]:!w-full",
            "[&>pre>code>span]:!inline-block [&>pre>code>span]:w-full [&>pre>code>span]:px-4 [&>pre>code>span]:py-0.5",
            "[&>pre>code>.highlighted]:!bg-[var(--highlight-color)] [&>pre>code>.highlighted]:inline-block [&>pre>code>.highlighted]:w-full",
            "group-hover/left:[&>pre>code>:not(.focused)]:!opacity-100 group-hover/left:[&>pre>code>:not(.focused)]:!blur-none",
            "group-hover/right:[&>pre>code>:not(.focused)]:!opacity-100 group-hover/right:[&>pre>code>:not(.focused)]:!blur-none",
            "[&>pre>code>.add]:bg-[rgba(16,185,129,.16)] [&>pre>code>.remove]:bg-[rgba(244,63,94,.16)]",
            "group-hover/left:[&>pre>code>:not(.focused)]:transition-all group-hover/left:[&>pre>code>:not(.focused)]:duration-300",
            "group-hover/right:[&>pre>code>:not(.focused)]:transition-all group-hover/right:[&>pre>code>:not(.focused)]:duration-300"
          )}
          ref={side === "before" ? beforeRef : afterRef}
          style={{ "--highlight-color": highlightColor } as React.CSSProperties}
        />
      );
    }
    return (
      <pre className="h-full overflow-auto break-all bg-background p-4 font-mono text-foreground text-xs">
        {code}
      </pre>
    );
  };

  // Inject highlighted HTML without using dangerouslySetInnerHTML
  useEffect(() => {
    if (beforeRef.current && highlightedBefore) {
      beforeRef.current.innerHTML = highlightedBefore;
    }
  }, [highlightedBefore]);
  useEffect(() => {
    if (afterRef.current && highlightedAfter) {
      afterRef.current.innerHTML = highlightedAfter;
    }
  }, [highlightedAfter]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="group relative w-full overflow-hidden rounded-md border border-border">
        <div className="relative grid md:grid-cols-2">
          <div
            className={cn(
              "leftside group/left border-primary/20 md:border-r",
              hasLeftFocus &&
                "[&>div>pre>code>:not(.focused)]:!opacity-50 [&>div>pre>code>:not(.focused)]:!blur-[0.095rem]",
              "[&>div>pre>code>:not(.focused)]:transition-all [&>div>pre>code>:not(.focused)]:duration-300"
            )}
          >
            <div className="flex items-center border-primary/20 border-b bg-accent p-2 text-foreground text-sm">
              <FileIcon className="mr-2 h-4 w-4" />
              {filename}
              <span className="ml-auto hidden md:block">before</span>
            </div>
            {renderCode(beforeCode, highlightedBefore, "before")}
          </div>
          <div
            className={cn(
              "rightside group/right border-primary/20 border-t md:border-t-0",
              hasRightFocus &&
                "[&>div>pre>code>:not(.focused)]:!opacity-50 [&>div>pre>code>:not(.focused)]:!blur-[0.095rem]",
              "[&>div>pre>code>:not(.focused)]:transition-all [&>div>pre>code>:not(.focused)]:duration-300"
            )}
          >
            <div className="flex items-center border-primary/20 border-b bg-accent p-2 text-foreground text-sm">
              <FileIcon className="mr-2 h-4 w-4" />
              {filename}
              <span className="ml-auto hidden md:block">after</span>
            </div>
            {renderCode(afterCode, highlightedAfter, "after")}
          </div>
        </div>
        <div className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 left-1/2 hidden h-8 w-8 items-center justify-center rounded-md border border-primary/20 bg-accent text-foreground text-xs md:flex">
          VS
        </div>
      </div>
    </div>
  );
}
