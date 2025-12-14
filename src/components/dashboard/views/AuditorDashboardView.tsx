import React from 'react';
import { MyWorkspaceWidget } from '../widgets/MyWorkspaceWidget';
import { ComplianceEvolutionWidget } from '../widgets/ComplianceEvolutionWidget';
import { RecentActivityWidget } from '../widgets/RecentActivityWidget';
import { HealthCheckWidget } from '../widgets/HealthCheckWidget';

type ActionItemList = React.ComponentProps<typeof MyWorkspaceWidget>['myActionItems'];
type HistoryData = React.ComponentProps<typeof ComplianceEvolutionWidget>['historyData'];
type ActivityList = React.ComponentProps<typeof RecentActivityWidget>['recentActivity'];
type HealthIssueList = React.ComponentProps<typeof HealthCheckWidget>['healthIssues'];

interface AuditorDashboardViewProps {
    loading: boolean;
    navigate: (path: string) => void;
    t: (key: string) => string;
    theme: string;
    myActionItems: ActionItemList;
    historyData: HistoryData;
    recentActivity: ActivityList;
    healthIssues: HealthIssueList;
}

export const AuditorDashboardView: React.FC<AuditorDashboardViewProps> = ({
    loading, navigate, t, theme, myActionItems, historyData, recentActivity, healthIssues
}) => {
    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <MyWorkspaceWidget myActionItems={myActionItems} loading={loading} navigate={navigate} t={t} />
                </div>
                <div className="lg:col-span-1">
                    <ComplianceEvolutionWidget historyData={historyData} loading={loading} t={t} theme={theme} />
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RecentActivityWidget recentActivity={recentActivity} loading={loading} t={t} />
                <HealthCheckWidget healthIssues={healthIssues} loading={loading} navigate={navigate} t={t} />
            </div>
        </>
    );
};
