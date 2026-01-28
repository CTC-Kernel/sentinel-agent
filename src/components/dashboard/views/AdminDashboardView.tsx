import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WidgetLayout, useDashboardPreferences } from '../../../hooks/useDashboardPreferences';
import { Plus } from '../../../components/ui/Icons';
import { useStore } from '../../../store';
import { AddWidgetModal } from '../configurable/AddWidgetModal';
import { WIDGET_REGISTRY, WidgetId } from '../configurable/WidgetRegistry';
import { StatsHistoryEntry, Risk } from '../../../types';
import { Button } from '../../../components/ui/button';
import { ConfigurableDashboardGrid } from '../configurable/ConfigurableDashboardGrid';

interface DashboardStats {
    totalRisks: number;
    criticalRisks: number;
    highRisks: number;
    openIncidents: number;
    complianceRate: number;
    compliance: number;
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
    incidents?: unknown[];
    complianceScore?: number;
    suppliers?: unknown[];
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = (props) => {
    const { user } = useStore();

    // Default Admin Layout - Radar at Top!
    // Default Admin Layout - AI Stats First, then Maturity Radar
    const defaultLayout: WidgetLayout[] = [
        { id: 'stats-1', widgetId: 'stats-overview', colSpan: 2 }, // Top Left (First module - AI Summary)
        { id: 'maturity-1', widgetId: 'maturity-radar', colSpan: 1 }, // Top Right (Next to it)
        { id: 'workspace-1', widgetId: 'my-workspace', colSpan: 2 }, // Row 2 Left
        { id: 'risks-1', widgetId: 'priority-risks', colSpan: 1 }, // Row 2 Right
        { id: 'history-1', widgetId: 'compliance-evolution', colSpan: 2 }, // Row 3 Left
        { id: 'activity-1', widgetId: 'recent-activity', colSpan: 1 }, // Row 3 Right
        { id: 'nis2-1', widgetId: 'nis2-dora-kpi', colSpan: 1 }, // Row 4
    ];

    const { layout, updateLayout, resetLayout } = useDashboardPreferences(user?.uid, user?.organizationId, 'admin', defaultLayout);
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
        <div className="space-y-6 animate-fade-in relative z-10 text-balance">

            {/* Edit Mode Actions Header */}
            <AnimatePresence>
                {props.isEditing && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex justify-end gap-3 mb-6"
                    >
                        <Button
                            onClick={resetLayout}
                            variant="glass"
                            className="px-4 py-2 rounded-3xl font-bold transition-all text-sm"
                        >
                            {props.t('common.reset')}
                        </Button>

                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Button
                                onClick={() => setIsAddWidgetModalOpen(true)}
                                variant="premium"
                                className="px-4 py-2 rounded-3xl font-black uppercase tracking-wider flex items-center gap-2 text-sm"
                            >
                                <Plus className="w-4 h-4" /> <span>{props.t('dashboard.addWidget')}</span>
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ConfigurableDashboardGrid
                layout={layout}
                onLayoutChange={updateLayout}
                isEditing={!!props.isEditing}
                widgetProps={props as unknown as Record<string, unknown>}
            />

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
