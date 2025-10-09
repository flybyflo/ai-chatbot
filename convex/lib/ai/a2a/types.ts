import type {
  AgentCard,
  CancelTaskResponse,
  GetTaskResponse,
  Message,
  MessageSendParams,
  Task,
  TaskArtifactUpdateEvent,
  TaskStatusUpdateEvent,
} from "@a2a-js/sdk";

export type {
  AgentCard,
  Message,
  Task,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  MessageSendParams,
  GetTaskResponse,
  CancelTaskResponse,
};

export type A2AStreamEvent =
  | Message
  | Task
  | TaskStatusUpdateEvent
  | TaskArtifactUpdateEvent;

export type A2AAgentConfig = {
  id?: string;
  name: string;
  cardUrl: string;
  description?: string;
  headers?: Record<string, string>;
};

export type A2AAgentStatus = {
  id?: string;
  name: string;
  cardUrl: string;
  isReady: boolean;
  lastError?: string;
};

export type A2AAgentMetadata = {
  id: string;
  toolId: string;
  displayName: string;
  cardUrl: string;
  description?: string;
  isReady: boolean;
  lastError?: string;
  supportsStreaming?: boolean;
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
  skills?: AgentCard["skills"];
  documentationUrl?: string;
  iconUrl?: string;
};

export type A2AAgentRegistry = {
  agents: Record<string, A2AAgentMetadata>;
};

export type A2AToolMessageSummary = {
  messageId?: string;
  taskId?: string;
  role?: "agent" | "user";
  text?: string;
};

export type A2ATaskSummary = {
  taskId: string;
  state?: string;
  statusMessage?: string;
  contextId: string;
  lastUpdated?: string;
  artifacts?: Array<{
    artifactId: string;
    name?: string;
    description?: string;
  }>;
};

export type A2ATaskStatusUpdateSummary = {
  taskId: string;
  contextId: string;
  state: string;
  message?: string;
  timestamp?: string;
};

export type A2AArtifactUpdateSummary = {
  taskId: string;
  contextId: string;
  artifactId: string;
  name?: string;
  description?: string;
};

export type A2AToolEventPayload = {
  agentKey: string;
  agentId: string;
  agentToolId: string;
  agentName: string;
  responseText?: string;
  contextId?: string;
  primaryTaskId?: string;
  tasks: A2ATaskSummary[];
  statusUpdates: A2ATaskStatusUpdateSummary[];
  artifacts: A2AArtifactUpdateSummary[];
  messages: A2AToolMessageSummary[];
  timestamp: string;
};

export type A2ASessionState = {
  contextId?: string;
  primaryTaskId?: string;
  tasks: Record<string, A2ATaskSummary>;
  lastUpdated?: string;
  messages?: A2AToolMessageSummary[];
  lastResponseText?: string;
};

export type A2ASessionSnapshot = {
  agentKey: string;
  agentId: string;
  agentToolId: string;
  agentName: string;
  contextId?: string;
  primaryTaskId?: string;
  lastUpdated?: string;
  tasks: Record<string, A2ATaskSummary>;
  messages: A2AToolMessageSummary[];
  lastResponseText?: string;
};

export type A2AEventLogEntry = A2AToolEventPayload;
