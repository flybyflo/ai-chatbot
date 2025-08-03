'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Button } from './ui/button';
import { Sliders } from 'lucide-react';
import { ExpandablePanel } from './expandable-panel';
import { InputOptions } from './input-options';
import { ModelSelectorPanel } from './model-selector-panel';
import type { Session } from 'next-auth';

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
  const [activePanel, setActivePanel] = useState<'options' | 'models' | null>(
    null,
  );
  const [panelTitle, setPanelTitle] = useState<React.ReactNode>('Options');
  const [panelHeaderAction, setPanelHeaderAction] = useState<React.ReactNode>(null);
  const [isInSubpage, setIsInSubpage] = useState(false);

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

  const [resetTrigger, setResetTrigger] = useState(false);

  const handleBackClick = () => {
    if (activePanel === 'options' && isInSubpage) {
      // Go back to main options menu
      setIsInSubpage(false);
      setResetTrigger(!resetTrigger);
      // Title will be updated by the OptionsNavigator
    } else {
      // Close the entire panel
      setActivePanel(null);
      setIsInSubpage(false);
      setPanelTitle('Options');
    }
  };

  const handleTitleChange = (title: React.ReactNode, headerAction?: React.ReactNode) => {
    setPanelTitle(title);
    setPanelHeaderAction(headerAction || null);
    setIsInSubpage(title !== 'Options');
  };

  return (
    <>
      <ExpandablePanel
        isOpen={activePanel !== null}
        onClose={handleBackClick}
        title={activePanel === 'options' ? panelTitle : 'Model Selection'}
        normalContent={normalContent}
        className={className}
        headerAction={activePanel === 'options' ? panelHeaderAction : undefined}
      >
        {activePanel === 'options' ? (
          <InputOptions
            onTitleChange={handleTitleChange}
            resetTrigger={resetTrigger}
          />
        ) : (
          modelSelectorData.panel
        )}
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
            <Button
              className="p-1.5 h-fit border dark:border-zinc-600 bg-transparent"
              variant="outline"
              size="sm"
              onClick={() => setActivePanel('options')}
            >
              <Sliders size={14} />
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
