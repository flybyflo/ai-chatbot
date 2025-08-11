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

// Registry of mounted containers in "call" state per server for anchoring elicitation UI
const serverActiveContainerCounts = new Map<string, number>();
function incServerCount(serverName?: string) {
  if (!serverName) return;
  serverActiveContainerCounts.set(
    serverName,
    (serverActiveContainerCounts.get(serverName) ?? 0) + 1,
  );
}
function decServerCount(serverName?: string) {
  if (!serverName) return;
  const next = (serverActiveContainerCounts.get(serverName) ?? 0) - 1;
  if (next <= 0) serverActiveContainerCounts.delete(serverName);
  else serverActiveContainerCounts.set(serverName, next);
}
export function hasContainerForServer(serverName?: string): boolean {
  if (!serverName) return serverActiveContainerCounts.size > 0;
  return (serverActiveContainerCounts.get(serverName) ?? 0) > 0;
}

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
  const [elicitationDraftByToken, setElicitationDraftByToken] = useState<
    Record<string, any>
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
  // Prefer matching elicitation by server; if none found, fall back to most recent
  const elicitationForServer = serverName
    ? activeElicitations.find((e) => e.serverName === serverName) ||
      activeElicitations[activeElicitations.length - 1]
    : activeElicitations[activeElicitations.length - 1];
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

  // Track container presence for a server while in call state
  useEffect(() => {
    if (currentState === 'call') {
      incServerCount(serverName);
      return () => decServerCount(serverName);
    }
    return;
  }, [currentState, serverName]);

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
          {/* Dynamic inputs based on responseType */}
          <div className="mb-2 space-y-2">
            {(() => {
              const token = elicitationForServer.elicitationToken;
              const rt = elicitationForServer.responseType as any;
              const draft = elicitationDraftByToken[token] ?? {};

              const setDraft = (updater: (prev: any) => any) =>
                setElicitationDraftByToken((prev) => ({
                  ...prev,
                  [token]: updater(prev[token] ?? {}),
                }));

              // Scalar types
              if (rt === 'boolean') {
                // For boolean confirmation, we do not render a checkbox input.
                // The action buttons below provide Yes/No/Cancel directly.
                return null;
              }
              if (rt === 'number' || rt === 'integer') {
                const current =
                  typeof draft.value === 'number' ? draft.value : undefined;
                return (
                  <input
                    type="number"
                    className="w-full text-xs p-2 border border-input rounded bg-transparent"
                    value={current ?? ''}
                    onChange={(e) =>
                      setDraft(() => ({
                        value:
                          e.target.value === ''
                            ? undefined
                            : Number(e.target.value),
                      }))
                    }
                    placeholder="Enter number"
                  />
                );
              }
              if (rt === 'string') {
                const current =
                  typeof draft.value === 'string' ? draft.value : '';
                return (
                  <input
                    type="text"
                    className="w-full text-xs p-2 border border-input rounded bg-transparent"
                    value={current}
                    onChange={(e) =>
                      setDraft(() => ({ value: e.target.value }))
                    }
                    placeholder="Enter text"
                  />
                );
              }

              // Enum as top-level constrained choices (array of strings) → show as buttons
              if (Array.isArray(rt)) {
                const current =
                  typeof draft.value === 'string' ? draft.value : undefined;
                return (
                  <div className="flex flex-wrap gap-1">
                    {rt.map((opt: any) => {
                      const val = String(opt);
                      const isSelected = current === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          className={`px-2 py-1 text-xs rounded border ${
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-input hover:bg-muted'
                          }`}
                          onClick={() => setDraft(() => ({ value: val }))}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                );
              }

              // Structured data
              if (
                rt &&
                rt.name === 'StructuredData' &&
                rt.properties &&
                typeof rt.properties === 'object'
              ) {
                const entries = Object.entries(
                  rt.properties as Record<string, any>,
                );
                return (
                  <div className="space-y-2">
                    {entries.map(([field, schema]) => {
                      const t = schema?.type || 'string';
                      const val =
                        draft[field] ?? (t === 'boolean' ? false : '');
                      const enumVals = Array.isArray(schema?.enum)
                        ? schema.enum
                        : undefined;

                      return (
                        <div key={field} className="space-y-1">
                          <label
                            className="text-xs block"
                            htmlFor={`elic-${toolCallId}-${field}`}
                          >
                            {field}
                          </label>
                          {enumVals ? (
                            <div className="flex flex-wrap gap-1">
                              {enumVals.map((opt: any) => {
                                const sval = String(opt);
                                const isSelected = String(val) === sval;
                                return (
                                  <button
                                    key={sval}
                                    type="button"
                                    className={`px-2 py-1 text-xs rounded border ${
                                      isSelected
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'border-input hover:bg-muted'
                                    }`}
                                    onClick={() =>
                                      setDraft((d) => ({ ...d, [field]: sval }))
                                    }
                                  >
                                    {sval}
                                  </button>
                                );
                              })}
                            </div>
                          ) : t === 'boolean' ? (
                            <label
                              className="flex items-center gap-2 text-xs"
                              htmlFor={`elic-${toolCallId}-${field}`}
                            >
                              <input
                                id={`elic-${toolCallId}-${field}`}
                                type="checkbox"
                                className="accent-primary"
                                checked={Boolean(val ?? false)}
                                onChange={(e) =>
                                  setDraft((d) => ({
                                    ...d,
                                    [field]: e.target.checked,
                                  }))
                                }
                              />
                              {field}
                            </label>
                          ) : t === 'number' || t === 'integer' ? (
                            <input
                              type="number"
                              className="w-full text-xs p-2 border border-input rounded bg-transparent"
                              value={val ?? ''}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  [field]:
                                    e.target.value === ''
                                      ? undefined
                                      : Number(e.target.value),
                                }))
                              }
                              placeholder={`Enter ${field}`}
                            />
                          ) : (
                            <input
                              type="text"
                              className="w-full text-xs p-2 border border-input rounded bg-transparent"
                              value={val ?? ''}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  [field]: e.target.value,
                                }))
                              }
                              placeholder={`Enter ${field}`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              }

              return null;
            })()}
          </div>
          <div className="flex gap-2">
            {elicitationForServer.responseType === 'boolean' ? (
              <>
                <button
                  type="button"
                  className="px-2 py-1 text-xs rounded border border-input hover:bg-muted"
                  onClick={() =>
                    respondToElicitation(
                      elicitationForServer.elicitationToken,
                      'accept',
                      false,
                    )
                  }
                >
                  No
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
                  onClick={() =>
                    respondToElicitation(
                      elicitationForServer.elicitationToken,
                      'accept',
                      true,
                    )
                  }
                >
                  Yes
                </button>
              </>
            ) : (
              <>
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
                    const token = elicitationForServer.elicitationToken;
                    const rt = elicitationForServer.responseType as any;
                    const draft = elicitationDraftByToken[token];
                    let data: any = undefined;
                    if (
                      rt === 'string' ||
                      rt === 'number' ||
                      rt === 'integer'
                    ) {
                      data = draft?.value;
                    } else if (Array.isArray(rt)) {
                      data =
                        draft?.value ?? (rt.length > 0 ? rt[0] : undefined);
                    } else if (rt && rt.name === 'StructuredData') {
                      data = draft ?? {};
                    }
                    respondToElicitation(token, 'accept', data);
                  }}
                >
                  Accept
                </button>
              </>
            )}
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
