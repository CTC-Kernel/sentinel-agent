
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Activity, ArrowRight } from './Icons';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] dark:bg-black p-6 relative overflow-hidden">
          {/* Ambient Background */}
          <div className="absolute inset-0 w-full h-full pointer-events-none">
              <div className="absolute top-[-20%] left-[-10%] w-[60rem] h-[60rem] bg-red-500/10 dark:bg-red-900/10 rounded-full mix-blend-multiply filter blur-[120px] opacity-50 animate-float"></div>
          </div>

          <div className="glass-panel rounded-[2.5rem] p-12 max-w-lg w-full text-center shadow-2xl relative z-10 border border-white/20 dark:border-white/10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 dark:bg-red-900/20 mb-8 shadow-inner ring-1 ring-black/5 dark:ring-white/5">
              <Activity className="h-10 w-10 text-red-500" />
            </div>
            
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight font-display">
              Erreur critique
            </h2>
            
            <p className="text-base text-slate-500 dark:text-slate-400 mb-8 leading-relaxed font-medium">
              L'application a rencontré un problème inattendu et a dû être arrêtée pour protéger vos données.
            </p>
            
            <div className="bg-slate-50/50 dark:bg-black/20 p-5 rounded-2xl text-left mb-8 overflow-auto max-h-40 border border-black/5 dark:border-white/5 shadow-inner custom-scrollbar">
                <p className="text-xs font-mono text-red-500 break-all">
                    {this.state.error?.toString()}
                </p>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center px-6 py-4 bg-slate-900 dark:bg-white text-white dark:text-black font-bold rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-slate-900/20 dark:shadow-white/10"
            >
              <ArrowRight className="h-4 w-4" />
              Relancer l'application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}