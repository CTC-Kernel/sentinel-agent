import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase'; // Assuming db is exported from firebase config
import { aiService } from '../../services/aiService';
import { Sparkles, X, Send, User, Bot, Loader2, Maximize2, Minimize2, Zap, Copy, Check, Lock } from '../ui/Icons';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';
import { cn } from '../../lib/utils';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Components } from 'react-markdown';
import { usePlanLimits } from '../../hooks/usePlanLimits';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isError?: boolean;
}

type FirestoreTimestampLike = { toDate?: () => Date };
type FirestoreMessage = {
    id?: unknown;
    role?: unknown;
    content?: unknown;
    timestamp?: unknown;
    isError?: unknown;
};

type MessageRole = Message['role'];

const prismTheme = vscDarkPlus as unknown as { [key: string]: React.CSSProperties };

const markdownComponents: Components = {
    code: (props) => {
        const { className, children, ...rest } = props;
        const inline = 'inline' in rest && typeof (rest as { inline?: unknown }).inline === 'boolean'
            ? (rest as { inline?: boolean }).inline
            : false;

        const match = /language-(\w+)/.exec(className || '');
        return !inline && match ? (
            <div className="rounded-lg overflow-hidden my-2 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between px-3 py-1 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-600">
                    <span>{match[1]}</span>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
                        }}
                        className="hover:text-indigo-500 transition-colors"
                    >
                        Copier
                    </button>
                </div>
                <SyntaxHighlighter
                    style={prismTheme}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{ margin: 0, borderRadius: 0 }}
                >
                    {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
            </div>
        ) : (
            <code
                className={cn(
                    "px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/50 font-mono text-xs text-indigo-600 dark:text-indigo-400",
                    className
                )}
            >
                {children}
            </code>
        );
    }
};

const QUICK_PROMPTS = [
    { label: "Analyser les risques", prompt: "Analyse les risques actuels et propose des mesures de mitigation prioritaires." },
    { label: "Rédiger une politique", prompt: "Rédige une ébauche de politique de sécurité pour le télétravail." },
    { label: "Checklist audit", prompt: "Génère une checklist pour un audit interne ISO 27001." },
];

