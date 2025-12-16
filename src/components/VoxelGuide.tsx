import React from 'react';
import { X, Map, Share2, Zap, ArrowRight, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VoxelGuideProps {
    isOpen: boolean;
    onClose: () => void;
}

export const VoxelGuide: React.FC<VoxelGuideProps> = ({ isOpen, onClose }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
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
                                        <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                            <Activity className="w-6 h-6" />
                                        </div>
                                        <span className="text-xs font-bold tracking-[0.2em] text-indigo-400 uppercase">CTC Engine</span>
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-2">Votre Centre de Commandement</h2>
                                    <p className="text-slate-500 text-sm max-w-md">
                                        Une interface neuro-spatiale conçue pour transformer la complexité GRC en décisions stratégiques immédiates.
                                    </p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
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
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    Une <span className="text-slate-200">carte unifiée</span> de votre territoire numérique. Vos actifs sont les fondations, vos projets les blocs, et vos risques les menaces en lévitation.
                                </p>
                            </div>

                            {/* Card 2 */}
                            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group">
                                <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                    <Share2 className="w-5 h-5" />
                                </div>
                                <h3 className="text-white font-semibold mb-2">Liens Invisibles</h3>
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    Révélez les <span className="text-slate-200">dépendances cachées</span>. Suivez les flux de données pour comprendre comment l'arrêt d'un actif critique impacte toute la chaîne.
                                </p>
                            </div>

                            {/* Card 3 */}
                            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group">
                                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                    <Zap className="w-5 h-5" />
                                </div>
                                <h3 className="text-white font-semibold mb-2">Radar de Priorité</h3>
                                <p className="text-xs text-slate-500 leading-relaxed">
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
                                className="flex items-center gap-2 px-6 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all hover:shadow-[0_0_20px_rgba(79,70,229,0.3)]"
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
