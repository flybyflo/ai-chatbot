import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";

// ============================================================================
// User Queries
// ============================================================================

export const getUserByEmail = query({
  args: { email: v.string() },
  handler: (_ctx, _args) => {
    // Note: User table is managed by Better Auth component
    // This would need to use the Better Auth component methods
    // For now, returning null - implement with authComponent if needed
    return null;
  },
});

// ============================================================================
// Chat Queries
// ============================================================================

export const getChatById = query({
  args: { id: v.union(v.id("chats"), v.string()) },
  handler: async (ctx, args) => {
    // Try direct ID lookup first
    try {
      const byId = await ctx.db.get(args.id as Id<"chats">);
      if (byId) {
        return byId;
      }
    } catch (_error) {
      // ID lookup failed, will try slug below
    }

    // If not found by ID, try slug lookup
    try {
      const bySlug = await ctx.db
        .query("chats")
        .withIndex("by_slug", (q) => q.eq("slug", args.id as string))
        .unique();
      return bySlug ?? null;
    } catch (error) {
      console.warn("Failed to locate chat by slug", error);
    }

    return null;
  },
});

export const getChatsByUserId = query({
  args: {
    userId: v.string(),
    limit: v.number(),
    cursor: v.optional(v.string()),
    direction: v.optional(v.union(v.literal("forward"), v.literal("backward"))),
  },
  handler: async (ctx, args) => {
    const { userId, limit } = args;

    const chatsQuery = ctx.db
      .query("chats")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc");

    // Handle pagination if cursor provided
    // Note: Convex pagination works differently - this is simplified
    const chats = await chatsQuery.take(limit + 1);

    const hasMore = chats.length > limit;
    const items = hasMore ? chats.slice(0, limit) : chats;

    return {
      chats: items,
      hasMore,
    };
  },
});

// ============================================================================
// Message Queries
// ============================================================================

export const getMessagesByChatId = query({
  args: { chatId: v.union(v.id("chats"), v.string()) },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      chatId: v.id("chats"),
      role: v.union(v.literal("user"), v.literal("assistant")),
      parts: v.any(),
      attachments: v.any(),
      isComplete: v.boolean(),
      createdAt: v.number(),
      chunks: v.array(
        v.object({
          _id: v.id("messageChunks"),
          _creationTime: v.number(),
          messageId: v.id("messages"),
          content: v.string(),
          sequence: v.number(),
          createdAt: v.number(),
        })
      ),
      reasoningChunks: v.array(
        v.object({
          _id: v.id("reasoningChunks"),
          _creationTime: v.number(),
          messageId: v.id("messages"),
          content: v.string(),
          sequence: v.number(),
          createdAt: v.number(),
        })
      ),
      combinedContent: v.union(v.string(), v.null()),
      combinedReasoning: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx, args) => {
    let chatId: Id<"chats"> | null = null;

    // Try to use as Convex ID first
    try {
      const directLookup = await ctx.db.get(args.chatId as Id<"chats">);
      if (directLookup) {
        chatId = args.chatId as Id<"chats">;
      } else {
        // If not found by ID, try slug lookup
        const chat = await ctx.db
          .query("chats")
          .withIndex("by_slug", (q) => q.eq("slug", args.chatId as string))
          .unique();
        chatId = chat?._id ?? null;
      }
    } catch {
      // If ID parsing fails, try slug lookup
      const chat = await ctx.db
        .query("chats")
        .withIndex("by_slug", (q) => q.eq("slug", args.chatId as string))
        .unique();
      chatId = chat?._id ?? null;
    }

    if (!chatId) {
      return [];
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) => q.eq("chatId", chatId))
      .order("asc")
      .collect();

    // Fetch chunks (both text and reasoning) for each message and combine them
    const messagesWithChunks = await Promise.all(
      messages.map(async (message) => {
        const chunks = await ctx.db
          .query("messageChunks")
          .withIndex("by_messageId", (q) => q.eq("messageId", message._id))
          .order("asc")
          .collect();

        const reasoningChunks = await ctx.db
          .query("reasoningChunks")
          .withIndex("by_messageId", (q) => q.eq("messageId", message._id))
          .order("asc")
          .collect();

        // Combine text chunks
        let combinedContent: string | null = null;
        if (chunks.length > 0) {
          combinedContent = chunks.map((c) => c.content).join("");
        }

        // Combine reasoning chunks
        let combinedReasoning: string | null = null;
        if (reasoningChunks.length > 0) {
          combinedReasoning = reasoningChunks.map((c) => c.content).join("");
        }

        return {
          _id: message._id,
          _creationTime: message._creationTime,
          chatId: message.chatId,
          role: message.role as "user" | "assistant",
          parts: message.parts,
          attachments: message.attachments,
          isComplete: message.isComplete ?? false,
          createdAt: message.createdAt,
          chunks,
          reasoningChunks,
          combinedContent,
          combinedReasoning,
        };
      })
    );

    return messagesWithChunks;
  },
});

export const getMessageById = query({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getMessageCountByUserId = query({
  args: {
    userId: v.string(),
    differenceInHours: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, differenceInHours } = args;
    const twentyFourHoursAgo = Date.now() - differenceInHours * 60 * 60 * 1000;

    // Get all chats for this user
    const userChats = await ctx.db
      .query("chats")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const chatIds = userChats.map((chat) => chat._id);

    // Count user messages in those chats within the time window
    let count = 0;
    for (const chatId of chatIds) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_chatId", (q) => q.eq("chatId", chatId))
        .filter((q) =>
          q.and(
            q.eq(q.field("role"), "user"),
            q.gte(q.field("createdAt"), twentyFourHoursAgo)
          )
        )
        .collect();
      count += messages.length;
    }

    return count;
  },
});

