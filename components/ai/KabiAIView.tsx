'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  AlertCircle,
  Plus,
  MessageSquare,
  Trash2,
  Clock,
  ChevronLeft,
  RotateCcw,
} from 'lucide-react';
import {
  aiApi,
  AIMessage,
  ConversationSummary,
  ChatResponseData,
} from '@/lib/api/ai';
import { useAuth } from '@/lib/authContext';

const MAX_MESSAGE_LENGTH = 2000;

const SUGGESTED_QUESTIONS = [
  'How does the handover process work?',
  'What is the indicative price for laptop scrap?',
  'How do I find an authorized recycler in Hyderabad?',
  'How should I handle damaged lithium batteries?',
];

function formatTime(timestampStr: string) {
  try {
    const d = new Date(timestampStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function KabiAIView() {
  const { user, isAuthenticated, isLoading } = useAuth();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Conversations history list
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  // Load user conversation list on mount
  const loadConversations = useCallback(async () => {
    if (!isAuthenticated) {
      setConversations([]);
      return;
    }
    setLoadingHistory(true);
    try {
      const res = await aiApi.getConversations(1, 30);
      setConversations(res.conversations);
    } catch (err: any) {
      console.warn('Could not load AI conversations history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      loadConversations();
    } else {
      setMessages([]);
      setSessionId(null);
      setConversations([]);
    }
  }, [isAuthenticated, isLoading, loadConversations]);

  // Select a past conversation session
  const selectSession = async (targetSessionId: string) => {
    setError(null);
    setShowHistoryDrawer(false);
    try {
      const detail = await aiApi.getConversation(targetSessionId);
      setSessionId(detail.sessionId);
      setMessages(detail.messages || []);
    } catch (err: any) {
      console.error('Failed to load conversation details:', err);
      setError('Could not load conversation session. Please try again.');
    }
  };

  // Start fresh chat
  const handleNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setError(null);
    setInput('');
    setShowHistoryDrawer(false);
    inputRef.current?.focus();
  };

  // Delete a session
  const handleDeleteSession = async (e: React.MouseEvent, targetSessionId: string) => {
    e.stopPropagation();
    try {
      await aiApi.deleteConversation(targetSessionId);
      setConversations((prev) => prev.filter((c) => c.sessionId !== targetSessionId));
      if (sessionId === targetSessionId) {
        handleNewChat();
      }
    } catch (err: any) {
      console.error('Failed to delete conversation session:', err);
    }
  };

  // Send message
  const handleSend = async (messageToSend?: string) => {
    const text = (messageToSend || input).trim();
    if (!text || sending) return;

    if (text.length > MAX_MESSAGE_LENGTH) {
      setError(`Message is too long. Please keep under ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }

    const optimisticUserMsg: AIMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg]);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const res: ChatResponseData = await aiApi.sendMessage({
        message: text,
        sessionId: sessionId || undefined,
      });

      // Update sessionId if backend assigned or returned one
      if (res.sessionId && res.sessionId !== sessionId) {
        setSessionId(res.sessionId);
      }

      const assistantMsg: AIMessage = {
        role: 'assistant',
        content: res.message,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Refresh conversations list to update titles/timestamps
      loadConversations();
    } catch (err: any) {
      console.error('KabiAI request failed:', err);
      setError(
        err.message || 'Sorry, I could not process that request. Please try again.'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4">
      {/* Session Header / Action Bar */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <MessageSquare size={14} className="text-emerald-600" />
            <span>Chat History ({conversations.length})</span>
          </button>

          {sessionId && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-400 font-mono px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200">
              Session: {sessionId.slice(0, 16)}...
            </span>
          )}
        </div>

        <button
          onClick={handleNewChat}
          className="flex items-center gap-1 text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-2xs"
        >
          <Plus size={14} />
          <span>New Chat</span>
        </button>
      </div>

      {/* History Drawer Dropdown if open */}
      {showHistoryDrawer && (
        <div className="card p-4 border border-emerald-200 bg-white rounded-2xl shadow-md">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Your Past Conversations
            </h3>
            <button
              onClick={() => setShowHistoryDrawer(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Close
            </button>
          </div>

          {loadingHistory ? (
            <div className="py-6 text-center text-xs text-gray-400">
              Loading chat sessions...
            </div>
          ) : conversations.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">
              No saved conversations yet. Start a new chat below!
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {conversations.map((c) => (
                <div
                  key={c.id || c.sessionId}
                  onClick={() => selectSession(c.sessionId)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-colors ${
                    sessionId === c.sessionId
                      ? 'bg-emerald-50 text-emerald-900 font-medium border border-emerald-200'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="truncate font-semibold">{c.title || 'Conversation'}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {c.messageCount} messages · {formatTime(c.updatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(e, c.sessionId)}
                    title="Delete conversation"
                    className="p-1 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Chat Interface */}
      <div className="rounded-3xl bg-slate-950 text-white overflow-hidden shadow-xl border border-slate-800 flex flex-col">
        {/* Chat Card Header */}
        <div className="p-5 md:p-6 border-b border-slate-800 flex items-center gap-4 bg-slate-900/60">
          <div className="size-12 rounded-2xl bg-emerald-400 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
            <Bot size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg text-white">KabiAI Assistant</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Verified Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Trained for e-waste classification, pricing, schedules, and safe handovers.
            </p>
          </div>
          <Sparkles className="text-emerald-400 shrink-0" size={20} />
        </div>

        {/* Message Thread Area */}
        <div className="p-5 md:p-8 min-h-[420px] max-h-[560px] overflow-y-auto flex flex-col gap-4">
          {/* Welcome introductory message when chat has no messages */}
          {messages.length === 0 && (
            <div className="my-auto flex flex-col items-center text-center max-w-md mx-auto py-8">
              <div className="size-16 rounded-3xl bg-slate-900 border border-slate-800 text-emerald-400 flex items-center justify-center mb-4">
                <Bot size={32} />
              </div>
              <h3 className="text-base font-bold text-white">
                Namaste {user?.name || 'Collector'}!
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                I am your digital e-waste assistant. Ask me about material classifications,
                current indicative prices, handover steps, or verified recyclers in your area.
              </p>

              {/* Suggested quick pills */}
              <div className="mt-6 flex flex-col gap-2 w-full text-left">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Suggested topics
                </p>
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="text-xs text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl px-4 py-2.5 text-left transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Render real messages */}
          {messages.map((m, idx) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={idx}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-emerald-500 text-white rounded-br-sm shadow-xs'
                      : 'bg-slate-800 text-slate-100 rounded-bl-sm border border-slate-700/60 shadow-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 px-1">
                  {formatTime(m.timestamp)}
                </span>
              </div>
            );
          })}

          {/* Thinking / Loading State */}
          {sending && (
            <div className="flex items-center gap-3 text-slate-400 text-xs py-2">
              <div className="size-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
                <Bot size={16} />
              </div>
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse delay-100" />
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse delay-200" />
                <span className="ml-1.5 text-slate-300">KabiAI is thinking...</span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-xs text-rose-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-xs font-semibold underline text-rose-300 hover:text-white"
              >
                Dismiss
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col gap-2">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              value={input}
              maxLength={MAX_MESSAGE_LENGTH}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing &&
                  e.keyCode !== 229
                ) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask KabiAI anything about e-waste, prices, or handovers..."
              disabled={sending}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            />
            <button
              onClick={() => handleSend()}
              disabled={sending || !input.trim()}
              className="size-12 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center hover:bg-emerald-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
            >
              <Send size={18} />
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>Press Enter to send · Shift+Enter for newline</span>
            <span>
              {input.length}/{MAX_MESSAGE_LENGTH}
            </span>
          </div>
        </div>
      </div>

      {/* Safety Notice */}
      <p className="text-xs text-gray-500 flex items-center gap-2 px-1">
        <AlertCircle size={14} className="shrink-0" />
        AI-generated guidance is for informational and operational workflow assistance. Always adhere to state and national e-waste handling safety guidelines.
      </p>
    </div>
  );
}
