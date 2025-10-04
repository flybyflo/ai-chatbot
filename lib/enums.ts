// Enum-like constants using const as const pattern
// This file centralizes all enum-like definitions for better maintainability

// Chat and API related enums
export const MESSAGE_PART_TYPES = {
  TEXT: "text",
  FILE: "file",
} as const;

export const MEDIA_TYPES = {
  // Images - supported by AI models
  IMAGE_JPEG: "image/jpeg",
  IMAGE_PNG: "image/png",
  IMAGE_GIF: "image/gif",
  IMAGE_WEBP: "image/webp",
  // Documents - supported by AI models
  APPLICATION_PDF: "application/pdf",
  TEXT_PLAIN: "text/plain",
  // Fallback for ambiguous files that will be processed as text
  APPLICATION_OCTET_STREAM: "application/octet-stream",
} as const;

export const MESSAGE_ROLES = {
  USER: "user",
} as const;

export const CHAT_MODELS = {
  CHAT_MODEL: "chat-model",
} as const;

export const VISIBILITY_TYPES = {
  PUBLIC: "public",
  PRIVATE: "private",
} as const;

export const REASONING_EFFORT_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

// PlantUML related enums
export const PLANTUML_FORMATS = {
  SVG: "svg",
  PNG: "png",
} as const;

// Tool types
export const TOOL_TYPES = {
  MCP: "mcp",
  A2A: "a2a",
  LOCAL: "local",
} as const;

// A2A Task states
export const A2A_TASK_STATES = {
  ACTIVE: "active",
  COMPLETED: "completed",
  DONE: "done",
  FAILED: "failed",
  ERROR: "error",
  PENDING: "pending",
  UNKNOWN: "unknown",
} as const;

// A2A Event types
export const A2A_EVENT_TYPES = {
  MESSAGE: "message",
  TASK: "task",
  STATUS_UPDATE: "status-update",
  ARTIFACT_UPDATE: "artifact-update",
} as const;

// Filter states
export const FILTER_STATES = {
  ALL: "all",
  READY: "ready",
  ERROR: "error",
} as const;

// User types
export const USER_TYPES = {
  ADMIN: "admin",
  REGULAR: "regular",
} as const;

// Error visibility levels
export const ERROR_VISIBILITY_LEVELS = {
  RESPONSE: "response",
  LOG: "log",
  NONE: "none",
} as const;

// Chart themes
export const CHART_THEMES = {
  LIGHT: "",
  DARK: ".dark",
} as const;

// React Query keys
export const QUERY_KEYS = {
  LOADOUTS: ["loadouts"],
  A2A_SERVERS: ["a2a-servers"],
  MCP_SERVERS: ["mcp-servers"],
  MEMORIES: ["memories"],
  TOOLS_ALL: ["tools", "all"],
  TOOLS_SELECTED: ["tools", "selected"],
} as const;

// Local tool IDs
export const LOCAL_TOOL_IDS = {
  GET_WEATHER: "getWeather",
  CODE_COMPARE: "codeCompare",
  PLANTUML: "plantuml",
} as const;

// Model IDs
export const MODEL_IDS = {
  CHAT_MODEL: "chat-model",
  CHAT_MODEL_REASONING: "chat-model-reasoning",
  TITLE_MODEL: "title-model",
  ARTIFACT_MODEL: "artifact-model",
} as const;

// Spreadsheet editor constants
export const SPREADSHEET_CONSTANTS = {
  MIN_ROWS: 50,
  MIN_COLS: 26,
} as const;

// Console log types
export const CONSOLE_LOG_TYPES = {
  REQUEST: "request",
  ERROR: "error",
} as const;

// Copy feedback types
export const COPY_FEEDBACK_TYPES = {
  MAIN: "main",
  DIALOG: "dialog",
} as const;

// Connection status types
export const CONNECTION_STATUS_TYPES = {
  CONNECTED: "connected",
  FAILED: "failed",
  TESTING: "testing",
} as const;

