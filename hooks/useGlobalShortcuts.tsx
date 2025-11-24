import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { useStore } from '../store';

/**
 * Hook pour les raccourcis clavier globaux de l'application
 */
export const useGlobalShortcuts = () => {
    const navigate = useNavigate();
    const { toggleTheme, addToast } = useStore();

    // Navigation rapide (Cmd/Ctrl + 1-9)
    useHotkeys('ctrl+1,cmd+1', (e) => {
        e.preventDefault();
        navigate('/');
        addToast('Dashboard');
    }, { enableOnFormTags: false });

    useHotkeys('ctrl+2,cmd+2', (e) => {
        e.preventDefault();
        navigate('/analytics');
    }, { enableOnFormTags: false });

    useHotkeys('ctrl+3,cmd+3', (e) => {
        e.preventDefault();
        navigate('/risks');
    }, { enableOnFormTags: false });

    useHotkeys('ctrl+4,cmd+4', (e) => {
        e.preventDefault();
        navigate('/assets');
    }, { enableOnFormTags: false });

    useHotkeys('ctrl+5,cmd+5', (e) => {
        e.preventDefault();
        navigate('/compliance');
    }, { enableOnFormTags: false });

    useHotkeys('ctrl+6,cmd+6', (e) => {
        e.preventDefault();
        navigate('/incidents');
    }, { enableOnFormTags: false });

    useHotkeys('ctrl+7,cmd+7', (e) => {
        e.preventDefault();
        navigate('/projects');
    }, { enableOnFormTags: false });

    useHotkeys('ctrl+8,cmd+8', (e) => {
        e.preventDefault();
        navigate('/audits');
    }, { enableOnFormTags: false });

    useHotkeys('ctrl+9,cmd+9', (e) => {
        e.preventDefault();
        navigate('/settings');
    }, { enableOnFormTags: false });

    // Thème (Cmd/Ctrl + Shift + T)
    useHotkeys('ctrl+shift+t,cmd+shift+t', (e) => {
        e.preventDefault();
        toggleTheme();
        addToast('Thème changé');
    });

    // Recherche globale (Cmd/Ctrl + /)
    useHotkeys('ctrl+/,cmd+/', (e) => {
        e.preventDefault();
        navigate('/search');
    }, { enableOnFormTags: false });

    // Aide (Cmd/Ctrl + Shift + H)
    useHotkeys('ctrl+shift+h,cmd+shift+h', (e) => {
        e.preventDefault();
        navigate('/help');
    }, { enableOnFormTags: false });

    return null;
};

/**
 * Composant pour afficher les raccourcis disponibles
 */
export const ShortcutsGuide = () => {
    const shortcuts = [
        { keys: ['Cmd/Ctrl', 'K'], description: 'Ouvrir la palette de commandes' },
        { keys: ['Cmd/Ctrl', '1-9'], description: 'Navigation rapide' },
        { keys: ['Cmd/Ctrl', '/'], description: 'Recherche globale' },
        { keys: ['Cmd/Ctrl', 'Shift', 'T'], description: 'Changer le thème' },
        { keys: ['Cmd/Ctrl', 'Shift', 'H'], description: 'Aide' },
        { keys: ['Esc'], description: 'Fermer/Annuler' },
    ];

    return (
        <div className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                Raccourcis Clavier
            </h3>
            {shortcuts.map((shortcut, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                        {shortcut.description}
                    </span>
                    <div className="flex gap-1">
                        {shortcut.keys.map((key, i) => (
                            <kbd
                                key={i}
                                className="px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm"
                            >
                                {key}
                            </kbd>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};
