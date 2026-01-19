import React from 'react';
import { useStore } from '../../../store';
import { Zap } from '../../ui/Icons';
import { Badge } from '../../ui/Badge';
import { BcpDrill } from '../../../types';

interface ProcessDrillsProps {
    drills: BcpDrill[];
}

export const ProcessDrills: React.FC<ProcessDrillsProps> = ({ drills }) => {
    const { t } = useStore();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('continuity.recentDrills')}</h3>
            </div>

            {drills.length > 0 ? (
                <div className="space-y-3">
                    {drills.map(d => (
                        <div key={d.id} className="flex items-center justify-between p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm hover:border-brand-200 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`p-2.5 rounded-xl ${d.result === 'Succès' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                    <Zap className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white capitalize">{d.type}</p>
                                    <p className="text-xs text-slate-500">{new Date(d.date).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <Badge status={d.result === 'Succès' ? 'success' : 'error'}>
                                {d.result}
                            </Badge>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
                    <Zap className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">{t('continuity.noDrills')}</p>
                </div>
            )}
        </div>
    );
};
