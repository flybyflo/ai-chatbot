import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { VisibilityType } from "@/components/visibility-selector";
import { ChatSDKError } from "../errors";
import type { AppUsage } from "../usage";
import { generateUUID } from "../utils";
import {
  type Chat,
  chat,
  type DBMessage,
  message,
  stream,
  type User,
  type UserMCPServer,
  type UserMemory,
  user,
  userMCPServer,
  userMemory,
  vote,
} from "./schema";
import { generateHashedPassword } from "./utils";

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

// Note: User creation is now handled by Better Auth
// This function is deprecated and should not be used
export async function createUser(email: string, password: string) {
  throw new ChatSDKError("bad_request:database", "User creation is handled by Better Auth");
}


export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id)
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get chat by id");
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db.insert(message).values(messages);
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save messages");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat visibility by id"
    );
  }
}

export async function updateChatLastContextById({
  chatId,
  context,
}: {
  chatId: string;
  // Store merged server-enriched usage object
  context: AppUsage;
}) {
  try {
    return await db
      .update(chat)
      .set({ lastContext: context })
      .where(eq(chat.id, chatId));
  } catch (error) {
    console.warn("Failed to update lastContext for chat", chatId, error);
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}

// User Memory Functions
export async function getUserMemories(userId: string): Promise<UserMemory[]> {
  try {
    return await db
      .select()
      .from(userMemory)
      .where(eq(userMemory.userId, userId))
      .orderBy(desc(userMemory.updatedAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user memories"
    );
  }
}

export async function getActiveUserMemories(
  userId: string
): Promise<UserMemory[]> {
  try {
    return await db
      .select()
      .from(userMemory)
      .where(and(eq(userMemory.userId, userId), eq(userMemory.isActive, true)))
      .orderBy(desc(userMemory.updatedAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get active user memories"
    );
  }
}

export async function createUserMemory({
  userId,
  title,
  content,
}: {
  userId: string;
  title: string;
  content: string;
}): Promise<UserMemory> {
  try {
    const [memory] = await db
      .insert(userMemory)
      .values({ userId, title, content })
      .returning();
    return memory;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create user memory"
    );
  }
}

export async function updateUserMemory({
  id,
  userId,
  title,
  content,
  isActive,
}: {
  id: string;
  userId: string;
  title?: string;
  content?: string;
  isActive?: boolean;
}): Promise<UserMemory | null> {
  try {
    const updateData: Partial<UserMemory> = { updatedAt: new Date() };
    if (title !== undefined) {
      updateData.title = title;
    }
    if (content !== undefined) {
      updateData.content = content;
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const [memory] = await db
      .update(userMemory)
      .set(updateData)
      .where(and(eq(userMemory.id, id), eq(userMemory.userId, userId)))
      .returning();
    return memory || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update user memory"
    );
  }
}

export async function deleteUserMemory({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<boolean> {
  try {
    const result = await db
      .delete(userMemory)
      .where(and(eq(userMemory.id, id), eq(userMemory.userId, userId)))
      .returning({ id: userMemory.id });
    return result.length > 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete user memory"
    );
  }
}

// User MCP Server Functions
export async function getUserMCPServers(
  userId: string
): Promise<UserMCPServer[]> {
  try {
    return await db
      .select()
      .from(userMCPServer)
      .where(eq(userMCPServer.userId, userId))
      .orderBy(desc(userMCPServer.updatedAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user MCP servers"
    );
  }
}

export async function getActiveUserMCPServers(
  userId: string
): Promise<UserMCPServer[]> {
  try {
    return await db
      .select()
      .from(userMCPServer)
      .where(
        and(eq(userMCPServer.userId, userId), eq(userMCPServer.isActive, true))
      )
      .orderBy(desc(userMCPServer.updatedAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get active user MCP servers"
    );
  }
}

export async function createUserMCPServer({
  userId,
  name,
  url,
  description,
  headers,
}: {
  userId: string;
  name: string;
  url: string;
  description?: string;
  headers?: Record<string, string>;
}): Promise<UserMCPServer> {
  try {
    const [mcpServer] = await db
      .insert(userMCPServer)
      .values({ userId, name, url, description, headers })
      .returning();
    return mcpServer;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create user MCP server"
    );
  }
}

export async function updateUserMCPServer({
  id,
  userId,
  name,
  url,
  description,
  headers,
  isActive,
  lastConnectionTest,
  lastConnectionStatus,
  lastError,
  toolCount,
}: {
  id: string;
  userId: string;
  name?: string;
  url?: string;
  description?: string;
  headers?: Record<string, string>;
  isActive?: boolean;
  lastConnectionTest?: Date;
  lastConnectionStatus?: string;
  lastError?: string;
  toolCount?: number;
}): Promise<UserMCPServer | null> {
  try {
    const updateData: Partial<UserMCPServer> = { updatedAt: new Date() };
    if (name !== undefined) {
      updateData.name = name;
    }
    if (url !== undefined) {
      updateData.url = url;
    }
    if (description !== undefined) {
      updateData.description = description;
    }
    if (headers !== undefined) {
      updateData.headers = headers;
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }
    if (lastConnectionTest !== undefined) {
      updateData.lastConnectionTest = lastConnectionTest;
    }
    if (lastConnectionStatus !== undefined) {
      updateData.lastConnectionStatus = lastConnectionStatus;
    }
    if (lastError !== undefined) {
      updateData.lastError = lastError;
    }
    if (toolCount !== undefined) {
      updateData.toolCount = toolCount;
    }

    const [mcpServer] = await db
      .update(userMCPServer)
      .set(updateData)
      .where(and(eq(userMCPServer.id, id), eq(userMCPServer.userId, userId)))
      .returning();
    return mcpServer || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update user MCP server"
    );
  }
}

export async function deleteUserMCPServer({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<boolean> {
  try {
    const result = await db
      .delete(userMCPServer)
      .where(and(eq(userMCPServer.id, id), eq(userMCPServer.userId, userId)))
      .returning({ id: userMCPServer.id });
    return result.length > 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete user MCP server"
    );
  }
}
