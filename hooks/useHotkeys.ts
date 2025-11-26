import { useEffect } from 'react';

/**
 * Hook pour gérer les raccourcis clavier globaux
 * Améliore la productivité des power users
 * 
 * @example
 * useHotkeys('ctrl+k', () => openSearch())
 * useHotkeys('ctrl+/', () => openHelp())
 * useHotkeys('escape', () => closeModal())
 */

type HotkeyCallback = (event: KeyboardEvent) => void;

interface HotkeyOptions {
  enabled?: boolean;
  preventDefault?: boolean;
  description?: string;
}

export const useHotkeys = (
  keys: string,
  callback: HotkeyCallback,
  options: HotkeyOptions = {}
) => {
  const { enabled = true, preventDefault = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const pressedKeys = [];

      if (event.ctrlKey || event.metaKey) pressedKeys.push('ctrl');
      if (event.shiftKey) pressedKeys.push('shift');
      if (event.altKey) pressedKeys.push('alt');

      const key = event.key.toLowerCase();
      pressedKeys.push(key);

      const pressedCombo = pressedKeys.join('+');
      const targetCombo = keys.toLowerCase().replace('cmd', 'ctrl');

      if (pressedCombo === targetCombo) {
        if (preventDefault) {
          event.preventDefault();
        }
        callback(event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [keys, callback, enabled, preventDefault]);
};

/**
 * Hook pour afficher un panneau d'aide des raccourcis
 */
export const useHotkeysHelp = () => {
  const shortcuts = [
    { keys: 'Ctrl+K', description: 'Ouvrir la recherche' },
    { keys: 'Ctrl+/', description: 'Afficher l\'aide' },
    { keys: 'Escape', description: 'Fermer les modals' },
    { keys: 'Ctrl+N', description: 'Créer un nouvel élément' },
    { keys: 'Ctrl+S', description: 'Sauvegarder' },
    { keys: 'Ctrl+E', description: 'Exporter' },
    { keys: '?', description: 'Afficher les raccourcis' },
  ];

  return shortcuts;
};

/**
 * Détection du système d'exploitation pour afficher les bonnes touches
 */
export const getModifierKey = (): 'Ctrl' | 'Cmd' => {
  if (typeof window === 'undefined') return 'Ctrl';
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'Cmd' : 'Ctrl';
};
