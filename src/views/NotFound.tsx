import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Home } from '../components/ui/Icons';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { Button } from '../components/ui/button';
import { slideUpVariants } from '../components/ui/animationVariants';
import { FeedbackModal } from '../components/ui/FeedbackModal';
import { useStore } from '../store';

export const NotFound: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useStore();
    const [showFeedback, setShowFeedback] = React.useState(false);

    return (
        <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center">
            <MasterpieceBackground />

            <motion.div
                variants={slideUpVariants}
                initial="initial"
                animate="visible"
                className="relative z-10 glass-premium p-12 md:p-16 rounded-3xl max-w-lg w-full mx-6 text-center shadow-apple dark:shadow-2xl overflow-hidden"
            >
                <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-white/10 flex items-center justify-center mx-auto mb-8 text-slate-500 dark:text-slate-300 shadow-inner">
                    <AlertTriangle className="h-10 w-10" />
                </div>

                <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 mb-4 font-display tracking-tighter">
                    404
                </h1>

                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 dark:text-white mb-4">
                    {t('notFound.title')}
                </h2>

                <p className="text-slate-600 dark:text-muted-foreground mb-10 text-lg leading-relaxed">
                    {t('notFound.description')}
                </p>

                <div className="flex flex-col gap-4">
                    <Button
                        onClick={() => navigate('/')}
                        className="w-full text-base py-6 rounded-xl font-bold shadow-lg shadow-brand-500/20 hover:shadow-brand-500/40 transition-all duration-300"
                    >
                        <Home className="mr-2 h-5 w-5" />
                        {t('notFound.backToDashboard')}
                    </Button>
                    <div className="grid grid-cols-2 gap-4">
                        <Button
                            variant="ghost"
                            onClick={() => window.history.back()}
                            className="w-full text-base py-4 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                        >
                            {t('common.back')}
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setShowFeedback(true)}
                            className="w-full text-base py-4 rounded-xl font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                        >
                            {t('notFound.report')}
                        </Button>
                    </div>
                </div>
            </motion.div>
            <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} />
        </div>
    );
};

// Headless UI handles FocusTrap and keyboard navigation
