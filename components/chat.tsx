'use client';

import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, fetchWithErrorHandlers, generateUUID } from '@/lib/utils';
import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import { MCPToolResult } from './mcp-tool-result';
import type { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { toast } from './toast';
import type { Session } from '@/lib/auth';
import { useSearchParams } from 'next/navigation';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { ChatSDKError } from '@/lib/errors';
import type { Attachment, ChatMessage } from '@/lib/types';
import { useDataStream } from './data-stream-provider';
import { useRealtime } from '@/hooks/use-realtime';
import type { OutboundMessage } from '@/lib/realtime/schema';
import { useElicitation } from '@/hooks/use-elicitation';
import { hasContainerForServer } from './mcp-tool-container';
import { useSampling } from '@/hooks/use-sampling';

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  session,
  autoResume,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  autoResume: boolean;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();
  // Proactively open a WebSocket connection even on new/empty chat
  useRealtime((_m: OutboundMessage) => {});
  // Mount listeners early so events are captured before tool containers render
  useElicitation();
  useSampling();

  const [input, setInput] = useState<string>('');
  const [selectedModelId, setSelectedModelId] =
    useState<string>(initialChatModel);

  // Elicitation handled inline in MCP tool container; also provide a global fallback below

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest({ messages, id, body }) {
        return {
          body: {
            id,
            message: messages.at(-1),
            selectedChatModel: initialChatModel,
            selectedVisibilityType: visibilityType,
            ...body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        toast({
          type: 'error',
          description: error.message,
        });
      }
    },
  });

  const searchParams = useSearchParams();
  const query = searchParams?.get('query') ?? null;

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: 'user' as const,
        parts: [{ type: 'text', text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, '', `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  // No modal elicitation dialog; primary is inline per tool

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          selectedVisibilityType={initialVisibilityType}
          isReadonly={isReadonly}
          session={session}
        />

        {messages.length > 0 ? (
          <Messages
            chatId={id}
            status={status}
            votes={votes}
            messages={messages}
            setMessages={setMessages}
            regenerate={regenerate}
            isReadonly={isReadonly}
            isArtifactVisible={isArtifactVisible}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full md:max-w-3xl px-4">
              {!isReadonly && (
                <MultimodalInput
                  chatId={id}
                  input={input}
                  setInput={setInput}
                  status={status}
                  stop={stop}
                  attachments={attachments}
                  setAttachments={setAttachments}
                  messages={messages}
                  setMessages={setMessages}
                  sendMessage={sendMessage}
                  session={session}
                  selectedModelId={selectedModelId}
                  onModelSelect={(modelId) => setSelectedModelId(modelId)}
                />
              )}
            </div>
          </div>
        )}

        {/* Inline elicitation fallback panel: renders immediately in chat flow */}
        <InlineElicitationFallback />

        {messages.length > 0 && (
          <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
            {!isReadonly && (
              <MultimodalInput
                chatId={id}
                input={input}
                setInput={setInput}
                status={status}
                stop={stop}
                attachments={attachments}
                setAttachments={setAttachments}
                messages={messages}
                setMessages={setMessages}
                sendMessage={sendMessage}
                session={session}
                selectedModelId={selectedModelId}
                onModelSelect={(modelId) => setSelectedModelId(modelId)}
              />
            )}
          </form>
        )}
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        status={status}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        sendMessage={sendMessage}
        messages={messages}
        setMessages={setMessages}
        regenerate={regenerate}
        votes={votes}
        isReadonly={isReadonly}
        selectedVisibilityType={visibilityType}
        session={session}
        selectedModelId={selectedModelId}
      />

      {/* Inline fallback above; overlay fallback removed */}
    </>
  );
}

function InlineElicitationFallback() {
  const { activeElicitations, respondToElicitation } = useElicitation();
  const [draft, setDraft] = useState<Record<string, any>>({});
  const elicitation = activeElicitations[activeElicitations.length - 1];
  // If there is a mounted tool container for this elicitation's server, do not show fallback
  const [visible, setVisible] = useState(false);

  // Grace period: wait briefly for the inline tool container to mount before showing fallback
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    setVisible(false);
    if (!elicitation) return;
    if (hasContainerForServer(elicitation.serverName)) return;
    timeoutId = setTimeout(() => {
      if (!hasContainerForServer(elicitation.serverName)) setVisible(true);
    }, 600);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [elicitation]);

  // Hide fallback immediately if a container appears
  useEffect(() => {
    if (elicitation && hasContainerForServer(elicitation.serverName)) {
      setVisible(false);
    }
  }, [elicitation, activeElicitations.length]);

  if (elicitation && hasContainerForServer(elicitation.serverName)) return null;
  if (!visible) return null;

  if (!elicitation) return null;

  const rt: any = elicitation.responseType as any;
  const setDraftField = (key: string, value: any) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const renderFields = () => {
    if (rt === 'boolean') return null;
    if (rt === 'string') {
      return (
        <input
          type="text"
          className="w-full text-xs p-2 border border-input rounded bg-transparent"
          value={typeof draft.value === 'string' ? draft.value : ''}
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
          value={typeof draft.value === 'number' ? draft.value : ''}
          onChange={(e) =>
            setDraftField(
              'value',
              e.target.value === '' ? undefined : Number(e.target.value),
            )
          }
          placeholder="Enter number"
        />
      );
    }
    if (Array.isArray(rt)) {
      const current = typeof draft.value === 'string' ? draft.value : undefined;
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
      const entries = Object.entries(rt.properties as Record<string, any>);
      if (entries.length === 0) return null;
      return (
        <div className="space-y-2">
          {entries.map(([field, schema]) => {
            const t = schema?.type || 'string';
            const val = draft[field] ?? (t === 'boolean' ? false : '');
            const enumVals = Array.isArray(schema?.enum)
              ? schema.enum
              : undefined;
            return (
              <div key={field} className="space-y-1">
                <label className="text-xs block" htmlFor={`gelic-${field}`}>
                  {field}
                </label>
                {enumVals ? (
                  <select
                    id={`gelic-${field}`}
                    className="w-full text-xs p-2 border border-input rounded bg-transparent"
                    value={val === undefined ? '' : String(val)}
                    onChange={(e) => setDraftField(field, e.target.value)}
                  >
                    <option value="" disabled>
                      Select an option
                    </option>
                    {enumVals.map((opt: any) => (
                      <option key={String(opt)} value={String(opt)}>
                        {String(opt)}
                      </option>
                    ))}
                  </select>
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
                      onChange={(e) => setDraftField(field, e.target.checked)}
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
                    onChange={(e) => setDraftField(field, e.target.value)}
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
  };

  const accept = () => {
    let data: any = undefined;
    if (rt === 'string' || rt === 'number' || rt === 'integer') {
      data = draft?.value;
    } else if (Array.isArray(rt)) {
      data = draft?.value ?? (rt.length > 0 ? rt[0] : undefined);
    } else if (rt && rt.name === 'StructuredData') {
      data = draft ?? {};
    } else if (rt === 'boolean') {
      data = true;
    }
    respondToElicitation(elicitation.elicitationToken, 'accept', data);
  };

  return (
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
          <div className="mb-2 space-y-2">{renderFields()}</div>
          <div className="flex gap-2">
            {rt === 'boolean' ? (
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
                    respondToElicitation(elicitation.elicitationToken, 'cancel')
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
            ) : (
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
                    respondToElicitation(elicitation.elicitationToken, 'cancel')
                  }
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-xs rounded border border-input hover:bg-muted"
                  onClick={accept}
                >
                  Accept
                </button>
              </>
            )}
          </div>
        </div>
      </MCPToolResult>
    </div>
  );
}