export const GeminiAssistant: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: "Bonjour je suis **Sentinel AI**. \n\nComment puis-je vous aider à sécuriser votre organisation aujourd'hui ?",
            timestamp: new Date()
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { user } = useStore();
    const navigate = useNavigate();
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const { hasFeature } = usePlanLimits();
    const aiEnabled = hasFeature('aiAssistant');

    // Persistence: Firestore Ref
    const conversationRef = React.useMemo(() => {
        if (!user?.uid || !aiEnabled) return null;
        // Use a single 'default' conversation for now, or generate ID based on session
        // For simplicity and "memory", we stick to one main conversation per user for the assistant.
        return doc(db, 'users', user.uid, 'conversations', 'default');
    }, [user?.uid, aiEnabled]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Load messages from Firestore
    useEffect(() => {
        if (!conversationRef) return;

        const unsubscribe = onSnapshot(conversationRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.messages && Array.isArray(data.messages)) {
                    // Convert timestamps back to Date objects
                    const loadedMessages: Message[] = data.messages
                        .map((m: unknown) => {
                            const fm = m as FirestoreMessage;
                            const id = typeof fm.id === 'string' ? fm.id : '';
                            const role: MessageRole = fm.role === 'user' || fm.role === 'assistant' ? fm.role : 'assistant';
                            const content = typeof fm.content === 'string' ? fm.content : '';

                            const ts = fm.timestamp as FirestoreTimestampLike | string | number | Date | undefined;
                            const timestamp =
                                ts && typeof (ts as FirestoreTimestampLike).toDate === 'function'
                                    ? (ts as FirestoreTimestampLike).toDate!()
                                    : ts instanceof Date
                                        ? ts
                                        : typeof ts === 'string' || typeof ts === 'number'
                                            ? new Date(ts)
                                            : new Date();

                            const isError = typeof fm.isError === 'boolean' ? fm.isError : undefined;

                            return { id, role, content, timestamp, isError };
                        })
                        .filter((m) => m.id.length > 0 && m.content.length > 0);
                    setMessages(loadedMessages);
                }
            } else {
                // Initialize if not exists
                setDoc(conversationRef, {
                    messages: [{
                        id: 'welcome',
                        role: 'assistant',
                        content: "Bonjour je suis **Sentinel AI**. \n\nComment puis-je vous aider à sécuriser votre organisation aujourd'hui ?",
                        timestamp: new Date()
                    }],
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }
        }, (error) => {
            console.warn("GeminiAssistant: Local conversation sync error (likely permission or offline)", error);
        });

        return () => unsubscribe();
    }, [conversationRef]);

    useEffect(() => {
        scrollToBottom();
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [messages, isOpen, isExpanded]);

    const handleSend = async (e?: React.FormEvent, promptOverride?: string) => {
        e?.preventDefault();
        const textToSend = promptOverride || input;

        if (!aiEnabled) {
            navigate('/pricing');
            return;
        }
        if (!textToSend.trim() || isLoading || !conversationRef) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: textToSend,
            timestamp: new Date()
        };

        // Optimistic update
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            // Save user message to Firestore
            await updateDoc(conversationRef, {
                messages: arrayUnion(userMsg),
                updatedAt: serverTimestamp()
            });

            const context = {
                userRole: user?.role,
                organizationId: user?.organizationId,
                currentPage: window.location.hash
            };

            const responseText = await aiService.chatWithAI(userMsg.content, context);

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: responseText,
                timestamp: new Date()
            };

            // Save AI message to Firestore
            await updateDoc(conversationRef, {
                messages: arrayUnion(aiMsg),
                updatedAt: serverTimestamp()
            });

        } catch (error: unknown) {
            ErrorLogger.error(error, 'GeminiAssistant.handleSend');
            const err = error as { message?: unknown; code?: unknown };
            const message = typeof err.message === 'string' ? err.message : '';
            const code = typeof err.code === 'string' ? err.code : '';
            const isQuotaError = message.includes('Daily AI limit reached') || code === 'resource-exhausted';

            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: isQuotaError
                    ? `### Quota journalier atteint\nVous avez atteint votre limite de **10 requêtes par jour** (Plan Discovery).\n\nPour continuer à utiliser l'IA sans limite, passez au plan supérieur.`
                    : "Désolé, j'ai rencontré une erreur lors du traitement de votre demande. Veuillez réessayer.",
                timestamp: new Date(),
                isError: true
            };

            // Save error message to Firestore so user sees it persistently? 
            // Maybe yes, maybe no. Let's save it for consistency.
            await updateDoc(conversationRef, {
                messages: arrayUnion(errorMsg),
                updatedAt: serverTimestamp()
            });
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (!aiEnabled) {
        return (
            <button
                onClick={() => navigate('/pricing')}
                className="fixed bottom-4 right-4 md:bottom-6 md:right-6 p-4 bg-gradient-to-br from-slate-200 to-slate-100 text-slate-700 rounded-full shadow-2xl hover:shadow-slate-400/40 transition-all duration-300 z-50 group border border-white/40"
                aria-label="Assistant IA réservé"
            >
                <span className="relative flex items-center gap-2 font-bold text-sm">
                    <Sparkles className="h-5 w-5 text-slate-500" />
                    Assistant IA
                    <Lock className="h-4 w-4 text-slate-500" />
                </span>
                <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap pointer-events-none translate-x-2 group-hover:translate-x-0 shadow-lg hidden md:block">
                    Disponible à partir du plan Professional
                </span>
            </button>
        );
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 md:bottom-6 md:right-6 p-4 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-full shadow-2xl hover:shadow-indigo-500/40 hover:scale-110 transition-all duration-300 z-50 group border border-white/20"
                aria-label="Ouvrir l'assistant IA"
            >
                <Sparkles className="h-6 w-6 animate-pulse" />
                <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap pointer-events-none translate-x-2 group-hover:translate-x-0 shadow-lg hidden md:block">
                    Assistant IA
                </span>
            </button>
        );
    }

    return (
        <div className={cn(
            "fixed z-[100] flex flex-col overflow-hidden transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) shadow-2xl",
            // Mobile: Full screen, white background for readability
            "inset-0 w-full h-full rounded-none bg-white dark:bg-slate-900",
            // Desktop: Floating glassmorphism card
            "md:inset-auto md:bottom-6 md:right-6 md:rounded-[2rem] md:bg-white/95 md:dark:bg-slate-900/95 md:backdrop-blur-xl md:border md:border-white/20 md:dark:border-white/10",
            // Desktop Sizing based on expansion
            isExpanded ? "md:w-[800px] md:h-[800px]" : "md:w-[420px] md:h-[600px]"
        )}>
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-gradient-to-r from-indigo-50/50 to-violet-50/50 dark:from-indigo-900/20 dark:to-violet-900/20">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/20">
                        <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">Sentinel AI</h3>
                        <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Cyber Threat Consulting
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="hidden md:block p-2 hover:bg-slate-200/50 dark:hover:bg-white/10 rounded-xl text-slate-600 dark:text-slate-400 transition-colors"
                        title={isExpanded ? "Réduire" : "Agrandir"}
                    >
                        {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 hover:bg-rose-100/50 dark:hover:bg-rose-900/20 hover:text-rose-600 rounded-xl text-slate-600 dark:text-slate-400 transition-colors"
                        title="Fermer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar scroll-smooth bg-slate-50/30 dark:bg-black/20">
                {messages.map((msg) => (
                    <div key={msg.id} className={cn("flex gap-4 group animate-in slide-in-from-bottom-2 duration-300",
                        msg.role === 'user' ? "flex-row-reverse" : ""
                    )}>
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border",
                            msg.role === 'user'
                                ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                                : "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-500/30"
                        )}>
                            {msg.role === 'user'
                                ? <User className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                                : <Bot className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            }
                        </div>

                        <div className="flex flex-col gap-1 max-w-[85%]">
                            {/* Name Label */}
                            <span className={cn("text-[10px] font-bold opacity-60 px-1", msg.role === 'user' ? "text-right" : "text-left")}>
                                {msg.role === 'user' ? 'Vous' : 'Sentinel AI'}
                            </span>

                            <div className={cn(
                                "p-4 rounded-2xl text-sm leading-relaxed shadow-sm relative group-hover:shadow-md transition-shadow",
                                msg.role === 'user'
                                    ? "bg-slate-900 dark:bg-indigo-600 text-white rounded-tr-none"
                                    : cn("bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-200 rounded-tl-none", msg.isError && "border-red-200 bg-red-50 text-red-800 dark:bg-red-900/10 dark:text-red-300 dark:border-red-900/30")
                            )}>
                                {msg.role === 'assistant' ? (
                                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={markdownComponents}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>

                                        {!msg.isError && (
                                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex gap-2">
                                                <button
                                                    onClick={() => copyToClipboard(msg.content, msg.id)}
                                                    className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                                                >
                                                    {copiedId === msg.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                                    {copiedId === msg.id ? 'Copié' : 'Copier'}
                                                </button>
                                            </div>
                                        )}
                                        {msg.isError && msg.content.includes('Quota') && (
                                            <div className="mt-4 pt-3 border-t border-red-100 dark:border-red-900/30">
                                                <button
                                                    onClick={() => {
                                                        navigate('/settings');
                                                        setIsOpen(false);
                                                    }}
                                                    className="w-full py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                                >
                                                    <Zap className="h-3 w-3" />
                                                    Mettre à niveau mon plan
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                )}
                            </div>
                            <span className={cn("text-[10px] opacity-40 px-1", msg.role === 'user' ? "text-right" : "text-left")}>
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-4 animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                            <Bot className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-700/50 shadow-sm flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">L'IA réfléchit...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts (Only if empty or start) */}
            {messages.length < 3 && !isLoading && (
                <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar mask-gradient-right">
                    {QUICK_PROMPTS.map((qp, i) => (
                        <button
                            key={i}
                            onClick={(e) => handleSend(e, qp.prompt)}
                            className="whitespace-nowrap flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-200 dark:hover:border-indigo-500/30 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all"
                        >
                            <Zap className="h-3 w-3" />
                            {qp.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <form onSubmit={(e) => handleSend(e)} className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-t border-slate-100 dark:border-white/5">
                <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Posez une question..."
                            className="w-full pl-4 pr-10 py-3.5 bg-slate-100 dark:bg-slate-950 border border-transparent focus:bg-white dark:focus:bg-slate-900 border-slate-200 dark:border-slate-800 focus:border-indigo-500/50 dark:focus:border-indigo-500/50 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm font-medium text-slate-900 dark:text-white transition-all placeholder:text-slate-500"
                            disabled={isLoading}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                            ) : (
                                <div className="text-[10px] font-bold text-slate-300 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 pointer-events-none">
                                    ⏎
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className={cn(
                            "p-3.5 rounded-2xl transition-all duration-300 shadow-lg",
                            !input.trim() || isLoading
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                                : "bg-gradient-to-br from-indigo-600 to-violet-600 text-white hover:shadow-indigo-500/25 hover:scale-105 active:scale-95"
                        )}
                    >
                        <Send className="h-5 w-5" />
                    </button>
                </div>
                <p className="text-[10px] text-center text-slate-500 mt-3 flex items-center justify-center gap-1.5 opacity-60">
                    <Sparkles className="h-3 w-3" /> Propulsé par Cyber Threat Consulting
                </p>
            </form>
        </div>
    );
};

