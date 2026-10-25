import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Plus,
  History,
  Send,
  ArrowLeft,
  Trash2,
  Compass,
  MessageSquare,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Play,
  RotateCcw,
  ListTodo,
  Eye,
  Layers,
  ChevronRight,
  Languages
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, AskVeyloraConversation, AskVeyloraMessage } from '../../services/api';
import { useScreenContext } from '../../hooks/useScreenContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';

interface AskVeyloraPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ActionConfirmationState {
  actionType: string;
  params: Record<string, any>;
  description: string;
  warnings?: string[];
  requiresConfirmation: boolean;
}

export const AskVeyloraPanel: React.FC<AskVeyloraPanelProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const screenContext = useScreenContext();
  const [conversations, setConversations] = useState<AskVeyloraConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AskVeyloraMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'chat' | 'history'>('chat');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionConfirmationState | null>(null);
  const [executingAction, setExecutingAction] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'auto' | 'en' | 'te' | 'tanglish'>('auto');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Keyboard accessibility: Escape key closes drawer
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus management: Focus textarea on open
  useEffect(() => {
    if (isOpen) {
      loadConversations();
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, pendingAction]);

  // Load non-expired conversations
  const loadConversations = async () => {
    const list = await api.listConversations();
    setConversations(list);

    if (!activeConversationId && list.length > 0) {
      loadSpecificConversation(list[0].id);
    } else if (list.length === 0) {
      handleNewChat();
    }
  };

  // Open a specific conversation from history
  const loadSpecificConversation = async (convId: string) => {
    const data = await api.getConversation(convId);
    if (data) {
      setActiveConversationId(data.conversation.id);
      setMessages(data.messages);
      setViewMode('chat');
      setPendingAction(null);
    }
  };

  // Start a fresh conversation
  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setViewMode('chat');
    setErrorMessage(null);
    setPendingAction(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // Delete conversation from history
  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    const success = await api.deleteConversation(convId);
    if (success) {
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConversationId === convId) {
        handleNewChat();
      }
    }
  };

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || isLoading) return;

    setInputPrompt('');
    setErrorMessage(null);

    // Optimistically add user message to list
    const tempUserMsg: AskVeyloraMessage = {
      id: `temp-${Date.now()}`,
      conversationId: activeConversationId || 'pending',
      role: 'user',
      content: prompt,
      screenContext: screenContext.contextText,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    // Instant URL and Testing Intent Interceptor (Zero AI Credits + Direct Execution)
    const urlRegex = /(https?:\/\/[^\s]+)/i;
    const urlMatch = prompt.match(urlRegex);

    const hasTestingIntent = (p: string) => {
      const cleaned = p.replace(urlRegex, '').trim().toLowerCase();
      // If prompt is essentially just the URL (with minimal or no extra text)
      if (cleaned.length <= 4) return true;
      // Or contains testing/auditing intent keywords in English, Telugu, or Tanglish
      return /test|audit|run|check|scenario|evaluat|smoke|journey|inspect|verify|chudu|chey|cheyyi|analyze|benchmark|monitor/i.test(p);
    };

    if (urlMatch && hasTestingIntent(prompt)) {
      const rawMatchedUrl = urlMatch[1].replace(/[.,;:!?)"'>]+$/, '');
      const loadingMsgId = `loading-${Date.now()}`;

      // Sleek loading state in the chat bubble
      const loadingAssistantMsg: AskVeyloraMessage = {
        id: loadingMsgId,
        conversationId: activeConversationId || 'pending',
        role: 'assistant',
        content: `Target identified: ${rawMatchedUrl}. Provisioning synthetic agents and launching Playwright runner...`,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, loadingAssistantMsg]);
      setIsLoading(true);

      try {
        const result = await api.quickAudit(rawMatchedUrl);
        if (result.success && result.runId) {
          const confirmationText = `🚀 Automated Quick-Audit launched!\n\n• Target: ${result.targetUrl}\n• Run ID: ${result.runId}\n• Synthetic Agents: ${result.agentCount}\n• Action Budget: 15 steps (Zero AI Credits spent)\n\nNavigating to Live Monitor...`;

          setMessages(prev => prev.map(m => m.id === loadingMsgId ? { ...m, content: confirmationText } : m));
          toast.success(`🚀 Automated audit launched for ${result.hostname || rawMatchedUrl}. Navigating to Live Monitor...`);

          setTimeout(() => {
            onClose();
            navigate(`/runs/${result.runId}`);
          }, 800);
          return;
        }
      } catch (err: any) {
        const failureText = `❌ Audit initialization failed: ${err?.message || 'Unable to start Playwright runner'}`;
        setErrorMessage(err?.message || 'Quick audit failed to start.');
        setMessages(prev => prev.map(m => m.id === loadingMsgId ? { ...m, content: failureText } : m));
        return;
      } finally {
        setIsLoading(false);
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    }

    // Standard AI Chat Flow (Gemini / Local Knowledge Base)
    setIsLoading(true);
    try {
      const response = await api.sendChatMessage({
        conversationId: activeConversationId || undefined,
        prompt,
        currentRoute: screenContext.route,
        screenContextText: screenContext.contextText,
        languagePreference: selectedLanguage !== 'auto' ? selectedLanguage : undefined
      });

      if (response) {
        setActiveConversationId(response.conversationId);
        const assistantMsg: AskVeyloraMessage = {
          id: response.messageId,
          conversationId: response.conversationId,
          role: 'assistant',
          content: response.answer,
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMsg]);
        loadConversations();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to connect to local assistant.');
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  // Handle Typed Assistant Actions
  const handleTriggerAction = async (actionType: string, params: Record<string, any> = {}) => {
    setErrorMessage(null);
    try {
      const validation = await api.validateAssistantAction(actionType, params);
      if (!validation.valid) {
        setErrorMessage(validation.error || 'Action failed validation');
        return;
      }

      const proposed = validation.proposedAction;
      if (proposed?.requiresConfirmation) {
        setPendingAction({
          actionType: proposed.actionType,
          params: proposed.params,
          description: proposed.description,
          warnings: proposed.warnings,
          requiresConfirmation: true
        });
      } else {
        await executeApprovedAction(actionType, params, false);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Action validation failed');
    }
  };

  const executeApprovedAction = async (actionType: string, params: Record<string, any>, confirmed = false) => {
    setExecutingAction(true);
    setErrorMessage(null);
    try {
      const result = await api.executeAssistantAction(actionType, params, confirmed);
      setPendingAction(null);

      let summaryText = `Action Completed: ${actionType}\n`;
      if (result.success) {
        if (actionType === 'GET_ROADMAP') {
          const tasks = result.data?.tasks || [];
          summaryText += `Roadmap has ${tasks.length} prioritized tasks. Top priority: ${tasks[0]?.title || 'None'}.`;
        } else if (actionType === 'GET_ACCESSIBILITY_RESULTS') {
          const count = result.data?.count || 0;
          summaryText += `Found ${count} accessibility findings for this project.`;
        } else if (actionType === 'REQUEST_RETEST' || actionType === 'PROPOSE_JOURNEY_RUN') {
          summaryText += `Browser test queued. Job ID: ${result.jobId || 'local-job'}. Chromium runner launched.`;
        } else {
          summaryText += `Result: ${JSON.stringify(result.data || 'Success')}`;
        }
      } else {
        summaryText = `Action Execution Failed: ${result.error || 'Unknown error'}`;
      }

      const outcomeMsg: AskVeyloraMessage = {
        id: `act-${Date.now()}`,
        conversationId: activeConversationId || 'pending',
        role: 'assistant',
        content: summaryText,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, outcomeMsg]);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to execute action');
    } finally {
      setExecutingAction(false);
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Contextual question chips based on active route
  const getContextChips = () => {
    const route = screenContext.route;
    if (route.includes('/detective')) {
      return [
        'Test my website: https://example.com',
        'How does Intent-to-Failure Detective work?',
        'Bro, website goal ela test cheyyali?',
        'Explain step assertions and failure diagnosis'
      ];
    }
    if (route.includes('/roadmap')) {
      return [
        'Test my website: https://example.com',
        'How is the priority score calculated?',
        'What is the difference between P0 and P3?',
        'Tanglish lo roadmap gurinchi cheppu'
      ];
    }
    if (route.includes('/comparisons')) {
      return [
        'Test my website: https://example.com',
        'Why is an issue marked Inconclusive instead of Fixed?',
        'What is a verified fix?',
        'What is Playwright?'
      ];
    }
    if (route.includes('/findings')) {
      return [
        'Test my website: https://example.com',
        'What is the difference between Verified and AI Hypothesis?',
        'How can I trigger a re-test for this finding?',
        'How do I create a project?'
      ];
    }
    if (route.includes('/settings')) {
      return [
        'Test my website: https://example.com',
        'What data is sent to the Gemini API?',
        'How does sensitive field redaction work?',
        'What is Playwright?'
      ];
    }
    return [
      'Test my website: https://example.com',
      'What is Playwright?',
      'How do I create a project?',
      'Bro, project ela create cheyyali?',
      'Explain this screen'
    ];
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 1. Fully Opaque Dark Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-black/70 z-[99] transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 2. Genuinely Opaque Drawer */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ask Veylora Assistant Panel"
        style={{ backgroundColor: '#0B0F17' }}
        className="fixed inset-y-0 right-0 z-[100] w-full sm:w-[480px] border-l border-[#1E293B] shadow-[-12px_0_40px_rgba(0,0,0,0.85)] flex flex-col transition-transform duration-300 ease-in-out animate-in slide-in-from-right"
      >
        {/* Panel Header (Fixed, 100% Opaque) */}
        <div
          style={{ backgroundColor: '#111722' }}
          className="flex items-center justify-between px-5 py-3.5 border-b border-[#1E293B] shrink-0"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-white">Ask Veylora</h2>
                <Badge variant="indigo" size="sm">Evidence Guide</Badge>
              </div>
              <p className="text-[11px] text-[#94A3B8]">Intent-Aware Assistant • Telugu, Tanglish & English</p>
            </div>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-1.5">
            {viewMode === 'chat' ? (
              <>
                <button
                  onClick={handleNewChat}
                  title="Start a new chat"
                  aria-label="Start a new chat"
                  className="p-1.5 rounded-md hover:bg-[#1E293B] text-[#94A3B8] hover:text-white transition-colors text-xs flex items-center gap-1 px-2.5 border border-[#2E3D52]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline font-medium">New</span>
                </button>
                <button
                  onClick={() => setViewMode('history')}
                  title="View chat history"
                  aria-label="View chat history"
                  className="p-1.5 rounded-md hover:bg-[#1E293B] text-[#94A3B8] hover:text-white transition-colors text-xs flex items-center gap-1 px-2.5 border border-[#2E3D52]"
                >
                  <History className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline font-medium">History</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setViewMode('chat')}
                className="p-1.5 rounded-md hover:bg-[#1E293B] text-[#94A3B8] hover:text-white transition-colors text-xs flex items-center gap-1 px-2.5 border border-[#2E3D52]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              onClick={onClose}
              aria-label="Close assistant panel (Escape)"
              title="Close (Escape)"
              className="p-1.5 rounded-md hover:bg-[#1E293B] text-[#94A3B8] hover:text-white transition-colors ml-1 border border-transparent hover:border-[#2E3D52]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Language Selection & Screen Context Bar */}
        <div
          style={{ backgroundColor: '#0E141D' }}
          className="px-4 py-2 border-b border-[#1E293B] flex items-center justify-between text-[11px] text-[#94A3B8] shrink-0"
        >
          <div className="flex items-center gap-1.5 truncate mr-2">
            <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
            <span className="truncate">
              Screen: <strong className="text-white">{screenContext.pageTitle}</strong> ({screenContext.route})
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Languages size={12} className="text-indigo-400" />
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value as any)}
              className="bg-[#18212F] border border-[#2E3D52] rounded text-[11px] text-white px-1.5 py-0.5 focus:outline-none"
              title="Select response language preference"
            >
              <option value="auto">Auto (Detect)</option>
              <option value="en">English</option>
              <option value="te">తెలుగు (Telugu)</option>
              <option value="tanglish">Tanglish (తెలు-Eng)</option>
            </select>
          </div>
        </div>

        {/* Quick Safe Actions Bar */}
        <div
          style={{ backgroundColor: '#0A0E17' }}
          className="px-4 py-1.5 border-b border-[#1E293B] flex items-center gap-2 overflow-x-auto text-xs scrollbar-none shrink-0"
        >
          <button
            onClick={() => handleTriggerAction('GET_ROADMAP', { projectId: 'p-1' })}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#18212F] border border-[#2E3D52] hover:border-indigo-500/60 text-[11px] text-[#94A3B8] hover:text-white shrink-0 transition-colors"
          >
            <ListTodo size={12} className="text-indigo-400" />
            <span>Smart Roadmap</span>
          </button>
          <button
            onClick={() => handleTriggerAction('GET_ACCESSIBILITY_RESULTS', { runId: 'run-101' })}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#18212F] border border-[#2E3D52] hover:border-teal-500/60 text-[11px] text-[#94A3B8] hover:text-white shrink-0 transition-colors"
          >
            <Eye size={12} className="text-teal-400" />
            <span>Accessibility Audit</span>
          </button>
          <button
            onClick={() => handleTriggerAction('REQUEST_RETEST', { findingId: 'f-101', runId: 'run-101', projectId: 'p-1' })}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#18212F] border border-[#2E3D52] hover:border-accent/60 text-[11px] text-[#94A3B8] hover:text-white shrink-0 transition-colors"
          >
            <RotateCcw size={12} className="text-accent-light" />
            <span>Request Retest</span>
          </button>
        </div>

        {/* Main Content Area: Chat or History */}
        {viewMode === 'history' ? (
          // History View
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            <div className="px-3 py-2.5 rounded-lg bg-[#18212F] border border-[#2E3D52] text-[12px] text-[#94A3B8] flex items-start gap-2">
              <Compass className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-white">7-Day Retention Notice</p>
                <p className="text-[#94A3B8] text-[11px] mt-0.5">
                  Ask Veylora conversations are stored locally in your SQLite database and automatically pruned after 7 days.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2 px-1">
                Previous Conversations ({conversations.length})
              </h3>

              {conversations.length === 0 ? (
                <div className="text-center py-12 text-[#64748B] text-xs">
                  No saved conversations yet. Start a chat anytime!
                </div>
              ) : (
                <div className="space-y-2">
                  {conversations.map(conv => (
                    <div
                      key={conv.id}
                      onClick={() => loadSpecificConversation(conv.id)}
                      className={`group w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        activeConversationId === conv.id
                          ? 'bg-indigo-500/15 border-indigo-500/40 text-white'
                          : 'bg-[#111722] border-[#1E293B] hover:bg-[#18212F] hover:border-[#2E3D52] text-[#94A3B8]'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="text-xs font-semibold text-white truncate">{conv.title}</p>
                        <p className="text-[11px] text-[#94A3B8] truncate mt-0.5">{conv.preview}</p>
                        <p className="text-[10px] text-[#64748B] mt-1">
                          {new Date(conv.updatedAt).toLocaleDateString()} • {conv.messageCount} messages
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        title="Delete conversation"
                        aria-label="Delete conversation"
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-[#94A3B8] hover:text-red-400 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          // Chat View (Scrollable message area)
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {messages.length === 0 ? (
              <div className="py-4 space-y-4">
                <div className="p-4 rounded-xl bg-[#111722] border border-[#1E293B] space-y-2">
                  <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
                    <Sparkles className="w-4 h-4" />
                    <span>Intent-Aware Veylora Assistant</span>
                  </div>
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    Ask me any question in <strong>English</strong>, <strong>Telugu (తెలుగు)</strong>, or <strong>Tanglish</strong>, or paste any website link (e.g. <em>"Test https://example.com"</em>) to launch an instant automated Playwright audit with zero AI credits.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    Suggested questions & quick actions:
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {getContextChips().map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(chip)}
                        className={`text-left px-3 py-2 rounded-lg border transition-all flex items-center justify-between gap-2 text-xs ${
                          chip.startsWith('Test my website:')
                            ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-300 hover:bg-indigo-900/50 hover:text-white hover:border-indigo-400 font-medium'
                            : 'bg-[#111722] border-[#1E293B] hover:border-indigo-500/50 text-[#94A3B8] hover:text-white hover:bg-[#18212F]'
                        }`}
                      >
                        <span>{chip}</span>
                        {chip.startsWith('Test my website:') && (
                          <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                            Instant Audit
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={msg.id || i}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`rounded-2xl p-3.5 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-xs shadow-md max-w-[85%]'
                        : 'bg-[#18212F] border border-[#2E3D52] text-[#F8FAFC] rounded-bl-xs shadow-md max-w-[92%] whitespace-pre-wrap'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-[#64748B] mt-1 px-1">
                    {msg.role === 'user' ? 'You' : 'Veylora'} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}

            {/* Pending Action Confirmation Card */}
            {pendingAction && (
              <div className="p-4 rounded-xl bg-[#111722] border border-accent/50 shadow-lg space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-accent-light font-semibold text-xs">
                  <ShieldCheck size={16} />
                  <span>Confirmation Required: State-Changing Action</span>
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  {pendingAction.description}
                </p>
                {pendingAction.warnings && pendingAction.warnings.length > 0 && (
                  <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] space-y-0.5">
                    {pendingAction.warnings.map((w, idx) => (
                      <div key={idx}>• {w}</div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={executingAction}
                    onClick={() => executeApprovedAction(pendingAction.actionType, pendingAction.params, true)}
                    className="text-xs flex items-center gap-1.5"
                  >
                    <Play size={12} />
                    <span>{executingAction ? 'Executing...' : 'Execute Approved Action'}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={executingAction}
                    onClick={() => setPendingAction(null)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="p-3 rounded-2xl rounded-bl-xs bg-[#18212F] border border-[#2E3D52] text-[#94A3B8] text-xs flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.4s]" />
                  <span className="text-[11px] text-[#94A3B8] ml-1">Analyzing intent & crafting response...</span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Message Composer (Fixed, 100% Opaque at bottom) */}
        <div
          style={{ backgroundColor: '#111722' }}
          className="p-3 border-t border-[#1E293B] shrink-0"
        >
          <div className="relative rounded-xl border border-[#2E3D52] bg-[#0B0F17] focus-within:border-indigo-500/80 transition-all">
            <textarea
              ref={textareaRef}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Ask anything (e.g. 'What is Playwright?', 'Bro, project ela create cheyyali?')..."
              rows={2}
              disabled={isLoading}
              className="w-full bg-transparent px-3 py-2 text-xs text-white placeholder:text-[#64748B] focus:outline-none resize-none"
            />
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#1E293B] text-[10px] text-[#64748B]">
              <span>Shift+Enter for newline • Esc to close</span>
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputPrompt.trim() || isLoading}
                aria-label="Send message"
                className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition-all active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-center text-[#64748B] mt-1.5">
            Local-first assistant • Redacted inputs • Strict action allowlist
          </p>
        </div>
      </div>
    </>
  );
};
