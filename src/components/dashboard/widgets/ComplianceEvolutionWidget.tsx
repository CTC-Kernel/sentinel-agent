// DIAGNOSTIC PHASE 4: CARD RESTORATION
import React, { useState } from 'react';
import { TrendingUp } from '../../ui/Icons';
import { DashboardCard } from '../DashboardCard';

interface ComplianceEvolutionWidgetProps {
    historyData: { date: string; compliance: number }[];
    loading: boolean;
    t: (key: string) => string;
    theme: string;
}

export const ComplianceEvolutionWidget: React.FC<ComplianceEvolutionWidgetProps> = ({ t }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <DashboardCard
            title={t('dashboard.complianceEvolution')}
            subtitle="DIAGNOSTIC MODE"
            icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
            expandable={true}
            className="lg:col-span-2 min-h-[400px] border-4 border-blue-500"
        >
            <div className="p-10 bg-blue-100 text-blue-900 font-bold text-2xl text-center h-full flex items-center justify-center">
                CARD IS ALIVE
                <br />
                (If you see this, the Card component is fine)
            </div>
        </DashboardCard>
    );
};
