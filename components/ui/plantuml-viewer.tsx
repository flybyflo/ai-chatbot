"use client";

import { FileIcon, Code, Eye, Download } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { encode } from "plantuml-encoder";

import { cn } from "@/lib/utils";
import { Button } from "./button";

type PlantUMLViewerProps = {
  code: string;
  title: string;
  language: string;
  lightTheme: string;
  darkTheme: string;
};

export function PlantUMLViewer({
  code,
  title,
  language,
  lightTheme,
  darkTheme,
}: PlantUMLViewerProps) {
  const { theme, systemTheme } = useTheme();
  const [highlightedCode, setHighlightedCode] = useState("");
  const [viewMode, setViewMode] = useState<"code" | "diagram">("diagram");
  const [diagramUrl, setDiagramUrl] = useState("");
  const [diagramError, setDiagramError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoadingDiagram, setIsLoadingDiagram] = useState(true);

  const selectedTheme = useMemo(() => {
    const currentTheme = theme === "system" ? systemTheme : theme;
    return currentTheme === "dark" ? darkTheme : lightTheme;
  }, [theme, systemTheme, darkTheme, lightTheme]);

  // Generate PlantUML diagram URL
  useEffect(() => {
    try {
      const encoded = encode(code);
      setDiagramUrl(`https://www.plantuml.com/plantuml/svg/${encoded}`);
      setDiagramError(false);
      setErrorMessage("");
      setIsLoadingDiagram(true);
    } catch (error) {
      const errorMsg = `PlantUML encoding error: ${error instanceof Error ? error.message : "Unknown encoding error"}`;
      console.error("Error encoding PlantUML:", error);
      setDiagramError(true);
      setErrorMessage(errorMsg);
      setIsLoadingDiagram(false);
    }
  }, [code]);

  // Highlight code using Shiki
  useEffect(() => {
    async function highlightCode() {
      try {
        const { codeToHtml, createHighlighter } = await import("shiki");

        if (language === "plantuml") {
          // Load PlantUML grammar from external source
          try {
            const grammarResponse = await fetch(
              "https://raw.githubusercontent.com/theia-ide/theia-plantuml-extension/master/plantuml/data/plantuml.tmLanguage.json"
            );
            const grammarData = await grammarResponse.json();

            const highlighter = await createHighlighter({
              themes: [selectedTheme],
              langs: [grammarData],
            });

            const highlighted = await highlighter.codeToHtml(code, {
              lang: "plantuml",
              theme: selectedTheme,
            });
            setHighlightedCode(highlighted);
          } catch (grammarError) {
            console.warn("Failed to load PlantUML grammar, falling back to text:", grammarError);
            // Fallback to basic text highlighting
            const highlighted = await codeToHtml(code, {
              lang: "text",
              theme: selectedTheme,
            });
            setHighlightedCode(highlighted);
          }
        } else {
          const highlighted = await codeToHtml(code, {
            lang: language,
            theme: selectedTheme,
          });
          setHighlightedCode(highlighted);
        }
      } catch (error) {
        console.error("Error highlighting code:", error);
        setHighlightedCode(`<pre>${code}</pre>`);
      }
    }
    highlightCode();
  }, [code, language, selectedTheme]);

  // Handle download of PlantUML source code
  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}.puml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderContent = () => {
    if (viewMode === "code") {
      if (highlightedCode) {
        return (
          <div
            className={cn(
              "h-full w-full overflow-auto bg-background font-mono text-xs",
              "[&>pre]:!w-screen [&>pre]:h-full [&>pre]:py-2",
              "[&>pre>code]:!inline-block [&>pre>code]:!w-full",
              "[&>pre>code>span]:!inline-block [&>pre>code>span]:w-full [&>pre>code>span]:px-4 [&>pre>code>span]:py-0.5"
            )}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki generates safe HTML
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        );
      }
      return (
        <pre className="h-full overflow-auto break-all bg-background p-4 font-mono text-foreground text-xs">
          {code}
        </pre>
      );
    }

    // Diagram view
    return (
      <div className="flex h-full items-center justify-center bg-background p-4">
        {diagramError ? (
          <div className="text-center text-destructive max-w-2xl">
            <div className="mb-2 text-lg">⚠️ Diagram Error</div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap text-left bg-muted/50 p-4 rounded-md">
              {errorMessage || "Failed to generate PlantUML diagram. Please check your PlantUML syntax."}
            </div>
            <div className="mt-3">
              <button
                onClick={() => setViewMode("code")}
                className="text-primary hover:underline text-sm"
                type="button"
              >
                View source code to fix errors
              </button>
            </div>
          </div>
        ) : diagramUrl ? (
          <img
            src={diagramUrl}
            alt="PlantUML Diagram"
            className="max-h-full max-w-full object-contain"
            onLoad={() => setIsLoadingDiagram(false)}
            onError={(e) => {
              const errorDetails = {
                url: diagramUrl,
                code: code,
                timestamp: new Date().toISOString(),
                error: "Failed to load PlantUML diagram from server"
              };

              const errorMsg = `PlantUML diagram generation failed. This usually indicates invalid PlantUML syntax. Please check the PlantUML code for syntax errors such as:
- Missing @startuml/@enduml tags
- Incorrect relationship syntax (use --> or -> for connections)
- Invalid element names or keywords
- Malformed class/sequence/activity diagram syntax

Code that failed:
\`\`\`
${code}
\`\`\`

Please correct the PlantUML syntax and try again.`;

              console.error("Failed to load PlantUML diagram:", errorDetails);
              setDiagramError(true);
              setErrorMessage(errorMsg);
              setIsLoadingDiagram(false);
            }}
          />
        ) : isLoadingDiagram ? (
          <div className="text-muted-foreground">Loading diagram...</div>
        ) : (
          <div className="text-muted-foreground">No diagram to display</div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="group relative w-full overflow-hidden rounded-[1.3rem] border border-border">
        <div className="relative">
          <div className="flex items-center justify-between border-primary/20 border-b bg-accent p-2 text-foreground text-sm">
            <div className="flex items-center">
              <FileIcon className="mr-2 h-4 w-4" />
              {title}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setViewMode("code")}
                size="sm"
                variant={viewMode === "code" ? "default" : "ghost"}
                className="h-6 px-2 text-xs"
              >
                <Code className="mr-1 h-3 w-3" />
                Code
              </Button>
              <Button
                onClick={() => setViewMode("diagram")}
                size="sm"
                variant={viewMode === "diagram" ? "default" : "ghost"}
                className={`h-6 px-2 text-xs ${diagramError ? "text-destructive" : ""}`}
              >
                <Eye className="mr-1 h-3 w-3" />
                Diagram
                {diagramError && <span className="ml-1">⚠️</span>}
              </Button>
              <Button
                onClick={handleDownload}
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                title="Download PlantUML source code"
              >
                <Download className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="min-h-96">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}