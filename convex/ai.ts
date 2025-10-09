"use node";

import {
  convertToModelMessages,
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

    let chunkSequence = 0;
    let buffer = "";
    const bufferThreshold = 50; // characters
    let lastFlushTime = Date.now();
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
      const uiMessages = convertToUIMessages(
        messagesFromDb
          .filter((msg) => msg.isComplete && msg.parts && msg.parts.length > 0)
          .map(
            (msg): DBMessage => ({
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

      // 5. Stream tokens and write chunks to database
      for await (const textChunk of result.textStream) {
        buffer += textChunk;
        const now = Date.now();

        // Flush buffer if threshold reached or time elapsed
        if (
          (buffer.length >= bufferThreshold ||
            now - lastFlushTime >= timeThreshold) &&
          buffer.length > 0
        ) {
          await ctx.runMutation(api.mutations.createMessageChunk, {
            messageId: args.assistantMessageId,
            content: buffer,
            sequence: chunkSequence++,
          });
          buffer = "";
          lastFlushTime = now;
        }
      }

      // Final flush
      if (buffer.length > 0) {
        await ctx.runMutation(api.mutations.createMessageChunk, {
          messageId: args.assistantMessageId,
          content: buffer,
          sequence: chunkSequence++,
        });
      }

      // Get the final result for usage tracking
      const finalResult = await result;
      let finalText: string | null = null;
      if (typeof finalResult.text === "string") {
        finalText = finalResult.text;
      } else if (
        finalResult.text &&
        typeof (finalResult.text as Promise<string>).then === "function"
      ) {
        finalText = await finalResult.text;
      }

      // 6. Update message parts with final content
      const allChunks = await ctx.runQuery(api.queries.getMessageById, {
        id: args.assistantMessageId,
      });

      // Update the message with final parts (combining chunks into proper format)
      if (allChunks && finalText) {
        await ctx.runMutation(api.mutations.saveMessages, {
          messages: [
            {
              chatId: args.chatId,
              role: "assistant",
              parts: [{ type: "text", text: finalText }],
              attachments: [],
              createdAt: Date.now(),
              isComplete: true,
            },
          ],
        });
      }

      // 7. Mark message as complete
      await ctx.runMutation(api.mutations.updateMessageComplete, {
        messageId: args.assistantMessageId,
        isComplete: true,
      });

      // 8. Update chat usage context
      if (finalResult.usage) {
        await ctx.runMutation(api.mutations.updateChatLastContext, {
          chatId: args.chatId,
          context: finalResult.usage,
        });
      }
    } catch (error) {
      console.error("Error generating assistant message:", error);

      // Write error message as final chunk
      await ctx.runMutation(api.mutations.createMessageChunk, {
        messageId: args.assistantMessageId,
        content: `\n\n[Error: ${error instanceof Error ? error.message : "Failed to generate response"}]`,
        sequence: chunkSequence++,
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
          title: args.title || "New Chat",
          visibility: args.selectedVisibilityType,
          slug: args.chatId,
        });
      }
    } catch {
      // If parsing fails, create new chat
      chatId = await ctx.runMutation(api.mutations.saveChat, {
        userId: args.userId,
        title: args.title || "New Chat",
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
    await ctx.scheduler.runAfter(0, internal.ai.generateAssistantMessage, {
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
