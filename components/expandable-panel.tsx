'use client';

import { useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { ArrowLeft } from 'lucide-react';

interface ExpandablePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: ReactNode;
  normalContent: ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

export function ExpandablePanel({
  isOpen,
  onClose,
  title,
  children,
  normalContent,
  className = '',
  headerAction,
}: ExpandablePanelProps) {
  // Handle ESC key to close panel
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <div className="relative">
      {!isOpen ? (
        normalContent
      ) : (
        <motion.div
          initial={{ height: '50px' }}
          animate={{ height: '240px' }}
          exit={{ height: '50px' }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className={`bg-muted rounded-2xl p-3 border dark:border-zinc-700 overflow-hidden ${className}`}
        >
          <div className="flex justify-between items-center mb-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground size-6"
            >
              <ArrowLeft size={14} />
            </Button>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <div className="w-6 flex justify-end">
              {headerAction}
            </div>
          </div>
          <div className="h-full overflow-y-auto">{children}</div>
        </motion.div>
      )}
    </div>
  );
}
