import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { azure } from '@ai-sdk/azure';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';
import { isTestEnvironment } from '../constants';

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    })
  : customProvider({
      languageModels: {
        'chat-model': azure.languageModel('gpt-4.1'),
        'chat-model-reasoning': wrapLanguageModel({
          model: azure.languageModel('o3-mini'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'title-model': azure.languageModel('gpt-4.1'),
        'artifact-model': azure.languageModel('gpt-4.1'),
      },
      imageModels: {
        'small-model': azure.imageModel('dall-e-3'),
      },
    });
