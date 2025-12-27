import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WidgetLayout, useDashboardPreferences } from '../../../hooks/useDashboardPreferences';
import { Plus } from '../../../components/ui/Icons';
import { useStore } from '../../../store';
import { ConfigurableDashboardGrid } from '../configurable/ConfigurableDashboardGrid';
import { AddWidgetModal } from '../configurable/AddWidgetModal';
import { WIDGET_REGISTRY, WidgetId } from '../configurable/WidgetRegistry';
import { StatsHistoryEntry, Risk } from '../../../types';

interface DashboardStats {
    totalRisks: number;
    criticalRisks: number;
    highRisks: number;
    openIncidents: number;
    complianceRate: number;
    totalAssets: number;
    activeProjects: number;
}

interface AdminDashboardViewProps {
    stats: DashboardStats;
    loading: boolean;
    navigate: (path: string) => void;
    t: (key: string) => string;
    theme: string;
    myActionItems: unknown[];
    historyData: StatsHistoryEntry[];
    healthIssues: unknown[];
    topRisks: Risk[];
    recentActivity: unknown[];
    radarData: unknown[];
    isEditing?: boolean;
    onLayoutUpdate?: (layout: WidgetLayout[]) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = (props) => {
    const { user } = useStore();

    // Default Admin Layout
    const defaultLayout = [
        { id: 'stats-1', widgetId: 'stats-overview', colSpan: 3 },
        { id: 'workspace-1', widgetId: 'my-workspace', colSpan: 2 },
        { id: 'maturity-1', widgetId: 'maturity-radar', colSpan: 1 }, // Moving radar up as right column
        { id: 'history-1', widgetId: 'compliance-evolution', colSpan: 2 },
        { id: 'health-1', widgetId: 'health-check', colSpan: 1 },
        { id: 'activity-1', widgetId: 'recent-activity', colSpan: 1 },
        { id: 'risks-1', widgetId: 'priority-risks', colSpan: 1 },
        { id: 'news-1', widgetId: 'cyber-news', colSpan: 1 },
    ];

    const { layout, updateLayout, resetLayout } = useDashboardPreferences(user?.uid, 'admin', defaultLayout);
    const [isAddWidgetModalOpen, setIsAddWidgetModalOpen] = React.useState(false);

    const handleAddWidget = (widgetId: WidgetId) => {
        const widgetConfig = WIDGET_REGISTRY[widgetId];
        if (!widgetConfig) return;

        // Find a suitable position (basic logic: append to end)
        const newWidgetLayout = {
            id: `${widgetId}-${Date.now()}`,
            widgetId: widgetId,
            colSpan: widgetConfig.defaultColSpan || 1
        };

        updateLayout([...layout, newWidgetLayout]);
    };

    return (
        <motion.div
            initial="initial"
            animate="visible"
            className="space-y-6"
        >
            <ConfigurableDashboardGrid
                layout={layout}
                onLayoutChange={updateLayout}
                isEditing={props.isEditing || false}
                widgetProps={props as unknown as Record<string, unknown>}
            />

            {/* Add Widget Button (Only visible in Edit Mode) */}
            <AnimatePresence>
                {props.isEditing && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex gap-4"
                    >
                        <button
                            onClick={resetLayout}
                            className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-6 py-3 rounded-full shadow-xl font-bold border border-slate-200 dark:border-slate-700 hover:scale-105 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                        >
                            {props.t('common.reset')}
                        </button>

                        <motion.button
                            onClick={() => setIsAddWidgetModalOpen(true)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="bg-brand-600 text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 border border-brand-500 hover:bg-brand-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        >
                            <Plus className="w-5 h-5" /> <span>{props.t('dashboard.addWidget')}</span>
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>

            <AddWidgetModal
                isOpen={isAddWidgetModalOpen}
                onClose={() => setIsAddWidgetModalOpen(false)}
                onAdd={handleAddWidget}
                currentWidgetIds={layout.map(w => w.widgetId)}
            />
        </motion.div>
    );
};
