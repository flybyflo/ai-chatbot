import { type Tool, tool } from "ai";
import { z } from "zod";
import { generateUUID } from "@/lib/utils";
import type { A2AClientWrapper } from "./client";
import type { A2AManager } from "./manager";
import type {
  A2AAgentMetadata,
  A2AAgentRegistry,
  A2AArtifactUpdateSummary,
  A2ASessionState,
  A2ATaskStatusUpdateSummary,
  A2ATaskSummary,
  A2AToolEventPayload,
  A2AToolMessageSummary,
} from "./types";

type BuildA2AToolParams = {
  key: string;
  metadata: A2AAgentMetadata;
  client: A2AClientWrapper;
  manager: A2AManager;
};

const A2A_TOOL_PREFIX = "a2a_";

function sanitizeAgentKey(agentKey: string) {
  return agentKey.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function buildToolId(agentKey: string) {
  const safeKey = sanitizeAgentKey(agentKey);
  return `${A2A_TOOL_PREFIX}${safeKey}`;
}

function extractTextFromParts(parts: any[] | undefined): string | undefined {
  if (!Array.isArray(parts)) {
    return;
  }
  const texts = parts
    .filter(
      (part) => part && part.kind === "text" && typeof part.text === "string"
    )
    .map((part) => part.text.trim())
    .filter(Boolean);
  return texts.length > 0 ? texts.join("\n\n") : undefined;
}

function buildA2ATool({ key, metadata, client, manager }: BuildA2AToolParams) {
  return tool<{ text: string }, A2AToolEventPayload>({
    description:
      metadata.description ||
      `Interact with the ${metadata.displayName} A2A agent`,
    inputSchema: z.object({
      text: z.string().min(1, "text is required"),
    }),
    execute: async ({ text }) => {
      const messageId = generateUUID();
      const existingSession = manager.getSession(key);
      const streamParams: any = {
        message: {
          messageId,
          role: "user" as const,
          kind: "message" as const,
          parts: [
            {
              kind: "text" as const,
              text,
            },
          ],
        },
      } satisfies Record<string, unknown>;

      if (existingSession?.contextId) {
        streamParams.message.contextId = existingSession.contextId;
      }
      if (existingSession?.primaryTaskId) {
        streamParams.message.referenceTaskIds = [existingSession.primaryTaskId];
      }

      const agentResponses: string[] = [];
      const messages: A2AToolMessageSummary[] = [];
      const taskMap = new Map<string, A2ATaskSummary>();
      const statusUpdates: A2ATaskStatusUpdateSummary[] = [];
      const artifactUpdates: A2AArtifactUpdateSummary[] = [];

      let contextId: string | undefined = existingSession?.contextId;
      let latestTaskId: string | undefined = existingSession?.primaryTaskId;

      for await (const event of client.sendMessageStream(streamParams)) {
        if (!event || typeof event !== "object") {
          continue;
        }

        const kind = (event as any).kind;

        if (kind === "message") {
          const message = event as any;
          const textContent = extractTextFromParts(message.parts);
          if (message.role === "agent" && textContent) {
            agentResponses.push(textContent);
          }
          messages.push({
            messageId: message.messageId,
            role: message.role,
            taskId: message.taskId,
            text: textContent,
          });
          if (!contextId && message.contextId) {
            contextId = message.contextId;
          }
          continue;
        }

        if (kind === "task") {
          const task = event as any;
          contextId = task.contextId ?? contextId;
          latestTaskId = task.id;
          const taskSummary: A2ATaskSummary = {
            taskId: task.id,
            state: task.status?.state,
            statusMessage: extractTextFromParts(task.status?.message?.parts),
            contextId: task.contextId,
            lastUpdated: new Date().toISOString(),
            artifacts: Array.isArray(task.artifacts)
              ? task.artifacts.map((artifact: any) => ({
                  artifactId: artifact.artifactId,
                  name: artifact.name,
                  description: artifact.description,
                }))
              : undefined,
          };
          taskMap.set(task.id, taskSummary);
          continue;
        }

        if (kind === "status-update") {
          const statusEvent = event as any;
          contextId = statusEvent.contextId ?? contextId;
          latestTaskId = statusEvent.taskId ?? latestTaskId;
          const summary: A2ATaskStatusUpdateSummary = {
            taskId: statusEvent.taskId,
            contextId: statusEvent.contextId,
            state: statusEvent.status?.state ?? "unknown",
            message: extractTextFromParts(statusEvent.status?.message?.parts),
            timestamp: statusEvent.status?.timestamp,
          };
          statusUpdates.push(summary);
          const existing = taskMap.get(statusEvent.taskId);
          if (existing) {
            taskMap.set(statusEvent.taskId, {
              ...existing,
              state: summary.state,
              statusMessage: summary.message ?? existing.statusMessage,
              lastUpdated: summary.timestamp ?? existing.lastUpdated,
            });
          } else {
            taskMap.set(statusEvent.taskId, {
              taskId: statusEvent.taskId,
              contextId: statusEvent.contextId,
              state: summary.state,
              statusMessage: summary.message,
              lastUpdated: summary.timestamp,
            });
          }
          continue;
        }

        if (kind === "artifact-update") {
          const artifactEvent = event as any;
          contextId = artifactEvent.contextId ?? contextId;
          latestTaskId = artifactEvent.taskId ?? latestTaskId;
          const artifactSummary: A2AArtifactUpdateSummary = {
            taskId: artifactEvent.taskId,
            contextId: artifactEvent.contextId,
            artifactId: artifactEvent.artifact?.artifactId,
            name: artifactEvent.artifact?.name,
            description: artifactEvent.artifact?.description,
          };
          artifactUpdates.push(artifactSummary);
          const existing = taskMap.get(artifactEvent.taskId);
          if (existing) {
            const nextArtifacts = new Map(
              (existing.artifacts ?? []).map((artifact) => [
                artifact.artifactId,
                artifact,
              ])
            );
            if (artifactSummary.artifactId) {
              nextArtifacts.set(artifactSummary.artifactId, {
                artifactId: artifactSummary.artifactId,
                name: artifactSummary.name,
                description: artifactSummary.description,
              });
            }
            taskMap.set(artifactEvent.taskId, {
              ...existing,
              artifacts: Array.from(nextArtifacts.values()),
            });
          } else if (artifactSummary.artifactId) {
            taskMap.set(artifactEvent.taskId, {
              taskId: artifactEvent.taskId,
              contextId: artifactEvent.contextId,
              state: undefined,
              artifacts: [
                {
                  artifactId: artifactSummary.artifactId,
                  name: artifactSummary.name,
                  description: artifactSummary.description,
                },
              ],
            });
          }
        }
      }

      const responseText = agentResponses.join("\n\n");
      const timestamp = new Date().toISOString();

      const tasks = Array.from(taskMap.values());

      const sessionUpdate: Partial<A2ASessionState> = {
        contextId,
        primaryTaskId:
          latestTaskId ?? contextId ?? existingSession?.primaryTaskId,
        tasks: tasks.reduce<Record<string, A2ATaskSummary>>((acc, task) => {
          acc[task.taskId] = task;
          return acc;
        }, {}),
        lastUpdated: timestamp,
        messages,
        lastResponseText: responseText,
      };

      manager.updateSession(key, sessionUpdate);

      const payload: A2AToolEventPayload = {
        agentKey: key,
        agentId: metadata.id,
        agentToolId: metadata.toolId,
        agentName: metadata.displayName,
        responseText,
        contextId,
        primaryTaskId: latestTaskId,
        tasks,
        statusUpdates,
        artifacts: artifactUpdates,
        messages,
        timestamp,
      };

      for (const message of payload.messages) {
        if (!message.messageId) {
          message.messageId = `${payload.agentToolId}-${payload.timestamp}`;
        }
        if (!message.text) {
          message.text = payload.responseText;
        }
        if (!message.role) {
          message.role = "agent";
        }
      }

      console.log("🛰️ A2A session update", {
        agent: metadata.displayName,
        contextId: payload.contextId,
        primaryTaskId: payload.primaryTaskId,
        taskCount: payload.tasks.length,
        messageCount: payload.messages.length,
        responsePreview: responseText?.slice(0, 120),
      });

      if (payload.tasks.length > 0) {
        console.log(
          "🧭 Tasks",
          payload.tasks.map((task) => ({
            taskId: task.taskId,
            state: task.state,
            artifactCount: task.artifacts?.length ?? 0,
          }))
        );
      }

      if (payload.statusUpdates.length > 0) {
        console.log("📈 Status updates", payload.statusUpdates);
      }

      if (payload.artifacts.length > 0) {
        console.log("📦 Artifacts", payload.artifacts);
      }

      if (payload.messages.length > 0) {
        console.log("💬 Agent messages", payload.messages);
      }

      return payload;
    },
  });
}

export function buildA2ATools(manager: A2AManager) {
  const registryRecords = manager.getRegistry();
  const tools: Record<string, Tool<{ text: string }, A2AToolEventPayload>> = {};
  const metadata: Record<string, A2AAgentMetadata> = {};

  for (const [key, record] of Object.entries(registryRecords)) {
    const { status, config, card } = record;
    const toolId = buildToolId(key);

    const agentMetadata: A2AAgentMetadata = {
      id: config.id ?? key,
      toolId,
      displayName: config.name,
      cardUrl: config.cardUrl,
      description: config.description ?? card?.description,
      isReady: status.isReady,
      lastError: status.lastError,
      supportsStreaming: card?.capabilities?.streaming ?? false,
      defaultInputModes: card?.defaultInputModes,
      defaultOutputModes: card?.defaultOutputModes,
      skills: card?.skills,
      documentationUrl: card?.documentationUrl,
      iconUrl: card?.iconUrl,
    };

    metadata[key] = agentMetadata;

    if (!status.isReady) {
      continue;
    }

    const client = manager.getClient(key);
    if (!client) {
      continue;
    }

    tools[toolId] = buildA2ATool({
      key,
      metadata: agentMetadata,
      client,
      manager,
    });
  }

  const registry: A2AAgentRegistry = { agents: metadata };

  return { tools, registry };
}
