"use client";

import { Code, Download, Eye, FileIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { Button } from "./button";
import { Textarea } from "./textarea";

type PlantUMLViewerProps = {
  code: string;
  title: string;
  language: string;
  lightTheme: string;
  darkTheme: string;
};

export function PlantUMLViewer(props: PlantUMLViewerProps) {
  const { code, title } = props;
  const [viewMode, setViewMode] = useState<"code" | "diagram">("diagram");
  const [diagramSvg, setDiagramSvg] = useState("");
  const [diagramError, setDiagramError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoadingDiagram, setIsLoadingDiagram] = useState(true);
  const [currentCode, setCurrentCode] = useState(code);
  const [draftCode, setDraftCode] = useState(code);
  // Removed: svgContainerRef (no longer needed when using Next Image)

  const diagramDataUrl = useMemo(() => {
    if (!diagramSvg) {
      return null;
    }
    // Encode SVG as data URL for safe rendering via Next Image
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(diagramSvg)}`;
  }, [diagramSvg]);

  // Update local state when code prop changes
  useEffect(() => {
    setCurrentCode(code);
    setDraftCode(code);
  }, [code]);

  // Debounce edits in Code tab to update the rendered diagram
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentCode(draftCode);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [draftCode]);

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
          throw new Error(
            errorData.message ||
              `HTTP ${response.status}: ${response.statusText}`
          );
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
        setDiagramError(true);
        setErrorMessage(errorMsg);
        setIsLoadingDiagram(false);
      }
    }

    generateDiagram();
  }, [currentCode]);

  // (Removed direct SVG injection; using Next Image for safe scaling and centering.)

  // (Removed Shiki highlighting for inline editing simplicity.)

  // Handle download of PlantUML source code
  const handleDownloadCode = () => {
    const blob = new Blob([draftCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}.puml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle download of diagram as SVG
  const handleDownloadDiagram = () => {
    if (!diagramSvg) {
      return;
    }
    const blob = new Blob([diagramSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderContent = () => {
    if (viewMode === "code") {
      return (
        <div className="flex h-full flex-col bg-background">
          <Textarea
            className="flex-1 resize-none rounded-none border-0 font-mono text-xs focus-visible:ring-0"
            onChange={(e) => setDraftCode(e.target.value)}
            placeholder="Enter PlantUML code here..."
            value={draftCode}
          />
        </div>
      );
    }

    // Diagram view
    return (
      <div className="flex h-full items-center justify-center bg-background">
        {diagramError ? (
          <div className="max-h-full max-w-2xl overflow-y-auto p-4 text-center text-destructive">
            <div className="mb-2 text-lg">⚠️ Diagram Error</div>
            <div className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/50 p-4 text-left text-muted-foreground text-sm">
              {errorMessage ||
                "Failed to generate PlantUML diagram. Please check your PlantUML syntax."}
            </div>
            <div className="mt-3">
              <button
                className="text-primary text-sm hover:underline"
                onClick={() => setViewMode("code")}
                type="button"
              >
                View source code to fix errors
              </button>
            </div>
          </div>
        ) : diagramSvg ? (
          <div className="relative h-full w-full">
            {isLoadingDiagram && (
              <div className="absolute top-2 right-2 z-10 rounded-md bg-background/80 px-2 py-1 text-muted-foreground text-xs backdrop-blur-sm">
                Updating...
              </div>
            )}
            <div
              className="relative h-full w-full p-2"
              style={{ overflow: "hidden" }}
            >
              {diagramDataUrl && (
                <Image
                  alt={`${title} diagram`}
                  fill
                  sizes="100vw"
                  src={diagramDataUrl}
                  style={{ objectFit: "contain" }}
                  unoptimized
                />
              )}
            </div>
          </div>
        ) : isLoadingDiagram ? (
          <div className="text-muted-foreground">Loading diagram...</div>
        ) : (
          <div className="text-muted-foreground">No diagram to display</div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto h-96 w-full max-w-5xl">
      <div className="group relative h-full w-full overflow-hidden rounded-[1.3rem] border border-border">
        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between border-primary/20 border-b bg-accent p-2 text-foreground text-sm">
            <div className="flex items-center">
              <FileIcon className="mr-2 h-4 w-4" />
              {title}
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="h-6 px-2 text-xs"
                onClick={() => setViewMode("code")}
                size="sm"
                variant={viewMode === "code" ? "default" : "ghost"}
              >
                <Code className="mr-1 h-3 w-3" />
                Code
              </Button>
              <Button
                className={`h-6 px-2 text-xs ${diagramError ? "text-destructive" : ""}`}
                onClick={() => setViewMode("diagram")}
                size="sm"
                variant={viewMode === "diagram" ? "default" : "ghost"}
              >
                <Eye className="mr-1 h-3 w-3" />
                Diagram
                {diagramError && <span className="ml-1">⚠️</span>}
              </Button>
              <Button
                className="h-6 px-2 text-xs"
                onClick={handleDownloadCode}
                size="sm"
                title="Download PlantUML source code"
                variant="ghost"
              >
                <Download className="mr-1 h-3 w-3" />
                Code
              </Button>
              <Button
                className="h-6 px-2 text-xs"
                disabled={!diagramSvg || diagramError}
                onClick={handleDownloadDiagram}
                size="sm"
                title="Download diagram as SVG"
                variant="ghost"
              >
                <Download className="mr-1 h-3 w-3" />
                SVG
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1">{renderContent()}</div>
        </div>
      </div>
    </div>
  );
}
