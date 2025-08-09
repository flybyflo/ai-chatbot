import { z } from 'zod';

export const progressUpdateSchema = z
  .object({
    progress: z.number().optional(),
    total: z.number().optional(),
    description: z.string().optional(),
    timestamp: z.number().optional(),
  })
  .strict();

export const OutboundMessage = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('progress'),
      toolName: z.string(),
      serverName: z.string(),
      progressToken: z.string(),
      currentProgress: progressUpdateSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('elicitation'),
      elicitationToken: z.string(),
      serverName: z.string(),
      message: z.string(),
      responseType: z.any(),
      timestamp: z.number(),
    })
    .strict(),
  z
    .object({
      type: z.literal('cleanup'),
      kind: z.enum(['progress', 'elicitation', 'sampling']),
      token: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal('sampling_request'),
      requestId: z.string(),
      serverName: z.string(),
      messages: z
        .array(
          z.object({
            role: z.string(),
            content: z.object({ type: z.string(), text: z.string() }),
          }),
        )
        .optional(),
      systemPrompt: z.string().optional(),
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
    .strict(),
]);

export const InboundMessage = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('elicitation_response'),
      elicitationToken: z.string(),
      action: z.enum(['accept', 'decline', 'cancel']),
      data: z.any().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('sampling_response'),
      requestId: z.string(),
      approved: z.boolean(),
      modifiedSystemPrompt: z.string().optional(),
    })
    .strict(),
]);

export type OutboundMessage = z.infer<typeof OutboundMessage>;
export type InboundMessage = z.infer<typeof InboundMessage>;
