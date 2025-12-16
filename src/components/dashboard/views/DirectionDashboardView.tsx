import React from 'react';
import { StatsOverview } from '../widgets/StatsOverview';
import { ComplianceEvolutionWidget } from '../widgets/ComplianceEvolutionWidget';
import { PriorityRisksWidget } from '../widgets/PriorityRisksWidget';
import { HealthCheckWidget } from '../widgets/HealthCheckWidget';
import { CyberNewsWidget } from '../CyberNewsWidget';

type Stats = React.ComponentProps<typeof StatsOverview>['stats'];
type HistoryData = React.ComponentProps<typeof ComplianceEvolutionWidget>['historyData'];
type HealthIssueList = React.ComponentProps<typeof HealthCheckWidget>['healthIssues'];
type RiskList = React.ComponentProps<typeof PriorityRisksWidget>['topRisks'];

interface DirectionDashboardViewProps {
    stats: Stats;
    loading: boolean;
    navigate: (path: string) => void;
    t: (key: string) => string;
    theme: string;
    historyData: HistoryData;
    healthIssues: HealthIssueList;
    topRisks: RiskList;
}

export const DirectionDashboardView: React.FC<DirectionDashboardViewProps> = ({
    stats, loading, navigate, t, theme, historyData, healthIssues, topRisks
}) => {
    return (
        <>
            <StatsOverview stats={stats} loading={loading} navigate={navigate} t={t} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ComplianceEvolutionWidget historyData={historyData} loading={loading} t={t} theme={theme} />
                <PriorityRisksWidget topRisks={topRisks} loading={loading} navigate={navigate} t={t} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <HealthCheckWidget healthIssues={healthIssues} loading={loading} navigate={navigate} t={t} />
                </div>
                <div className="lg:col-span-1">
                    <CyberNewsWidget />
                </div>
            </div>
        </>
    );
};
