import React from 'react';
import { StatsOverview } from '../widgets/StatsOverview';
import { MyWorkspaceWidget } from '../widgets/MyWorkspaceWidget';
import { ComplianceEvolutionWidget } from '../widgets/ComplianceEvolutionWidget';
import { HealthCheckWidget } from '../widgets/HealthCheckWidget';
import { PriorityRisksWidget } from '../widgets/PriorityRisksWidget';
import { RecentActivityWidget } from '../widgets/RecentActivityWidget';
import { MaturityRadarWidget } from '../widgets/MaturityRadarWidget';
import { CyberNewsWidget } from '../CyberNewsWidget';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../../ui/animationVariants';

type Stats = React.ComponentProps<typeof StatsOverview>['stats'];
type ActionItemList = React.ComponentProps<typeof MyWorkspaceWidget>['myActionItems'];
type HistoryData = React.ComponentProps<typeof ComplianceEvolutionWidget>['historyData'];
type HealthIssueList = React.ComponentProps<typeof HealthCheckWidget>['healthIssues'];
type RiskList = React.ComponentProps<typeof PriorityRisksWidget>['topRisks'];
type ActivityList = React.ComponentProps<typeof RecentActivityWidget>['recentActivity'];
type RadarData = React.ComponentProps<typeof MaturityRadarWidget>['radarData'];

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
    radarData: RadarData;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
    stats, loading, navigate, t, theme, myActionItems, historyData, healthIssues, topRisks, recentActivity, radarData
}) => {
    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="space-y-8"
        >
            <motion.div variants={slideUpVariants}>
                <StatsOverview stats={stats} loading={loading} navigate={navigate} t={t} />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Focus Column (2/3) */}
                <div className="lg:col-span-2 space-y-8">
                    <motion.div variants={slideUpVariants}>
                        <MyWorkspaceWidget myActionItems={myActionItems} loading={loading} navigate={navigate} t={t} />
                    </motion.div>

                    {/* DEBUG: Removed animation to check visibility */}
                    <div>
                        <div className="text-red-500 font-bold bg-yellow-100 p-2 text-center border border-red-500 mb-2">COMPLIANCE WIDGET HERE (ADMIN)</div>
                        <ComplianceEvolutionWidget historyData={historyData} loading={loading} t={t} theme={theme} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <motion.div variants={slideUpVariants}>
                            <RecentActivityWidget recentActivity={recentActivity} loading={loading} t={t} />
                        </motion.div>
                        <motion.div variants={slideUpVariants}>
                            <PriorityRisksWidget topRisks={topRisks} loading={loading} navigate={navigate} t={t} />
                        </motion.div>
                    </div>
                </div>

                {/* Right Context Column (1/3) */}
                <div className="space-y-8">
                    <motion.div variants={slideUpVariants} className="glass-panel p-6 rounded-[2rem] border border-glass-border shadow-sm relative overflow-hidden group hover:shadow-apple transition-all duration-300">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6 text-center">Niveau de Maturité</h3>
                        <div className="min-h-[250px] flex items-center justify-center -ml-2">
                            <MaturityRadarWidget
                                radarData={radarData}
                                t={t}
                                navigate={navigate}
                            />
                        </div>
                    </motion.div>

                    <motion.div variants={slideUpVariants}>
                        <HealthCheckWidget healthIssues={healthIssues} loading={loading} navigate={navigate} t={t} />
                    </motion.div>

                    <motion.div variants={slideUpVariants}>
                        <CyberNewsWidget />
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
};
