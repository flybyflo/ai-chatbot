import { z } from "zod";
import {
  CHAT_MODELS,
  MEDIA_TYPES,
  MESSAGE_PART_TYPES,
  MESSAGE_ROLES,
  REASONING_EFFORT_LEVELS,
  VISIBILITY_TYPES,
} from "@/lib/enums";

const textPartSchema = z.object({
  type: z.enum([MESSAGE_PART_TYPES.TEXT]),
  text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
  type: z.enum([MESSAGE_PART_TYPES.FILE]),
  mediaType: z.enum([
    MEDIA_TYPES.IMAGE_JPEG,
    MEDIA_TYPES.IMAGE_PNG,
    MEDIA_TYPES.IMAGE_GIF,
    MEDIA_TYPES.IMAGE_WEBP,
    MEDIA_TYPES.APPLICATION_PDF,
    MEDIA_TYPES.TEXT_PLAIN,
    MEDIA_TYPES.APPLICATION_OCTET_STREAM,
  ]),
  filename: z.string().min(1).max(100),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum([MESSAGE_ROLES.USER]),
    parts: z.array(partSchema),
  }),
  selectedChatModel: z.enum([CHAT_MODELS.CHAT_MODEL]),
  selectedVisibilityType: z.enum([
    VISIBILITY_TYPES.PUBLIC,
    VISIBILITY_TYPES.PRIVATE,
  ]),
  selectedReasoningEffort: z
    .enum([
      REASONING_EFFORT_LEVELS.LOW,
      REASONING_EFFORT_LEVELS.MEDIUM,
      REASONING_EFFORT_LEVELS.HIGH,
    ])
    .optional(),
  selectedTools: z.array(z.string()).optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
