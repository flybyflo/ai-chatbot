'use client';

import React, { useState, useEffect, useMemo } from 'react';

export interface OptionPage {
  id: string;
  title: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  component: React.ComponentType<any>;
  headerAction?: React.ComponentType<any>;
}

interface OptionsNavigatorProps {
  pages: OptionPage[];
  defaultPageId?: string;
  onTitleChange?: (title: React.ReactNode, headerAction?: React.ReactNode) => void;
  resetTrigger?: boolean;
}

export function OptionsNavigator({ pages, defaultPageId, onTitleChange, resetTrigger }: OptionsNavigatorProps) {
  const [currentPageId, setCurrentPageId] = useState<string | null>(
    defaultPageId || null,
  );

  const currentPage = pages.find((page) => page.id === currentPageId);

  // Reset to main menu when trigger changes
  useEffect(() => {
    setCurrentPageId(null);
  }, [resetTrigger]);


  // Simplified title management - just set the basic title
  useEffect(() => {
    if (currentPage) {
      onTitleChange?.(
        <>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setCurrentPageId(null)}
          >
            Options
          </button>
          <span className="text-muted-foreground mx-1">/</span>
          <span className="font-medium">{currentPage.title}</span>
        </>,
        currentPage.headerAction ? <currentPage.headerAction /> : undefined
      );
    } else {
      onTitleChange?.('Options');
    }
  }, [currentPage, onTitleChange]);

  if (currentPage) {
    const PageComponent = currentPage.component;
    
    return (
      <div className="space-y-3">
        <PageComponent />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2">
        {pages.map((page) => {
          const IconComponent = page.icon;
          return (
            <button
              key={page.id}
              type="button"
              className="w-full text-left p-2 hover:bg-background/50 rounded text-xs flex items-center gap-2"
              onClick={() => setCurrentPageId(page.id)}
            >
              {IconComponent && <IconComponent size={14} />}
              {page.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}