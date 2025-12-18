import React from 'react';
import { useActivityLogs } from '../hooks/useActivityLogs';
import { ActivityLogList } from '../components/activity/ActivityLogList';
import { PageHeader } from '../components/ui/PageHeader';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { Activity, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { slideUpVariants } from '../components/ui/animationVariants';

export const ActivityLogs: React.FC = () => {
    const { logs, loading, hasMore, loadMore, refresh } = useActivityLogs();

    return (
        <div className="relative min-h-screen">
            <MasterpieceBackground />
            <div className="relative z-10 p-6 md:p-8 space-y-8 max-w-[1920px] mx-auto">
                <PageHeader
                    title="Journal d'Activité"
                    subtitle="Traçabilité complète des actions utilisateurs et système pour la conformité ISO 27001."
                    icon={<Activity className="h-6 w-6 text-white" />}
                    actions={
                        <button
                            onClick={refresh}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"
                            title="Actualiser"
                        >
                            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    }
                />

                <motion.div
                    variants={slideUpVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-6"
                >
                    <div className="glass-panel p-6 rounded-2xl">
                        <ActivityLogList
                            logs={logs}
                            loading={loading}
                            hasMore={hasMore}
                            onLoadMore={loadMore}
                        />
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
