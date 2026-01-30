import React from 'react';
import { WidgetLayout, useDashboardPreferences } from '../../../hooks/useDashboardPreferences';
import { useStore } from '../../../store';
import { AddWidgetModal } from '../configurable/AddWidgetModal';
import { WIDGET_REGISTRY, WidgetId } from '../configurable/WidgetRegistry';
import { StatsHistoryEntry, Risk } from '../../../types';
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
    isAddWidgetModalOpen?: boolean;
    setIsAddWidgetModalOpen?: (isOpen: boolean) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = (props) => {
    const { user } = useStore();
    const { isAddWidgetModalOpen, setIsAddWidgetModalOpen } = props;

    // Default Admin Layout - AI Stats First, then Maturity Radar
    const defaultLayout: WidgetLayout[] = [
        { id: 'stats-1', widgetId: 'stats-overview', colSpan: 2 },
        { id: 'maturity-1', widgetId: 'maturity-radar', colSpan: 1 },
        { id: 'workspace-1', widgetId: 'my-workspace', colSpan: 2 },
        { id: 'risks-1', widgetId: 'priority-risks', colSpan: 1 },
        { id: 'history-1', widgetId: 'compliance-evolution', colSpan: 2 },
        { id: 'activity-1', widgetId: 'recent-activity', colSpan: 1 },
        { id: 'nis2-1', widgetId: 'nis2-dora-kpi', colSpan: 1 },
        { id: 'agent-maturity-1', widgetId: 'agent-maturity-radar', colSpan: 1 },
    ];

    const { layout, updateLayout, resetLayout } = useDashboardPreferences(user?.uid, user?.organizationId, 'admin', defaultLayout);

    const handleAddWidget = (widgetId: WidgetId) => {
        const widgetConfig = WIDGET_REGISTRY[widgetId];
        if (!widgetConfig) return;

        const newWidgetLayout = {
            id: `${widgetId}-${Date.now()}`,
            widgetId: widgetId,
            colSpan: widgetConfig.defaultColSpan || 1
        };

        updateLayout([...layout, newWidgetLayout]);
    };

    return (
        <div className="space-y-6 animate-fade-in relative z-10 text-balance">
            <ConfigurableDashboardGrid
                layout={layout}
                onLayoutChange={updateLayout}
                isEditing={!!props.isEditing}
                widgetProps={props as unknown as Record<string, unknown>}
            />

            <AddWidgetModal
                isOpen={!!isAddWidgetModalOpen}
                onClose={() => setIsAddWidgetModalOpen?.(false)}
                onAdd={handleAddWidget}
                onReset={resetLayout}
                currentWidgetIds={layout.map(w => w.widgetId)}
            />
        </div>
    );
};

// Headless UI handles FocusTrap and keyboard navigation
