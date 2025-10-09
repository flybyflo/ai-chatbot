import { geolocation } from "@vercel/functions";
import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import { headers } from "next/headers";
import { after } from "next/server";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import type { VisibilityType } from "@/components/visibility-selector";
import { api } from "@/convex/_generated/api";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import type { ChatModel } from "@/lib/ai/models";
import { auth, type UserType } from "@/lib/auth";
import { getToken } from "@/lib/auth-server";
import { isAdminUser } from "@/lib/constants";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

let streamContext: ResumableStreamContext | null | undefined;

export function getStreamContext(): ResumableStreamContext | null {
  if (streamContext === undefined) {
    try {
      streamContext = createResumableStreamContext({ waitUntil: after });
    } catch (error) {
      console.error("Failed to create stream context", error);
      streamContext = null;
    }
  }

  return streamContext ?? null;
}

/**
 * New Convex-based chat API
 * This replaces the old streaming implementation with Convex real-time sync
 */
export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
      selectedReasoningEffort,
      selectedTools,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel["id"];
      selectedVisibilityType: VisibilityType;
      selectedReasoningEffort?: "low" | "medium" | "high";
      selectedTools?: string[];
    } = requestBody;

    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userType: UserType = isAdminUser(session.user.email ?? "")
      ? "admin"
      : "regular";

    // Rate limiting check (you can move this to Convex if preferred)
    const token = await getToken();
    if (!token) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }
    const messageCount = await fetchQuery(
      api.queries.getMessageCountByUserId,
      {
        userId: session.user.id,
        differenceInHours: 24,
      },
      { token }
    );

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    // Get geolocation for request hints
    const { longitude, latitude, city, country } = geolocation(request);
    const requestHints = {
      longitude: longitude ?? null,
      latitude: latitude ?? null,
      city: city ?? null,
      country: country ?? null,
    };

    // Get auth token for Convex authenticated calls (reuse existing token)

    // Call Convex action to handle everything
    const result = await fetchAction(
      api.ai.startChatMessagePair,
      {
        chatId: id,
        userMessage: {
          id: message.id,
          role: message.role,
          parts: message.parts,
          attachments: message.attachments || [],
        },
        userId: session.user.id,
        selectedChatModel,
        selectedVisibilityType,
        selectedReasoningEffort,
        selectedTools,
        requestHints,
      },
      { token }
    );

    // Return success - client will see real-time updates via Convex
    return Response.json({
      success: true,
      userMessageId: result.userMessageId,
      assistantMessageId: result.assistantMessageId,
      message:
        "Streaming started. Subscribe to Convex queries to see real-time updates.",
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Check for Vercel AI Gateway credit card error
    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  // Use Convex mutation for deletion
  const token = await getToken();
  if (!token) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }
  const deletedChat = await fetchMutation(
    api.mutations.deleteChatById,
    { id: id as any },
    { token }
  );

  return Response.json(deletedChat, { status: 200 });
}
