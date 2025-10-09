import { MODEL_IDS } from "../enums";

export const DEFAULT_CHAT_MODEL: string = MODEL_IDS.CHAT_MODEL;

export type ChatModel = {
  id: string;
  name: string;
  description: string;
  reasoningEffort?: "low" | "medium" | "high";
};

export const chatModels: ChatModel[] = [
  {
    id: MODEL_IDS.CHAT_MODEL,
    name: "gpt-5-mini",
    description:
      "Exposes detailed reasoning summaries for transparency into the model's thought process",
    reasoningEffort: "high",
  },
];
