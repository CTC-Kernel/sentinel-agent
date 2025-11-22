
import React from 'react';
import { useStore } from '../../store';
import { X, CheckCircle2, AlertTriangle, Activity } from './Icons';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useStore();

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            pointer-events-auto
            flex items-center p-4 pr-6 rounded-2xl shadow-2xl border backdrop-blur-xl animate-slide-up min-w-[320px]
            ${toast.type === 'success' ? 'bg-white/90 dark:bg-slate-800/90 border-emerald-500/20 shadow-emerald-500/10' : ''}
            ${toast.type === 'error' ? 'bg-white/90 dark:bg-slate-800/90 border-red-500/20 shadow-red-500/10' : ''}
            ${toast.type === 'info' ? 'bg-white/90 dark:bg-slate-800/90 border-blue-500/20 shadow-blue-500/10' : ''}
          `}
        >
          <div className={`flex-shrink-0 p-2 rounded-full mr-3 ${
              toast.type === 'success' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
              toast.type === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
              'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
          }`}>
            {toast.type === 'success' && <CheckCircle2 className="h-5 w-5" />}
            {toast.type === 'error' && <AlertTriangle className="h-5 w-5" />}
            {toast.type === 'info' && <Activity className="h-5 w-5" />}
          </div>
          <div className="flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  {toast.type === 'success' ? 'Succès' : toast.type === 'error' ? 'Erreur' : 'Information'}
              </p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{toast.message}</p>
          </div>
          <button 
            onClick={() => removeToast(toast.id)} 
            className="ml-4 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
