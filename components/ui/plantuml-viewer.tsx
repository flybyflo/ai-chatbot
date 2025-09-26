"use client";

import { FileIcon, Code, Eye, Download, Edit, Save, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Textarea } from "./textarea";

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
  const [diagramSvg, setDiagramSvg] = useState("");
  const [diagramError, setDiagramError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoadingDiagram, setIsLoadingDiagram] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(code);
  const [currentCode, setCurrentCode] = useState(code);

  const selectedTheme = useMemo(() => {
    const currentTheme = theme === "system" ? systemTheme : theme;
    return currentTheme === "dark" ? darkTheme : lightTheme;
  }, [theme, systemTheme, darkTheme, lightTheme]);

  // Update local state when code prop changes
  useEffect(() => {
    setCurrentCode(code);
    setEditedCode(code);
  }, [code]);

  // Generate PlantUML diagram using backend API
  useEffect(() => {
    async function generateDiagram() {
      if (!currentCode.trim()) {
        setDiagramSvg("");
        setIsLoadingDiagram(false);
        return;
      }

      setIsLoadingDiagram(true);
      setDiagramError(false);
      setErrorMessage("");

      try {
        const response = await fetch("/api/plantuml", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: currentCode,
            format: "svg",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const svg = await response.text();
        setDiagramSvg(svg);
        setIsLoadingDiagram(false);
      } catch (error) {
        const errorMsg = `PlantUML rendering error: ${error instanceof Error ? error.message : "Failed to render diagram"}.

Common issues:
- Missing @startuml/@enduml tags
- Invalid syntax in diagram code
- Unsupported PlantUML features

Code that failed:
\`\`\`
${currentCode}
\`\`\`

Please check your PlantUML syntax and try again.`;

        console.error("Error generating PlantUML diagram:", error);
        setDiagramError(true);
        setErrorMessage(errorMsg);
        setIsLoadingDiagram(false);
      }
    }

    generateDiagram();
  }, [currentCode]);

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
        setHighlightedCode(`<pre>${currentCode}</pre>`);
      }
    }
    highlightCode();
  }, [currentCode, language, selectedTheme]);

  // Handle download of PlantUML source code
  const handleDownload = () => {
    const blob = new Blob([currentCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}.puml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle editing mode
  const handleStartEdit = () => {
    setIsEditing(true);
    setEditedCode(currentCode);
  };

  const handleSaveEdit = () => {
    setCurrentCode(editedCode);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedCode(currentCode);
    setIsEditing(false);
  };

  const renderContent = () => {
    if (viewMode === "code") {
      if (isEditing) {
        return (
          <div className="h-full flex flex-col bg-background">
            <Textarea
              value={editedCode}
              onChange={(e) => setEditedCode(e.target.value)}
              className="flex-1 font-mono text-xs resize-none border-0 focus-visible:ring-0 rounded-none"
              placeholder="Enter PlantUML code here..."
            />
            <div className="flex justify-end gap-2 p-2 border-t border-border">
              <Button onClick={handleCancelEdit} size="sm" variant="outline">
                <X className="mr-1 h-3 w-3" />
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} size="sm">
                <Save className="mr-1 h-3 w-3" />
                Apply Changes
              </Button>
            </div>
          </div>
        );
      }

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
          {currentCode}
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
        ) : diagramSvg ? (
          <div
            className="max-h-full max-w-full flex items-center justify-center"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG content is generated by PlantUML library
            dangerouslySetInnerHTML={{ __html: diagramSvg }}
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
              {viewMode === "code" && !isEditing && (
                <Button
                  onClick={handleStartEdit}
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  title="Edit PlantUML code"
                >
                  <Edit className="h-3 w-3" />
                </Button>
              )}
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