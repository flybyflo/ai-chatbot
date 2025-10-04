import type { InferUITool, UIMessage } from "ai";
import type { A2AAgentRegistry, A2AToolEventPayload } from "./ai/a2a/types";
import type { MCPToolRegistry } from "./ai/mcp/types";
import type { codeCompare } from "./ai/tools/code-compare";
import type { getWeather } from "./ai/tools/get-weather";
import type { AppUsage } from "./usage";

export type MessageMetadata = {
  createdAt: string;
  a2aEventId?: string;
};

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
  a2aRegistry?: A2AAgentRegistry;
  a2aEvents?: A2AToolEventPayload;
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
