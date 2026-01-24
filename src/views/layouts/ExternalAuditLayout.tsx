import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Loader2, ShieldCheck } from '../../components/ui/Icons';

export const ExternalAuditLayout: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100 selection:bg-brand-500/30">
            {/* Minimal Header */}
            <header className="sticky top-0 z-40 w-full backdrop-blur-lg bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-white/10">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-brand-600 p-1.5 rounded-lg text-white">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-lg tracking-tight">Sentinel<span className="text-brand-600 text-xs align-top ml-0.5">PORTAL</span></span>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-muted-foreground">
                        Espace Auditeur Sécurisé
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                <Suspense
                    fallback={
                        <div className="flex items-center justify-center h-[60vh]">
                            <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
                        </div>
                    }
                >
                    <Outlet />
                </Suspense>
            </main>

            {/* Simple Footer */}
            <footer className="border-t border-slate-200 dark:border-white/10 mt-auto bg-white dark:bg-slate-950 py-6">
                <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
                    <p>&copy; 2022 Sentinel GRC. Accès restreint et monitoré.</p>
                </div>
            </footer>
        </div>
    );
};
