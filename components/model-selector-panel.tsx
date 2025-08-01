'use client';

import { startTransition, useMemo, useOptimistic } from 'react';
import { CheckCircle } from 'lucide-react';
import { chatModels } from '@/lib/ai/models';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { saveChatModelAsCookie } from '@/app/(chat)/actions';
import type { Session } from 'next-auth';

interface ModelSelectorPanelProps {
  session: Session | null;
  selectedModelId: string;
  onModelSelect?: (modelId: string) => void;
}

export function ModelSelectorPanel({
  session,
  selectedModelId,
  onModelSelect,
}: ModelSelectorPanelProps) {
  const [optimisticModelId, setOptimisticModelId] =
    useOptimistic(selectedModelId);

  // Add null checks for session and session.user
  const userType = session?.user?.type || 'guest';
  const { availableChatModelIds } = entitlementsByUserType[userType];

  const availableChatModels = chatModels.filter((chatModel) =>
    availableChatModelIds.includes(chatModel.id),
  );

  const selectedChatModel = useMemo(
    () =>
      availableChatModels.find(
        (chatModel) => chatModel.id === optimisticModelId,
      ),
    [optimisticModelId, availableChatModels],
  );

  return {
    selectedChatModel,
    panel: (
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="space-y-1">
            {availableChatModels.map((chatModel) => {
              const isSelected = chatModel.id === optimisticModelId;
              return (
                <button
                  key={chatModel.id}
                  type="button"
                  className={`w-full text-left p-2 hover:bg-background/50 rounded text-xs flex justify-between items-start ${
                    isSelected
                      ? 'border border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border border-transparent'
                  }`}
                  onClick={() => {
                    startTransition(() => {
                      setOptimisticModelId(chatModel.id);
                      saveChatModelAsCookie(chatModel.id);
                    });
                    onModelSelect?.(chatModel.id);
                  }}
                >
                  <div>
                    <div className="font-medium">{chatModel.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {chatModel.description}
                    </div>
                  </div>
                  {isSelected && (
                    <CheckCircle size={16} className="text-blue-500 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    ),
  };
}
