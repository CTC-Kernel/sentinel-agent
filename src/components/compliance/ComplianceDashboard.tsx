import React, { useEffect, useState } from 'react';
import { Control } from '../../types';
import { RefreshCw } from '../ui/Icons';
import { Button } from '../ui/button';
import { StatsService } from '../../services/statsService';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';
import { EmptyChartState } from '../ui/EmptyChartState';
import { Skeleton } from '../ui/Skeleton';
import { ComplianceScoreCard } from './dashboard/ComplianceScoreCard';
import { ComplianceCharts } from './dashboard/ComplianceCharts';
import { ComplianceCriticalControls } from './dashboard/ComplianceCriticalControls';
import { ComplianceDomainDetails } from './dashboard/ComplianceDomainDetails';
import { PriorityActionsList } from './dashboard/PriorityActionsList';

interface ComplianceDashboardProps {
    controls: Control[];
    onFilterChange?: (status: string | null) => void;
    currentFramework?: string;
    onSeedData?: () => void;
    loading?: boolean;
}

export const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({ controls, onFilterChange, currentFramework = 'ISO27001', onSeedData, loading }) => {
    const { user } = useStore();
    const [trend, setTrend] = useState<number | undefined>(undefined);

    const totalControls = controls.length;

    // Trend calculation
    useEffect(() => {
        const fetchTrend = async () => {
            if (!user?.organizationId) return;
            try {
                // Get last 30 days history
                const history = await StatsService.getHistory(user.organizationId, 30);
                if (history.length >= 2) {
                    const current = history[history.length - 1].metrics.complianceRate;
                    const previous = history[0].metrics.complianceRate; // Compare with 30 days ago (or oldest available)
                    setTrend(Math.round(current - previous));
                }
            } catch (error) {
                ErrorLogger.error(error, 'ComplianceDashboard.fetchTrend');
            }
        };
        fetchTrend();
    }, [user?.organizationId]);

    if (loading) {
        return (
            <div className="space-y-6 w-full min-w-0">
                {/* Summary Card Skeleton */}
                <div className="glass-panel p-6 md:p-8 rounded-5xl border border-white/60 dark:border-white/5 shadow-lg flex flex-col xl:flex-row gap-8">
                    <div className="flex items-center gap-6 min-w-[240px]">
                        <Skeleton className="w-24 h-24 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => (
                            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                        ))}
                    </div>
                </div>

                {/* Charts Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="glass-panel p-6 rounded-5xl h-[350px]">
                            <Skeleton className="h-6 w-48 mb-6" />
                            <Skeleton className="h-full w-full rounded-2xl" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 w-full min-w-0">
            {/* Summary Card */}
            <ComplianceScoreCard
                controls={controls}
                currentFramework={currentFramework}
                trend={trend}
                onFilterChange={onFilterChange}
            />

            {totalControls > 0 ? (
                <>
                    {/* Charts and Priority Actions */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        <div className="xl:col-span-2">
                            <ComplianceCharts
                                controls={controls}
                                currentFramework={currentFramework}
                            />
                        </div>
                        <div className="xl:col-span-1">
                            <PriorityActionsList
                                controls={controls}
                                currentFramework={currentFramework}
                                maxActions={5}
                            />
                        </div>
                    </div>

                    {/* Critical Controls Not Implemented */}
                    <ComplianceCriticalControls controls={controls} />

                    {/* Domain Details */}
                    <ComplianceDomainDetails
                        controls={controls}
                        currentFramework={currentFramework}
                    />
                </>
            ) : (
                <div className="flex flex-col items-center justify-center space-y-4">
                    <EmptyChartState
                        variant="bar"
                        message="Aucune donnée de conformité"
                        description="Commencez par importer les contrôles standards pour visualiser les graphiques."
                        className="glass-panel border-dashed p-12 w-full"
                    />
                    {onSeedData && (
                        <div className="flex gap-4">
                            <Button onClick={onSeedData} variant="default" className="gap-2">
                                <RefreshCw className="w-4 h-4" />
                                Initialiser {currentFramework === 'ISO27001' ? 'ISO 27001 (Sécurité SI)' :
                                    currentFramework === 'ISO22301' ? 'ISO 22301 (Continuité)' :
                                        currentFramework === 'NIS2' ? 'NIS 2 (Cyber UE)' :
                                            currentFramework === 'DORA' ? 'DORA (Résilience Fin.)' :
                                                currentFramework === 'GDPR' ? 'RGPD (Données Personnelles)' :
                                                    currentFramework === 'SOC2' ? 'SOC 2 (Trust Services)' :
                                                        currentFramework === 'HDS' ? 'HDS (Données de Santé)' :
                                                            currentFramework === 'PCI_DSS' ? 'PCI DSS (Paiement)' :
                                                                currentFramework === 'NIST_CSF' ? 'NIST CSF' :
                                                                    currentFramework} (Standard)
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
