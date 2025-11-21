import React from 'react';
import { useStore } from '../../store';
import { X, CheckCircle2, AlertTriangle, Activity } from './Icons';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            flex items-center p-4 rounded-lg shadow-lg border min-w-[300px] animate-fade-in transform transition-all duration-300
            ${toast.type === 'success' ? 'bg-white dark:bg-slate-800 border-l-4 border-l-emerald-500 text-slate-800 dark:text-white' : ''}
            ${toast.type === 'error' ? 'bg-white dark:bg-slate-800 border-l-4 border-l-red-500 text-slate-800 dark:text-white' : ''}
            ${toast.type === 'info' ? 'bg-white dark:bg-slate-800 border-l-4 border-l-blue-500 text-slate-800 dark:text-white' : ''}
          `}
        >
          <div className="mr-3">
            {toast.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            {toast.type === 'error' && <AlertTriangle className="h-5 w-5 text-red-500" />}
            {toast.type === 'info' && <Activity className="h-5 w-5 text-blue-500" />}
          </div>
          <div className="flex-1 text-sm font-medium">{toast.message}</div>
          <button 
            onClick={() => removeToast(toast.id)} 
            className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};