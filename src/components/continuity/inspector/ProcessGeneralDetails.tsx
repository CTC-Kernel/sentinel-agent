import React from 'react';
import { useStore } from '../../../store';
import { Clock, Activity } from '../../ui/Icons';
import { Badge } from '../../ui/Badge';
import { BusinessProcess } from '../../../types';

interface ProcessGeneralDetailsProps {
    process: BusinessProcess;
}

export const ProcessGeneralDetails: React.FC<ProcessGeneralDetailsProps> = ({ process }) => {
    const { t } = useStore();

    return (
        <div className="space-y-8">
            {/* Metrics Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-white dark:bg-white/5 rounded-4xl border border-slate-100 dark:border-white/10 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Clock className="w-16 h-16" />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-slate-500" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('continuity.rto')}</span>
                    </div>
                    <span className="text-3xl font-black text-slate-900 dark:text-white">{process.rto}</span>
                </div>
                <div className="p-6 bg-white dark:bg-white/5 rounded-4xl border border-slate-100 dark:border-white/10 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Activity className="w-16 h-16" />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-4 w-4 text-slate-500" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('continuity.rpo')}</span>
                    </div>
                    <span className="text-3xl font-black text-slate-900 dark:text-white">{process.rpo}</span>
                </div>
            </div>

            {/* Description */}
            <div className="glass-panel p-6 rounded-4xl border border-white/60 dark:border-white/10 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">{t('common.description')}</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{process.description}</p>
            </div>

            {/* Recovery Tasks */}
            <div className="glass-panel p-6 rounded-4xl border border-white/60 dark:border-white/10 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">{t('continuity.recoveryPlan')}</h3>
                <div className="space-y-3">
                    {process.recoveryTasks?.length ? process.recoveryTasks.map((task, i) => (
                        <div key={`dep-${i}`} className="flex gap-4 p-4 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-100 dark:border-white/5 group hover:border-brand-200 dark:hover:border-brand-800 transition-colors">
                            <div className="flex-none">
                                <div className="w-8 h-8 rounded-full bg-white dark:bg-white/10 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-200 dark:border-white/10 shadow-sm">
                                    {i + 1}
                                </div>
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-slate-800 dark:text-white mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{task.title}</p>
                                <div className="flex items-center gap-4">
                                    <Badge variant="soft" size="sm" className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10">
                                        Resp: {task.owner}
                                    </Badge>
                                    <span className="text-xs text-slate-400 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {task.duration}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )) : <p className="text-sm text-slate-500 italic">{t('continuity.noSteps')}</p>}
                </div>
            </div>
        </div>
    );
};
