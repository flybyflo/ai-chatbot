import { azure } from "@ai-sdk/azure";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";
import { MODEL_IDS } from "../enums";

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          [MODEL_IDS.CHAT_MODEL]: chatModel,
          [MODEL_IDS.CHAT_MODEL_REASONING]: reasoningModel,
          [MODEL_IDS.TITLE_MODEL]: titleModel,
          [MODEL_IDS.ARTIFACT_MODEL]: artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        [MODEL_IDS.CHAT_MODEL]: azure.responses("gpt-5-mini"),
        [MODEL_IDS.TITLE_MODEL]: azure("gpt-5-mini"),
        [MODEL_IDS.ARTIFACT_MODEL]: azure("gpt-5-mini"),
      },
    });
