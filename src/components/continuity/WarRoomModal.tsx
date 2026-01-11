import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Lock, Send, X, FileText, User, Paperclip, Eye, ShieldAlert
} from 'lucide-react';
import { Dialog } from '@headlessui/react';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useWarRoom } from '../../hooks/incidents/useWarRoom';
import { ErrorLogger } from '../../services/errorLogger';

interface WarRoomModalProps {
    isOpen: boolean;
    onClose: () => void;
    incidentId: string;
    incidentTitle: string;
}

export const WarRoomModal: React.FC<WarRoomModalProps> = ({ isOpen, onClose, incidentId, incidentTitle }) => {
    const { user } = useStore();
    const bottomRef = useRef<HTMLDivElement>(null);
    const { messages, sendMessage, loading } = useWarRoom(incidentId);

    useEffect(() => {
        if (isOpen) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const messageSchema = z.object({
        content: z.string().min(1, "Le message ne peut pas être vide")
    });

    type MessageFormData = z.infer<typeof messageSchema>;

    const { register, handleSubmit, reset } = useForm<MessageFormData>({
        resolver: zodResolver(messageSchema),
        defaultValues: {
            content: ''
        }
    });

    const onSubmit = async (data: MessageFormData) => {
        if (!data.content.trim()) return;
        try {
            await sendMessage(data.content);
            reset();
        } catch (error) {
            // Toast error handled globally or we can add local error state
            ErrorLogger.error(error, 'WarRoomModal.onSubmit');
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <Dialog static open={isOpen} onClose={onClose} className="relative z-modal">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/90 backdrop-blur-sm"
                    />

                    <div className="fixed inset-0 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-slate-900 w-full max-w-6xl h-[85vh] rounded-3xl border border-red-500/30 shadow-[0_0_100px_rgba(239,68,68,0.2)] flex overflow-hidden flex-col md:flex-row relative"
                        >
                            {/* CRT/Scanline Overlay */}
                            <div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(transparent,transparent_2px,rgba(0,0,0,0.1)_3px)] opacity-50 z-decorator mix-blend-overlay" />

                            {/* Left Panel: Context & Docs */}
                            <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-white/10 bg-black/20 flex flex-col">
                                <div className="p-6 border-b border-white/10 bg-red-950/20">
                                    <div className="flex items-center gap-3 text-red-500 mb-2">
                                        <Lock className="w-5 h-5 animate-pulse" />
                                        <span className="text-xs font-mono font-bold tracking-[0.2em] uppercase">Top Secret // Eyes Only</span>
                                    </div>
                                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">War Room</h2>
                                    <p className="text-red-400 text-sm font-mono mt-1 break-all">REF: {incidentId}</p>
                                    <p className="text-slate-400 text-xs mt-2 line-clamp-2">{incidentTitle}</p>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {/* Critical Docs */}
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <FileText className="w-4 h-4" /> Documents Critiques
                                        </h3>
                                        <div className="space-y-2">
                                            {/* TODO: Link to real documents related to incident */}
                                            {['Plan de Continuité (PCA)', 'Annuaire de Crise', 'Procédures de Restauration'].map((doc, i) => (
                                                <div key={`drill-${i}`} className="group flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-red-500/30 hover:bg-white/10 cursor-pointer transition-all">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-lg bg-slate-800 text-slate-400 group-hover:text-white transition-colors">
                                                            <FileText className="w-4 h-4" />
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-300 group-hover:text-white">{doc}</span>
                                                    </div>
                                                    <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white">
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Active Users */}
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <User className="w-4 h-4" /> En Ligne
                                        </h3>
                                        <div className="flex -space-x-2">
                                            {/* TODO: Real presence list */}
                                            <div className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-xs text-white cursor-help" title="Vous">
                                                {user?.displayName?.charAt(0) || 'U'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Panel: Chat */}
                            <div className="flex-1 flex flex-col bg-slate-900/50">
                                {/* Chat Header */}
                                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-xs font-mono text-emerald-500 uppercase">Canal Sécurisé actif</span>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-white/10 text-slate-400 hover:text-white">
                                        <X className="w-5 h-5" />
                                    </Button>
                                </div>

                                {/* Messages Area */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-sm max-h-[60vh] md:max-h-none">
                                    {messages.length === 0 && !loading && (
                                        <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                                            <ShieldAlert className="w-12 h-12 opacity-20" />
                                            <p>Aucun message. Le canal est ouvert.</p>
                                        </div>
                                    )}

                                    {messages.map((msg) => (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            key={msg.id}
                                            className={`flex ${msg.isSystem ? 'justify-center' : msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}
                                        >
                                            {msg.isSystem ? (
                                                <span className="px-3 py-1 rounded-full bg-red-950/50 border border-red-500/20 text-red-500 text-xs">
                                                    {msg.content}
                                                </span>
                                            ) : (
                                                <div className={`max-w-[80%] p-4 rounded-2xl border ${msg.senderId === user?.uid
                                                    ? 'bg-blue-600/20 border-blue-500/30 text-blue-100 rounded-tr-none'
                                                    : 'bg-slate-800 border-white/10 text-slate-300 rounded-tl-none'
                                                    }`}>
                                                    <div className="flex items-center gap-2 mb-1 opacity-50 text-xs">
                                                        <span className="font-bold">{msg.sender}</span>
                                                        <span>•</span>
                                                        <span>{msg.role}</span>
                                                        <span>•</span>
                                                        <span>{msg.timestamp?.toLocaleTimeString ? msg.timestamp.toLocaleTimeString() : ''}</span>
                                                    </div>
                                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                    <div ref={bottomRef} />
                                </div>

                                {/* Input Area */}
                                <div className="p-4 border-t border-white/10 bg-black/20">
                                    <form onSubmit={handleSubmit(onSubmit)} className="flex gap-4">
                                        <Button type="button" variant="ghost" className="text-slate-400 hover:text-white">
                                            <Paperclip className="w-5 h-5" />
                                        </Button>
                                        <input
                                            aria-label="Message de war room"
                                            placeholder="Tapez un message chiffré..."
                                            className="flex-1 bg-transparent border-none text-white placeholder-slate-500 focus:ring-0 font-mono"
                                            autoFocus
                                            {...register('content')}
                                        />
                                        <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50">
                                            <Send className="w-4 h-4" />
                                        </Button>
                                    </form>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </Dialog>
            )}
        </AnimatePresence>
    );
};
