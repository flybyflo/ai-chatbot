import type { UserType } from "@/lib/auth";
import { MODEL_IDS } from "../enums";
import type { ChatModel } from "./models";

type Entitlements = {
  maxMessagesPerDay: number;
  availableChatModelIds: ChatModel["id"][];
};

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For regular users with an account
   */
  regular: {
    maxMessagesPerDay: 100,
    availableChatModelIds: [
      MODEL_IDS.CHAT_MODEL,
      MODEL_IDS.CHAT_MODEL_REASONING,
    ],
  },

  /*
   * For admin users - same as regular for now, can be expanded later
   */
  admin: {
    maxMessagesPerDay: 100,
    availableChatModelIds: [
      MODEL_IDS.CHAT_MODEL,
      MODEL_IDS.CHAT_MODEL_REASONING,
    ],
  },
};
