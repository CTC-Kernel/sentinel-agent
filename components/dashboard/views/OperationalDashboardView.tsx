import React from 'react';
import { MyWorkspaceWidget } from '../widgets/MyWorkspaceWidget';
import { PriorityRisksWidget } from '../widgets/PriorityRisksWidget';
import { CyberNewsWidget } from '../CyberNewsWidget';

interface OperationalDashboardViewProps {
    loading: boolean;
    navigate: (path: string) => void;
    t: (key: string) => string;
    myActionItems: any[];
    myRisksList: any[];
}

export const OperationalDashboardView: React.FC<OperationalDashboardViewProps> = ({
    loading, navigate, t, myActionItems, myRisksList
}) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-full">
                <MyWorkspaceWidget myActionItems={myActionItems} loading={loading} navigate={navigate} t={t} />
            </div>
            <div className="lg:col-span-1 space-y-6">
                <PriorityRisksWidget topRisks={myRisksList} loading={loading} navigate={navigate} t={t} title="Mes Risques" />
                <CyberNewsWidget />
            </div>
        </div>
    );
};
