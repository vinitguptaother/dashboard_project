'use client';

/**
 * ChiefAnalystChat — conversational interface to the Chief Analyst super-bot.
 *
 * MASTER_PLAN §3 Tier 1 · Phase 4 deliverable.
 *
 * Behaviour:
 *   - User types a question → POST /api/agents/chief-analyst/chat { query }
 *   - Messages stored in ephemeral component state (no DB persistence for MVP)
 *   - CA responses are plain prose (chat mode doesn't return JSON)
 *   - Loading state between send + reply
 *   - Clear-chat button resets the transcript
 *   - Handles the "needs key" partial state gracefully
 */

import {
  FormEvent,
  KeyboardEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Sparkles, Send, Trash2, User as UserIcon } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

type Role = 'user' | 'analyst' | 'system';

interface Message {
  id: string;
  role: Role;
  content: string;
  at: number;
  cost?: number;
}

interface ChatApiResponse {
  status?: string;
  agent?: string;
  data?: {
    success?: boolean;
    error?: string;
    partial?: boolean;
    output?: { reply?: string };
    costUSD?: number;
  };
  message?: string;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ChiefAnalystChat(): ReactElement {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to bottom when messages change or loading toggles
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const sendMessage = useCallback(
    async (raw: string): Promise<void> => {
      const query = raw.trim();
      if (!query || loading) return;

      setError('');
      const userMsg: Message = { id: uid(), role: 'user', content: query, at: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      try {
        const res = await fetch(`${BACKEND_URL}/api/agents/chief-analyst/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });
        const json: ChatApiResponse = await res.json().catch(() => ({}));
        const reply = json?.data?.output?.reply;
        const partial = json?.data?.partial;
        const errMsg = json?.data?.error || json?.message;

        if (reply) {
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: 'analyst',
              content: reply,
              at: Date.now(),
              cost: json.data?.costUSD,
            },
          ]);
        } else if (partial || errMsg) {
          const msg =
            partial && /needs key/i.test(errMsg || '')
              ? 'ANTHROPIC_API_KEY is not set. Add it to backend/.env and restart the server to enable the Chief Analyst.'
              : errMsg || 'Chief Analyst returned no reply.';
          setMessages((prev) => [
            ...prev,
            { id: uid(), role: 'system', content: msg, at: Date.now() },
          ]);
        } else {
          setError('Unexpected response from Chief Analyst.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error');
      } finally {
        setLoading(false);
        // Re-focus the textarea for rapid follow-ups
        textareaRef.current?.focus();
      }
    },
    [loading],
  );

  const onSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    void sendMessage(input);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const clearChat = (): void => {
    setMessages([]);
    setError('');
  };

  return (
    <div className="flex flex-col h-[520px] rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-100 dark:border-indigo-900 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <div>
            <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
              Chief Analyst
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              Ask anything — market context, trade review, what to watch.
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={clearChat}
          disabled={!messages.length || loading}
          className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-rose-500 disabled:opacity-40 disabled:hover:text-gray-500 px-2 py-1 rounded-md hover:bg-white/70 dark:hover:bg-gray-800 transition-colors"
          title="Clear chat"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>

      {/* Messages scroll area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50/50 dark:bg-gray-950/30"
      >
        {messages.length === 0 && !loading && (
          <div className="h-full flex items-center justify-center text-center px-6">
            <div className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
              <Sparkles className="w-6 h-6 mx-auto mb-2 text-indigo-400" />
              <p className="mb-1 font-medium text-gray-700 dark:text-gray-300">
                No messages yet.
              </p>
              <p>
                Try: &quot;What is the market regime today?&quot; · &quot;Should I be
                aggressive this week?&quot; · &quot;Review last week&apos;s FII flow.&quot;
              </p>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {loading && (
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-indigo-50 dark:bg-indigo-900/30 px-3 py-2 text-sm text-indigo-900 dark:text-indigo-200">
              <span className="inline-flex items-center gap-1">
                Thinking
                <span className="inline-flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-rose-500 border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={onSubmit}
        className="border-t border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-900"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask the Chief Analyst…"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-300 max-h-32 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            Send
          </button>
        </div>
        <div className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
          Press Enter to send · Shift+Enter for newline · Chat does not affect CA memory.
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }): ReactElement {
  if (message.role === 'user') {
    return (
      <div className="flex items-start justify-end gap-2">
        <div className="rounded-2xl rounded-tr-sm bg-blue-600 text-white px-3 py-2 text-sm max-w-[75%] whitespace-pre-wrap">
          {message.content}
        </div>
        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
          <UserIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-300" />
        </div>
      </div>
    );
  }

  if (message.role === 'system') {
    return (
      <div className="flex justify-center">
        <div className="max-w-[85%] text-xs italic text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  // analyst
  return (
    <div className="flex items-start gap-2">
      <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-indigo-50 dark:bg-indigo-900/30 px-3 py-2 text-sm text-indigo-900 dark:text-indigo-100 max-w-[75%] whitespace-pre-wrap">
        {message.content}
        {typeof message.cost === 'number' && message.cost > 0 && (
          <div className="text-[10px] mt-1 text-indigo-500 dark:text-indigo-400 opacity-70">
            ~${message.cost.toFixed(4)}
          </div>
        )}
      </div>
    </div>
  );
}
