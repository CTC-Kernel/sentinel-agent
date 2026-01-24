import React from 'react';
import { createPortal } from 'react-dom';
import { X, Command, Keyboard } from './Icons';

interface ShortcutsHelpProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ShortcutsHelp: React.FC<ShortcutsHelpProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const shortcuts = [
        { keys: ['Cmd', 'K'], description: 'Ouvrir la palette de commandes' },
        { keys: ['Cmd', 'H'], description: 'Retour au tableau de bord' },
        { keys: ['Cmd', 'N'], description: 'Créer un nouvel élément' },
        { keys: ['Cmd', 'S'], description: 'Sauvegarder (si applicable)' },
        { keys: ['Cmd', '/'], description: 'Recherche globale' },
        { keys: ['Shift', '?'], description: 'Afficher cette aide' },
        { keys: ['Cmd', 'Shift', 'T'], description: 'Changer le thème' },
        { keys: ['Esc'], description: 'Fermer la fenêtre' },
    ];

    return createPortal(
        <div className="fixed inset-0 z-max flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden animate-scale-in">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-50 dark:bg-slate-900/20 rounded-xl text-brand-600 dark:text-brand-400">
                            <Keyboard className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Raccourcis Clavier</h3>
                            <p className="text-xs text-slate-600 dark:text-muted-foreground">Gagnez du temps avec ces commandes</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {shortcuts.map((shortcut) => (
                        <div key={shortcut.description} className="flex items-center justify-between group">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                {shortcut.description}
                            </span>
                            <div className="flex items-center gap-1">
                                {shortcut.keys.map((key, i) => (
                                    <kbd
                                        key={`key-${i}-${key}`}
                                        className="min-w-[24px] px-2 py-1 flex items-center justify-center bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider font-mono"
                                    >
                                        {key === 'Cmd' ? <Command className="h-3 w-3" /> : key}
                                    </kbd>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="px-6 py-4 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-500">
                        Appuyez sur <kbd className="font-bold text-slate-600 dark:text-muted-foreground">Esc</kbd> pour fermer
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
};
