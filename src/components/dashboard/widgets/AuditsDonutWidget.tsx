import React from 'react';
import { useFirestoreCollection } from '../../../hooks/useFirestore';
import { Audit } from '../../../types';
import { where } from 'firebase/firestore';
import { useStore } from '../../../store';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Loader2 } from 'lucide-react';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { EmptyChartState } from '../../ui/EmptyChartState';

interface AuditsDonutWidgetProps {
    navigate?: (path: string) => void;
    t?: (key: string) => string;
}

export const AuditsDonutWidget: React.FC<AuditsDonutWidgetProps> = ({ navigate, t = (k) => k }) => {
    const { user } = useStore();

    const { data: audits, loading } = useFirestoreCollection<Audit>(
        'audits',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId }
    );

    const data = React.useMemo(() => {
        const counts = {
            'Planifié': 0,
            'En cours': 0,
            'Terminé': 0,
            'Retard': 0
        };

        audits.forEach(audit => {
            const status = audit.status || 'Planifié';
            if (counts[status as keyof typeof counts] !== undefined) {
                counts[status as keyof typeof counts]++;
            } else {
                // Fallback for unexpected statuses
                counts['Planifié']++;
            }
        });

        return [
            { name: 'Planifié', value: counts['Planifié'], color: 'hsl(var(--primary))' }, // blue-500
            { name: 'En cours', value: counts['En cours'], color: 'hsl(var(--warning))' }, // amber-500
            { name: 'Terminé', value: counts['Terminé'], color: 'hsl(var(--success))' }, // emerald-500
            { name: 'Retard', value: counts['Retard'], color: 'hsl(var(--destructive))' }   // red-500
        ].filter(d => d.value > 0);
    }, [audits]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center min-h-[300px] max-h-96 overflow-hidden">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
        );
    }

    if (data.length === 0) {
        return (
        <div className="h-full flex flex-col p-4 bg-card rounded-2xl border border-border shadow-sm max-h-96 overflow-hidden">
                <h3 className="text-lg font-bold mb-4 flex-shrink-0">{t('dashboard.auditsStatus')}</h3>
                <div className="flex-1 flex items-center justify-center min-h-[220px] max-h-[280px] overflow-hidden">
                    <EmptyChartState
                        message={t('dashboard.noAuditsData')}
                        description="Créez votre premier audit pour visualiser la répartition."
                        variant="pie"
                        actionLabel="Nouvel Audit"
                        onAction={() => navigate && navigate('/audits')}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-4 bg-card rounded-2xl border border-border shadow-sm max-h-96 overflow-hidden">
            <h3 className="text-lg font-bold mb-4 flex-shrink-0">{t('dashboard.auditsStatus')}</h3>
            <div className="flex-1 min-h-[220px] max-h-[280px] overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <defs>
                            {data.map((entry, index) => (
                                <linearGradient key={`grad-${index}`} id={`auditPieGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                                    <stop offset="100%" stopColor={entry.color} stopOpacity={0.8} />
                                </linearGradient>
                            ))}
                        </defs>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius="60%"
                            outerRadius="80%"
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                            cursor="pointer"
                            onClick={() => navigate && navigate('/audits')}
                        >
                            {data.map((_entry, index) => (
                                <Cell key={`cell-${index}`} fill={`url(#auditPieGradient-${index})`} className="drop-shadow-sm" />
                            ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            iconType="circle"
                            formatter={(value) => <span className="text-xs font-bold text-muted-foreground ml-1">{value}</span>}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
