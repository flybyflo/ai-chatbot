import { headers } from 'next/headers';
import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
  tool,
} from 'ai';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  getMCPServersByUserId,
} from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { entitlements } from '@/lib/ai/entitlements';
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
import { samplingManager } from '@/lib/sampling-manager';
import { progressManager } from '@/lib/progress-manager';

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

    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlements.maxMessagesPerDay) {
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
        const mcpClients: Client[] = [];
        const mcpTools: Record<string, any> = {};

        // Get saved MCP servers from database
        try {
          const savedServers = await getMCPServersByUserId({
            userId: session.user.id,
          });
          const enabledServers = savedServers.filter(
            (server) => server.isEnabled,
          );

          // Connect to all enabled MCP servers
          for (const server of enabledServers) {
            let mcpClient: Client | null = null;
            try {
              // Configure transport with optional authentication
              const transportConfig: any = {};

              // Add authentication headers if token is provided
              if (server.authToken) {
                transportConfig.requestInit = {
                  headers: {
                    Authorization: `Bearer ${server.authToken}`,
                    'Content-Type': 'application/json',
                  },
                };
              }

              const transport = new StreamableHTTPClientTransport(
                new URL(server.url),
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
                    sampling: {},
                  },
                },
              );

              // Connect to the server
              await mcpClient.connect(transport);

              // Set up progress notification handler
              const progressNotificationSchema = z.object({
                method: z.literal('notifications/progress'),
                params: z.object({
                  progressToken: z.string(),
                  progress: z.number().optional(),
                  total: z.number().optional(),
                  description: z.string().optional()
                }).optional()
              });

              mcpClient.setNotificationHandler(progressNotificationSchema, async (notification) => {
                console.log('📊 Received progress notification:', notification);
                
                const { progressToken, progress, total, description } = notification.params || {};
                
                // Update progress directly through the progress manager
                if (progressToken) {
                  progressManager.updateProgress(progressToken, {
                    progress,
                    total,
                    description,
                    timestamp: Date.now()
                  });
                  
                  console.log(`📈 Progress update for token ${progressToken}:`, { progress, total, description });
                }
              });

              // Set up sampling handler using correct Zod schema
              const samplingRequestSchema = z.object({
                method: z.literal('sampling/createMessage'),
                params: z
                  .object({
                    messages: z
                      .array(
                        z.object({
                          role: z.string(),
                          content: z.union([
                            z.object({ type: z.string(), text: z.string() }),
                            z.string(),
                          ]),
                        }),
                      )
                      .optional()
                      .default([]),
                    systemPrompt: z.string().optional(),
                    includeContext: z.string().optional(),
                    maxTokens: z.number().optional(),
                    temperature: z.number().optional(),
                    modelPreferences: z
                      .object({
                        speedPriority: z.number().optional(),
                        intelligencePriority: z.number().optional(),
                        costPriority: z.number().optional(),
                      })
                      .optional(),
                  })
                  .optional(),
              });

              mcpClient.setRequestHandler(
                samplingRequestSchema,
                async (request, extra) => {
                  console.log('🎯 Received sampling request:', request);

                  // Extract sampling parameters
                  const {
                    messages = [],
                    systemPrompt,
                    includeContext,
                    maxTokens,
                    temperature,
                    modelPreferences,
                  } = request.params || {};

                  try {
                    // Create sampling request for approval
                    const samplingRequest = {
                      id: samplingManager.generateRequestId(),
                      serverName: server.name,
                      messages: messages.map((msg) => ({
                        role: msg.role,
                        content: {
                          type: 'text',
                          text:
                            typeof msg.content === 'string'
                              ? msg.content
                              : msg.content.text,
                        },
                      })),
                      systemPrompt,
                      maxTokens,
                      temperature,
                      modelPreferences,
                    };

                    // Request user approval (this would integrate with UI in a full implementation)
                    const approval =
                      await samplingManager.requestApproval(samplingRequest);

                    if (!approval.approved) {
                      console.log('❌ Sampling request denied by user');
                      throw new Error('Sampling request denied by user');
                    }

                    console.log('✅ Sampling request approved by user');

                    // Use the current AI model to handle sampling
                    const model = myProvider.languageModel(selectedChatModel);

                    const result = await streamText({
                      model,
                      messages: messages.map((msg) => ({
                        role: msg.role as 'user' | 'assistant' | 'system',
                        content:
                          typeof msg.content === 'string'
                            ? msg.content
                            : msg.content.text,
                      })),
                      system:
                        approval.modifiedSystemPrompt ||
                        systemPrompt ||
                        'You are a helpful assistant.',
                      temperature: temperature || 0.7,
                    });

                    let fullResponse = '';
                    for await (const chunk of result.textStream) {
                      fullResponse += chunk;
                    }

                    console.log(
                      '✅ Sampling response generated:',
                      `${fullResponse.substring(0, 100)}...`,
                    );

                    return {
                      model: selectedChatModel,
                      role: 'assistant',
                      content: {
                        type: 'text',
                        text: fullResponse,
                      },
                    };
                  } catch (error) {
                    console.error('❌ Sampling error:', error);
                    throw error;
                  }
                },
              );

              mcpClients.push(mcpClient);

              // Get available tools from MCP server
              const toolsResult = await mcpClient.listTools();

              // Convert MCP tools to AI SDK format
              for (const mcpTool of toolsResult.tools) {
                console.log(
                  `🔧 Converting MCP tool: ${mcpTool.name} from ${server.name}`,
                  {
                    description: mcpTool.description,
                    inputSchema: mcpTool.inputSchema,
                    inputSchemaStringified: JSON.stringify(
                      mcpTool.inputSchema,
                      null,
                      2,
                    ),
                  },
                );

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

                // Create unique tool name to avoid conflicts between servers
                const uniqueToolName = `${server.name}__${mcpTool.name}`;

                // Create proper AI SDK tool using tool() function
                try {
                  mcpTools[uniqueToolName] = tool({
                    description:
                      mcpTool.description ||
                      `MCP tool: ${mcpTool.name} from ${server.name}`,
                    inputSchema: zodSchema,
                    execute: async (args: any) => {
                      console.log(
                        `🚀 MCP tool "${mcpTool.name}" from ${server.name} called with args:`,
                        args,
                      );

                      if (!mcpClient) {
                        console.error(
                          `❌ MCP client not connected for tool ${mcpTool.name}`,
                        );
                        throw new Error('MCP client not connected');
                      }

                      try {
                        // Generate a unique progress token for this tool call
                        const progressToken = `progress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                        
                        // Register the tool execution with progress manager
                        progressManager.registerToolExecution(progressToken, mcpTool.name, server.name);
                        
                        const result = await mcpClient.callTool({
                          name: mcpTool.name,
                          arguments: args,
                          _meta: {
                            progressToken: progressToken
                          }
                        });
                        
                        // Clean up progress tracking when tool completes
                        progressManager.cleanupProgress(progressToken);

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
                  console.error(
                    `❌ Error creating tool ${mcpTool.name}:`,
                    error,
                  );
                  // Fallback - skip this tool
                  continue;
                }
              }

              console.log(
                `✅ Connected to MCP server ${server.name} at ${server.url} with ${toolsResult.tools.length} tools`,
              );
            } catch (error: any) {
              console.error(
                `❌ Failed to connect to MCP server ${server.name}: ${error.message}`,
              );
              console.error(`   URL: ${server.url}`);
              if (error.message?.includes('protocol version')) {
                console.error(
                  `   This may be a protocol version issue - try updating your MCP server`,
                );
              }

              if (mcpClient) {
                try {
                  await mcpClient.close();
                } catch (closeError) {
                  console.error('Error closing MCP client:', closeError);
                }
              }
            }
          }
        } catch (dbError: any) {
          console.error(
            '❌ Failed to fetch MCP servers from database:',
            dbError.message,
          );
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

        const activeToolNames = [
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

            // Close all MCP clients when done
            for (const client of mcpClients) {
              try {
                await client.close();
              } catch (closeError) {
                console.error('Error closing MCP client:', closeError);
              }
            }
          },
          onError: async (error) => {
            console.error(`❌ Stream error:`, error);
            // Close all MCP clients on error
            for (const client of mcpClients) {
              try {
                await client.close();
              } catch (closeError) {
                console.error('Error closing MCP client:', closeError);
              }
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

  const session = await auth.api.getSession({ headers: await headers() });

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
