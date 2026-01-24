import React, { useEffect, useCallback, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Layers, Eye, Flame, RotateCw, AlertTriangle, Zap, Clock, RefreshCw, Maximize2, Camera, Keyboard, HelpCircle, Search, Command, Shield, Activity, Network, MousePointer, Move3D } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VoxelGuideProps {
    isOpen: boolean;
    onClose: () => void;
}

const GUIDE_SECTIONS = [
    {
        id: 'intro',
        title: 'Bienvenue dans CTC Engine',
        subtitle: 'Cyber Threat Cartography',
        icon: Shield,
        content: (
            <div className="space-y-4">
                <p className="text-muted-foreground">
                    CTC Engine est votre centre de commandement pour visualiser et analyser l'ensemble de votre écosystème de sécurité en 3D.
                </p>
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center mb-2">
                            <Network className="w-4 h-4 text-blue-400" />
                        </div>
                        <h4 className="text-sm font-medium text-white mb-1">Vue Unifiée</h4>
                        <p className="text-xs text-muted-foreground">Tous vos actifs, risques, projets et contrôles dans une seule vue</p>
                    </div>
                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center mb-2">
                            <Activity className="w-4 h-4 text-purple-400" />
                        </div>
                        <h4 className="text-sm font-medium text-white mb-1">Temps Réel</h4>
                        <p className="text-xs text-muted-foreground">Visualisez les connexions et dépendances instantanément</p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'navigation',
        title: 'Navigation 3D',
        subtitle: 'Contrôles de la caméra',
        icon: Move3D,
        content: (
            <div className="space-y-4">
                <div className="grid gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                            <MousePointer className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-white">Clic gauche + Glisser</h4>
                            <p className="text-xs text-muted-foreground">Rotation de la vue (orbite)</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-muted-foreground text-xs font-bold">
                            Scroll
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-white">Molette de souris</h4>
                            <p className="text-xs text-muted-foreground">Zoom avant/arrière</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-muted-foreground text-xs font-bold">
                            Clic
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-white">Clic sur un nœud</h4>
                            <p className="text-xs text-muted-foreground">Sélectionne et centre la vue sur l'élément</p>
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'layers',
        title: 'Types de Nœuds',
        subtitle: 'Les 7 calques de données',
        icon: Layers,
        content: (
            <div className="space-y-3">
                <p className="text-xs text-muted-foreground mb-3">Chaque type d'élément a une forme et couleur distincte :</p>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { label: 'Actifs', color: 'bg-blue-500', desc: 'Serveurs, applications, données' },
                        { label: 'Risques', color: 'bg-orange-500', desc: 'Menaces identifiées' },
                        { label: 'Contrôles', color: 'bg-purple-500', desc: 'Mesures de sécurité' },
                        { label: 'Projets', color: 'bg-emerald-500', desc: 'Initiatives en cours' },
                        { label: 'Audits', color: 'bg-cyan-500', desc: 'Évaluations planifiées' },
                        { label: 'Incidents', color: 'bg-red-500', desc: 'Événements de sécurité' },
                        { label: 'Fournisseurs', color: 'bg-amber-500', desc: 'Tiers et partenaires' },
                    ].map(item => (
                        <div key={item.label} className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                            <span className={`w-3 h-3 rounded-full ${item.color}`} />
                            <div>
                                <span className="text-xs font-medium text-white">{item.label}</span>
                                <p className="text-[11px] text-slate-500">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs text-amber-300">
                        <strong>Astuce :</strong> Utilisez le bouton <Layers className="w-3 h-3 inline" /> pour afficher/masquer les calques
                    </p>
                </div>
            </div>
        )
    },
    {
        id: 'status',
        title: 'États et Priorités',
        subtitle: 'Comprendre les indicateurs visuels',
        icon: AlertTriangle,
        content: (
            <div className="space-y-4">
                <p className="text-xs text-muted-foreground">La taille et la couleur indiquent la criticité :</p>
                <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <span className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
                        <div>
                            <h4 className="text-sm font-medium text-red-400">Critique</h4>
                            <p className="text-xs text-muted-foreground">Risque score ≥15, Incident critique, Asset C/I/A critique</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <span className="w-4 h-4 rounded-full bg-amber-500" />
                        <div>
                            <h4 className="text-sm font-medium text-amber-400">Alerte</h4>
                            <p className="text-xs text-muted-foreground">Risque score ≥10, Incident élevé, Projet en retard</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <span className="w-4 h-4 rounded-full bg-emerald-500" />
                        <div>
                            <h4 className="text-sm font-medium text-emerald-400">Normal</h4>
                            <p className="text-xs text-muted-foreground">Éléments sans alerte particulière</p>
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'toolbar',
        title: 'Barre d\'Outils',
        subtitle: 'Contrôles de visualisation',
        icon: Eye,
        content: (
            <div className="space-y-3">
                <div className="grid gap-2">
                    {[
                        { icon: ChevronLeft, label: '← / →', desc: 'Naviguer entre les nœuds' },
                        { icon: Layers, label: 'Calques', desc: 'Afficher/masquer les types' },
                        { icon: Flame, label: 'Heatmap', desc: 'Mettre en évidence les critiques' },
                        { icon: Eye, label: 'X-Ray', desc: 'Mode transparence' },
                        { icon: RotateCw, label: 'Auto-rotation', desc: 'Rotation automatique de la vue' },
                        { icon: AlertTriangle, label: 'Anomalies', desc: 'Panneau de détection d\'anomalies' },
                        { icon: Zap, label: 'Blast Radius', desc: 'Simulation d\'impact' },
                        { icon: Clock, label: 'Time Machine', desc: 'Historique des changements' },
                        { icon: RefreshCw, label: 'Reset (R)', desc: 'Réinitialiser la vue' },
                        { icon: Maximize2, label: 'Plein écran (F)', desc: 'Mode immersif' },
                        { icon: Camera, label: 'Capture (S)', desc: 'Télécharger une image' },
                    ].map(item => (
                        <div key={item.label} className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                            <item.icon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs font-medium text-white w-24">{item.label}</span>
                            <span className="text-xs text-slate-500">{item.desc}</span>
                        </div>
                    ))}
                </div>
            </div>
        )
    },
    {
        id: 'panels',
        title: 'Panneaux d\'Analyse',
        subtitle: 'Outils avancés',
        icon: Zap,
        content: (
            <div className="space-y-4">
                <div className="p-3 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-orange-400" />
                        <h4 className="text-sm font-semibold text-white">Panneau Anomalies</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Détecte automatiquement les configurations anormales : actifs sans contrôles, risques non traités, fournisseurs sans évaluation...
                    </p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-5 h-5 text-purple-400" />
                        <h4 className="text-sm font-semibold text-white">Blast Radius</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Simulez l'impact d'une défaillance. Sélectionnez un nœud et visualisez tous les éléments qui seraient affectés par effet de cascade.
                    </p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-cyan-400" />
                        <h4 className="text-sm font-semibold text-white">Time Machine</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Voyagez dans le temps pour voir l'évolution de votre posture de sécurité. Comparez les états passés et présents.
                    </p>
                </div>
            </div>
        )
    },
    {
        id: 'shortcuts',
        title: 'Raccourcis Clavier',
        subtitle: 'Productivité maximale',
        icon: Keyboard,
        content: (
            <div className="space-y-2">
                {[
                    { key: '⌘K / Ctrl+K', action: 'Ouvrir la recherche rapide' },
                    { key: 'Échap', action: 'Fermer les panneaux / Quitter plein écran' },
                    { key: '← / →', action: 'Naviguer entre les nœuds' },
                    { key: 'F', action: 'Basculer en plein écran' },
                    { key: 'R', action: 'Réinitialiser la vue' },
                    { key: 'L', action: 'Ouvrir le menu des calques' },
                    { key: 'S', action: 'Capturer l\'écran' },
                ].map(item => (
                    <div key={item.key} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                        <span className="text-xs text-muted-foreground">{item.action}</span>
                        <kbd className="px-2 py-1 rounded bg-slate-800 text-xs font-mono text-white">{item.key}</kbd>
                    </div>
                ))}
            </div>
        )
    },
    {
        id: 'search',
        title: 'Recherche Rapide',
        subtitle: 'Trouvez instantanément',
        icon: Search,
        content: (
            <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-800/50 border border-white/10">
                    <div className="flex items-center gap-3 mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Rechercher un nœud...</span>
                        <kbd className="ml-auto px-2 py-0.5 rounded bg-white/10 text-[10px] text-muted-foreground">
                            <Command className="w-3 h-3 inline" />K
                        </kbd>
                    </div>
                    <p className="text-xs text-slate-500">
                        Tapez le nom d'un actif, risque, projet ou tout autre élément pour le localiser et le sélectionner instantanément dans la vue 3D.
                    </p>
                </div>
                <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <p className="text-xs text-indigo-300">
                        <strong>Conseil Pro :</strong> La recherche fonctionne aussi par type. Tapez "risque" pour voir tous les risques.
                    </p>
                </div>
            </div>
        )
    },
];

export const VoxelGuide: React.FC<VoxelGuideProps> = ({ isOpen, onClose }) => {
    const [currentSection, setCurrentSection] = useState(0);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'ArrowRight') setCurrentSection(prev => Math.min(prev + 1, GUIDE_SECTIONS.length - 1));
        if (e.key === 'ArrowLeft') setCurrentSection(prev => Math.max(prev - 1, 0));
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, handleKeyDown]);

    const section = GUIDE_SECTIONS[currentSection];
    const Icon = section?.icon || HelpCircle;

    // Reset section when modal closes (will be 0 when reopened due to fresh useState)
    // Using key on the wrapper to reset state when isOpen changes from false to true
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100010] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
                    >
                        {/* Progress */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
                            <motion.div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${((currentSection + 1) / GUIDE_SECTIONS.length) * 100}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>

                        {/* Header */}
                        <div className="p-5 border-b border-white/10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                        <Icon className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-white">{section.title}</h2>
                                        <p className="text-xs text-muted-foreground">{section.subtitle}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-5 max-h-[50vh] overflow-y-auto">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentSection}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {section.content}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Footer Navigation */}
                        <div className="p-4 border-t border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-1">
                                {GUIDE_SECTIONS.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentSection(idx)}
                                        className={`w-2 h-2 rounded-full transition-all ${idx === currentSection
                                            ? 'w-6 bg-indigo-500'
                                            : 'bg-white/20 hover:bg-white/40'
                                            }`}
                                    />
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentSection(prev => Math.max(prev - 1, 0))}
                                    disabled={currentSection === 0}
                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                {currentSection === GUIDE_SECTIONS.length - 1 ? (
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
                                    >
                                        Commencer
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setCurrentSection(prev => Math.min(prev + 1, GUIDE_SECTIONS.length - 1))}
                                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Keyboard hint */}
                        <div className="px-4 pb-3 text-center">
                            <span className="text-[11px] text-slate-500">
                                Utilisez ← → pour naviguer, Échap pour fermer
                            </span>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
