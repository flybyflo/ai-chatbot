'use client';

import { useEffect } from 'react';
import { MCPServersWithDialog } from './options/mcp-servers-with-dialog';

interface InputOptionsProps {
  onTitleChange?: (title: React.ReactNode, headerAction?: React.ReactNode) => void;
  resetTrigger?: boolean;
}

export function InputOptions({ onTitleChange, resetTrigger }: InputOptionsProps) {
  // Update title when component mounts or resets
  useEffect(() => {
    onTitleChange?.('MCP Servers');
  }, [onTitleChange, resetTrigger]);

  return <MCPServersWithDialog />;
}