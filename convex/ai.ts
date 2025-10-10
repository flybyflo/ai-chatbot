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
import type { DBMessage } from "./lib/utils";

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
      const { tools: allTools } = await getAllTools(
        a2aServersFromDb,
        mcpServersFromDb
      );

      const tools = Object.entries(allTools).reduce<Record<string, any>>(
        (acc, [toolName, toolImpl]) => {
          if (!args.selectedTools || args.selectedTools.includes(toolName)) {
            acc[toolName] = toolImpl;
          }
          return acc;
        },
        {}
      );

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
      console.log("🌊 Starting fullStream processing...");
      let partCount = 0;
      let textDeltaCount = 0;
      let reasoningDeltaCount = 0;

      for await (const part of result.fullStream) {
        partCount++;
        console.log(`📦 Part #${partCount}: type=${part.type}`);

        const now = Date.now();

        // Handle text deltas
        if (part.type === "text-delta") {
          textDeltaCount++;
          textBuffer += part.text; // AI SDK v5 uses 'text' not 'textDelta'
          console.log(
            `✍️ Text delta #${textDeltaCount}, buffer length: ${textBuffer.length}`
          );

          // Flush text buffer if threshold reached or time elapsed
          if (
            (textBuffer.length >= bufferThreshold ||
              now - lastTextFlushTime >= timeThreshold) &&
            textBuffer.length > 0
          ) {
            console.log(`💾 Flushing text buffer (${textBuffer.length} chars)`);
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
          reasoningDeltaCount++;
          reasoningBuffer += part.text; // AI SDK v5 uses 'text' not 'reasoningDelta'
          console.log(
            `🧠 Reasoning delta #${reasoningDeltaCount}, buffer length: ${reasoningBuffer.length}, text: "${part.text.substring(0, 50)}..."`
          );

          // Flush reasoning buffer if threshold reached or time elapsed
          if (
            (reasoningBuffer.length >= bufferThreshold ||
              now - lastReasoningFlushTime >= timeThreshold) &&
            reasoningBuffer.length > 0
          ) {
            console.log(
              `💾 Flushing reasoning buffer (${reasoningBuffer.length} chars)`
            );
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

      console.log(
        `✅ Stream complete: ${partCount} total parts (${textDeltaCount} text, ${reasoningDeltaCount} reasoning)`
      );
      console.log("🧾 Stream summary snapshot:", {
        textChunkSequence,
        reasoningChunkSequence,
        textBufferLength: textBuffer.length,
        reasoningBufferLength: reasoningBuffer.length,
      });

      // Final flush for both text and reasoning
      if (textBuffer.length > 0) {
        console.log(`💾 Final text flush (${textBuffer.length} chars)`);
        await ctx.runMutation(api.mutations.createMessageChunk, {
          messageId: args.assistantMessageId,
          content: textBuffer,
          sequence: textChunkSequence++,
        });
      }

      if (reasoningBuffer.length > 0) {
        console.log(
          `💾 Final reasoning flush (${reasoningBuffer.length} chars)`
        );
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
      console.log("🧪 Final result diagnostics:", {
        // biome-ignore lint/suspicious/noPrototypeBuiltins: must be this way
        hasReasoningProperty: Object.prototype.hasOwnProperty.call(
          finalResult,
          "reasoning"
        ),
        reasoningType: rawReasoning === null ? "null" : typeof rawReasoning,
        reasoningConstructor:
          rawReasoning &&
          typeof rawReasoning === "object" &&
          rawReasoning.constructor
            ? rawReasoning.constructor.name
            : null,
        reasoningIsPromise:
          rawReasoning &&
          typeof rawReasoning === "object" &&
          typeof (rawReasoning as Promise<unknown>).then === "function",
        reasoningIsArray: Array.isArray(rawReasoning),
        reasoningLength: Array.isArray(rawReasoning) ? rawReasoning.length : 0,
        reasoningPreview: Array.isArray(rawReasoning)
          ? rawReasoning
              .map((r: any) =>
                typeof r?.text === "string" ? r.text.substring(0, 80) : null
              )
              .filter((r: string | null) => r)
          : typeof rawReasoning === "string"
            ? rawReasoning.substring(0, 120)
            : null,
        // biome-ignore lint/suspicious/noPrototypeBuiltins: must be this way
        hasResponse: Object.prototype.hasOwnProperty.call(
          finalResult,
          "response"
        ),
        responseKeys:
          typeof (finalResult as any).response === "object" &&
          (finalResult as any).response !== null
            ? Object.keys((finalResult as any).response)
            : null,
      });

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
      console.log("🔍 Checking finalResult.reasoning:", {
        hasReasoning: !!finalResult.reasoning,
        isArray: Array.isArray(finalResult.reasoning),
        length: Array.isArray(finalResult.reasoning)
          ? finalResult.reasoning.length
          : 0,
      });

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
            console.log(
              `🧠 Awaited reasoning array extracted: ${finalReasoning.length} chars`
            );
          } else if (typeof awaitedReasoning === "string") {
            finalReasoning = awaitedReasoning;
            console.log(
              `🧠 Awaited reasoning string extracted: ${finalReasoning.length} chars`
            );
          } else if (awaitedReasoning && typeof awaitedReasoning === "object") {
            const maybeText = (awaitedReasoning as any).text;
            if (typeof maybeText === "string" && maybeText.length > 0) {
              finalReasoning = maybeText;
              console.log(
                `🧠 Awaited reasoning object text extracted: ${finalReasoning.length} chars`
              );
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
        console.log(
          `🧠 Final reasoning extracted: ${finalReasoning.length} chars`
        );
      } else if (typeof rawReasoning === "string" && rawReasoning.length > 0) {
        finalReasoning = rawReasoning;
        console.log(
          `🧠 Final reasoning string extracted: ${finalReasoning.length} chars`
        );
      } else if (rawReasoning && typeof rawReasoning === "object") {
        const maybeText = (rawReasoning as any).text;
        if (typeof maybeText === "string" && maybeText.length > 0) {
          finalReasoning = maybeText;
          console.log(
            `🧠 Final reasoning object text extracted: ${finalReasoning.length} chars`
          );
        } else {
          console.log("🧠 Reasoning object did not include text field:", {
            keys: Object.keys(rawReasoning),
          });
        }
      } else {
        console.log(
          "⚠️ No finalResult.reasoning returned by provider. Falling back to streamed chunks.",
          {
            reasoningChunkSequence,
            reasoningBufferLength: reasoningBuffer.length,
            streamedReasoningLength: streamedReasoning.length,
          }
        );
        if (!finalReasoning && streamedReasoning.length > 0) {
          finalReasoning = streamedReasoning;
          console.log(
            `🧠 Using streamed reasoning fallback (${finalReasoning.length} chars)`
          );
        }
      }

      // 6. Extract tool calls and results from steps
      const flattenSteps = (items: any[]): any[] =>
        items.flatMap((item) =>
          Array.isArray(item) ? flattenSteps(item) : [item]
        );

      const stepsToArray = async (value: any): Promise<any[]> => {
        if (!value) {
          return [];
        }

        if (Array.isArray(value)) {
          return flattenSteps(value);
        }

        if (
          typeof value === "object" &&
          typeof (value as PromiseLike<any>).then === "function"
        ) {
          return stepsToArray(await value);
        }

        if (
          typeof value === "object" &&
          value !== null &&
          typeof (value as any).toArray === "function"
        ) {
          return stepsToArray(await (value as any).toArray());
        }

        if (
          typeof value === "object" &&
          value !== null &&
          typeof (value as any)[Symbol.iterator] === "function"
        ) {
          return stepsToArray(Array.from(value as Iterable<any>));
        }

        if (
          typeof value === "object" &&
          value !== null &&
          typeof (value as any)[Symbol.asyncIterator] === "function"
        ) {
          const collected: any[] = [];
          for await (const entry of value as AsyncIterable<any>) {
            collected.push(...(await stepsToArray(entry)));
          }
          return collected;
        }

        return [];
      };

      const rawSteps = (finalResult as any)?.steps;
      console.log("[AI] Processing steps for tool calls:", {
        hasSteps: !!rawSteps,
        isArray: Array.isArray(rawSteps),
        hasThen:
          rawSteps &&
          typeof rawSteps === "object" &&
          typeof (rawSteps as PromiseLike<any>).then === "function",
        hasToArray:
          rawSteps &&
          typeof rawSteps === "object" &&
          rawSteps !== null &&
          typeof (rawSteps as any).toArray === "function",
        hasIterator:
          rawSteps &&
          typeof rawSteps === "object" &&
          rawSteps !== null &&
          typeof (rawSteps as any)[Symbol.iterator] === "function",
        hasAsyncIterator:
          rawSteps &&
          typeof rawSteps === "object" &&
          rawSteps !== null &&
          typeof (rawSteps as any)[Symbol.asyncIterator] === "function",
      });

      let resolvedSteps = await stepsToArray(rawSteps);

      if (resolvedSteps.length === 0) {
        const responseSteps = (finalResult as any)?.response?.steps;
        if (responseSteps) {
          console.log("[AI] Trying response.steps fallback");
          resolvedSteps = await stepsToArray(responseSteps);
        }
      }

      console.log(
        "[AI] After processing steps, toolPartsMap size:",
        resolvedSteps.length
      );

      const toolParts: any[] = [];
      if (resolvedSteps.length > 0) {
        console.log(
          `🔧 Processing ${resolvedSteps.length} steps for tool calls`
        );

        for (const step of resolvedSteps) {
          if (step.toolCalls && Array.isArray(step.toolCalls)) {
            console.log(`🔧 Found ${step.toolCalls.length} tool calls in step`);

            for (const toolCall of step.toolCalls) {
              const toolName = toolCall.toolName || "";
              const toolCallId = toolCall.toolCallId || "";
              const toolArgs = toolCall.args || {};

              // Find matching tool result
              const toolResult = step.toolResults?.find(
                (r: any) => r.toolCallId === toolCallId
              );

              console.log("🔧 Tool call:", {
                toolName,
                toolCallId,
                hasResult: !!toolResult,
              });

              // Check if this is a dynamic tool (MCP or A2A)
              // Dynamic tools typically have underscore in their name (e.g., better-auth_search)
              if (toolName.includes("_")) {
                const state = toolResult
                  ? "output-available"
                  : "input-available";

                const toolPart: any = {
                  type: "dynamic-tool",
                  toolCallId,
                  toolName,
                  state,
                  input: toolArgs,
                };

                if (toolResult) {
                  if (toolResult.result) {
                    toolPart.output = toolResult.result;
                  }
                  if ((toolResult as any).error) {
                    toolPart.errorText = String((toolResult as any).error);
                  }
                }

                toolParts.push(toolPart);
                console.log(`✅ Added dynamic tool part: ${toolName}`);
              }
            }
          }
        }
      }

      console.log(`🔧 Total tool parts extracted: ${toolParts.length}`);

      // 7. Update message parts with final content (reasoning + tools + text)
      const parts: any[] = [];

      // Add reasoning part first (if exists) so it appears before text
      if (finalReasoning) {
        console.log(
          `➕ Adding reasoning part (${finalReasoning.length} chars)`
        );
        parts.push({ type: "reasoning", text: finalReasoning });
      }

      // Add tool parts
      if (toolParts.length > 0) {
        console.log(`➕ Adding ${toolParts.length} tool parts`);
        parts.push(...toolParts);
      }

      // Add text part
      if (finalText) {
        console.log(`➕ Adding text part (${finalText.length} chars)`);
        parts.push({ type: "text", text: finalText });
      }

      console.log(`📝 Updating message parts: ${parts.length} parts total`);

      // Update message with all parts
      if (parts.length > 0) {
        await ctx.runMutation(api.mutations.updateMessageParts, {
          messageId: args.assistantMessageId,
          parts,
        });
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
