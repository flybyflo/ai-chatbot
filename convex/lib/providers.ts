import { azure } from "@ai-sdk/azure";
import { customProvider } from "ai";

const MODEL_IDS = {
  CHAT_MODEL: "chat-model",
  CHAT_MODEL_REASONING: "reasoning-model",
  TITLE_MODEL: "title-model",
  ARTIFACT_MODEL: "artifact-model",
};

export const myProvider = customProvider({
  languageModels: {
    [MODEL_IDS.CHAT_MODEL]: azure.responses("gpt-5-mini"),
    [MODEL_IDS.TITLE_MODEL]: azure("gpt-5-mini"),
    [MODEL_IDS.ARTIFACT_MODEL]: azure("gpt-5-mini"),
  },
});
