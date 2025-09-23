export const DEFAULT_CHAT_MODEL: string = "chat-model";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
  reasoningEffort?: "low" | "medium" | "high";
};

export const chatModels: ChatModel[] = [
  {
    id: "chat-model",
    name: "gpt-5-mini",
    description:
      "Exposes detailed reasoning summaries for transparency into the model's thought process",
    reasoningEffort: "high",
  },
];
