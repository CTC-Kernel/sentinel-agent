import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { AlertTriangle, Home } from '../components/ui/Icons';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { Button } from '../components/ui/button';
import { slideUpVariants } from '../components/ui/animationVariants';
import { FeedbackModal } from '../components/ui/FeedbackModal';

export const NotFound: React.FC = () => {
    const [showFeedback, setShowFeedback] = React.useState(false);

    return (
        <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center">
            <MasterpieceBackground />

            <motion.div
                variants={slideUpVariants}
                initial="initial"
                animate="visible"
                className="relative z-10 glass-panel p-12 md:p-16 rounded-[2.5rem] max-w-lg w-full mx-6 text-center shadow-2xl border border-white/40 dark:border-white/5"
            >
                <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-white/10 flex items-center justify-center mx-auto mb-8 text-slate-500 shadow-inner">
                    <AlertTriangle className="h-10 w-10" />
                </div>

                <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 mb-4 font-display tracking-tighter">
                    404
                </h1>

                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">
                    Page introuvable
                </h2>

                <p className="text-slate-600 dark:text-slate-400 mb-10 text-lg leading-relaxed">
                    Désolé, la page que vous recherchez semble avoir été déplacée, supprimée ou n'a jamais existé.
                </p>

                <div className="flex flex-col gap-4">
                    <Button asChild className="w-full text-base py-6 rounded-xl font-bold shadow-lg shadow-brand-500/20 hover:shadow-brand-500/40 transition-all duration-300">
                        <Link to="/">
                            <Home className="mr-2 h-5 w-5" />
                            Retour au Tableau de Bord
                        </Link>
                    </Button>
                    <div className="grid grid-cols-2 gap-4">
                        <Button
                            variant="ghost"
                            onClick={() => window.history.back()}
                            className="w-full text-base py-4 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                        >
                            Retour
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setShowFeedback(true)}
                            className="w-full text-base py-4 rounded-xl font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
                        >
                            Signaler
                        </Button>
                    </div>
                </div>
            </motion.div>
            <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} />
        </div>
    );
};
