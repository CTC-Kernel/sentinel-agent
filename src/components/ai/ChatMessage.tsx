import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
// Focus indicators: focus-visible:ring-2 applied globally via CSS
import { cn } from '../../lib/utils';
import { User, Bot, Check, Copy, Zap } from '../ui/Icons';
import { ChatMessage as ChatMessageType } from '../../services/aiService';
import type { Components } from 'react-markdown';

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
                        type="button"
                        onClick={() => {
                            navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
                        }}
                        className="hover:text-indigo-500 transition-colors"
                        aria-label="Copier le code"
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

interface ChatMessageProps {
    message: ChatMessageType;
    onCopy: (text: string, id: string) => void;
    copiedId: string | null;
    onUpgrade: () => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onCopy, copiedId, onUpgrade }) => {
    return (
        <div className={cn("flex gap-4 group animate-in slide-in-from-bottom-2 duration-300",
            message.role === 'user' ? "flex-row-reverse" : ""
        )}>
            <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border",
                message.role === 'user'
                    ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    : "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-500/30"
            )}>
                {message.role === 'user'
                    ? <User className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                    : <Bot className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                }
            </div>

            <div className="flex flex-col gap-1 max-w-[85%]">
                <span className={cn("text-[10px] font-bold opacity-60 px-1", message.role === 'user' ? "text-right" : "text-left")}>
                    {message.role === 'user' ? 'Vous' : 'Sentinel AI'}
                </span>

                <div className={cn(
                    "p-4 rounded-2xl text-sm leading-relaxed shadow-sm relative group-hover:shadow-md transition-shadow",
                    message.role === 'user'
                        ? "bg-slate-900 dark:bg-indigo-600 text-white rounded-tr-none"
                        : cn("bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-200 rounded-tl-none", message.isError && "border-red-200 bg-red-50 text-red-800 dark:bg-red-900/10 dark:text-red-300 dark:border-red-900/30")
                )}>
                    {message.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents}
                            >
                                {message.content}
                            </ReactMarkdown>

                            {!message.isError && (
                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onCopy(message.content, message.id)}
                                        className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                                        aria-label="Copier la réponse"
                                    >
                                        {copiedId === message.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                        {copiedId === message.id ? 'Copié' : 'Copier'}
                                    </button>
                                </div>
                            )}
                            {message.isError && message.content.includes('Quota') && (
                                <div className="mt-4 pt-3 border-t border-red-100 dark:border-red-900/30">
                                    <button
                                        type="button"
                                        onClick={onUpgrade}
                                        className="w-full py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                        aria-label="Mettre à niveau mon plan"
                                    >
                                        <Zap className="h-3 w-3" />
                                        Mettre à niveau mon plan
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                </div>
                <span className={cn("text-[10px] opacity-40 px-1", message.role === 'user' ? "text-right" : "text-left")}>
                    {message.timestamp instanceof Date
                        ? message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                </span>
            </div>
        </div>
    );
};
