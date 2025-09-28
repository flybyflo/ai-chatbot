import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { MCPProgressNotification } from "./ai/mcp/progress-types";
import type { MCPToolRegistry } from "./ai/mcp/types";
import type { codeCompare } from "./ai/tools/code-compare";
import type { getWeather } from "./ai/tools/get-weather";
import type { AppUsage } from "./usage";

export type DataPart = { type: "append-message"; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type codeCompareTool = InferUITool<typeof codeCompare>;

export type ChatTools = {
  getWeather: weatherTool;
  codeCompare: codeCompareTool;
  // MCP tools will be dynamically added with pattern: [serverName_toolName]: any
  [key: string]: any;
};

export type CustomUIDataTypes = {
  usage: AppUsage;
  mcpRegistry?: MCPToolRegistry;
  mcpProgress?: MCPProgressNotification;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
