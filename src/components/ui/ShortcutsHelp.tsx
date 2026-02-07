import React from 'react';
import { createPortal } from 'react-dom';
import { X, Command, Keyboard } from './Icons';

interface ShortcutsHelpProps {
 isOpen: boolean;
 onClose: () => void;
}

export const ShortcutsHelp: React.FC<ShortcutsHelpProps> = ({ isOpen, onClose }) => {
 if (!isOpen) return null;

 const shortcutGroups = [
 {
 title: 'Actions globales',
 shortcuts: [
 { keys: ['Cmd', 'K'], description: 'Ouvrir la palette de commandes' },
 { keys: ['Cmd', '/'], description: 'Recherche globale' },
 { keys: ['Cmd', 'N'], description: 'Créer un nouvel élément' },
 { keys: ['Cmd', 'S'], description: 'Sauvegarder (si applicable)' },
 { keys: ['Shift', '?'], description: 'Afficher cette aide' },
 { keys: ['Cmd', 'Shift', 'T'], description: 'Changer le thème' },
 { keys: ['Esc'], description: 'Fermer la fenêtre' },
 ]
 },
 {
 title: 'Navigation rapide',
 shortcuts: [
 { keys: ['Cmd', '1'], description: 'Tableau de bord' },
 { keys: ['Cmd', '2'], description: 'Analytique' },
 { keys: ['Cmd', '3'], description: 'Risques' },
 { keys: ['Cmd', '4'], description: 'Actifs' },
 { keys: ['Cmd', '5'], description: 'Conformité' },
 { keys: ['Cmd', '6'], description: 'Incidents' },
 { keys: ['Cmd', '7'], description: 'Projets' },
 { keys: ['Cmd', '8'], description: 'Audits' },
 { keys: ['Cmd', '9'], description: 'Paramètres' },
 ]
 }
 ];

 return createPortal(
 <div className="fixed inset-0 z-max flex items-center justify-center p-4">
 <div
 className="absolute inset-0 bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)] transition-opacity"
 onClick={onClose}
 role="presentation"
 aria-hidden="true"
 />

 <div className="relative w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border/40 overflow-hidden animate-scale-in">
 <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 dark:border-white/5">
  <div className="flex items-center gap-3">
  <div className="p-2 bg-primary/10/20 rounded-3xl text-primary">
  <Keyboard className="h-5 w-5" />
  </div>
  <div>
  <h3 className="text-lg font-bold text-foreground">Raccourcis Clavier</h3>
  <p className="text-xs text-muted-foreground">Gagnez du temps avec ces commandes</p>
  </div>
  </div>
  <button
  onClick={onClose}
  className="p-2 text-muted-foreground hover:text-muted-foreground/60 hover:bg-muted rounded-3xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  aria-label="Fermer"
  >
  <X className="h-5 w-5" />
  </button>
 </div>

 <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
  {shortcutGroups.map((group) => (
  <div key={group.title || 'unknown'}>
  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
  {group.title}
  </h4>
  <div className="space-y-2">
  {group.shortcuts.map((shortcut) => (
   <div key={shortcut.description || 'unknown'} className="flex items-center justify-between group">
   <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground dark:group-hover:text-foreground transition-colors">
   {shortcut.description}
   </span>
   <div className="flex items-center gap-1">
   {shortcut.keys.map((key, i) => (
   <kbd
    key={`key-${i || 'unknown'}-${key}`}
    className="min-w-[24px] px-2 py-1 flex items-center justify-center bg-muted border-b-2 border-border/40 rounded-lg text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono"
   >
    {key === 'Cmd' ? <Command className="h-3 w-3" /> : key}
   </kbd>
   ))}
   </div>
   </div>
  ))}
  </div>
  </div>
  ))}
 </div>

 <div className="px-6 py-4 bg-muted/50 dark:bg-white/5 border-t border-border/40 dark:border-white/5 text-center">
  <p className="text-xs text-muted-foreground">
  Appuyez sur <kbd className="font-bold text-muted-foreground">Esc</kbd> pour fermer
  </p>
 </div>
 </div>
 </div>,
 document.body
 );
};
