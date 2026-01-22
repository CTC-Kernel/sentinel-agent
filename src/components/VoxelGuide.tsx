import React, { useEffect, useCallback } from 'react';
import { X, Map, Share2, Zap, ArrowRight, Activity } from './ui/Icons';
import { motion, AnimatePresence } from 'framer-motion';

interface VoxelGuideProps {
    isOpen: boolean;
    onClose: () => void;
}

export const VoxelGuide: React.FC<VoxelGuideProps> = ({ isOpen, onClose }) => {
    // Keyboard navigation: close on Escape
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, handleKeyDown]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="voxel-guide-title"
                >
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        onKeyDown={(e) => e.key === 'Enter' && onClose()}
                        role="button"
                        tabIndex={0}
                        aria-label="Fermer le guide"
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-2xl bg-slate-950/90 border border-white/10 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl"
                    >
                        {/* Header */}
                        <div className="relative p-8 pb-0 overflow-hidden">
                            <div className="absolute top-0 right-0 p-6 pointer-events-none">
                                <div className="w-32 h-32 bg-indigo-500/20 blur-[60px] rounded-full"></div>
                            </div>
                            <div className="absolute top-0 left-0 p-6 pointer-events-none">
                                <div className="w-24 h-24 bg-rose-500/10 blur-[50px] rounded-full"></div>
                            </div>

                            <div className="flex items-start justify-between relative z-10">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30">
                                            <Activity className="w-6 h-6" />
                                        </div>
                                        <span className="text-xs font-bold tracking-[0.2em] text-brand-400 uppercase">CTC Engine</span>
                                    </div>
                                    <h2 id="voxel-guide-title" className="text-2xl font-bold text-white mb-2">Votre Centre de Commandement</h2>
                                    <p className="text-slate-500 text-sm max-w-md">
                                        Une interface neuro-spatiale conçue pour transformer la complexité GRC en décisions stratégiques immédiates.
                                    </p>
                                </div>
                                <button
                                    onClick={onClose}
                                    aria-label="Fermer le guide Voxel"
                                    className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Content Grid */}
                        <div className="grid md:grid-cols-3 gap-4 p-8">
                            {/* Card 1 */}
                            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                    <Map className="w-5 h-5" />
                                </div>
                                <h3 className="text-white font-semibold mb-2">Topologie Stratégique</h3>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    Une <span className="text-slate-200">carte unifiée</span> de votre territoire numérique. Vos actifs sont les fondations, vos projets les blocs, et vos risques les menaces en lévitation.
                                </p>
                            </div>

                            {/* Card 2 */}
                            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group">
                                <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                    <Share2 className="w-5 h-5" />
                                </div>
                                <h3 className="text-white font-semibold mb-2">Liens Invisibles</h3>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    Révélez les <span className="text-slate-200">dépendances cachées</span>. Suivez les flux de données pour comprendre comment l'arrêt d'un actif critique impacte toute la chaîne.
                                </p>
                            </div>

                            {/* Card 3 */}
                            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group">
                                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                    <Zap className="w-5 h-5" />
                                </div>
                                <h3 className="text-white font-semibold mb-2">Radar de Priorité</h3>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    Ne cherchez plus l'urgence : elle pulse en rouge. <span className="text-slate-200">Taille et couleur</span> dictent l'action. Identifiez vos Quick Wins en une seconde.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-white/5 border-t border-white/10 flex items-center justify-between">
                            <span className="text-xs text-slate-600">
                                Propulsé par le moteur de rendu Sentinel Core™
                            </span>
                            <button
                                onClick={onClose}
                                aria-label="Explorer la matrice et fermer le guide"
                                className="flex items-center gap-2 px-6 py-2 rounded-full bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-all hover:shadow-[0_0_20px_rgba(79,70,229,0.3)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                            >
                                Explorer la matrice <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
