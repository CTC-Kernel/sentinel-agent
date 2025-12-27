import React from 'react';
import { createPortal } from 'react-dom';
import { Lock } from 'lucide-react';

interface LoadingScreenProps {
    message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => {
    const [showTimeout, setShowTimeout] = React.useState(false);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setShowTimeout(true);
        }, 10000); // 10 seconds timeout

        return () => clearTimeout(timer);
    }, []);

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-max h-[100dvh] w-screen grid place-items-center bg-background transition-colors overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50rem] h-[50rem] bg-brand-200/40 dark:bg-slate-900/20 rounded-full mix-blend-multiply filter blur-[100px] animate-float"></div>
            </div>
            <div className="relative z-10 flex flex-col items-center">
                <div className="w-20 h-20 rounded-3xl glass-panel flex items-center justify-center shadow-2xl animate-pulse mb-8 border border-white/40 dark:border-white/10">
                    <Lock className="h-10 w-10 text-slate-900 dark:text-white" strokeWidth={2.5} />
                </div>
                {!showTimeout ? (
                    <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center animate-fade-in">
                        <p className="text-sm text-slate-500 mb-4 text-center px-4">
                            {message || 'Le chargement prend plus de temps que prévu...'}
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors shadow-lg hover:shadow-brand-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                        >
                            Recharger la page
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
