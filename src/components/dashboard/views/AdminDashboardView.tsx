import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WidgetLayout, useDashboardPreferences } from '../../../hooks/useDashboardPreferences';
import { Plus, Activity } from '../../../components/ui/Icons';
import { useStore } from '../../../store';
import { DashboardStats } from '../widgets/DashboardStats';
import { ComplianceEvolutionWidget } from '../widgets/ComplianceEvolutionWidget';
import { PriorityRisksWidget } from '../widgets/PriorityRisksWidget';
import { RecentActivityWidget } from '../widgets/RecentActivityWidget';

import { AddWidgetModal } from '../configurable/AddWidgetModal';
import { WIDGET_REGISTRY, WidgetId } from '../configurable/WidgetRegistry';
import { StatsHistoryEntry, Risk } from '../../../types';
import { Button } from '../../../components/ui/button';

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

    // Placeholder for activeWidgets and renderWidget to make the bento grid syntactically correct
    // In a real application, these would be properly defined based on the layout and WIDGET_REGISTRY
    const activeWidgets = layout; // Using the existing layout as activeWidgets
    const renderWidget = (widget: WidgetLayout) => {
        const WidgetComponent = WIDGET_REGISTRY[widget.widgetId]?.component;
        if (!WidgetComponent) return <div>Unknown Widget: {widget.widgetId}</div>;
        return <WidgetComponent {...props as unknown as Record<string, unknown>} />;
    };

    const renderBentoGrid = () => {
        // Bento Grid Logic:
        // We want a fluid masonry-like grid where some items span 2 cols or 2 rows
        // For simplicity and stability, we define a fixed layout for main items and flow rest

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-max">
                {/* Hero Stats - Spans 2 cols, 1 row */}
                <div className="col-span-1 md:col-span-2 row-span-1 glass-premium rounded-[2.5rem] p-1 overflow-hidden group hover:shadow-glow transition-all duration-500">
                    <DashboardStats
                        stats={{
                            activeIncidents: props.stats.openIncidents,
                            highRisks: props.stats.highRisks,
                            financialRisk: 0, // Default or calculate from somewhere
                            assetValue: 0, // Default or calculate
                            compliance: props.stats.complianceRate
                        }}
                        loading={props.loading}
                        navigate={props.navigate}
                        t={props.t}
                    />
                </div>

                {/* Status Card - 1x1 */}
                <div className="col-span-1 glass-premium rounded-[2.5rem] p-6 relative overflow-hidden group hover:shadow-apple-xl transition-all duration-500">
                    <div className="absolute top-0 right-0 p-4 opacity-50"><Activity className="w-24 h-24 text-brand-500/10" /></div>
                    <h3 className="text-lg font-bold mb-1 font-display">Conformité</h3>
                    <div className="mt-4 h-[120px]">
                        <ComplianceEvolutionWidget
                            historyData={props.historyData.map(h => ({ date: h.date, compliance: h.metrics.complianceRate }))}
                            loading={props.loading}
                            t={props.t}
                            theme={props.theme}
                        />
                    </div>
                </div>

                {/* Risks - Spans 1 col, 2 rows (Tall) */}
                <div className="col-span-1 row-span-2 glass-premium rounded-[2.5rem] p-1 overflow-hidden group hover:shadow-apple-xl transition-all duration-500 relative">
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl" />
                    <PriorityRisksWidget
                        topRisks={props.topRisks}
                        loading={props.loading}
                        navigate={props.navigate}
                        t={props.t}
                    />
                </div>

                {/* Activity Feed - Spans 2 cols on LG */}
                <div className="col-span-1 md:col-span-2 lg:col-span-2 glass-premium rounded-[2.5rem] p-1 overflow-hidden group hover:shadow-apple-xl transition-all duration-500 max-h-[400px]">
                    <RecentActivityWidget
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        recentActivity={props.recentActivity as any[]}
                        loading={props.loading}
                        t={props.t}
                    />
                </div>

                {/* Extra Widgets Flow */}
                {activeWidgets.filter(w => !['stats-overview', 'compliance-evolution', 'priority-risks', 'recent-activity'].includes(w.widgetId)).map(widget => (
                    <div key={widget.id} className="col-span-1 glass-premium rounded-[2.5rem] p-1 overflow-hidden group hover:shadow-apple-xl transition-all duration-500">
                        {renderWidget(widget)}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-fade-in relative z-10 text-balance">
            {renderBentoGrid()}

            {/* Add Widget Button (Only visible in Edit Mode) */}
            <AnimatePresence>
                {props.isEditing && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex gap-4"
                    >
                        <Button
                            onClick={resetLayout}
                            variant="secondary"
                            className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-6 py-6 rounded-full shadow-xl font-bold border border-slate-200 dark:border-slate-700 hover:scale-105 transition-all text-sm"
                        >
                            {props.t('common.reset')}
                        </Button>

                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Button
                                onClick={() => setIsAddWidgetModalOpen(true)}
                                className="bg-brand-600 text-white px-6 py-6 rounded-full shadow-xl font-bold flex items-center gap-2 border border-brand-500 hover:bg-brand-700 transition-colors text-sm"
                            >
                                <Plus className="w-5 h-5" /> <span>{props.t('dashboard.addWidget')}</span>
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AddWidgetModal
                isOpen={isAddWidgetModalOpen}
                onClose={() => setIsAddWidgetModalOpen(false)}
                onAdd={handleAddWidget}
                currentWidgetIds={layout.map(w => w.widgetId)}
            />
        </div>
    );
};

// Headless UI handles FocusTrap and keyboard navigation
