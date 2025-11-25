import React from 'react';
import { X } from '../ui/Icons';

interface IncidentPlaybookModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title: string;
}

export const IncidentPlaybookModal: React.FC<IncidentPlaybookModalProps> = ({ isOpen, onClose, children, title }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-850 rounded-[2.5rem] shadow-2xl w-full max-w-3xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-8 border-b border-gray-100 dark:border-white/5 bg-red-50/30 dark:bg-red-900/10">
                    <h2 className="text-2xl font-bold text-red-700 dark:text-red-400 flex items-center tracking-tight">
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-white/50 p-2"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );
};
