import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Note: Better Auth tables (user, session, account, verification) are managed by the component
// We only define our application-specific tables here

export default defineSchema({
  // Chat tables
  chats: defineTable({
    createdAt: v.number(), // timestamp
    title: v.string(),
    userId: v.string(),
    visibility: v.union(v.literal("public"), v.literal("private")),
    slug: v.optional(v.string()),
    lastContext: v.optional(
      v.object({
        // AppUsage type - usage tracking data
        promptTokens: v.optional(v.number()),
        completionTokens: v.optional(v.number()),
        totalTokens: v.optional(v.number()),
        // Add any additional usage fields as needed
      })
    ),
  })
    .index("by_userId", ["userId"])
    .index("by_slug", ["slug"])
    .index("by_createdAt", ["createdAt"]),

  messages: defineTable({
    chatId: v.id("chats"),
    role: v.string(),
    parts: v.any(), // JSON structure for message parts
    attachments: v.any(), // JSON structure for attachments
    createdAt: v.number(), // timestamp
    isComplete: v.optional(v.boolean()), // For streaming: true when assistant response is fully received
  })
    .index("by_chatId", ["chatId"])
    .index("by_chatId_createdAt", ["chatId", "createdAt"]),

  // Message chunks for streaming AI responses
  messageChunks: defineTable({
    messageId: v.id("messages"),
    content: v.string(), // Partial text chunk
    sequence: v.number(), // Order of chunk (0, 1, 2, ...)
    createdAt: v.number(), // timestamp
  })
    .index("by_messageId", ["messageId"])
    .index("by_messageId_sequence", ["messageId", "sequence"]),

  // Reasoning chunks for streaming AI thinking/reasoning
  reasoningChunks: defineTable({
    messageId: v.id("messages"),
    content: v.string(), // Partial reasoning chunk
    sequence: v.number(), // Order of chunk (0, 1, 2, ...)
    createdAt: v.number(), // timestamp
  })
    .index("by_messageId", ["messageId"])
    .index("by_messageId_sequence", ["messageId", "sequence"]),

  votes: defineTable({
    chatId: v.id("chats"),
    messageId: v.id("messages"),
    isUpvoted: v.boolean(),
  })
    .index("by_chatId", ["chatId"])
    .index("by_messageId", ["messageId"])
    .index("by_chatId_messageId", ["chatId", "messageId"]),

  streams: defineTable({
    chatId: v.id("chats"),
    createdAt: v.number(), // timestamp
  }).index("by_chatId", ["chatId"]),

  // User Memory
  userMemory: defineTable({
    userId: v.string(),
    title: v.string(),
    content: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(), // timestamp
    updatedAt: v.number(), // timestamp
  })
    .index("by_userId", ["userId"])
    .index("by_userId_isActive", ["userId", "isActive"])
    .index("by_updatedAt", ["updatedAt"]),

  // User MCP Servers
  userMCPServers: defineTable({
    userId: v.string(),
    name: v.string(),
    url: v.string(),
    description: v.optional(v.string()),
    headers: v.optional(v.any()), // Record<string, string>
    isActive: v.boolean(),
    lastConnectionTest: v.optional(v.number()), // timestamp
    lastConnectionStatus: v.optional(v.string()),
    lastError: v.optional(v.string()),
    toolCount: v.optional(v.number()),
    createdAt: v.number(), // timestamp
    updatedAt: v.number(), // timestamp
  })
    .index("by_userId", ["userId"])
    .index("by_userId_isActive", ["userId", "isActive"])
    .index("by_updatedAt", ["updatedAt"]),

  // User A2A Servers
  userA2AServers: defineTable({
    userId: v.string(),
    name: v.string(),
    cardUrl: v.string(),
    description: v.optional(v.string()),
    headers: v.optional(v.any()), // Record<string, string>
    isActive: v.boolean(),
    lastConnectionTest: v.optional(v.number()), // timestamp
    lastConnectionStatus: v.optional(v.string()),
    lastError: v.optional(v.string()),
    createdAt: v.number(), // timestamp
    updatedAt: v.number(), // timestamp
  })
    .index("by_userId", ["userId"])
    .index("by_userId_isActive", ["userId", "isActive"])
    .index("by_updatedAt", ["updatedAt"]),

  // User Loadouts
  userLoadouts: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isDefault: v.boolean(),
    selectedTools: v.optional(v.array(v.string())),
    createdAt: v.number(), // timestamp
    updatedAt: v.number(), // timestamp
  })
    .index("by_userId", ["userId"])
    .index("by_userId_isDefault", ["userId", "isDefault"])
    .index("by_updatedAt", ["updatedAt"]),
});
