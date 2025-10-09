import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";

// ============================================================================
// Chat Mutations
// ============================================================================

export const saveChat = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    visibility: v.union(v.literal("public"), v.literal("private")),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const chatId = await ctx.db.insert("chats", {
      createdAt: Date.now(),
      userId: args.userId,
      title: args.title,
      visibility: args.visibility,
      slug: args.slug,
    });
    return chatId;
  },
});

export const deleteChatById = mutation({
  args: { id: v.id("chats") },
  handler: async (ctx, args) => {
    // Delete associated votes
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.id))
      .collect();
    for (const vote of votes) {
      await ctx.db.delete(vote._id);
    }

    // Delete associated messages
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.id))
      .collect();
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete associated streams
    const streams = await ctx.db
      .query("streams")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.id))
      .collect();
    for (const stream of streams) {
      await ctx.db.delete(stream._id);
    }

    // Delete the chat
    const chat = await ctx.db.get(args.id);
    await ctx.db.delete(args.id);
    return chat;
  },
});

export const updateChatVisibility = mutation({
  args: {
    chatId: v.id("chats"),
    visibility: v.union(v.literal("public"), v.literal("private")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.chatId, { visibility: args.visibility });
  },
});

export const updateChatLastContext = mutation({
  args: {
    chatId: v.id("chats"),
    context: v.any(), // AppUsage type
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.chatId, { lastContext: args.context });
  },
});

// ============================================================================
// Message Mutations
// ============================================================================

export const saveMessages = mutation({
  args: {
    messages: v.array(
      v.object({
        chatId: v.id("chats"),
        role: v.string(),
        parts: v.any(),
        attachments: v.any(),
        createdAt: v.number(),
        isComplete: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ids: Id<"messages">[] = [];
    for (const message of args.messages) {
      const id = await ctx.db.insert("messages", message);
      ids.push(id);
    }
    return ids;
  },
});

// Create a message chunk for streaming AI responses
export const createMessageChunk = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
    sequence: v.number(),
  },
  handler: async (ctx, args) => {
    const chunkId = await ctx.db.insert("messageChunks", {
      messageId: args.messageId,
      content: args.content,
      sequence: args.sequence,
      createdAt: Date.now(),
    });
    return chunkId;
  },
});

// Mark a message as complete (streaming finished)
export const updateMessageComplete = mutation({
  args: {
    messageId: v.id("messages"),
    isComplete: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { isComplete: args.isComplete });
  },
});

// Initialize a streaming assistant message
export const createStreamingMessage = mutation({
  args: {
    chatId: v.id("chats"),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      chatId: args.chatId,
      role: args.role,
      parts: [], // Empty initially
      attachments: [],
      createdAt: Date.now(),
      isComplete: false,
    });
    return messageId;
  },
});

export const deleteMessagesByChatIdAfterTimestamp = mutation({
  args: {
    chatId: v.id("chats"),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .filter((q) => q.gte(q.field("createdAt"), args.timestamp))
      .collect();

    const messageIds = messages.map((m) => m._id);

    // Delete associated votes
    for (const messageId of messageIds) {
      const votes = await ctx.db
        .query("votes")
        .withIndex("by_messageId", (q) => q.eq("messageId", messageId))
        .collect();
      for (const vote of votes) {
        await ctx.db.delete(vote._id);
      }
    }

    // Delete messages
    for (const messageId of messageIds) {
      await ctx.db.delete(messageId);
    }
  },
});

// ============================================================================
// Vote Mutations
// ============================================================================

export const voteMessage = mutation({
  args: {
    chatId: v.id("chats"),
    messageId: v.id("messages"),
    isUpvoted: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Check for existing vote
    const existingVote = await ctx.db
      .query("votes")
      .withIndex("by_chatId_messageId", (q) =>
        q.eq("chatId", args.chatId).eq("messageId", args.messageId)
      )
      .first();

    if (existingVote) {
      await ctx.db.patch(existingVote._id, { isUpvoted: args.isUpvoted });
    } else {
      await ctx.db.insert("votes", {
        chatId: args.chatId,
        messageId: args.messageId,
        isUpvoted: args.isUpvoted,
      });
    }
  },
});