// Settings page features
export const SETTINGS_FEATURES = {
  MEMORY_MANAGEMENT: {
    NAME: "Memory Management",
    DESCRIPTION:
      "Manage your chat memory and personal context for better AI interactions.",
    HREF: "/settings/memory",
    CTA: "Manage Memory",
    CLASS_NAME: "lg:col-span-1",
  },
  LOADOUTS: {
    NAME: "Loadouts",
    DESCRIPTION:
      "Create and manage loadouts to quickly configure tools and agents.",
    HREF: "/settings/loadouts",
    CTA: "Manage Loadouts",
    CLASS_NAME: "lg:col-span-1",
  },
  MCP_SERVERS: {
    NAME: "MCP Servers",
    DESCRIPTION:
      "Configure and manage Model Context Protocol servers for extended functionality.",
    HREF: "/settings/mcp-servers",
    CTA: "Configure Servers",
    CLASS_NAME: "lg:col-span-1",
  },
  A2A_SERVERS: {
    NAME: "A2A Servers",
    DESCRIPTION: "Configure and manage A2A agent card servers.",
    HREF: "/settings/a2a-servers",
    CTA: "Configure Servers",
    CLASS_NAME: "lg:col-span-1",
  },
  A2A_AGENTS: {
    NAME: "A2A Agents",
    DESCRIPTION: "Browse and manage available A2A agents.",
    HREF: "/settings/a2a-agents",
    CTA: "Browse Agents",
    CLASS_NAME: "lg:col-span-1",
  },
} as const;

// Type exports for better TypeScript support
export type MessagePartType =
  (typeof MESSAGE_PART_TYPES)[keyof typeof MESSAGE_PART_TYPES];
export type MediaType = (typeof MEDIA_TYPES)[keyof typeof MEDIA_TYPES];
export type MessageRole = (typeof MESSAGE_ROLES)[keyof typeof MESSAGE_ROLES];
export type ChatModel = (typeof CHAT_MODELS)[keyof typeof CHAT_MODELS];
export type VisibilityType =
  (typeof VISIBILITY_TYPES)[keyof typeof VISIBILITY_TYPES];
export type ReasoningEffortLevel =
  (typeof REASONING_EFFORT_LEVELS)[keyof typeof REASONING_EFFORT_LEVELS];
export type PlantUMLFormat =
  (typeof PLANTUML_FORMATS)[keyof typeof PLANTUML_FORMATS];
export type ToolType = (typeof TOOL_TYPES)[keyof typeof TOOL_TYPES];
export type A2ATaskState =
  (typeof A2A_TASK_STATES)[keyof typeof A2A_TASK_STATES];
export type A2AEventType =
  (typeof A2A_EVENT_TYPES)[keyof typeof A2A_EVENT_TYPES];
export type FilterState = (typeof FILTER_STATES)[keyof typeof FILTER_STATES];
export type UserType = (typeof USER_TYPES)[keyof typeof USER_TYPES];
export type ErrorVisibility =
  (typeof ERROR_VISIBILITY_LEVELS)[keyof typeof ERROR_VISIBILITY_LEVELS];
export type ChartTheme = (typeof CHART_THEMES)[keyof typeof CHART_THEMES];
export type QueryKey = (typeof QUERY_KEYS)[keyof typeof QUERY_KEYS];
export type LocalToolId = (typeof LOCAL_TOOL_IDS)[keyof typeof LOCAL_TOOL_IDS];
export type ModelId = (typeof MODEL_IDS)[keyof typeof MODEL_IDS];
export type ConsoleLogType =
  (typeof CONSOLE_LOG_TYPES)[keyof typeof CONSOLE_LOG_TYPES];
export type CopyFeedbackType =
  (typeof COPY_FEEDBACK_TYPES)[keyof typeof COPY_FEEDBACK_TYPES];
export type ConnectionStatusType =
  (typeof CONNECTION_STATUS_TYPES)[keyof typeof CONNECTION_STATUS_TYPES];
export type SettingsFeature =
  (typeof SETTINGS_FEATURES)[keyof typeof SETTINGS_FEATURES];
