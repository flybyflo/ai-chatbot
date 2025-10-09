import { tool } from "ai";
import { z } from "zod";

// A local tool that carries PlantUML code to the UI for rich rendering.
// It does not render the diagram; it simply echoes validated inputs so the UI can render
// both the source code and the rendered diagram using the PlantUMLViewer component.
export const plantuml = tool({
  description:
    "Render PlantUML diagrams with source code and visual representation.",
  inputSchema: z.object({
    code: z.string().min(1, "PlantUML code is required"),
    title: z.string().default("PlantUML Diagram"),
    language: z.string().default("plantuml"),
    lightTheme: z.string().default("github-light"),
    darkTheme: z.string().default("github-dark"),
  }),
  execute: (input) => {
    // Pass-through payload; the UI will render this with PlantUMLViewer.
    return input;
  },
});
