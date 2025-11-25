import React, { useState, useRef, useEffect } from 'react';
import { aiService } from '../../services/aiService';
import { Sparkles, X, Send, User, Bot, Loader2, Maximize2, Minimize2 } from '../ui/Icons';
import { useStore } from '../../store';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export const GeminiAssistant: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: "Bonjour ! Je suis Sentinel AI. Comment puis-je vous aider à sécuriser votre organisation aujourd'hui ?",
            timestamp: new Date()
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { user } = useStore();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            // Context could be current page, user role, etc.
            const context = {
                userRole: user?.role,
                organizationId: user?.organizationId
            };

            const responseText = await aiService.chatWithAI(userMsg.content, context);

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: responseText,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, aiMsg]);
        } catch (_error) {
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "Désolé, j'ai rencontré une erreur. Veuillez réessayer.",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-indigo-500/30 hover:scale-110 transition-all z-50 group"
            >
                <Sparkles className="h-6 w-6 animate-pulse" />
                <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Assistant IA
                </span>
            </button>
        );
    }

    return (
        <div className={`fixed bottom-6 right-6 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col transition-all duration-300 z-50 ${isExpanded ? 'w-[800px] h-[80vh]' : 'w-[400px] h-[600px]'}`}>
            {/* Header */}
            <div className="p-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-t-3xl">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white dark:bg-white/10 rounded-xl shadow-sm">
                        <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">Sentinel AI</h3>
                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> En ligne
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-lg text-slate-500 transition-colors">
                        {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </button>
                    <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-lg text-slate-500 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50 dark:bg-black/20">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-slate-200 dark:bg-slate-700' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
                            {msg.role === 'user' ? <User className="h-4 w-4 text-slate-600 dark:text-slate-300" /> : <Bot className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                        </div>
                        <div className={`max-w-[80%] p-3.5 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-tr-none'
                            : 'bg-white dark:bg-slate-800 border border-gray-100 dark:border-white/5 text-slate-700 dark:text-slate-200 rounded-tl-none shadow-sm'
                            }`}>
                            {msg.content.split('\n').map((line, i) => (
                                <p key={i} className={i > 0 ? 'mt-2' : ''}>{line}</p>
                            ))}
                            <span className={`text-[10px] block mt-1 opacity-70 ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                            <Bot className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-gray-100 dark:border-white/5 shadow-sm">
                            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-white/5 rounded-b-3xl">
                <div className="relative flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Posez une question sur votre sécurité..."
                        className="w-full pl-4 pr-12 py-3.5 bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium dark:text-white transition-all"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors"
                    >
                        <Send className="h-4 w-4" />
                    </button>
                </div>
                <p className="text-[10px] text-center text-slate-400 mt-2">
                    L'IA peut faire des erreurs. Vérifiez les informations importantes.
                </p>
            </form>
        </div>
    );
};
