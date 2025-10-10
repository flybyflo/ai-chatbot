"use node";

import {
  convertToModelMessages,
  generateText,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import type { A2AToolEventPayload } from "./lib/ai/a2a/types";
import type { DBMessage } from "./lib/utils";

function mergeA2AOutput(previous: any, next: any) {
  const base = previous ?? {};
  const merged = { ...base, ...(next ?? {}) };

  if (Array.isArray(base?.tasks) || Array.isArray(next?.tasks)) {
    const tasksById = new Map<string, any>();
    const allTasks = [
      ...(Array.isArray(base?.tasks) ? base.tasks : []),
      ...(Array.isArray(next?.tasks) ? next.tasks : []),
    ];
    for (const task of allTasks) {
      if (!task || typeof task !== "object") {
        continue;
      }
      const key =
        typeof task.taskId === "string"
          ? task.taskId
          : `task-${tasksById.size}`;
      const existingTask = tasksById.get(key) ?? {};
      tasksById.set(key, { ...existingTask, ...task });
    }
    merged.tasks = Array.from(tasksById.values());
  }

  if (
    Array.isArray(base?.statusUpdates) ||
    Array.isArray(next?.statusUpdates)
  ) {
    const combinedUpdates = [
      ...(Array.isArray(base?.statusUpdates) ? base.statusUpdates : []),
      ...(Array.isArray(next?.statusUpdates) ? next.statusUpdates : []),
    ];
    const seen = new Set<string>();
    const dedupedUpdates: any[] = [];
    for (const update of combinedUpdates) {
      if (!update || typeof update !== "object") {
        continue;
      }
      const key = [
        update.taskId ?? "",
        update.state ?? "",
        update.message ?? "",
        update.timestamp ?? "",
      ].join("|");
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      dedupedUpdates.push(update);
    }
    merged.statusUpdates = dedupedUpdates;
  }

  if (Array.isArray(base?.artifacts) || Array.isArray(next?.artifacts)) {
    const combinedArtifacts = [
      ...(Array.isArray(base?.artifacts) ? base.artifacts : []),
      ...(Array.isArray(next?.artifacts) ? next.artifacts : []),
    ];
    const seenArtifacts = new Set<string>();
    const dedupedArtifacts: any[] = [];
    for (const artifact of combinedArtifacts) {
      if (!artifact || typeof artifact !== "object") {
        continue;
      }
      const key =
        artifact.id ??
        [artifact.url ?? "", artifact.name ?? "", artifact.type ?? ""].join(
          "|"
        );
      if (seenArtifacts.has(key)) {
        continue;
      }
      seenArtifacts.add(key);
      dedupedArtifacts.push(artifact);
    }
    merged.artifacts = dedupedArtifacts;
  }

  if (Array.isArray(next?.messages)) {
    merged.messages = next.messages;
  }

  if (next?.responseText !== undefined) {
    merged.responseText = next.responseText;
  }

  return merged;
}

/**
 * Internal action that handles streaming LLM responses to Convex
 * This is called asynchronously after creating the user message
 */
export const generateAssistantMessage = internalAction({
  args: {
    chatId: v.id("chats"),
    assistantMessageId: v.id("messages"),
    userId: v.string(),
    selectedChatModel: v.string(),
    selectedReasoningEffort: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
    ),
    selectedTools: v.optional(v.array(v.string())),
    requestHints: v.optional(v.any()),
    userMemories: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    // Import your AI provider and tools from convex/lib
    const { myProvider } = await import("./lib/ai/providers");
    const { systemPrompt } = await import("./lib/ai/prompts");
    const { getAllTools } = await import("./lib/ai/tools");
    const { convertToUIMessages } = await import("./lib/utils");
    const { isProductionEnvironment } = await import("./lib/constants");

    let textChunkSequence = 0;
    let reasoningChunkSequence = 0;
    let textBuffer = "";
    let reasoningBuffer = "";
    let streamedReasoning = "";
    const bufferThreshold = 50; // characters
    let lastTextFlushTime = Date.now();
    let lastReasoningFlushTime = Date.now();
    const timeThreshold = 200; // ms

    const streamingToolParts = new Map<string, any>();
    let streamingUpdatesFinalized = false;
    let pendingStreamingPublish: Promise<void> = Promise.resolve();
    let removeA2AListener: (() => void) | undefined;
    const a2aPersistencePromises: Promise<unknown>[] = [];

    try {
      // 1. Fetch conversation history from Convex
      const messagesFromDb = await ctx.runQuery(
        api.queries.getMessagesByChatId,
        {
          chatId: args.chatId,
        }
      );

      // Convert to UI messages format
      // Only filter out incomplete messages - keep all complete messages regardless of parts
      const filteredMessages = messagesFromDb.filter((msg: any) => {
        // Keep all complete messages
        if (!msg.isComplete) {
          return false;
        }

        // Ensure parts exists and is a valid array
        if (!msg.parts) {
          return false;
        }

        // Handle both array and non-array parts
        const partsArray = Array.isArray(msg.parts) ? msg.parts : [msg.parts];

        // Keep messages with at least one part
        return partsArray.length > 0;
      });

      const uiMessages = convertToUIMessages(
        filteredMessages.map(
          (msg: any): DBMessage => ({
            id: msg._id,
            chatId: msg.chatId,
            role: msg.role,
            parts: msg.parts,
            attachments: msg.attachments,
            createdAt: new Date(msg.createdAt),
          })
        )
      );

      // 2. Fetch user's MCP and A2A servers
      const a2aServersFromDb = await ctx.runQuery(
        api.queries.getActiveUserA2AServers,
        {
          userId: args.userId,
        }
      );
      const mcpServersFromDb = await ctx.runQuery(
        api.queries.getActiveUserMCPServers,
        {
          userId: args.userId,
        }
      );

      // 3. Load all tools and filter by selected tools
      const {
        tools: allTools,
        a2aManager,
        a2aRegistry,
      } = await getAllTools(a2aServersFromDb, mcpServersFromDb);

      if (a2aRegistry) {
        await ctx.runMutation(api.mutations.upsertA2ARegistry, {
          userId: args.userId,
          registry: a2aRegistry,
        });
      }

      const tools = Object.entries(allTools).reduce<Record<string, any>>(
        (acc, [toolName, toolImpl]) => {
          if (!args.selectedTools || args.selectedTools.includes(toolName)) {
            acc[toolName] = toolImpl;
          }
          return acc;
        },
        {}
      );

      const publishStreamingToolParts = async () => {
        if (streamingUpdatesFinalized) {
          return;
        }
        if (streamingToolParts.size === 0) {
          return;
        }

        const partsToPublish = Array.from(streamingToolParts.values()).map(
          (part) => ({
            ...part,
          })
        );

        await ctx.runMutation(api.mutations.updateMessageParts, {
          messageId: args.assistantMessageId,
          parts: partsToPublish,
        });
      };

      const enqueueStreamingPublish = () => {
        pendingStreamingPublish = pendingStreamingPublish
          .catch((error) => {
            console.error("[AI] Previous streaming A2A publish failed", error);
          })
          .then(async () => {
            await publishStreamingToolParts();
          });
      };

      if (a2aManager) {
        removeA2AListener = a2aManager.onToolEvent(
          (payload: A2AToolEventPayload) => {
            if (streamingUpdatesFinalized) {
              return;
            }

            const agentKey = payload.agentKey ?? "unknown";
            const mapKey = payload.agentToolId ?? agentKey;
            const existing = streamingToolParts.get(mapKey) ?? {
              type: `tool-a2a_${agentKey}`,
              toolCallId:
                payload.primaryTaskId ??
                payload.contextId ??
                `${mapKey}-${payload.timestamp ?? Date.now()}`,
              toolName: payload.agentToolId ?? `a2a_${agentKey}`,
              state: "output-available" as const,
            };

            const mergedOutput = mergeA2AOutput(existing.output, payload);
            streamingToolParts.set(mapKey, {
              ...existing,
              agentKey,
              output: mergedOutput,
            });

            a2aPersistencePromises.push(
              ctx
                .runMutation(api.mutations.recordA2AEvent, {
                  userId: args.userId,
                  chatId: args.chatId,
                  payload,
                })
                .catch((error) => {
                  console.error("[AI] Failed to persist A2A event", error);
                })
            );

            enqueueStreamingPublish();
          }
        );
      }

      // 3. Prepare system prompt with user memories
      const memoryContext = args.userMemories || [];

      // 4. Call streamText with AI SDK
      const promptMessages = convertToModelMessages(uiMessages);

      const result = streamText({
        model: myProvider.languageModel(args.selectedChatModel),
        system: systemPrompt({
          requestHints: args.requestHints,
          userMemories: memoryContext,
        }),
        messages: promptMessages.length > 0 ? promptMessages : [],
        stopWhen: stepCountIs(5),
        experimental_activeTools: Object.keys(tools),
        experimental_transform: smoothStream({ chunking: "word" }),
        tools,
        providerOptions: {
          openai: {
            reasoningSummary: "detailed",
            reasoningEffort: args.selectedReasoningEffort || "medium",
          },
        },
        experimental_telemetry: {
          isEnabled: isProductionEnvironment,
          functionId: "convex-stream-text",
        },
      });

      // 5. Stream all parts (text AND reasoning) and write chunks to database
      for await (const part of result.fullStream) {
        const now = Date.now();

        // Handle text deltas
        if (part.type === "text-delta") {
          textBuffer += part.text; // AI SDK v5 uses 'text' not 'textDelta'

          // Flush text buffer if threshold reached or time elapsed
          if (
            (textBuffer.length >= bufferThreshold ||
              now - lastTextFlushTime >= timeThreshold) &&
            textBuffer.length > 0
          ) {
            await ctx.runMutation(api.mutations.createMessageChunk, {
              messageId: args.assistantMessageId,
              content: textBuffer,
              sequence: textChunkSequence++,
            });
            textBuffer = "";
            lastTextFlushTime = now;
          }
        }

        // Handle reasoning deltas (thinking content from models like O1)
        if (part.type === "reasoning-delta") {
          reasoningBuffer += part.text; // AI SDK v5 uses 'text' not 'reasoningDelta'

          // Flush reasoning buffer if threshold reached or time elapsed
          if (
            (reasoningBuffer.length >= bufferThreshold ||
              now - lastReasoningFlushTime >= timeThreshold) &&
            reasoningBuffer.length > 0
          ) {
            const reasoningToPersist = reasoningBuffer;
            await ctx.runMutation(api.mutations.createReasoningChunk, {
              messageId: args.assistantMessageId,
              content: reasoningToPersist,
              sequence: reasoningChunkSequence++,
            });
            streamedReasoning += reasoningToPersist;
            reasoningBuffer = "";
            lastReasoningFlushTime = now;
          }
        }
      }

      // Final flush for both text and reasoning
      if (textBuffer.length > 0) {
        await ctx.runMutation(api.mutations.createMessageChunk, {
          messageId: args.assistantMessageId,
          content: textBuffer,
          sequence: textChunkSequence++,
        });
      }

      if (reasoningBuffer.length > 0) {
        const reasoningToPersist = reasoningBuffer;
        await ctx.runMutation(api.mutations.createReasoningChunk, {
          messageId: args.assistantMessageId,
          content: reasoningToPersist,
          sequence: reasoningChunkSequence++,
        });
        streamedReasoning += reasoningToPersist;
        reasoningBuffer = "";
      }

      // Get the final result for usage tracking
      const finalResult = await result;
      const rawReasoning = (finalResult as any)?.reasoning;

      // Extract final text
      let finalText: string | null = null;
      if (typeof finalResult.text === "string") {
        finalText = finalResult.text;
      } else if (
        finalResult.text &&
        typeof (finalResult.text as Promise<string>).then === "function"
      ) {
        finalText = await finalResult.text;
      }

      // Extract final reasoning
      // In AI SDK v5, reasoning is an array of ReasoningOutput objects
      let finalReasoning: string | null = null;

      if (
        rawReasoning &&
        typeof (rawReasoning as Promise<unknown>).then === "function"
      ) {
        try {
          const awaitedReasoning = await rawReasoning;
          if (Array.isArray(awaitedReasoning)) {
            finalReasoning = awaitedReasoning
              .map((r: any) => r?.text || "")
              .filter((t: string) => t.length > 0)
              .join("\n\n");
          } else if (typeof awaitedReasoning === "string") {
            finalReasoning = awaitedReasoning;
          } else if (awaitedReasoning && typeof awaitedReasoning === "object") {
            const maybeText = (awaitedReasoning as any).text;
            if (typeof maybeText === "string" && maybeText.length > 0) {
              finalReasoning = maybeText;
            }
          }
        } catch (awaitError) {
          console.warn("⚠️ Failed to await reasoning promise:", awaitError);
        }
      } else if (Array.isArray(rawReasoning)) {
        // Combine all reasoning outputs into a single string
        finalReasoning = rawReasoning
          .map((r: any) => r.text || "")
          .filter((t: string) => t.length > 0)
          .join("\n\n");
      } else if (typeof rawReasoning === "string" && rawReasoning.length > 0) {
        finalReasoning = rawReasoning;
      } else if (rawReasoning && typeof rawReasoning === "object") {
        const maybeText = (rawReasoning as any).text;
        if (typeof maybeText === "string" && maybeText.length > 0) {
          finalReasoning = maybeText;
        }
      } else if (!finalReasoning && streamedReasoning.length > 0) {
        finalReasoning = streamedReasoning;
      }

      // 6. Extract tool calls and results from steps
      const toolPartsMap = new Map<string, any>();

      const formatError = (error: unknown) => {
        if (error === undefined || error === null) {
          return;
        }
        if (typeof error === "string") {
          return error;
        }
        try {
          return JSON.stringify(error, null, 2);
        } catch (jsonError) {
          console.warn("⚠️ Failed to stringify tool error:", jsonError);
          return String(error);
        }
      };

      const upsertToolPart = (
        toolCall: any,
        context: {
          result?: any;
          error?: any;
        }
      ) => {
        if (!toolCall) {
          return;
        }

        const toolName: string = toolCall.toolName || "";
        const toolCallId: string = toolCall.toolCallId || "";
        if (!toolName || !toolCallId) {
          return;
        }

        const isDynamic = toolCall.dynamic === true || toolName.includes("_");
        if (!isDynamic) {
          return;
        }

        const isA2A = toolName.startsWith("a2a_");
        const a2aAgentKey = isA2A
          ? toolName.slice("a2a_".length) || "unknown"
          : undefined;
        const partType = isA2A ? `tool-a2a_${a2aAgentKey}` : "dynamic-tool";

        const existing = toolPartsMap.get(toolCallId) || {
          type: partType,
          toolCallId,
          toolName,
          state: "input-available",
          input: toolCall.input ?? toolCall.args ?? {},
        };

        existing.type = partType;
        if (a2aAgentKey) {
          (existing as any).agentKey = a2aAgentKey;
        }

        const resolvedInput = toolCall.input ?? toolCall.args;
        if (resolvedInput !== undefined) {
          existing.input = resolvedInput;
        }

        const output = context.result?.output ?? context.result?.result;
        if (output !== undefined) {
          existing.output = isA2A
            ? mergeA2AOutput(existing.output, output)
            : output;
          existing.state = "output-available";
        }

        const formattedError = formatError(
          context.error ?? context.result?.error ?? existing.errorText
        );
        if (formattedError !== undefined) {
          existing.errorText = formattedError;
          existing.state = "output-available";
        }

        toolPartsMap.set(toolCallId, existing);
      };

      const collectFromStep = (step: any) => {
        if (
          !step ||
          !Array.isArray(step.toolCalls) ||
          step.toolCalls.length === 0
        ) {
          return;
        }

        const toolResultsById = new Map<string, any>();
        if (Array.isArray(step.toolResults)) {
          for (const toolResultEntry of step.toolResults) {
            if (toolResultEntry?.toolCallId) {
              toolResultsById.set(toolResultEntry.toolCallId, toolResultEntry);
            }
          }
        }

        const content = Array.isArray(step.content) ? step.content : [];
        const toolErrorsById = new Map<string, any>();
        const contentResultsById = new Map<string, any>();
        for (const part of content) {
          if (!part || typeof part !== "object") {
            continue;
          }
          if (part.type === "tool-error" && part.toolCallId) {
            toolErrorsById.set(part.toolCallId, part);
          }
          if (part.type === "tool-result" && part.toolCallId) {
            contentResultsById.set(part.toolCallId, part);
          }
        }

        for (const toolCall of step.toolCalls) {
          const toolCallId = toolCall?.toolCallId;
          if (!toolCallId) {
            continue;
          }

          const matchedResult =
            toolResultsById.get(toolCallId) ??
            contentResultsById.get(toolCallId);
          const error = toolErrorsById.get(toolCallId)?.error;

          upsertToolPart(toolCall, { result: matchedResult, error });
        }
      };

      // Await steps if it's a Promise
      let resolvedSteps: any = finalResult.steps;
      if (
        resolvedSteps &&
        typeof (resolvedSteps as Promise<unknown>).then === "function"
      ) {
        try {
          resolvedSteps = await resolvedSteps;
        } catch (stepsError) {
          console.warn("⚠️ Failed to await steps promise:", stepsError);
          resolvedSteps = [];
        }
      }

      console.log("[AI] Processing steps for tool calls:", {
        hasSteps: !!resolvedSteps,
        isArray: Array.isArray(resolvedSteps),
        stepsCount: Array.isArray(resolvedSteps) ? resolvedSteps.length : 0,
        steps: resolvedSteps,
      });

      if (resolvedSteps && Array.isArray(resolvedSteps)) {
        for (const step of resolvedSteps) {
          console.log("[AI] Processing step:", {
            hasToolCalls: !!step?.toolCalls,
            toolCallsCount: Array.isArray(step?.toolCalls)
              ? step.toolCalls.length
              : 0,
            toolCalls: step?.toolCalls,
          });
          collectFromStep(step);
        }
      }

      console.log(
        "[AI] After processing steps, toolPartsMap size:",
        toolPartsMap.size
      );

      // Fallback to aggregated dynamic tool data if steps did not yield results
      if (toolPartsMap.size === 0) {
        const dynamicToolCalls = (finalResult as any)?.dynamicToolCalls;
        const dynamicToolResults = (finalResult as any)?.dynamicToolResults;
        const content = (finalResult as any)?.content;

        if (Array.isArray(dynamicToolCalls) && dynamicToolCalls.length > 0) {
          const resultsById = new Map<string, any>();
          if (Array.isArray(dynamicToolResults)) {
            for (const dynamicResult of dynamicToolResults) {
              if (dynamicResult?.toolCallId) {
                resultsById.set(dynamicResult.toolCallId, dynamicResult);
              }
            }
          }

          const errorById = new Map<string, any>();
          if (Array.isArray(content)) {
            for (const part of content) {
              if (part?.type === "tool-error" && part.toolCallId) {
                errorById.set(part.toolCallId, part.error);
              }
            }
          }

          for (const toolCall of dynamicToolCalls) {
            const toolCallId = toolCall?.toolCallId;
            const resolvedResult = toolCallId
              ? resultsById.get(toolCallId)
              : undefined;
            const error = toolCallId ? errorById.get(toolCallId) : undefined;
            upsertToolPart(toolCall, { result: resolvedResult, error });
          }
        }
      }

      streamingUpdatesFinalized = true;
      await pendingStreamingPublish.catch((error) => {
        console.error(
          "[AI] Failed to publish pending streaming tool parts",
          error
        );
      });
      streamingToolParts.clear();
      await Promise.allSettled(a2aPersistencePromises);

      const toolParts = Array.from(toolPartsMap.values());

      console.log("[AI] Tool parts extracted:", {
        count: toolParts.length,
        toolParts: JSON.stringify(toolParts, null, 2),
      });

      // 7. Update message parts with final content (reasoning + tools + text)
      const parts: any[] = [];

      // Add reasoning part first (if exists) so it appears before text
      if (finalReasoning) {
        parts.push({ type: "reasoning", text: finalReasoning });
      }

      // Add tool parts
      if (toolParts.length > 0) {
        console.log(
          "[AI] Adding tool parts to message parts array:",
          toolParts
        );
        parts.push(...toolParts);
      }

      // Add text part
      if (finalText) {
        parts.push({ type: "text", text: finalText });
      }

      console.log("[AI] Final parts to persist:", {
        count: parts.length,
        parts: JSON.stringify(parts, null, 2),
      });

      // Update message with all parts
      if (parts.length > 0) {
        console.log("[AI] Calling updateMessageParts with:", {
          messageId: args.assistantMessageId,
          partsCount: parts.length,
        });
        await ctx.runMutation(api.mutations.updateMessageParts, {
          messageId: args.assistantMessageId,
          parts,
        });
        console.log("[AI] updateMessageParts completed");
      }

      // 7. Mark message as complete
      await ctx.runMutation(api.mutations.updateMessageComplete, {
        messageId: args.assistantMessageId,
        isComplete: true,
      });

      // 8. Update chat usage context
      if (finalResult.usage) {
        try {
          // Await the usage promise if needed
          const usage: any = await finalResult.usage;

          // Extract usage data - handle both old and new AI SDK formats
          const serializableUsage = {
            promptTokens: usage.promptTokens || usage.inputTokens || 0,
            completionTokens: usage.completionTokens || usage.outputTokens || 0,
            totalTokens:
              usage.totalTokens ||
              (usage.promptTokens || usage.inputTokens || 0) +
                (usage.completionTokens || usage.outputTokens || 0),
          };

          await ctx.runMutation(api.mutations.updateChatLastContext, {
            chatId: args.chatId,
            context: serializableUsage,
          });
        } catch (usageError) {
          console.warn("Failed to save usage context:", usageError);
        }
      }

      await ctx.scheduler.runAfter(0, internal.ai.generateChatTitle, {
        chatId: args.chatId,
      });
    } catch (error) {
      console.error("Error generating assistant message:", error);

      // Write error message as final chunk
      await ctx.runMutation(api.mutations.createMessageChunk, {
        messageId: args.assistantMessageId,
        content: `\n\n[Error: ${error instanceof Error ? error.message : "Failed to generate response"}]`,
        sequence: textChunkSequence++,
      });

      // Still mark as complete to stop loading state
      await ctx.runMutation(api.mutations.updateMessageComplete, {
        messageId: args.assistantMessageId,
        isComplete: true,
      });
    } finally {
      if (!streamingUpdatesFinalized) {
        streamingUpdatesFinalized = true;
      }
      await pendingStreamingPublish.catch((error) => {
        console.error("[AI] Pending streaming A2A publish failed", error);
      });
      streamingToolParts.clear();
      removeA2AListener?.();
    }
  },
});

