"use node";
import { type Tool, tool } from "ai";
import { z } from "zod";
import { generateUUID } from "../../utils";
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
      console.log("🚀 [A2A] Starting tool execution", {
        agent: metadata.displayName,
        agentKey: key,
        toolId: metadata.toolId,
        inputText: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
        timestamp: new Date().toISOString(),
      });

      const messageId = generateUUID();
      const existingSession = manager.getSession(key);

      console.log("📋 [A2A] Session state", {
        agent: metadata.displayName,
        hasExistingSession: !!existingSession,
        contextId: existingSession?.contextId,
        primaryTaskId: existingSession?.primaryTaskId,
        taskCount: existingSession?.tasks
          ? Object.keys(existingSession.tasks).length
          : 0,
      });

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
        configuration: {
          // Ensure we wait for task completion in streaming mode
          // This keeps the stream open until the agent finishes
          blocking: false, // Use non-blocking with streaming
        },
      } satisfies Record<string, unknown>;

      if (existingSession?.contextId) {
        streamParams.message.contextId = existingSession.contextId;
      }
      if (existingSession?.primaryTaskId) {
        streamParams.message.referenceTaskIds = [existingSession.primaryTaskId];
      }

      console.log("📤 [A2A] Sending message", {
        agent: metadata.displayName,
        messageId,
        hasContext: !!streamParams.message.contextId,
        hasReferenceTask: !!streamParams.message.referenceTaskIds,
        streamParams,
      });

      const agentResponses: string[] = [];
      const messages: A2AToolMessageSummary[] = [];
      const taskMap = new Map<string, A2ATaskSummary>();
      const statusUpdates: A2ATaskStatusUpdateSummary[] = [];
      const artifactUpdates: A2AArtifactUpdateSummary[] = [];

      let contextId: string | undefined = existingSession?.contextId;
      let latestTaskId: string | undefined = existingSession?.primaryTaskId;

      // Terminal task states that indicate the agent has finished
      const terminalStates = new Set([
        "completed",
        "failed",
        "canceled",
        "input_required",
        "unknown",
      ]);

      const emitProgressUpdate = (eventTimestamp?: string) => {
        const tasksSnapshot = Array.from(taskMap.values()).map((task) => ({
          ...task,
          artifacts: task.artifacts
            ? task.artifacts.map((artifact) => ({ ...artifact }))
            : undefined,
        }));
        const statusSnapshot = statusUpdates.map((update) => ({ ...update }));
        const artifactSnapshot = artifactUpdates.map((artifact) => ({
          ...artifact,
        }));
        const messageSnapshot = messages.map((message) => ({ ...message }));

        const payload: A2AToolEventPayload = {
          agentKey: key,
          agentId: metadata.id,
          agentToolId: metadata.toolId,
          agentName: metadata.displayName,
          responseText: agentResponses.join("\n\n"),
          contextId,
          primaryTaskId: latestTaskId,
          tasks: tasksSnapshot,
          statusUpdates: statusSnapshot,
          artifacts: artifactSnapshot,
          messages: messageSnapshot,
          timestamp: eventTimestamp ?? new Date().toISOString(),
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

        manager.emitToolEvent(payload);
      };

      try {
        let eventCount = 0;
        let shouldContinue = true;

        console.log("🌊 [A2A] Starting stream consumption", {
          agent: metadata.displayName,
          messageId,
        });

        for await (const event of client.sendMessageStream(streamParams)) {
          eventCount++;
          if (!event || typeof event !== "object") {
            console.warn("⚠️ [A2A] Skipping invalid event", {
              agent: metadata.displayName,
              eventCount,
              event,
            });
            continue;
          }

          const kind = (event as any).kind;

          console.log("📥 [A2A] Event received", {
            agent: metadata.displayName,
            eventCount,
            kind,
            hasContextId: !!(event as any).contextId,
            hasTaskId: !!(event as any).taskId || !!(event as any).id,
          });

          if (kind === "message") {
            const message = event as any;
            const textContent = extractTextFromParts(message.parts);

            console.log("💬 [A2A] Message received", {
              agent: metadata.displayName,
              eventCount,
              messageId: message.messageId,
              role: message.role,
              taskId: message.taskId,
              contextId: message.contextId,
              textPreview:
                textContent?.substring(0, 100) +
                (textContent && textContent.length > 100 ? "..." : ""),
              timestamp: message.timestamp,
            });

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
              console.log("🔗 [A2A] Context ID established", {
                agent: metadata.displayName,
                contextId,
              });
            }

            emitProgressUpdate(message.timestamp);

            // If we received an agent message and have a completed task, we can exit
            if (
              message.role === "agent" &&
              taskMap.size > 0 &&
              Array.from(taskMap.values()).some(
                (t) => t.state && terminalStates.has(t.state)
              )
            ) {
              console.log("✅ [A2A] Stream complete (agent message + terminal task)", {
                agent: metadata.displayName,
                eventCount,
              });
              shouldContinue = false;
              break;
            }
            continue;
          }

          if (kind === "task") {
            const task = event as any;
            contextId = task.contextId ?? contextId;
            latestTaskId = task.id;

            const statusMessage = extractTextFromParts(task.status?.message?.parts);
            const taskSummary: A2ATaskSummary = {
              taskId: task.id,
              state: task.status?.state,
              statusMessage,
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

            console.log("📝 [A2A] Task event", {
              agent: metadata.displayName,
              eventCount,
              taskId: task.id,
              state: task.status?.state,
              contextId: task.contextId,
              statusMessage,
              artifactCount: taskSummary.artifacts?.length ?? 0,
              isTerminal: task.status?.state && terminalStates.has(task.status.state),
              timestamp: task.status?.timestamp,
            });

            taskMap.set(task.id, taskSummary);
            emitProgressUpdate(task.status?.timestamp);

            // Check if task has reached a terminal state
            if (task.status?.state && terminalStates.has(task.status.state)) {
              console.log("🏁 [A2A] Stream complete (terminal task state)", {
                agent: metadata.displayName,
                eventCount,
                taskId: task.id,
                state: task.status.state,
              });
              shouldContinue = false;
              break;
            }
            continue;
          }

          if (kind === "status-update") {
            const statusEvent = event as any;
            contextId = statusEvent.contextId ?? contextId;
            latestTaskId = statusEvent.taskId ?? latestTaskId;
            const message = extractTextFromParts(statusEvent.status?.message?.parts);
            const summary: A2ATaskStatusUpdateSummary = {
              taskId: statusEvent.taskId,
              contextId: statusEvent.contextId,
              state: statusEvent.status?.state ?? "unknown",
              message,
              timestamp: statusEvent.status?.timestamp,
            };

            console.log("🔄 [A2A] Status update", {
              agent: metadata.displayName,
              eventCount,
              taskId: statusEvent.taskId,
              state: summary.state,
              contextId: statusEvent.contextId,
              message,
              isFinal: statusEvent.final === true,
              isTerminal:
                statusEvent.status?.state &&
                terminalStates.has(statusEvent.status.state),
              timestamp: summary.timestamp,
            });

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

            emitProgressUpdate(statusEvent.status?.timestamp);

            // Check for the 'final' property which signals stream completion
            if (statusEvent.final === true) {
              console.log("🏁 [A2A] Stream complete (final flag)", {
                agent: metadata.displayName,
                eventCount,
                taskId: statusEvent.taskId,
                state: statusEvent.status?.state,
              });
              shouldContinue = false;
              break;
            }

            // Also check if status update indicates terminal state
            if (
              statusEvent.status?.state &&
              terminalStates.has(statusEvent.status.state)
            ) {
              console.log("🏁 [A2A] Stream complete (terminal status)", {
                agent: metadata.displayName,
                eventCount,
                taskId: statusEvent.taskId,
                state: statusEvent.status.state,
              });
              shouldContinue = false;
              break;
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

            console.log("📎 [A2A] Artifact update", {
              agent: metadata.displayName,
              eventCount,
              taskId: artifactEvent.taskId,
              artifactId: artifactSummary.artifactId,
              name: artifactSummary.name,
              description: artifactSummary.description,
              contextId: artifactEvent.contextId,
              timestamp: artifactEvent.artifact?.timestamp ?? artifactEvent.timestamp,
            });

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

            emitProgressUpdate(
              artifactEvent.artifact?.timestamp ?? artifactEvent.timestamp
            );
            continue;
          }

          // Unknown event kind
          console.warn("⚠️ [A2A] Unknown event kind", {
            agent: metadata.displayName,
            eventCount,
            kind,
            event,
          });
        }

        console.log("🏁 [A2A] Stream ended", {
          agent: metadata.displayName,
          totalEvents: eventCount,
          taskCount: taskMap.size,
          messageCount: messages.length,
        });
      } catch (error) {
        console.error("❌ A2A stream consumption error", {
          agent: metadata.displayName,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw new Error(
          `Failed to consume A2A stream from ${metadata.displayName}: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      const responseText = agentResponses.join("\n\n");
      const timestamp = new Date().toISOString();

      const tasks = Array.from(taskMap.values());

      console.log("🎯 [A2A] Tool execution complete", {
        agent: metadata.displayName,
        responseLength: responseText.length,
        taskCount: tasks.length,
        messageCount: messages.length,
        statusUpdateCount: statusUpdates.length,
        artifactUpdateCount: artifactUpdates.length,
        contextId,
        primaryTaskId: latestTaskId,
        tasks: tasks.map((t) => ({
          taskId: t.taskId,
          state: t.state,
          artifactCount: t.artifacts?.length ?? 0,
        })),
      });

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

      console.log("💾 [A2A] Updating session", {
        agent: metadata.displayName,
        contextId: sessionUpdate.contextId,
        primaryTaskId: sessionUpdate.primaryTaskId,
        taskCount: Object.keys(sessionUpdate.tasks ?? {}).length,
      });

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

      console.log("📡 [A2A] Emitting final tool event", {
        agent: metadata.displayName,
        messageCount: payload.messages.length,
        timestamp: payload.timestamp,
      });

      manager.emitToolEvent(payload);

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
