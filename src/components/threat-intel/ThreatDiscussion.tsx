
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { CommentSection } from '../collaboration/CommentSection';

interface ThreatDiscussionProps {
    threatId: string;
    threatTitle: string;
    isOpen: boolean;
    onClose: () => void;
}

export const ThreatDiscussion: React.FC<ThreatDiscussionProps> = ({ threatId, threatTitle, isOpen, onClose }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                    />

                    {/* Side Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">Discussion</h3>
                                <p className="text-xs text-slate-500 truncate max-w-[280px]">{threatTitle}</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                                <X className="h-5 w-5 text-slate-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-hidden p-4">
                            <CommentSection
                                collectionName="threats"
                                documentId={threatId}
                                className="h-full"
                            />
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// Typed helper since generic useState was used in prompt