// ============================================================================
// Vote Queries
// ============================================================================

export const getVotesByChatId = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("votes")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .collect();
  },
});

// ============================================================================
// Stream Queries
// ============================================================================

export const getStreamIdsByChatId = query({
  args: { chatId: v.union(v.id("chats"), v.string()) },
  handler: async (ctx, args) => {
    let chatId: Id<"chats"> | null = null;

    if (typeof args.chatId === "string") {
      const chat = await ctx.db
        .query("chats")
        .withIndex("by_slug", (q) => q.eq("slug", args.chatId))
        .unique();
      chatId = chat?._id ?? null;
    } else {
      chatId = args.chatId;
    }

    if (!chatId) {
      return [];
    }

    if (!chatId) {
      return [];
    }

    const streams = await ctx.db
      .query("streams")
      .withIndex("by_chatId", (q) => q.eq("chatId", chatId))
      .order("asc")
      .collect();

    return streams.map((stream) => stream._id);
  },
});

// ============================================================================
// User Memory Queries
// ============================================================================

export const getUserMemories = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userMemory")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getActiveUserMemories = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userMemory")
      .withIndex("by_userId_isActive", (q) =>
        q.eq("userId", args.userId).eq("isActive", true)
      )
      .order("desc")
      .collect();
  },
});

// ============================================================================
// User MCP Server Queries
// ============================================================================

export const getUserMCPServers = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userMCPServers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getActiveUserMCPServers = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userMCPServers")
      .withIndex("by_userId_isActive", (q) =>
        q.eq("userId", args.userId).eq("isActive", true)
      )
      .order("desc")
      .collect();
  },
});

export const getUserMCPRegistrySnapshots = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userMCPRegistrySnapshots")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getUserMCPRegistrySnapshotByServer = query({
  args: {
    userId: v.string(),
    serverId: v.id("userMCPServers"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userMCPRegistrySnapshots")
      .withIndex("by_userId_serverId", (q) =>
        q.eq("userId", args.userId).eq("serverId", args.serverId)
      )
      .unique();
  },
});

// ============================================================================
// User A2A Server Queries
// ============================================================================

export const getUserA2AServers = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userA2AServers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getActiveUserA2AServers = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userA2AServers")
      .withIndex("by_userId_isActive", (q) =>
        q.eq("userId", args.userId).eq("isActive", true)
      )
      .order("desc")
      .collect();
  },
});

export const getUserA2AServerById = query({
  args: {
    id: v.id("userA2AServers"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const server = await ctx.db.get(args.id);
    if (!server || server.userId !== args.userId) {
      return null;
    }
    return server;
  },
});

// ============================================================================
// User Loadout Queries
// ============================================================================

export const getUserLoadouts = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userLoadouts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getUserLoadoutById = query({
  args: {
    id: v.id("userLoadouts"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const loadout = await ctx.db.get(args.id);
    if (!loadout || loadout.userId !== args.userId) {
      return null;
    }
    return loadout;
  },
});

export const getDefaultLoadout = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const loadouts = await ctx.db
      .query("userLoadouts")
      .withIndex("by_userId_isDefault", (q) =>
        q.eq("userId", args.userId).eq("isDefault", true)
      )
      .first();

    return loadouts;
  },
});

// ============================================================================
// User Selected Tools Queries
// ============================================================================

export const getUserSelectedTools = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      selectedTools: v.array(v.string()),
      selectedMcpTools: v.array(v.string()),
      selectedA2AServers: v.array(v.string()),
      selectedLocalTools: v.array(v.string()),
      selectedChatModel: v.optional(v.string()),
      selectedReasoningEffort: v.optional(
        v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
      ),
      activeLoadoutId: v.optional(v.union(v.string(), v.null())),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const record = await ctx.db
      .query("userSelectedTools")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();

    if (!record) {
      return null;
    }

    return {
      selectedTools: record.selectedTools ?? [],
      selectedMcpTools: record.selectedMcpTools ?? [],
      selectedA2AServers: record.selectedA2AServers ?? [],
      selectedLocalTools: record.selectedLocalTools ?? [],
      selectedChatModel: record.selectedChatModel ?? undefined,
      selectedReasoningEffort: record.selectedReasoningEffort ?? undefined,
      activeLoadoutId:
        record.activeLoadoutId === undefined
          ? null
          : (record.activeLoadoutId ?? null),
      updatedAt: record.updatedAt ?? record._creationTime,
    };
  },
});

// ============================================================================
// A2A Data Queries
// ============================================================================

export const getA2AData = query({
  args: {},
  returns: v.object({
    registry: v.union(v.null(), v.any()),
    sessions: v.array(
      v.object({
        sessionKey: v.string(),
        snapshot: v.any(),
      })
    ),
    events: v.array(v.any()),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        registry: null,
        sessions: [],
        events: [],
      };
    }

    const userId = identity.subject;

    const registryDocs = await ctx.db
      .query("a2aRegistries")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    let latestRegistry: any = null;
    let latestUpdatedAt = Number.NEGATIVE_INFINITY;

    for (const doc of registryDocs) {
      const updatedAt = doc.updatedAt ?? doc._creationTime;
      if (updatedAt > latestUpdatedAt) {
        latestUpdatedAt = updatedAt;
        latestRegistry = doc.registry;
      }
    }

    const sessionDocs = await ctx.db
      .query("a2aSessions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const sessions = sessionDocs.map((doc) => ({
      sessionKey: doc.sessionKey,
      snapshot: doc.snapshot,
    }));

    const eventDocs = await ctx.db
      .query("a2aEvents")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);

    const events = eventDocs.map((doc) => doc.payload);

    return {
      registry: latestRegistry ?? null,
      sessions,
      events,
    };
  },
});
