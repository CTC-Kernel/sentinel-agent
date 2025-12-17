import React from 'react';

// Import all widgets
import { StatsOverview } from '../widgets/StatsOverview';
import { MyWorkspaceWidget } from '../widgets/MyWorkspaceWidget';
import { ComplianceEvolutionWidget } from '../widgets/ComplianceEvolutionWidget';
import { HealthCheckWidget } from '../widgets/HealthCheckWidget';
import { PriorityRisksWidget } from '../widgets/PriorityRisksWidget';
import { RecentActivityWidget } from '../widgets/RecentActivityWidget';
import { MaturityRadarWidget } from '../widgets/MaturityRadarWidget';
import { CyberNewsWidget } from '../CyberNewsWidget';
import { RiskHeatmapWidget } from '../widgets/RiskHeatmapWidget';
import { AuditsDonutWidget } from '../widgets/AuditsDonutWidget';
import { ProjectTasksWidget } from '../widgets/ProjectTasksWidget';
import { IncidentsStatsWidget } from '../widgets/IncidentsStatsWidget';
import { DocumentsStatsWidget } from '../widgets/DocumentsStatsWidget';
import { ComplianceProgressWidget } from '../widgets/ComplianceProgressWidget';
import { AssetStatsWidget } from '../widgets/AssetStatsWidget';
import { SuppliersStatsWidget } from '../widgets/SuppliersStatsWidget';
import { ContinuityPlansWidget } from '../widgets/ContinuityPlansWidget';

// Define generic props for widgets
export type DashboardWidgetProps = Record<string, unknown>;

// Define the Registry
// This maps a string ID to the Component and its implicit Grid sizing
export const WIDGET_REGISTRY: Record<string, {
    id?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: React.ComponentType<any>; // Keep ComponentType<any> to allow diverse widgets, but we could narrow if possible
    defaultColSpan: 1 | 2 | 3;
    defaultRowSpan?: number;
    minColSpan?: number;
    minRowSpan?: number;
    titleKey: string; // for the "Add Widget" menu
}> = {
    'stats-overview': {
        component: StatsOverview,
        defaultColSpan: 3,
        titleKey: 'dashboard.statsOverview'
    },
    'my-workspace': {
        component: MyWorkspaceWidget,
        defaultColSpan: 2,
        titleKey: 'dashboard.myWorkspace'
    },
    'compliance-evolution': {
        component: ComplianceEvolutionWidget,
        defaultColSpan: 2,
        titleKey: 'dashboard.complianceEvolution'
    },
    'health-check': {
        component: HealthCheckWidget,
        defaultColSpan: 1,
        titleKey: 'dashboard.healthCheck'
    },
    'priority-risks': {
        component: PriorityRisksWidget,
        defaultColSpan: 1,
        titleKey: 'dashboard.priorityRisks'
    },
    'recent-activity': {
        component: RecentActivityWidget,
        defaultColSpan: 1,
        titleKey: 'dashboard.recentActivity'
    },
    'maturity-radar': {
        component: MaturityRadarWidget,
        defaultColSpan: 1,
        titleKey: 'dashboard.maturityRadar'
    },
    'cyber-news': {
        component: CyberNewsWidget,
        defaultColSpan: 1,
        titleKey: 'dashboard.cyberNews'
    },
    'risk-heatmap': {
        component: RiskHeatmapWidget,
        defaultColSpan: 1,
        titleKey: 'dashboard.riskHeatmap'
    },
    'audits-donut': {
        component: AuditsDonutWidget,
        defaultColSpan: 1,
        titleKey: 'dashboard.auditsStatus'
    },
    'project-tasks': {
        id: 'project-tasks',
        component: ProjectTasksWidget,
        defaultColSpan: 1,
        defaultRowSpan: 1,
        minColSpan: 1,
        minRowSpan: 1,
        titleKey: 'dashboard.projectStatus'
    },
    'incidents-stats': {
        id: 'incidents-stats',
        titleKey: 'dashboard.incidentsStats',
        component: IncidentsStatsWidget,
        defaultColSpan: 1,
        defaultRowSpan: 1,
        minColSpan: 1,
        minRowSpan: 1
    },
    'documents-stats': {
        id: 'documents-stats',
        titleKey: 'dashboard.documentsStats',
        component: DocumentsStatsWidget,
        defaultColSpan: 1,
        defaultRowSpan: 1,
        minColSpan: 1,
        minRowSpan: 1
    },
    'compliance-progress': {
        id: 'compliance-progress',
        titleKey: 'dashboard.complianceProgress',
        component: ComplianceProgressWidget,
        defaultColSpan: 1,
        defaultRowSpan: 1,
        minColSpan: 1,
        minRowSpan: 1
    },
    'asset-stats': {
        id: 'asset-stats',
        titleKey: 'dashboard.assetStats',
        component: AssetStatsWidget,
        defaultColSpan: 1,
        defaultRowSpan: 1,
        minColSpan: 1,
        minRowSpan: 1
    },
    'suppliers-stats': {
        id: 'suppliers-stats',
        titleKey: 'dashboard.suppliersStats',
        component: SuppliersStatsWidget,
        defaultColSpan: 1,
        defaultRowSpan: 1,
        minColSpan: 1,
        minRowSpan: 1
    },
    'continuity-plans': {
        id: 'continuity-plans',
        titleKey: 'dashboard.continuityPlans',
        component: ContinuityPlansWidget,
        defaultColSpan: 1,
        defaultRowSpan: 1,
        minColSpan: 1,
        minRowSpan: 1
    }
};
export type WidgetId = keyof typeof WIDGET_REGISTRY;
