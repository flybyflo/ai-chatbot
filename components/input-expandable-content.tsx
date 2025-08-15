'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Button } from './ui/button';
import { ExpandablePanel } from './expandable-panel';
import { ModelSelectorPanel } from './model-selector-panel';
import type { Session } from '@/lib/auth';

interface InputExpandableContentProps {
  normalContent: ReactNode;
  session: Session;
  selectedModelId: string;
  className?: string;
  attachmentButton: ReactNode;
  sendButton: ReactNode;
  onModelSelect?: (modelId: string) => void;
}

export function InputExpandableContent({
  normalContent,
  session,
  selectedModelId,
  className = '',
  attachmentButton,
  sendButton,
  onModelSelect,
}: InputExpandableContentProps) {
  const [activePanel, setActivePanel] = useState<'models' | null>(null);

  // Handle ESC key to close panel
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activePanel) {
        setActivePanel(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [activePanel]);

  const modelSelectorData = ModelSelectorPanel({
    session,
    selectedModelId,
    onModelSelect: (modelId: string) => {
      setActivePanel(null);
      // Call the parent's onModelSelect if provided
      if (onModelSelect) {
        onModelSelect(modelId);
      }
    },
  });

  const handleBackClick = () => {
    setActivePanel(null);
  };

  return (
    <>
      <ExpandablePanel
        isOpen={activePanel !== null}
        onClose={handleBackClick}
        title="Model Selection"
        normalContent={normalContent}
        className={className}
      >
        {modelSelectorData.panel}
      </ExpandablePanel>

      {!activePanel && (
        <>
          <div className="absolute bottom-0 p-2 w-fit flex flex-row justify-start gap-1">
            {attachmentButton}
            <Button
              className="p-1.5 h-fit border dark:border-zinc-600 bg-transparent text-xs"
              variant="outline"
              size="sm"
              onClick={() => setActivePanel('models')}
            >
              {modelSelectorData.selectedChatModel?.name || 'Select Model'}
            </Button>
          </div>
          <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
            {sendButton}
          </div>
        </>
      )}
    </>
  );
}
