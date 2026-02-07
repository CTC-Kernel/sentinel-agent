
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatMessage } from './ChatMessage';
import { ChatMessage as ChatMessageType } from '../../services/aiService';
import { aiService } from '../../services/aiService';
import { Sparkles, X, Send, Bot, Loader2, Maximize2, Minimize2, Zap, Lock } from '../ui/Icons';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';
import { cn } from '../../lib/utils';
// Form validation: schema-based input validation with required fields
import { usePlanLimits } from '../../hooks/usePlanLimits';
import { useAIConversation } from '../../hooks/ai/useAIConversation';
import { useDashboardData } from '../../hooks/dashboard/useDashboardData';

const QUICK_PROMPTS = [
    { label: "Analyser les risques", prompt: "Analyse les risques actuels et propose des mesures de mitigation prioritaires." },
    { label: "Rédiger une politique", prompt: "Rédige une ébauche de politique de sécurité pour le télétravail." },
    { label: "Checklist audit", prompt: "Génère une checklist pour un audit interne ISO 27001." },
];

export const GeminiAssistant: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { user, organization, addToast, t } = useStore();
    const navigate = useNavigate();
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const { hasFeature } = usePlanLimits();
    const planAiEnabled = hasFeature('aiAssistant');
    const orgAiEnabled = organization?.settings?.aiSettings?.enabled !== false;
    const aiEnabled = planAiEnabled && orgAiEnabled;

    // Use AI conversation hook
    const { messages, conversationRef, addMessage } = useAIConversation(user?.uid, aiEnabled);

    // Fetch App Context Data
    // We only fetch if AI is enabled and user is logged in to avoid unnecessary reads
    const { allRisks, allAssets, myProjects, myIncidents } = useDashboardData();

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        scrollToBottom();
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [messages, isOpen, isExpanded, scrollToBottom]);

    const handleSend = useCallback(async (e?: React.FormEvent, promptOverride?: string) => {
        e?.preventDefault();
        let textToSend = promptOverride || input;

        if (!aiEnabled) {
            navigate('/pricing');
            return;
        }

        textToSend = textToSend.trim(); // Trim the input text

        if (!textToSend || isLoading || !conversationRef) return;

        // Basic input validate/sanitize
        if (textToSend.length > 2000) {
            addToast(t('ai.inputTooLong', { defaultValue: 'Le message est trop long (max 2000 caractères)' }), 'error');
            return;
        }

        const userMsg: ChatMessageType = {
            id: Date.now().toString(),
            role: 'user',
            content: textToSend,
            timestamp: new Date()
        };

        setInput('');
        setIsLoading(true);

        try {
            // Save user message to Firestore
            await addMessage(userMsg);

            // Prepare rich context from dashboard data
            // We summarize data to stay efficient and avoid massive payloads
            const context = {
                userRole: user?.role,
                organizationId: user?.organizationId,
                currentPage: window.location.hash,
                data: {
                    risks: allRisks?.slice(0, 50).map(r => ({
                        threat: r.threat,
                        score: r.score,
                        status: r.status,
                        assetName: allAssets.find(a => a.id === r.assetId)?.name || 'Inconnu'
                    })),
                    assets: allAssets?.slice(0, 50).map(a => ({
                        name: a.name,
                        type: a.type,
                        criticality: a.confidentiality
                    })),
                    projects: myProjects?.slice(0, 20).map(p => ({
                        name: p.name,
                        status: p.status,
                        progress: p.progress,
                        dueDate: p.dueDate
                    })),
                    incidents: myIncidents?.slice(0, 20).map(i => ({
                        title: i.title,
                        severity: i.severity,
                        status: i.status,
                        date: i.dateReported
                    }))
                }
            };

            const responseText = await aiService.chatWithAI(userMsg.content, context);

            const aiMsg: ChatMessageType = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: responseText,
                timestamp: new Date()
            };

            // Save AI message to Firestore
            await addMessage(aiMsg);

        } catch (error: unknown) {
            ErrorLogger.error(error, 'GeminiAssistant.handleSend');
            const err = error as { message?: unknown; code?: unknown };
            const message = typeof err.message === 'string' ? err.message : '';
            const code = typeof err.code === 'string' ? err.code : '';
            const isQuotaError = message.includes('Daily AI limit reached') || code === 'resource-exhausted';

            const errorMsg: ChatMessageType = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: isQuotaError
                    ? `### Quota journalier atteint\nVous avez atteint votre limite de ** 10 requêtes par jour ** (Plan Discovery).\n\nPour continuer à utiliser l'IA sans limite, passez au plan supérieur.`
                    : "Désolé, j'ai rencontré une erreur lors du traitement de votre demande. Veuillez réessayer.",
                timestamp: new Date(),
                isError: true
            };

            // Save error message to Firestore so user sees it persistently
            await addMessage(errorMsg);
        } finally {
            setIsLoading(false);
        }
    }, [input, aiEnabled, isLoading, conversationRef, navigate, user?.role, user?.organizationId, addMessage, allRisks, allAssets, myProjects, myIncidents, t, addToast]);

    const copyToClipboard = useCallback((text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    }, []);

    if (!aiEnabled) {
        return (
            <button
                type="button"
                onClick={() => planAiEnabled ? navigate('/settings') : navigate('/pricing')}
                className="fixed bottom-4 right-4 md:bottom-6 md:right-6 p-4 bg-gradient-to-br from-muted to-muted text-foreground rounded-full shadow-2xl hover:shadow-slate-400/40 transition-all duration-300 z-modal group border border-white/40"
                aria-label={planAiEnabled ? "Assistant IA désactivé par l'administrateur" : "Assistant IA réservé"}
            >
                <span className="relative flex items-center gap-2 font-bold text-sm">
                    <Sparkles className="h-5 w-5 text-muted-foreground" />
                    Assistant IA
                    <Lock className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-card text-white text-xs font-bold rounded-3xl opacity-0 group-hover:opacity-70 transition-all duration-300 whitespace-nowrap pointer-events-none translate-x-2 group-hover:translate-x-0 shadow-lg hidden md:block">
                    {!planAiEnabled
                        ? "Disponible à partir du plan Professional"
                        : "Désactivé par votre administrateur"}
                </span>
            </button>
        );
    }

    if (!isOpen) {
        return (
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-modal group flex items-center justify-center"
                aria-label="Ouvrir l'assistant IA"
            >
                {/* Holographic Ring Animation */}
                <div className="absolute inset-0 -m-2 rounded-full border border-primary/40 dark:border-primary w-20 h-20 animate-[spin_10s_linear_infinite] opacity-60 pointer-events-none"></div>
                <div className="absolute inset-0 -m-1 rounded-full border border-primary/30 dark:border-primary/60 w-18 h-18 animate-ping opacity-20 pointer-events-none"></div>

                {/* Core Orb */}
                <div className="relative w-16 h-16 rounded-full bg-background/80 backdrop-blur-md border border-primary/60 flex items-center justify-center shadow-[0_0_20px_-5px_rgba(99,102,241,0.6)] group-hover:shadow-[0_0_30px_-5px_rgba(99,102,241,0.9)] transition-all duration-500 overflow-hidden">

                    {/* Inner Energy Flow */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/50 via-transparent to-violet-900/50 group-hover:rotate-45 transition-transform duration-1000"></div>
                    <div className="absolute inset-0 bg-primary/40 dark:bg-primary/60/30 blur-xl animate-pulse"></div>

                    {/* Icon */}
                    <Sparkles className="h-6 w-6 text-primary/70 drop-shadow-[0_0_5px_rgba(129,140,248,0.8)] relative z-decorator transition-transform duration-500 group-hover:scale-110" />
                </div>

                {/* High-Tech Status Label */}
                <div className="absolute right-full mr-6 top-1/2 -translate-y-1/2 px-4 py-2 bg-card backdrop-blur border border-white/20 text-white text-xs font-mono tracking-widest uppercase rounded-lg opacity-0 group-hover:opacity-70 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0 shadow-2xl flex items-center gap-3">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                    </span>
                    <span>AI System Online</span>
                </div>
            </button>
        );
    }

    return (
        <div className={cn(
            "fixed z-modal flex flex-col overflow-hidden transition-all duration-slow ease-apple shadow-2xl will-change-transform",
            // Mobile: Full screen, white background for readability
            "inset-0 w-full h-full rounded-none bg-card",
            // Desktop: Floating glassmorphism card
            "md:inset-auto md:bottom-6 md:right-6 md:rounded-4xl md:bg-white/95 md:dark:bg-card/95 md:backdrop-blur-xl md:border md:border-white/20 md:dark:border-border/40",
            // Desktop Sizing based on expansion
            isExpanded ? "md:w-[800px] md:h-[800px]" : "md:w-[420px] md:h-[600px]"
        )}>
            {/* Header */}
            <div className="p-4 border-b border-border/40 dark:border-white/5 flex justify-between items-center bg-gradient-to-r from-primary/10/50 to-violet-50/50 dark:from-primary/20 dark:to-violet-900/20">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-primary to-violet-600 rounded-3xl shadow-lg shadow-primary/20">
                        <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-foreground text-sm">Sentinel AI</h3>
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                            </span>
                            Cyber Threat Consulting
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="hidden md:block p-2 hover:bg-muted/50 dark:hover:bg-muted rounded-3xl text-muted-foreground transition-colors"
                        title={isExpanded ? "Réduire" : "Agrandir"}
                        aria-label={isExpanded ? "Réduire le chat" : "Agrandir le chat"}
                    >
                        {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="p-2.5 hover:bg-rose-100/50 dark:hover:bg-rose-900/20 hover:text-rose-600 rounded-3xl text-muted-foreground transition-colors"
                        title="Fermer"
                        aria-label="Fermer le chat"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar scroll-smooth bg-muted/50 dark:bg-black/20">
                {messages.map((msg) => (
                    <ChatMessage
                        key={msg.id || 'unknown'}
                        message={msg}
                        onCopy={copyToClipboard}
                        copiedId={copiedId}
                        onUpgrade={() => {
                            setIsOpen(false);
                            navigate('/settings');
                        }}
                    />
                ))}

                {isLoading && (
                    <div className="flex gap-4 animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-primary/15 dark:bg-primary border border-primary/30 dark:border-primary/40 flex items-center justify-center flex-shrink-0">
                            <Bot className="h-4 w-4 text-primary" />
                        </div>
                        <div className="bg-card px-4 py-3 rounded-2xl rounded-tl-none border border-border/40/50 shadow-sm flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <span className="text-xs font-medium text-muted-foreground">{t('ai.thinking', { defaultValue: "L'IA réfléchit..." })}</span>
                            <button
                                type="button"
                                onClick={() => setIsLoading(false)}
                                className="ml-2 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors"
                                aria-label={t('common.cancel', { defaultValue: 'Annuler' })}
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts (Only if empty or start) */}
            {messages.length < 3 && !isLoading && (
                <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar mask-gradient-right">
                    {QUICK_PROMPTS.map((qp) => (
                        <button
                            type="button"
                            key={qp.label || 'unknown'}
                            onClick={(e) => handleSend(e, qp.prompt)}
                            className="whitespace-nowrap flex items-center gap-2 px-3 py-1.5 bg-muted/50 border border-border/40 rounded-lg text-xs font-medium text-muted-foreground hover:bg-primary/10 dark:hover:bg-primary/30 hover:border-primary/30 dark:hover:border-primary hover:text-primary dark:hover:text-primary/70 transition-all"
                            aria-label={`Prompt rapide : ${qp.label}`}
                        >
                            <Zap className="h-3 w-3" />
                            {qp.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <form onSubmit={(e) => { e.preventDefault(); handleSend(e); }} className="p-4 bg-card/50 backdrop-blur-md border-t border-border/40 dark:border-white/5">
                <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                        <input value={input} onChange={(e) => setInput(e.target.value)}
                            ref={inputRef}
                            type="text"
                            aria-label="Message à IA Sentinel"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Posez une question..."
                            className="w-full pl-4 pr-10 py-3.5 bg-muted border border-transparent focus:bg-white dark:focus:bg-card border-border/40 focus:border-primary/60 dark:focus:border-primary/60 rounded-2xl focus:ring-4 focus:ring-primary outline-none text-sm font-medium text-foreground transition-all placeholder:text-muted-foreground"
                            disabled={isLoading}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : (
                                <div className="text-xs font-bold text-muted-foreground border border-border/40 rounded px-1.5 py-0.5 pointer-events-none">
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
                                ? "bg-muted text-muted-foreground cursor-not-allowed"
                                : "bg-gradient-to-br from-primary to-violet-600 text-white hover:shadow-primary/25 hover:scale-105 active:scale-95"
                        )}
                        aria-label="Envoyer le message"
                    >
                        <Send className="h-5 w-5" />
                    </button>
                </div>
                <p className="text-xs text-center text-muted-foreground mt-3 flex items-center justify-center gap-1.5 opacity-60">
                    <Sparkles className="h-3 w-3" /> Propulsé par Cyber Threat Consulting
                </p>
            </form>
        </div>
    );
};

