import { tool } from "ai";
import { z } from "zod";

// A local tool that carries structured diff metadata to the UI for rich rendering.
// It does not compute a diff; it simply echoes validated inputs so the UI can render
// a side-by-side comparison using the CodeComparison component.
export const codeCompare = tool({
  description:
    "Render a side-by-side code comparison for a file (before vs after).",
  inputSchema: z.object({
    filename: z.string().min(1, "filename is required"),
    beforeCode: z.string(),
    afterCode: z.string(),
    language: z.string().default("plaintext"),
    lightTheme: z.string().default("github-light"),
    darkTheme: z.string().default("github-dark"),
    highlightColor: z.string().optional(),
  }),
  execute: (input) => {
    // Pass-through payload; the UI will render this with CodeComparison.
    return input;
  },
});
