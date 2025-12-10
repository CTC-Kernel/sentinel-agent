import React from 'react';
import { MyWorkspaceWidget } from '../widgets/MyWorkspaceWidget';
import { PriorityRisksWidget } from '../widgets/PriorityRisksWidget';
import { CyberNewsWidget } from '../CyberNewsWidget';

interface ProjectManagerDashboardViewProps {
    loading: boolean;
    navigate: (path: string) => void;
    t: (key: string) => string;
    myActionItems: any[];
    projectRisks: any[];
}

export const ProjectManagerDashboardView: React.FC<ProjectManagerDashboardViewProps> = ({
    loading, navigate, t, myActionItems, projectRisks
}) => {
    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <MyWorkspaceWidget myActionItems={myActionItems} loading={loading} navigate={navigate} t={t} />
                </div>
                <div className="lg:col-span-1">
                    <PriorityRisksWidget topRisks={projectRisks} loading={loading} navigate={navigate} t={t} title="Risques Projets" />
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <CyberNewsWidget />
                </div>
            </div>
        </>
    );
};
