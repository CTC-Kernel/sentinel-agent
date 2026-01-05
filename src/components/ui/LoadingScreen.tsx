import React from 'react';
import { createPortal } from 'react-dom';
import { Lock } from 'lucide-react';

interface LoadingScreenProps {
    message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => {
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] h-[100dvh] w-screen bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center transition-all duration-300">
            <div className="relative flex flex-col items-center">
                <div className="relative">
                    <div className="absolute inset-0 bg-brand-500/20 blur-xl rounded-full animate-pulse"></div>
                    <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex items-center justify-center relative z-10 border border-slate-100 dark:border-slate-800 animate-bounce-subtle">
                        <Lock className="w-8 h-8 text-brand-600 dark:text-brand-500 animate-pulse" />
                    </div>
                </div>

                {message && (
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 font-medium animate-fade-in">
                        {message}
                    </p>
                )}
            </div>
        </div>,
        document.body
    );
};
