
import React from 'react';
import { AlertTriangle } from './Icons';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  type?: 'danger' | 'warning' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, message, type = 'danger' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-850 rounded-[2rem] shadow-2xl w-full max-w-sm border border-white/20 overflow-hidden animate-scale-in">
        <div className="p-6 text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg ${type === 'danger' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{message}</p>
        </div>
        <div className="flex border-t border-gray-100 dark:border-white/5">
          <button onClick={onClose} className="flex-1 py-4 text-sm font-bold text-slate-500 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            Annuler
          </button>
          <div className="w-px bg-gray-100 dark:bg-white/5"></div>
          <button onClick={() => { onConfirm(); onClose(); }} className={`flex-1 py-4 text-sm font-bold ${type === 'danger' ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'} transition-colors`}>
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
};