/**
 * Action to start a new chat message pair (user + assistant)
 * This creates both messages and schedules the AI generation
 */
export const startChatMessagePair = action({
  args: {
    chatId: v.string(), // Accept string ID from client
    userMessage: v.object({
      id: v.string(),
      role: v.string(),
      parts: v.any(),
      attachments: v.any(),
    }),
    userId: v.string(),
    selectedChatModel: v.string(),
    selectedVisibilityType: v.union(v.literal("public"), v.literal("private")),
    selectedReasoningEffort: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
    ),
    selectedTools: v.optional(v.array(v.string())),
    requestHints: v.optional(v.any()),
    title: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ userMessageId: unknown; assistantMessageId: unknown }> => {
    const deriveTitleFromMessage = (): string => {
      const parts = Array.isArray(args.userMessage.parts)
        ? args.userMessage.parts
        : [];

      const textPart = parts.find(
        (part: any) =>
          part && typeof part.text === "string" && part.type === "text"
      );

      const raw = typeof textPart?.text === "string" ? textPart.text : "";
      const normalized = raw.trim().replace(/\s+/g, " ");
      if (!normalized) {
        return "New Chat";
      }
      return normalized.length > 80
        ? normalized.slice(0, 80).trimEnd()
        : normalized;
    };

    const resolveTitle = (): string => {
      if (typeof args.title === "string") {
        const trimmed = args.title.trim();
        if (trimmed.length > 0) {
          return trimmed.length > 80 ? trimmed.slice(0, 80).trimEnd() : trimmed;
        }
      }
      return deriveTitleFromMessage();
    };

    const chatTitle = resolveTitle();

    // Check if chat exists, if not create it
    let chatId: any;
    try {
      // Try to parse as Convex ID
      const existingChat = await ctx.runQuery(api.queries.getChatById, {
        id: args.chatId as any,
      });
      chatId = args.chatId;

      if (existingChat) {
        chatId = existingChat._id;
      } else {
        chatId = await ctx.runMutation(api.mutations.saveChat, {
          userId: args.userId,
          title: chatTitle,
          visibility: args.selectedVisibilityType,
          slug: args.chatId,
        });
      }
    } catch {
      // If parsing fails, create new chat
      chatId = await ctx.runMutation(api.mutations.saveChat, {
        userId: args.userId,
        title: chatTitle,
        visibility: args.selectedVisibilityType,
        slug: args.chatId,
      });
    }

    // Get user memories for personalization
    const userMemories = await ctx.runQuery(api.queries.getActiveUserMemories, {
      userId: args.userId,
    });
    const memoryContext = userMemories?.map((memory) => ({
      title: memory.title,
      content: memory.content,
    }));

    // 1. Save user message
    const userMessageIds = await ctx.runMutation(api.mutations.saveMessages, {
      messages: [
        {
          chatId,
          role: args.userMessage.role,
          parts: args.userMessage.parts,
          attachments: args.userMessage.attachments || [],
          createdAt: Date.now(),
          isComplete: true, // User messages are always complete
        },
      ],
    });
    const userMessageId = userMessageIds[0];

    // 2. Create empty assistant message
    const assistantMessageId = await ctx.runMutation(
      api.mutations.createStreamingMessage,
      {
        chatId,
        role: "assistant",
      }
    );

    // 3. Schedule AI generation in background
    // NOTE: Add a small delay to ensure mutations are committed before querying
    await ctx.scheduler.runAfter(100, internal.ai.generateAssistantMessage, {
      chatId,
      assistantMessageId,
      userId: args.userId,
      selectedChatModel: args.selectedChatModel,
      selectedReasoningEffort: args.selectedReasoningEffort,
      selectedTools: args.selectedTools,
      requestHints: args.requestHints,
      userMemories: memoryContext,
    });

    return {
      userMessageId,
      assistantMessageId,
    };
  },
});

