import React from 'react';
import { StatsOverview } from '../widgets/StatsOverview';
import { MyWorkspaceWidget } from '../widgets/MyWorkspaceWidget';
import { ComplianceEvolutionWidget } from '../widgets/ComplianceEvolutionWidget';
import { HealthCheckWidget } from '../widgets/HealthCheckWidget';
import { PriorityRisksWidget } from '../widgets/PriorityRisksWidget';
import { RecentActivityWidget } from '../widgets/RecentActivityWidget';
import { CyberNewsWidget } from '../CyberNewsWidget';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../../ui/animationVariants';

type Stats = React.ComponentProps<typeof StatsOverview>['stats'];
type ActionItemList = React.ComponentProps<typeof MyWorkspaceWidget>['myActionItems'];
type HistoryData = React.ComponentProps<typeof ComplianceEvolutionWidget>['historyData'];
type HealthIssueList = React.ComponentProps<typeof HealthCheckWidget>['healthIssues'];
type RiskList = React.ComponentProps<typeof PriorityRisksWidget>['topRisks'];
type ActivityList = React.ComponentProps<typeof RecentActivityWidget>['recentActivity'];

interface AdminDashboardViewProps {
    stats: Stats;
    loading: boolean;
    navigate: (path: string) => void;
    t: (key: string) => string;
    theme: string;
    myActionItems: ActionItemList;
    historyData: HistoryData;
    healthIssues: HealthIssueList;
    topRisks: RiskList;
    recentActivity: ActivityList;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
    stats, loading, navigate, t, theme, myActionItems, historyData, healthIssues, topRisks, recentActivity
}) => {
    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="animate"
            className="space-y-6"
        >
            <motion.div variants={slideUpVariants}>
                <StatsOverview stats={stats} loading={loading} navigate={navigate} t={t} />
            </motion.div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div variants={slideUpVariants} className="col-span-1">
                    <MyWorkspaceWidget myActionItems={myActionItems} loading={loading} navigate={navigate} t={t} />
                </motion.div>
                <motion.div variants={slideUpVariants} className="col-span-1 lg:col-span-2">
                    <ComplianceEvolutionWidget historyData={historyData} loading={loading} t={t} theme={theme} />
                </motion.div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div variants={slideUpVariants} className="col-span-1">
                    <HealthCheckWidget healthIssues={healthIssues} loading={loading} navigate={navigate} t={t} />
                </motion.div>
                <motion.div variants={slideUpVariants} className="col-span-1 lg:col-span-2">
                    <PriorityRisksWidget topRisks={topRisks} loading={loading} navigate={navigate} t={t} />
                </motion.div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div variants={slideUpVariants}>
                    <RecentActivityWidget recentActivity={recentActivity} loading={loading} t={t} />
                </motion.div>
                <motion.div variants={slideUpVariants}>
                    <CyberNewsWidget />
                </motion.div>
            </div>
        </motion.div>
    );
};
