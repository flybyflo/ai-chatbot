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
  name: string;
  cardUrl: string;
};

export type A2AAgentStatus = {
  name: string;
  cardUrl: string;
  isReady: boolean;
  lastError?: string;
};
