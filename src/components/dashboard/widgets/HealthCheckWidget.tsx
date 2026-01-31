import React, { useState } from 'react';
import { Stethoscope, CheckCircle2, AlertTriangle } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { Tooltip as CustomTooltip } from '../../ui/Tooltip';
import { DashboardCard } from '../DashboardCard';
import { validateUrl } from '../../../utils/urlValidation';

interface HealthIssue {
    id: string;
    type: 'warning' | 'danger';
    message: string;
    count: number;
    link: string;
}

interface HealthCheckWidgetProps {
    healthIssues: HealthIssue[];
    loading: boolean;
    navigate: (path: string) => void;
    t: (key: string) => string;
}

export const HealthCheckWidget: React.FC<HealthCheckWidgetProps> = React.memo(({ healthIssues, loading, navigate, t }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const displayIssues = isExpanded ? healthIssues : healthIssues.slice(0, 3);

    return (
        <DashboardCard
            title={t('dashboard.healthCheck')}
            subtitle={t('dashboard.systemAlerts')}
            icon={<Stethoscope className="w-5 h-5" />}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
            expandable={true}
            headerAction={
                <CustomTooltip content={healthIssues.length > 0 ? t('dashboard.actionsRequired') : t('dashboard.systemHealthy')} position="left">
                    <div className={`p-1.5 rounded-lg relative ${healthIssues.length > 0 ? 'bg-warning/10' : 'bg-success/10'}`}>
                        {/* Heartbeat rings */}
                        {healthIssues.length > 0 && (
                            <>
                                <div className="absolute inset-0 rounded-lg bg-warning/20 animate-ping" style={{ animationDuration: '1.5s' }} />
                                <div className="absolute inset-0 rounded-lg bg-warning/10 animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.3s' }} />
                            </>
                        )}
                        <div className={`relative w-2 h-2 rounded-full ${healthIssues.length > 0 ? 'bg-warning' : 'bg-success'}`}
                            style={healthIssues.length > 0 ? { animation: 'heartbeat 1s ease-in-out infinite' } : undefined} />
                    </div>
                </CustomTooltip>
            }
        >
            <div className="p-4 h-full overflow-y-auto custom-scrollbar">
                {loading ? <Skeleton className="h-full w-full" /> : healthIssues.length === 0 ? (
                    <div className="flex items-center p-5 bg-success-bg/50 dark:bg-success/10 rounded-2xl border border-success-border/50 dark:border-success/20 backdrop-blur-sm">
                        <CheckCircle2 className="h-6 w-6 text-success-text dark:text-success mr-4 flex-shrink-0" />
                        <div>
                            <span className="text-sm font-bold text-foreground dark:text-success block">{t('dashboard.noAnomalies')}</span>
                            <span className="text-xs font-semibold text-muted-foreground dark:text-success/80">{t('dashboard.systemsNominal')}</span>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {displayIssues.map(issue => (
                            <CustomTooltip key={issue.id || 'unknown'} content={t('dashboard.clickToResolve')} position="top" className="w-full">
                                <div
                                    onClick={() => {
                                        const safeUrl = validateUrl(issue.link);
                                        if (safeUrl) navigate(safeUrl); // validateUrl checked
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            const safeUrl = validateUrl(issue.link);
                                            if (safeUrl) navigate(safeUrl); // validateUrl checked
                                        }
                                    }}
                                    className={`flex items-start p-4 rounded-2xl border cursor-pointer hover:scale-[1.02] transition-all w-full ${issue.type === 'danger' ? 'bg-error-bg/80 dark:bg-error/5 border-error-border dark:border-error/20 hover:shadow-md hover:shadow-destructive/5' : 'bg-warning-bg/80 dark:bg-warning/5 border-warning-border dark:border-warning/20 hover:shadow-md hover:shadow-warning/5'}`}
                                >
                                    <AlertTriangle className={`h-5 w-5 mr-3 mt-0.5 flex-shrink-0 ${issue.type === 'danger' ? 'text-destructive' : 'text-warning'}`} />
                                    <div>
                                        <p className={`text-sm font-bold leading-tight ${issue.type === 'danger' ? 'text-error-text dark:text-error' : 'text-warning-text dark:text-warning'}`}>{issue.message}</p>
                                        <span className={`text-xs font-bold mt-1 block ${issue.type === 'danger' ? 'text-error-text/70 dark:text-error/70' : 'text-warning-text/70 dark:text-warning/70'}`}>{issue.count} {t('dashboard.itemsAffected')}</span>
                                    </div>
                                </div>
                            </CustomTooltip>
                        ))}
                    </div>
                )}
                {!isExpanded && healthIssues.length > 3 && (
                    <div className="mt-3 text-center">
                        <button
                            className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none p-0 focus:outline-none focus:ring-2 focus:ring-offset-2 focus-visible:ring-brand-500 rounded"
                            onClick={() => setIsExpanded(true)}
                        >
                            +{healthIssues.length - 3} {t('common.more').toLowerCase()}
                        </button>
                    </div>
                )}
            </div>
        </DashboardCard>
    );
});

HealthCheckWidget.displayName = 'HealthCheckWidget';
