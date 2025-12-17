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

// Define the Registry
// This maps a string ID to the Component and its implicit Grid sizing
export const WIDGET_REGISTRY: Record<string, {
    component: React.ComponentType<any>;
    defaultColSpan: 1 | 2 | 3;
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
    }
};

export type WidgetId = keyof typeof WIDGET_REGISTRY;
