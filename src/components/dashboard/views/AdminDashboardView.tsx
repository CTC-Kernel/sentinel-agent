import React from 'react';
import { StatsOverview } from '../widgets/StatsOverview';
import { MyWorkspaceWidget } from '../widgets/MyWorkspaceWidget';
import { ComplianceEvolutionWidget } from '../widgets/ComplianceEvolutionWidget';
import { HealthCheckWidget } from '../widgets/HealthCheckWidget';
import { PriorityRisksWidget } from '../widgets/PriorityRisksWidget';
import { RecentActivityWidget } from '../widgets/RecentActivityWidget';
import { CyberNewsWidget } from '../CyberNewsWidget';
import { StaggerContainer, SlideUp } from '../../ui/Animations';

interface AdminDashboardViewProps {
    stats: any;
    loading: boolean;
    navigate: (path: string) => void;
    t: (key: string) => string;
    theme: string;
    myActionItems: any[];
    historyData: any[];
    healthIssues: any[];
    topRisks: any[];
    recentActivity: any[];
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
    stats, loading, navigate, t, theme, myActionItems, historyData, healthIssues, topRisks, recentActivity
}) => {
    return (
        <StaggerContainer className="space-y-6">
            <SlideUp>
                <StatsOverview stats={stats} loading={loading} navigate={navigate} t={t} />
            </SlideUp>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <SlideUp className="col-span-1">
                    <MyWorkspaceWidget myActionItems={myActionItems} loading={loading} navigate={navigate} t={t} />
                </SlideUp>
                <SlideUp className="col-span-1 lg:col-span-2">
                    <ComplianceEvolutionWidget historyData={historyData} loading={loading} t={t} theme={theme} />
                </SlideUp>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <SlideUp className="col-span-1">
                    <HealthCheckWidget healthIssues={healthIssues} loading={loading} navigate={navigate} t={t} />
                </SlideUp>
                <SlideUp className="col-span-1 lg:col-span-2">
                    <PriorityRisksWidget topRisks={topRisks} loading={loading} navigate={navigate} t={t} />
                </SlideUp>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SlideUp>
                    <RecentActivityWidget recentActivity={recentActivity} loading={loading} t={t} />
                </SlideUp>
                <SlideUp>
                    <CyberNewsWidget />
                </SlideUp>
            </div>
        </StaggerContainer>
    );
};