export const generateChatTitle = internalAction({
  args: {
    chatId: v.id("chats"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const chat = await ctx.runQuery(api.queries.getChatById, {
        id: args.chatId,
      });

      if (!chat) {
        return null;
      }

      const messages = await ctx.runQuery(api.queries.getMessagesByChatId, {
        chatId: args.chatId,
      });

      const completeMessages = messages
        .filter((message: any) => message.isComplete)
        .map((message: any) => {
          const rawParts = Array.isArray(message.parts)
            ? message.parts
            : message.parts
              ? [message.parts]
              : [];

          const text = rawParts
            .map((part: any) => {
              if (part && typeof part.text === "string") {
                return part.text.trim();
              }
              if (typeof part === "string") {
                return part.trim();
              }
              return "";
            })
            .filter((value: string) => value.length > 0)
            .join("\n")
            .trim();

          if (!text) {
            return null;
          }

          return {
            role: message.role,
            text,
          };
        })
        .filter(
          (
            entry: { role: string; text: string } | null
          ): entry is { role: string; text: string } => entry !== null
        );

      if (completeMessages.length === 0) {
        return null;
      }

      const lastAssistantMessage = [...completeMessages]
        .reverse()
        .find((entry) => entry.role === "assistant");

      if (!lastAssistantMessage) {
        return null;
      }

      const limitedMessages = completeMessages.slice(-12);
      const conversationForPrompt = limitedMessages
        .map((entry) => {
          const speaker = entry.role === "assistant" ? "Assistant" : "User";
          return `${speaker}: ${entry.text}`;
        })
        .join("\n\n");

      if (!conversationForPrompt) {
        return null;
      }

      const { MODEL_IDS } = await import("./lib/enums");
      const { myProvider } = await import("./lib/ai/providers");
      const prompt = [
        `Conversation transcript:\n${conversationForPrompt}`,
        `Most recent assistant response:\n${lastAssistantMessage.text}`,
        "Return only the title.",
      ].join("\n\n");

      const { text: generatedTitle } = await generateText({
        model: myProvider.languageModel(MODEL_IDS.TITLE_MODEL),
        system: [
          "You create concise, descriptive titles for chat conversations.",
          "Focus on summarizing the assistant's most recent response while",
          "considering the conversation context provided.",
          "Return at most 80 characters and avoid quotation marks.",
        ].join(" "),
        prompt,
        maxOutputTokens: 64,
      });

      const normalizedTitle = generatedTitle.trim().replace(/\s+/g, " ");

      if (!normalizedTitle) {
        return null;
      }

      const truncatedTitle =
        normalizedTitle.length > 80
          ? normalizedTitle.slice(0, 80).trimEnd()
          : normalizedTitle;

      if (truncatedTitle === chat.title) {
        return null;
      }

      await ctx.runMutation(api.mutations.updateChatTitle, {
        chatId: args.chatId,
        title: truncatedTitle,
      });
    } catch (error) {
      console.warn("Failed to generate chat title:", error);
    }

    return null;
  },
});
