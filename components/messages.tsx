import { PreviewMessage, ThinkingMessage } from './message';
import { memo, useState } from 'react';
import type { Vote } from '@/lib/db/schema';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { motion } from 'framer-motion';
import { useMessages } from '@/hooks/use-messages';
import type { ChatMessage } from '@/lib/types';
import { useDataStream } from './data-stream-provider';
import { MCPToolResult } from './mcp-tool-result';
import { useElicitation } from '@/hooks/use-elicitation';
import { hasContainerForServer } from './mcp-tool-container';

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers<ChatMessage>['status'];
  votes: Array<Vote> | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  regenerate: UseChatHelpers<ChatMessage>['regenerate'];
  isReadonly: boolean;
  isArtifactVisible: boolean;
}

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    onViewportEnter,
    onViewportLeave,
    hasSentMessage,
  } = useMessages({
    chatId,
    status,
  });

  useDataStream();

  // Inline elicitation panel rendered inside the message flow when no tool container is mounted yet
  const { activeElicitations, respondToElicitation } = useElicitation();
  const elicitation = activeElicitations[activeElicitations.length - 1];
  const [elicitationDraft, setElicitationDraft] = useState<Record<string, any>>(
    {},
  );
  const setDraftField = (key: string, value: any) =>
    setElicitationDraft((d) => ({ ...d, [key]: value }));

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4 relative"
    >
      {messages.map((message, index) => (
        <PreviewMessage
          key={message.id}
          chatId={chatId}
          message={message}
          isLoading={status === 'streaming' && messages.length - 1 === index}
          vote={
            votes
              ? votes.find((vote) => vote.messageId === message.id)
              : undefined
          }
          setMessages={setMessages}
          regenerate={regenerate}
          isReadonly={isReadonly}
          requiresScrollPadding={
            hasSentMessage && index === messages.length - 1
          }
        />
      ))}

      {/* Inline elicitation fallback (immediate). Only shows if no tool container is mounted. */}
      {elicitation && !hasContainerForServer(elicitation.serverName) && (
        <div className="mx-auto w-full md:max-w-3xl px-4">
          <MCPToolResult
            toolName={`${elicitation.serverName}__pending_elicitation`}
            args={{}}
            state="call"
            serverName={elicitation.serverName}
          >
            <div className="mt-2 border border-input rounded p-2">
              <div className="text-xs text-muted-foreground mb-1">
                Elicitation requested by {elicitation.serverName}
              </div>
              <div className="text-sm mb-2">{elicitation.message}</div>
              <div className="mb-2 space-y-2">
                {(() => {
                  const rt: any = elicitation.responseType as any;
                  if (rt === 'boolean') return null;
                  if (rt === 'string') {
                    return (
                      <input
                        type="text"
                        className="w-full text-xs p-2 border border-input rounded bg-transparent"
                        value={
                          typeof elicitationDraft.value === 'string'
                            ? elicitationDraft.value
                            : ''
                        }
                        onChange={(e) => setDraftField('value', e.target.value)}
                        placeholder="Enter text"
                      />
                    );
                  }
                  if (rt === 'number' || rt === 'integer') {
                    return (
                      <input
                        type="number"
                        className="w-full text-xs p-2 border border-input rounded bg-transparent"
                        value={
                          typeof elicitationDraft.value === 'number'
                            ? elicitationDraft.value
                            : ''
                        }
                        onChange={(e) =>
                          setDraftField(
                            'value',
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value),
                          )
                        }
                        placeholder="Enter number"
                      />
                    );
                  }
                  if (Array.isArray(rt)) {
                    const current =
                      typeof elicitationDraft.value === 'string'
                        ? elicitationDraft.value
                        : undefined;
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
                              onClick={() => setDraftField('value', val)}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    );
                  }
                  if (
                    rt &&
                    rt.name === 'StructuredData' &&
                    rt.properties &&
                    typeof rt.properties === 'object'
                  ) {
                    const entries = Object.entries(
                      rt.properties as Record<string, any>,
                    );
                    if (entries.length === 0) return null;
                    return (
                      <div className="space-y-2">
                        {entries.map(([field, schema]) => {
                          const t = schema?.type || 'string';
                          const val =
                            (elicitationDraft as any)[field] ??
                            (t === 'boolean' ? false : '');
                          const enumVals = Array.isArray(schema?.enum)
                            ? schema.enum
                            : undefined;
                          return (
                            <div key={field} className="space-y-1">
                              <label
                                className="text-xs block"
                                htmlFor={`gelic-${field}`}
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
                                          setDraftField(field, sval)
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
                                  htmlFor={`gelic-${field}`}
                                >
                                  <input
                                    id={`gelic-${field}`}
                                    type="checkbox"
                                    className="accent-primary"
                                    checked={Boolean(val ?? false)}
                                    onChange={(e) =>
                                      setDraftField(field, e.target.checked)
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
                                    setDraftField(
                                      field,
                                      e.target.value === ''
                                        ? undefined
                                        : Number(e.target.value),
                                    )
                                  }
                                  placeholder={`Enter ${field}`}
                                />
                              ) : (
                                <input
                                  type="text"
                                  className="w-full text-xs p-2 border border-input rounded bg-transparent"
                                  value={val ?? ''}
                                  onChange={(e) =>
                                    setDraftField(field, e.target.value)
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
                {(() => {
                  const rt: any = elicitation.responseType as any;
                  if (rt === 'boolean') {
                    return (
                      <>
                        <button
                          type="button"
                          className="px-2 py-1 text-xs rounded border border-input hover:bg-muted"
                          onClick={() =>
                            respondToElicitation(
                              elicitation.elicitationToken,
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
                              elicitation.elicitationToken,
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
                              elicitation.elicitationToken,
                              'accept',
                              true,
                            )
                          }
                        >
                          Yes
                        </button>
                      </>
                    );
                  }
                  return (
                    <>
                      <button
                        type="button"
                        className="px-2 py-1 text-xs rounded border border-input hover:bg-muted"
                        onClick={() =>
                          respondToElicitation(
                            elicitation.elicitationToken,
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
                            elicitation.elicitationToken,
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
                          const rt: any = elicitation.responseType as any;
                          let data: any = undefined;
                          if (
                            rt === 'string' ||
                            rt === 'number' ||
                            rt === 'integer'
                          ) {
                            data = elicitationDraft?.value;
                          } else if (Array.isArray(rt)) {
                            data =
                              elicitationDraft?.value ??
                              (rt.length > 0 ? rt[0] : undefined);
                          } else if (rt && rt.name === 'StructuredData') {
                            data = elicitationDraft ?? {};
                          }
                          respondToElicitation(
                            elicitation.elicitationToken,
                            'accept',
                            data,
                          );
                        }}
                      >
                        Accept
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          </MCPToolResult>
        </div>
      )}

      {status === 'submitted' &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'user' && <ThinkingMessage />}

      <motion.div
        ref={messagesEndRef}
        className="shrink-0 min-w-[24px] min-h-[24px]"
        onViewportLeave={onViewportLeave}
        onViewportEnter={onViewportEnter}
      />
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isArtifactVisible && nextProps.isArtifactVisible) return true;

  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;

  return false;
});
