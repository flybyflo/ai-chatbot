import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { unstable_cache as cache } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";
import type { VisibilityType } from "@/components/visibility-selector";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import type { ChatModel } from "@/lib/ai/models";
import { chatModels } from "@/lib/ai/models";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { getAllTools } from "@/lib/ai/tools";
import { auth, type UserType } from "@/lib/auth";
import { isAdminUser, isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getActiveUserMemories,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatLastContextById,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

// File processing is now handled automatically by the AI SDK
// when files are sent using the native attachment system

const getTokenlensCatalog = cache(
  async (): Promise<ModelCatalog | undefined> => {
    try {
      return await fetchModels();
    } catch (err) {
      console.warn(
        "TokenLens: catalog fetch failed, using default catalog",
        err
      );
      return; // tokenlens helpers will fall back to defaultCatalog
    }
  },
  ["tokenlens-catalog"],
  { revalidate: 24 * 60 * 60 } // 24 hours
);

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes("REDIS_URL")) {
        console.log(
          " > Resumable streams are disabled due to missing REDIS_URL"
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

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

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    const chat = await getChatById({ id });

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
    } else {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    }

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    // Get user memories for personalization
    const userMemories = await getActiveUserMemories(session.user.id);
    const memoryContext = userMemories.map((memory) => ({
      title: memory.title,
      content: memory.content,
    }));

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: "user",
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    let finalMergedUsage: AppUsage | undefined;

    const selectedModel = chatModels.find(
      (model) => model.id === selectedChatModel
    );
    const reasoningEffort =
      selectedReasoningEffort || selectedModel?.reasoningEffort || "medium";

    // Load all tools (local + MCP) and filter by selected tools
    const {
      tools: allTools,
      mcpRegistry,
      a2aRegistry,
      a2aManager,
    } = await getAllTools(session.user.id);
    console.log("🔧 Backend: Received selectedTools:", selectedTools);
    const tools = Object.entries(allTools).reduce<Record<string, any>>(
      (acc, [toolName, toolImpl]) => {
        if (!selectedTools || selectedTools.includes(toolName)) {
          acc[toolName] = toolImpl;
        }
        return acc;
      },
      {}
    );
    console.log(
      "🔧 Backend: Active tools after filtering:",
      Object.keys(tools)
    );

    let lastToolResults: any[] = [];

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        let unsubscribeA2AEvents: (() => void) | undefined;
        if (a2aManager) {
          unsubscribeA2AEvents = a2aManager.onToolEvent((event) => {
            dataStream.write({
              type: "data-a2aEvents",
              data: event,
            });
          });
        }

        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ requestHints, userMemories: memoryContext }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools: Object.keys(tools),
          experimental_transform: smoothStream({ chunking: "word" }),
          tools,
          onStepFinish: ({ toolCalls, toolResults }) => {
            // Log tool usage
            if (toolCalls.length > 0) {
              console.log("🔧 Tools Called:");
              for (const toolCall of toolCalls) {
                let toolType: "A2A" | "MCP" | "Local" = "Local";
                if (toolCall.toolName.startsWith("a2a_")) {
                  toolType = "A2A";
                } else if (toolCall.toolName.includes("_")) {
                  toolType = "MCP";
                }
                console.log(`  📋 ${toolType} Tool: ${toolCall.toolName}`);
                console.log(`     🔧 Tool ID: ${toolCall.toolCallId}`);
                console.log(
                  "     📝 Parameters:",
                  JSON.stringify(toolCall.input, null, 2)
                );
              }
            }

            if (toolResults.length > 0) {
              console.log("📊 Tool Results:");
              for (const toolResult of toolResults) {
                console.log(`  ✅ Tool: ${toolResult.toolName}`);
                console.log(
                  "     📊 Result:",
                  typeof toolResult.output === "object"
                    ? JSON.stringify(toolResult.output, null, 2)
                    : toolResult.output
                );
                if ("errorText" in toolResult && toolResult.errorText) {
                  console.log(`     ❌ Error: ${toolResult.errorText}`);
                }
              }
            }

            lastToolResults = toolResults;

            for (const toolResult of toolResults) {
              if (
                typeof toolResult.toolName === "string" &&
                toolResult.toolName.startsWith("a2a_") &&
                toolResult.output &&
                typeof toolResult.output === "object"
              ) {
                dataStream.write({
                  type: "data-a2aEvents",
                  data: toolResult.output,
                });
              }
            }
          },
          providerOptions: {
            openai: {
              reasoningSummary: "detailed",
              reasoningEffort,
            },
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
          onFinish: async ({ usage }) => {
            try {
              const providers = await getTokenlensCatalog();
              const modelId =
                myProvider.languageModel(selectedChatModel).modelId;
              if (!modelId) {
                finalMergedUsage = usage;
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
                return;
              }

              if (!providers) {
                finalMergedUsage = usage;
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
                return;
              }

              const summary = getUsage({ modelId, usage, providers });
              finalMergedUsage = { ...usage, ...summary, modelId } as AppUsage;
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            } catch (err) {
              console.warn("TokenLens enrichment failed", err);
              finalMergedUsage = usage;
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            }

            // Send MCP registry data if available
            if (mcpRegistry) {
              dataStream.write({
                type: "data-mcp-registry",
                data: mcpRegistry,
              });
            }
            for (const toolResult of lastToolResults ?? []) {
              if (
                typeof toolResult.toolName === "string" &&
                toolResult.toolName.startsWith("a2a_") &&
                toolResult.output &&
                typeof toolResult.output === "object"
              ) {
                dataStream.write({
                  type: "data-a2aEvents",
                  data: toolResult.output,
                });
              }
            }
            if (a2aRegistry) {
              dataStream.write({
                type: "data-a2a-registry",
                data: a2aRegistry,
              });
            }
          },
        });

        const streamConsumption = result.consumeStream();
        if (unsubscribeA2AEvents) {
          streamConsumption
            .catch(() => {
              // Errors are surfaced via streamText handlers
              return;
            })
            .finally(() => {
              unsubscribeA2AEvents?.();
            });
        }

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          })
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((currentMessage) => ({
            id: currentMessage.id,
            role: currentMessage.role,
            parts: currentMessage.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });

        if (finalMergedUsage) {
          try {
            await updateChatLastContextById({
              chatId: id,
              context: finalMergedUsage,
            });
          } catch (err) {
            console.warn("Unable to persist last usage for chat", id, err);
          }
        }
      },
      onError: () => {
        return "Oops, an error occurred!";
      },
    });

    // const streamContext = getStreamContext();

    // if (streamContext) {
    //   return new Response(
    //     await streamContext.resumableStream(streamId, () =>
    //       stream.pipeThrough(new JsonToSseTransformStream())
    //     )
    //   );
    // }

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
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

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
