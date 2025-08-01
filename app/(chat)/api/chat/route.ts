import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { tool } from 'ai';
import { z } from 'zod';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export const maxDuration = 60;

// Helper function to convert JSON Schema to Zod schema
function jsonSchemaToZod(jsonSchema: any): z.ZodType<any> {
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    return z.object({});
  }

  if (jsonSchema.type === 'object' && jsonSchema.properties) {
    const zodObject: Record<string, z.ZodType<any>> = {};

    for (const [key, prop] of Object.entries(jsonSchema.properties)) {
      const property = prop as any;

      switch (property.type) {
        case 'string':
          zodObject[key] = z
            .string()
            .describe(property.description || property.title || '');
          break;
        case 'number':
          zodObject[key] = z
            .number()
            .describe(property.description || property.title || '');
          break;
        case 'integer':
          zodObject[key] = z
            .number()
            .int()
            .describe(property.description || property.title || '');
          break;
        case 'boolean':
          zodObject[key] = z
            .boolean()
            .describe(property.description || property.title || '');
          break;
        case 'array':
          zodObject[key] = z
            .array(z.any())
            .describe(property.description || property.title || '');
          break;
        case 'object':
          zodObject[key] = jsonSchemaToZod(property);
          break;
        default:
          zodObject[key] = z
            .any()
            .describe(property.description || property.title || '');
      }

      // Make optional if not in required array
      if (!jsonSchema.required || !jsonSchema.required.includes(key)) {
        zodObject[key] = zodObject[key].optional();
      }
    }

    return z.object(zodObject);
  }

  // Fallback for non-object schemas
  return z.object({});
}

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
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
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
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

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        // Initialize MCP client for additional tools (optional)
        let mcpClient: Client | null = null;
        let mcpTools: Record<string, any> = {};

        // Try to connect to MCP server if configured
        const mcpUrl = process.env.MCP_SERVER_URL;
        const mcpAuthToken = process.env.MCP_AUTH_TOKEN;

        if (mcpUrl) {
          try {
            // Configure transport with optional authentication
            const transportConfig: any = {};

            // Add authentication headers if token is provided
            if (mcpAuthToken) {
              transportConfig.requestInit = {
                headers: {
                  Authorization: `Bearer ${mcpAuthToken}`,
                  'Content-Type': 'application/json',
                },
              };
            }

            const transport = new StreamableHTTPClientTransport(
              new URL(mcpUrl),
              Object.keys(transportConfig).length > 0
                ? transportConfig
                : undefined,
            );

            // Create official MCP client
            mcpClient = new Client(
              {
                name: 'ai-chatbot',
                version: '1.0.0',
              },
              {
                capabilities: {
                  tools: {},
                },
              },
            );

            // Connect to the server
            await mcpClient.connect(transport);

            // Get available tools from MCP server
            const toolsResult = await mcpClient.listTools();

            // Convert MCP tools to AI SDK format
            mcpTools = {};
            for (const mcpTool of toolsResult.tools) {
              console.log(`🔧 Converting MCP tool: ${mcpTool.name}`, {
                description: mcpTool.description,
                inputSchema: mcpTool.inputSchema,
                inputSchemaStringified: JSON.stringify(
                  mcpTool.inputSchema,
                  null,
                  2,
                ),
              });

              // Ensure the schema is a valid JSON Schema object
              let validSchema = mcpTool.inputSchema;

              // If inputSchema is null, undefined, or has invalid type, create a default schema
              if (
                !validSchema ||
                typeof validSchema !== 'object' ||
                validSchema.type !== 'object'
              ) {
                console.warn(
                  `⚠️ Invalid inputSchema for tool ${mcpTool.name}, using default schema`,
                );
                validSchema = {
                  type: 'object',
                  properties: {},
                  additionalProperties: true,
                };
              }

              // Ensure the schema has all required fields
              if (!validSchema.properties) {
                validSchema.properties = {};
              }

              console.log(
                `✅ Final schema for ${mcpTool.name}:`,
                JSON.stringify(validSchema, null, 2),
              );

              // Convert JSON Schema to Zod schema
              const zodSchema = jsonSchemaToZod(validSchema);
              console.log(`🔄 Converted to Zod schema for ${mcpTool.name}`);

              // Debug: Check if tool function is available
              console.log(`🔍 tool function type:`, typeof tool);

              // Create proper AI SDK tool using tool() function
              try {
                mcpTools[mcpTool.name] = tool({
                  description:
                    mcpTool.description || `MCP tool: ${mcpTool.name}`,
                  inputSchema: zodSchema,
                  execute: async (args: any) => {
                    console.log(
                      `🚀 MCP tool "${mcpTool.name}" called with args:`,
                      args,
                    );

                    if (!mcpClient) {
                      console.error(
                        `❌ MCP client not connected for tool ${mcpTool.name}`,
                      );
                      throw new Error('MCP client not connected');
                    }

                    try {
                      const result = await mcpClient.callTool({
                        name: mcpTool.name,
                        arguments: args,
                      });

                      console.log(
                        `✅ MCP tool "${mcpTool.name}" result:`,
                        result,
                      );
                      return result.content;
                    } catch (error) {
                      console.error(
                        `❌ MCP tool "${mcpTool.name}" error:`,
                        error,
                      );
                      throw error;
                    }
                  },
                });
              } catch (error) {
                console.error(`❌ Error creating tool ${mcpTool.name}:`, error);
                // Fallback - skip this tool
                continue;
              }
            }

            console.log(
              `✅ Connected to MCP server at ${mcpUrl} with ${Object.keys(mcpTools).length} tools: ${Object.keys(mcpTools).join(', ')}`,
            );
          } catch (error: any) {
            console.error(
              `❌ Failed to connect to MCP server: ${error.message}`,
            );
            console.error(`   URL: ${mcpUrl}`);
            if (error.message?.includes('protocol version')) {
              console.error(
                `   This may be a protocol version issue - try updating your MCP server`,
              );
            }
            mcpTools = {};
          }
        }

        // Log all available tools before calling streamText
        const allTools = {
          getWeather,
          createDocument: createDocument({ session, dataStream }),
          updateDocument: updateDocument({ session, dataStream }),
          requestSuggestions: requestSuggestions({
            session,
            dataStream,
          }),
          ...mcpTools,
        };

        const activeToolNames =
          selectedChatModel === 'chat-model-reasoning'
            ? []
            : [
                'getWeather',
                'createDocument',
                'updateDocument',
                'requestSuggestions',
                ...Object.keys(mcpTools),
              ];

        console.log(`🔧 AI SDK Tools Setup:`, {
          totalTools: Object.keys(allTools).length,
          builtInTools: 4,
          mcpTools: Object.keys(mcpTools).length,
          activeTools: activeToolNames,
          allToolNames: Object.keys(allTools),
        });

        // Debug: Log the actual tool definitions that will be sent to AI SDK
        Object.entries(mcpTools).forEach(
          ([toolName, toolDef]: [string, any]) => {
            console.log(`🔍 Final tool definition for ${toolName}:`, {
              description: toolDef.description,
              parameters: toolDef.parameters,
              parametersStringified: JSON.stringify(
                toolDef.parameters,
                null,
                2,
              ),
            });
          },
        );

        // Enhanced system prompt with MCP tool awareness
        let enhancedSystemPrompt = systemPrompt({
          selectedChatModel,
          requestHints,
        });

        if (Object.keys(mcpTools).length > 0) {
          const mcpToolDescriptions = Object.entries(mcpTools)
            .map(
              ([name, tool]: [string, any]) => `- ${name}: ${tool.description}`,
            )
            .join('\n');

          enhancedSystemPrompt += `\n\nAdditional MCP Tools Available:\n${mcpToolDescriptions}\n\nYou can use these MCP tools when appropriate to help users. Be proactive in suggesting and using them when they match the user's request.`;

          console.log(
            `🎯 Enhanced system prompt with ${Object.keys(mcpTools).length} MCP tools`,
          );
        }

        // Log the messages being sent to the AI
        const modelMessages = convertToModelMessages(uiMessages);
        console.log(
          `💬 Sending ${modelMessages.length} messages to AI:`,
          modelMessages.map((msg, i) => ({
            index: i,
            role: msg.role,
            content:
              typeof msg.content === 'string'
                ? `${msg.content.substring(0, 100)}...`
                : `[${typeof msg.content}]`,
          })),
        );

        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: enhancedSystemPrompt,
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools: activeToolNames as any,
          experimental_transform: smoothStream({ chunking: 'word' }),
          tools: allTools,
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
          onStepFinish: ({ text, toolCalls, toolResults }) => {
            console.log(`📊 Step finished`);
            if (toolCalls && toolCalls.length > 0) {
              console.log(
                `🔧 Tool calls in step:`,
                toolCalls.map((tc) => ({
                  toolName: tc.toolName,
                  input: tc.input,
                })),
              );
            }
            if (toolResults && toolResults.length > 0) {
              console.log(
                `✅ Tool results in step:`,
                toolResults.map((tr) => ({
                  toolCallId: tr.toolCallId,
                  toolName: tr.toolName,
                  output: tr.output,
                })),
              );
            }
            if (text) {
              console.log(`💬 Text in step: "${text.substring(0, 100)}..."`);
            }
          },
          onFinish: async ({ text, toolCalls, toolResults, finishReason }) => {
            console.log(`🏁 Stream finished - Reason: ${finishReason}`);
            console.log(`📝 Final text length: ${text?.length || 0}`);
            console.log(`🔧 Total tool calls: ${toolCalls?.length || 0}`);
            console.log(`✅ Total tool results: ${toolResults?.length || 0}`);

            if (toolCalls && toolCalls.length > 0) {
              console.log(
                `🔧 All tool calls:`,
                toolCalls.map((tc) => ({
                  toolName: tc.toolName,
                  input: tc.input,
                })),
              );
            }

            // Close MCP client when done
            if (mcpClient) {
              await mcpClient.close();
            }
          },
          onError: async (error) => {
            console.error(`❌ Stream error:`, error);
            // Close MCP client on error
            if (mcpClient) {
              await mcpClient.close();
            }
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          }),
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream()),
        ),
      );
    } else {
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
