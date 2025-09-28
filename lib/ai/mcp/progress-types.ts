export type MCPProgress = {
  progress: number; // Current progress value (must increase)
  total?: number; // Optional total value for percentage calculation
  message?: string; // Optional descriptive message
};

export type MCPProgressToken = string;

export type MCPProgressNotification = {
  progressToken: MCPProgressToken;
  progress: number;
  total?: number;
  message?: string;
};

export type MCPProgressCallback = (progress: MCPProgress) => void;

export type MCPProgressState = {
  token: MCPProgressToken;
  progress: number;
  total?: number;
  message?: string;
  startTime: number;
  lastUpdate: number;
};

export type MCPToolCallOptions = {
  progressToken?: MCPProgressToken;
  onProgress?: MCPProgressCallback;
  timeout?: number;
  resetTimeoutOnProgress?: boolean;
  maxTotalTimeout?: number;
};

export type MCPProgressEvent = {
  type: "progress";
  data: MCPProgressNotification;
};
