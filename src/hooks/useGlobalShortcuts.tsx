import { useNavigate, useLocation } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { useStore } from '../store';
import { useState } from 'react';

/**
 * Hook pour les raccourcis clavier globaux de l'application
 */
export const useGlobalShortcuts = () => {
 const navigate = useNavigate();
 const location = useLocation();
 const { toggleTheme, addToast, t } = useStore();
 const [showHelp, setShowHelp] = useState(false);

 // Navigation rapide (Cmd/Ctrl + 1-9)
 useHotkeys('ctrl+1,cmd+1', (e) => { e.preventDefault(); navigate('/'); addToast(t('shortcuts.toast.dashboard', { defaultValue: 'Dashboard' })); }, { enableOnFormTags: false });
 useHotkeys('ctrl+2,cmd+2', (e) => { e.preventDefault(); navigate('/analytics'); }, { enableOnFormTags: false });
 useHotkeys('ctrl+3,cmd+3', (e) => { e.preventDefault(); navigate('/risks'); }, { enableOnFormTags: false });
 useHotkeys('ctrl+4,cmd+4', (e) => { e.preventDefault(); navigate('/assets'); }, { enableOnFormTags: false });
 useHotkeys('ctrl+5,cmd+5', (e) => { e.preventDefault(); navigate('/compliance'); }, { enableOnFormTags: false });
 useHotkeys('ctrl+6,cmd+6', (e) => { e.preventDefault(); navigate('/incidents'); }, { enableOnFormTags: false });
 useHotkeys('ctrl+7,cmd+7', (e) => { e.preventDefault(); navigate('/projects'); }, { enableOnFormTags: false });
 useHotkeys('ctrl+8,cmd+8', (e) => { e.preventDefault(); navigate('/audits'); }, { enableOnFormTags: false });
 useHotkeys('ctrl+9,cmd+9', (e) => { e.preventDefault(); navigate('/settings'); }, { enableOnFormTags: false });

 // Thème (Cmd/Ctrl + Shift + T)
 useHotkeys('ctrl+shift+t,cmd+shift+t', (e) => {
 e.preventDefault();
 toggleTheme();
 addToast(t('shortcuts.toast.themeChanged', { defaultValue: 'Thème changé' }));
 });

 // Recherche globale (Cmd/Ctrl + /)
 useHotkeys('ctrl+/,cmd+/', (e) => {
 e.preventDefault();
 navigate('/search');
 }, { enableOnFormTags: false });

 // Aide (Cmd/Ctrl + Shift + H ou ?)
 useHotkeys(['ctrl+shift+h', 'cmd+shift+h', 'shift+?'], (e) => {
 e.preventDefault();
 setShowHelp(prev => !prev);
 }, { enableOnFormTags: false });

 // Home (Cmd/Ctrl + H)
 useHotkeys('ctrl+h,cmd+h', (e) => {
 e.preventDefault();
 navigate('/');
 }, { enableOnFormTags: false });

 // New Item (Cmd/Ctrl + N) - Context Aware
 useHotkeys('ctrl+n,cmd+n', (e) => {
 e.preventDefault();
 const path = location.pathname;
 if (path.includes('risks')) {
 // Logic handled in Risks.tsx via local shortcut or we can trigger a global event
 // For now, let's just navigate to the creation view if applicable or show a toast
 addToast(t('shortcuts.toast.useNewRiskButton', { defaultValue: 'Utilisez le bouton "Nouveau Risque" pour créer un élément' }), 'info');
 } else if (path.includes('assets')) {
 addToast(t('shortcuts.toast.useNewAssetButton', { defaultValue: 'Utilisez le bouton "Nouvel Actif" pour créer un élément' }), 'info');
 } else {
 // Generic fallback or open command palette in "New" mode?
 // For now, simple toast
 addToast(t('shortcuts.toast.contextualCreate', { defaultValue: 'Raccourci de création contextuel' }), 'info');
 }
 }, { enableOnFormTags: false });

 // Save (Cmd/Ctrl + S)
 useHotkeys('ctrl+s,cmd+s', (e) => {
 e.preventDefault();
 // This is tricky to handle globally without a complex event bus or context
 // But we can prevent the browser "Save Page" dialog
 addToast(t('shortcuts.toast.autoSaveActive', { defaultValue: 'Sauvegarde automatique active' }), 'success');
 }, { enableOnFormTags: true });

 return { showHelp, setShowHelp };
};
