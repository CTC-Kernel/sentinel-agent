import React from 'react';
import { Lock } from 'lucide-react';

export const LoadingScreen: React.FC = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafafa] dark:bg-slate-900 transition-colors relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-20%] left-[-10%] w-[50rem] h-[50rem] bg-brand-200/40 dark:bg-blue-900/20 rounded-full mix-blend-multiply filter blur-[100px] animate-float"></div>
        </div>
        <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl glass-panel flex items-center justify-center shadow-2xl animate-pulse mb-8 border border-white/40 dark:border-white/10">
                <Lock className="h-10 w-10 text-slate-900 dark:text-white" strokeWidth={2.5} />
            </div>
            <div className="flex space-x-2">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
        </div>
    </div>
);
