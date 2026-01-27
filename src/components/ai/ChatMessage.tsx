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
import { ActionCard } from './ActionCard';
import { AIActionType } from '../../services/ai/actionRegistry';

const prismTheme = vscDarkPlus as unknown as { [key: string]: React.CSSProperties };

const markdownComponents: Components = {
    // Headers
    h1: ({ children }) => <h1 className="text-lg font-bold text-slate-900 dark:text-white mt-4 mb-2 first:mt-0">{children}</h1>,
    h2: ({ children }) => <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 mt-4 mb-2">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-3 mb-1.5">{children}</h3>,
    h4: ({ children }) => <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-3 mb-1.5">{children}</h4>,

    // Text Content
    p: ({ children }) => <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 mb-3 last:mb-0">{children}</p>,
    strong: ({ children }) => <strong className="font-semibold text-slate-900 dark:text-white">{children}</strong>,
    em: ({ children }) => <em className="italic text-slate-800 dark:text-slate-200">{children}</em>,
    blockquote: ({ children }) => (
        <blockquote className="border-l-4 border-brand-200 dark:border-brand-800 pl-4 py-1.5 my-3 italic text-muted-foreground bg-slate-50 dark:bg-slate-900/30 rounded-r-lg">
            {children}
        </blockquote>
    ),

    // Lists
    ul: ({ children }) => <ul className="list-disc list-outside ml-4 space-y-1 mb-3 text-slate-700 dark:text-slate-300 pointer-events-none">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal list-outside ml-4 space-y-1 mb-3 text-slate-700 dark:text-slate-300 dark:text-muted-foreground">{children}</ol>,
    li: ({ children }) => <li className="pl-1 leading-relaxed text-slate-700 dark:text-slate-300 dark:text-muted-foreground">{children}</li>,

    // Tables
    table: ({ children }) => (
        <div className="overflow-x-auto my-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                {children}
            </table>
        </div>
    ),
    thead: ({ children }) => <thead className="bg-slate-50 dark:bg-slate-900">{children}</thead>,
    th: ({ children }) => (
        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {children}
        </th>
    ),
    tbody: ({ children }) => <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">{children}</tbody>,
    tr: ({ children }) => <tr className="hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:bg-slate-700/50 transition-colors">{children}</tr>,
    td: ({ children }) => <td className="px-3 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap">{children}</td>,

    // Links
    a: ({ href, children }) => (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 dark:text-brand-400 hover:text-brand-500 underline underline-offset-2 transition-colors font-medium"
        >
            {children}
        </a>
    ),

    // Horizontal Rule
    hr: () => <hr className="my-6 border-slate-200 dark:border-slate-700/50" />,

    // Code
    code: (props) => {
        const { className, children, ...rest } = props;
        const inline = 'inline' in rest && typeof (rest as { inline?: unknown }).inline === 'boolean'
            ? (rest as { inline?: boolean }).inline
            : false;

        const match = /language-(\w+)/.exec(className || '');
        return !inline && match ? (
            <div className="rounded-lg overflow-hidden my-3 shadow-md border border-slate-200 dark:border-slate-700/50 group/code">
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/50">
                    <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">{match[1]}</span>
                    <button
                        type="button"
                        onClick={() => {
                            navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
                        }}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-brand-600 dark:hover:text-brand-400 transition-colors opacity-0 group-hover/code:opacity-70"
                        aria-label="Copier le code"
                    >
                        <Copy className="h-3 w-3" />
                        Copier
                    </button>
                </div>
                <SyntaxHighlighter
                    style={prismTheme}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{ margin: 0, padding: '1rem', borderRadius: 0, fontSize: '0.8rem', lineHeight: '1.5' }}
                    showLineNumbers={true}
                    lineNumberStyle={{ minWidth: '2.5em', paddingRight: '1em', color: '#64748b', textAlign: 'right', borderRight: '1px solid #e2e8f030', marginRight: '1em' }}
                >
                    {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
            </div>
        ) : (
            <code
                className={cn(
                    "px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600/50 font-mono text-[11px] font-medium text-violet-600 dark:text-violet-400",
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
    // Helper to detect and extract action JSON if present
    const extractAction = (content: string) => {
        try {
            // Basic regex to find JSON block that looks like an action response
            // We look for {"action": ...} structure.
            // This is a simple heuristic. For production, we'd enforce JSON output mode more strictly.
            const actionMatch = content.match(/```json\s*({[\s\S]*?"action"[\s\S]*?})\s*```/);
            if (actionMatch) {
                const json = JSON.parse(actionMatch[1]);
                if (json.action && json.action.type) {
                    return {
                        text: json.text || content.replace(actionMatch[0], '').trim(), // Fallback to stripping JSON
                        action: json.action
                    };
                }
            }

            // Also try full string parse if no markdown block
            if (content.trim().startsWith('{') && content.includes('"action"')) {
                const json = JSON.parse(content);
                if (json.action && json.action.type) {
                    return { text: json.text, action: json.action };
                }
            }
        } catch {
            // Ignore parse errors, treat as text
        }
        return { text: content, action: null };
    };

    const { text, action } = extractAction(message.content);

    return (
        <div className={cn("flex gap-4 group animate-in slide-in-from-bottom-2 duration-300",
            message.role === 'user' ? "flex-row-reverse" : ""
        )}>
            <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border",
                message.role === 'user'
                    ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    : "bg-brand-100 dark:bg-brand-900 border-brand-200 dark:border-brand-300"
            )}>
                {message.role === 'user'
                    ? <User className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                    : <Bot className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                }
            </div>

            <div className="flex flex-col gap-1 max-w-[85%]">
                <span className={cn("text-[11px] font-bold opacity-60 px-1", message.role === 'user' ? "text-right" : "text-left")}>
                    {message.role === 'user' ? 'Vous' : 'Sentinel AI'}
                </span>

                <div className={cn(
                    "p-4 rounded-2xl text-sm leading-relaxed shadow-sm relative group-hover:shadow-md transition-shadow",
                    message.role === 'user'
                        ? "bg-slate-900 dark:bg-brand-600 text-white rounded-tr-none shadow-brand-500/25"
                        : cn("bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 dark:text-slate-200 rounded-tl-none", message.isError && "border-error/30 bg-error/5 text-error dark:bg-error/10 dark:text-error dark:border-error/30")
                )}>
                    {message.role === 'assistant' ? (
                        <div className="text-sm">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents}
                            >
                                {text || ""}
                            </ReactMarkdown>

                            {/* Render Action Card if Action is present */}
                            {action && (
                                <ActionCard
                                    type={action.type as AIActionType}
                                    payload={action.payload as Record<string, unknown>}
                                    reasoning={action.reasoning as string}
                                    onComplete={() => {
                                        // Optional: trigger a follow up or just show success state in card

                                    }}
                                />
                            )}

                            {!message.isError && (
                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onCopy(message.content, message.id)}
                                        className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-brand-600 transition-colors"
                                        aria-label="Copier la réponse"
                                    >
                                        {copiedId === message.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                        {copiedId === message.id ? 'Copié' : 'Copier'}
                                    </button>
                                </div>
                            )}
                            {message.isError && message.content.includes('Quota') && (
                                <div className="mt-4 pt-3 border-t border-error/20 dark:border-error/30">
                                    <button
                                        type="button"
                                        onClick={onUpgrade}
                                        className="w-full py-2 bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-brand-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
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
                <span className={cn("text-[11px] opacity-40 px-1", message.role === 'user' ? "text-right" : "text-left")}>
                    {message.timestamp instanceof Date
                        ? message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                </span>
            </div>
        </div>
    );
};
