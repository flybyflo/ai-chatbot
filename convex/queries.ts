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
    const attemptingId = args.id as Id<"chats">;
    const byId = await ctx.db.get(attemptingId);
    if (byId) {
      return byId;
    }

    if (typeof args.id === "string") {
      try {
        const bySlug = await ctx.db
          .query("chats")
          .withIndex("by_slug", (q) => q.eq("slug", args.id))
          .unique();
        return bySlug ?? null;
      } catch (error) {
        console.warn("Failed to locate chat by slug", error);
      }
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

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) => q.eq("chatId", chatId))
      .order("asc")
      .collect();

    // Fetch chunks for each message and combine them
    const messagesWithChunks = await Promise.all(
      messages.map(async (message) => {
        const chunks = await ctx.db
          .query("messageChunks")
          .withIndex("by_messageId", (q) => q.eq("messageId", message._id))
          .order("asc")
          .collect();

        // If message has chunks, combine them into parts
        if (chunks.length > 0) {
          const combinedText = chunks.map((c) => c.content).join("");
          return {
            ...message,
            chunks, // Include raw chunks for debugging/streaming UI
            combinedContent: combinedText, // Combined text for convenience
          };
        }

        return { ...message, chunks: [], combinedContent: null };
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