// ============================================================================
// Stream Mutations
// ============================================================================

export const createStreamId = mutation({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, args) => {
    const streamId = await ctx.db.insert("streams", {
      chatId: args.chatId,
      createdAt: Date.now(),
    });
    return streamId;
  },
});

// ============================================================================
// User Memory Mutations
// ============================================================================

export const createUserMemory = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("userMemory", {
      userId: args.userId,
      title: args.title,
      content: args.content,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const updateUserMemory = mutation({
  args: {
    id: v.id("userMemory"),
    userId: v.string(),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db.get(args.id);
    if (!memory || memory.userId !== args.userId) {
      return null;
    }

    const updateData: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) {
      updateData.title = args.title;
    }
    if (args.content !== undefined) {
      updateData.content = args.content;
    }
    if (args.isActive !== undefined) {
      updateData.isActive = args.isActive;
    }

    await ctx.db.patch(args.id, updateData);
    return await ctx.db.get(args.id);
  },
});

export const deleteUserMemory = mutation({
  args: {
    id: v.id("userMemory"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db.get(args.id);
    if (!memory || memory.userId !== args.userId) {
      return false;
    }
    await ctx.db.delete(args.id);
    return true;
  },
});

// ============================================================================
// User MCP Server Mutations
// ============================================================================

export const createUserMCPServer = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    url: v.string(),
    description: v.optional(v.string()),
    headers: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("userMCPServers", {
      userId: args.userId,
      name: args.name,
      url: args.url,
      description: args.description,
      headers: args.headers,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const updateUserMCPServer = mutation({
  args: {
    id: v.id("userMCPServers"),
    userId: v.string(),
    name: v.optional(v.string()),
    url: v.optional(v.string()),
    description: v.optional(v.string()),
    headers: v.optional(v.any()),
    isActive: v.optional(v.boolean()),
    lastConnectionTest: v.optional(v.number()),
    lastConnectionStatus: v.optional(v.string()),
    lastError: v.optional(v.string()),
    toolCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const server = await ctx.db.get(args.id);
    if (!server || server.userId !== args.userId) {
      return null;
    }

    const updateData: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      updateData.name = args.name;
    }
    if (args.url !== undefined) {
      updateData.url = args.url;
    }
    if (args.description !== undefined) {
      updateData.description = args.description;
    }
    if (args.headers !== undefined) {
      updateData.headers = args.headers;
    }
    if (args.isActive !== undefined) {
      updateData.isActive = args.isActive;
    }
    if (args.lastConnectionTest !== undefined) {
      updateData.lastConnectionTest = args.lastConnectionTest;
    }
    if (args.lastConnectionStatus !== undefined) {
      updateData.lastConnectionStatus = args.lastConnectionStatus;
    }
    if (args.lastError !== undefined) {
      updateData.lastError = args.lastError;
    }
    if (args.toolCount !== undefined) {
      updateData.toolCount = args.toolCount;
    }

    await ctx.db.patch(args.id, updateData);
    return await ctx.db.get(args.id);
  },
});

export const deleteUserMCPServer = mutation({
  args: {
    id: v.id("userMCPServers"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const server = await ctx.db.get(args.id);
    if (!server || server.userId !== args.userId) {
      return false;
    }
    await ctx.db.delete(args.id);
    return true;
  },
});

// ============================================================================
// User A2A Server Mutations
// ============================================================================

export const createUserA2AServer = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    cardUrl: v.string(),
    description: v.optional(v.string()),
    headers: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("userA2AServers", {
      userId: args.userId,
      name: args.name,
      cardUrl: args.cardUrl,
      description: args.description,
      headers: args.headers,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const updateUserA2AServer = mutation({
  args: {
    id: v.id("userA2AServers"),
    userId: v.string(),
    name: v.optional(v.string()),
    cardUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    headers: v.optional(v.any()),
    isActive: v.optional(v.boolean()),
    lastConnectionTest: v.optional(v.number()),
    lastConnectionStatus: v.optional(v.string()),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const server = await ctx.db.get(args.id);
    if (!server || server.userId !== args.userId) {
      return null;
    }

    const updateData: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      updateData.name = args.name;
    }
    if (args.cardUrl !== undefined) {
      updateData.cardUrl = args.cardUrl;
    }
    if (args.description !== undefined) {
      updateData.description = args.description;
    }
    if (args.headers !== undefined) {
      updateData.headers = args.headers;
    }
    if (args.isActive !== undefined) {
      updateData.isActive = args.isActive;
    }
    if (args.lastConnectionTest !== undefined) {
      updateData.lastConnectionTest = args.lastConnectionTest;
    }
    if (args.lastConnectionStatus !== undefined) {
      updateData.lastConnectionStatus = args.lastConnectionStatus;
    }
    if (args.lastError !== undefined) {
      updateData.lastError = args.lastError;
    }

    await ctx.db.patch(args.id, updateData);
    return await ctx.db.get(args.id);
  },
});

export const deleteUserA2AServer = mutation({
  args: {
    id: v.id("userA2AServers"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const server = await ctx.db.get(args.id);
    if (!server || server.userId !== args.userId) {
      return false;
    }
    await ctx.db.delete(args.id);
    return true;
  },
});

// ============================================================================
// User Loadout Mutations
// ============================================================================

export const createUserLoadout = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isDefault: v.optional(v.boolean()),
    selectedTools: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // If setting as default, unset all other defaults for this user
    if (args.isDefault) {
      const existingDefaults = await ctx.db
        .query("userLoadouts")
        .withIndex("by_userId_isDefault", (q) =>
          q.eq("userId", args.userId).eq("isDefault", true)
        )
        .collect();

      for (const loadout of existingDefaults) {
        await ctx.db.patch(loadout._id, { isDefault: false });
      }
    }

    const id = await ctx.db.insert("userLoadouts", {
      userId: args.userId,
      name: args.name,
      description: args.description,
      color: args.color || "#8b5cf6",
      tags: args.tags || [],
      isDefault: args.isDefault || false,
      selectedTools: args.selectedTools || [],
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const updateUserLoadout = mutation({
  args: {
    id: v.id("userLoadouts"),
    userId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isDefault: v.optional(v.boolean()),
    selectedTools: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const loadout = await ctx.db.get(args.id);
    if (!loadout || loadout.userId !== args.userId) {
      return null;
    }

    // If setting as default, unset all other defaults for this user
    if (args.isDefault) {
      const existingDefaults = await ctx.db
        .query("userLoadouts")
        .withIndex("by_userId_isDefault", (q) =>
          q.eq("userId", args.userId).eq("isDefault", true)
        )
        .collect();

      for (const existingDefault of existingDefaults) {
        if (existingDefault._id !== args.id) {
          await ctx.db.patch(existingDefault._id, { isDefault: false });
        }
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      updateData.name = args.name;
    }
    if (args.description !== undefined) {
      updateData.description = args.description;
    }
    if (args.color !== undefined) {
      updateData.color = args.color;
    }
    if (args.tags !== undefined) {
      updateData.tags = args.tags;
    }
    if (args.isDefault !== undefined) {
      updateData.isDefault = args.isDefault;
    }
    if (args.selectedTools !== undefined) {
      updateData.selectedTools = args.selectedTools;
    }

    await ctx.db.patch(args.id, updateData);
    return await ctx.db.get(args.id);
  },
});

export const deleteUserLoadout = mutation({
  args: {
    id: v.id("userLoadouts"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const loadout = await ctx.db.get(args.id);
    if (!loadout || loadout.userId !== args.userId) {
      return false;
    }
    await ctx.db.delete(args.id);
    return true;
  },
});
