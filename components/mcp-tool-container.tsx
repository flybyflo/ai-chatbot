'use client';

import { memo, useState, useEffect, useRef } from 'react';
import { MCPToolResult } from './mcp-tool-result';
import { useProgress } from '@/hooks/use-progress';

interface MCPToolContainerProps {
  toolName: string;
  toolCallId: string;
  args: Record<string, any>;
  result?: any;
  state: 'call' | 'result';
  isReadonly?: boolean;
  serverName?: string;
}

// Store active tool calls globally to manage their state
const toolCallsMap = new Map();

const MCPToolContainer = memo(function MCPToolContainer({
  toolName,
  toolCallId,
  args,
  result,
  state,
  isReadonly,
  serverName,
}: MCPToolContainerProps) {
  const [currentState, setCurrentState] = useState<'call' | 'result'>('call');
  const [currentResult, setCurrentResult] = useState(result);
  const mountedRef = useRef(true);
  const { getProgressForTool } = useProgress();
  
  // Get progress for this specific tool - use the original tool name without server prefix
  const originalToolName = toolName.startsWith(`${serverName}__`) ? toolName.substring(`${serverName}__`.length) : toolName;
  const progressInfo = serverName ? getProgressForTool(originalToolName, serverName) : undefined;
  

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Register this tool call
    toolCallsMap.set(toolCallId, {
      toolName,
      args,
      state,
      result,
      updateState: (newState: 'call' | 'result', newResult?: any) => {
        if (mountedRef.current) {
          setCurrentState(newState);
          if (newResult !== undefined) {
            setCurrentResult(newResult);
          }
        }
      }
    });

    // Update current state
    if (state === 'result' && result !== undefined) {
      setCurrentState('result');
      setCurrentResult(result);
    }

    return () => {
      toolCallsMap.delete(toolCallId);
    };
  }, [toolCallId, toolName, args, state, result]);

  return (
    <MCPToolResult
      toolName={toolName}
      args={args}
      result={currentResult}
      state={currentState}
      serverName={serverName}
      progress={progressInfo?.currentProgress}
    />
  );
});

export { MCPToolContainer };