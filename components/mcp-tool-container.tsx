'use client';

import { memo, useState, useEffect, useRef } from 'react';
import { MCPToolResult } from './mcp-tool-result';
import { useProgress } from '@/hooks/use-progress';
import { useElicitation } from '@/hooks/use-elicitation';
import { useSampling, type ActiveSamplingRequest } from '@/hooks/use-sampling';

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
  const [samplingDraftSystem, setSamplingDraftSystem] = useState<
    Record<string, string>
  >({});
  const mountedRef = useRef(true);
  const { getProgressForTool } = useProgress();
  const { activeElicitations, respondToElicitation } = useElicitation();
  const { activeSampling, respondToSampling } = useSampling();

  // Get progress for this specific tool - use the original tool name without server prefix
  const originalToolName = toolName.startsWith(`${serverName}__`)
    ? toolName.substring(`${serverName}__`.length)
    : toolName;
  const progressInfo = serverName
    ? getProgressForTool(originalToolName, serverName)
    : undefined;
  const elicitationForServer = serverName
    ? activeElicitations.find((e) => e.serverName === serverName)
    : undefined;
  const samplingForServer = serverName
    ? [...activeSampling]
        .reverse()
        .find((s: ActiveSamplingRequest) => s.serverName === serverName)
    : undefined;

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
      },
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
    >
      {currentState === 'call' && elicitationForServer ? (
        <div className="mt-2 border border-input rounded p-2">
          <div className="text-xs text-muted-foreground mb-1">
            Elicitation requested by {serverName}
          </div>
          <div className="text-sm mb-2">{elicitationForServer.message}</div>
          <div className="flex gap-2">
            <button
              type="button"
              className="px-2 py-1 text-xs rounded border border-input hover:bg-muted"
              onClick={() =>
                respondToElicitation(
                  elicitationForServer.elicitationToken,
                  'decline',
                )
              }
            >
              Decline
            </button>
            <button
              type="button"
              className="px-2 py-1 text-xs rounded border border-input hover:bg-muted"
              onClick={() =>
                respondToElicitation(
                  elicitationForServer.elicitationToken,
                  'cancel',
                )
              }
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-2 py-1 text-xs rounded border border-input hover:bg-muted"
              onClick={() => {
                const value = prompt(elicitationForServer.message) ?? '';
                respondToElicitation(
                  elicitationForServer.elicitationToken,
                  'accept',
                  value,
                );
              }}
            >
              Accept
            </button>
          </div>
        </div>
      ) : null}

      {currentState === 'call' && samplingForServer ? (
        <div className="mt-2 border border-input rounded p-2">
          <div className="text-xs text-muted-foreground mb-1">
            Sampling approval requested by {serverName}
          </div>
          <div className="text-xs text-muted-foreground mb-2">
            {samplingForServer.messages?.length ?? 0} message(s)
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="px-2 py-1 text-xs rounded border border-input hover:bg-muted"
              onClick={() =>
                respondToSampling(samplingForServer.requestId, false)
              }
            >
              Deny
            </button>
            <button
              type="button"
              className="px-2 py-1 text-xs rounded border border-input hover:bg-muted"
              onClick={() =>
                respondToSampling(samplingForServer.requestId, true)
              }
            >
              Approve
            </button>
          </div>
        </div>
      ) : null}
    </MCPToolResult>
  );
});

export { MCPToolContainer };
