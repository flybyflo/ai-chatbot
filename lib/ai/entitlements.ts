import type { ChatModel } from './models';

export const entitlements = {
  maxMessagesPerDay: 100,
  availableChatModelIds: ['chat-model', 'chat-model-reasoning'] as Array<ChatModel['id']>,
};
