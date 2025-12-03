import React, { useState } from 'react';
import { History, ShieldAlert, Siren, Server, CheckCircle2 } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { SystemLog } from '../../../types';

interface RecentActivityWidgetProps {
    recentActivity: SystemLog[];
    loading: boolean;
    t: (key: string) => string;
}

export const RecentActivityWidget: React.FC<RecentActivityWidgetProps> = ({ recentActivity, loading, t }) => {
    const [expanded, setExpanded] = useState(false);
    const [filter, setFilter] = useState<'All' | 'Risk' | 'Incident' | 'Asset'>('All');

    const getActivityIcon = (resource: string) => {
        switch (resource) {
            case 'Risk': return <ShieldAlert className="h-3.5 w-3.5 text-orange-500" />;
            case 'Incident': return <Siren className="h-3.5 w-3.5 text-red-500" />;
            case 'Asset': return <Server className="h-3.5 w-3.5 text-blue-500" />;
            default: return <CheckCircle2 className="h-3.5 w-3.5 text-slate-500" />;
        }
    };

    const filteredActivity = recentActivity.filter(log => filter === 'All' || log.resource === filter);

    return (
        <div className="glass-panel p-0 rounded-[2rem] overflow-hidden shadow-sm group hover:shadow-md transition-shadow h-full flex flex-col">
            <div className="flex items-center justify-between px-8 pt-8 pb-6 bg-slate-50/80 dark:bg-white/5 border-b border-slate-200/60 dark:border-white/5 backdrop-blur-sm">
                <div><h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{t('dashboard.recentActivity')}</h3><p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">{t('dashboard.realTime')}</p></div>
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-slate-100 dark:bg-white/10 rounded-xl"><History className="w-5 h-5 text-slate-500 dark:text-slate-300" /></div>

                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as any)}
                        className="px-2 py-1.5 bg-white/80 dark:bg-white/10 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 hover:bg-white dark:hover:bg-white/20 transition-colors outline-none"
                    >
                        <option value="All">{t('common.all')}</option>
                        <option value="Risk">Risks</option>
                        <option value="Incident">Incidents</option>
                        <option value="Asset">Assets</option>
                    </select>

                    <button onClick={() => setExpanded(prev => !prev)} className="px-3 py-1.5 bg-white/80 dark:bg-white/10 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 hover:bg-white dark:hover:bg-white/20 transition-colors">
                        {expanded ? t('common.collapse') : t('common.expand')}
                    </button>
                </div>
            </div>
            <div className={`relative ml-4 pr-8 pl-6 ${expanded ? 'max-h-[520px]' : 'max-h-[300px]'} overflow-y-auto custom-scrollbar bg-white/40 dark:bg-transparent flex-1`}>
                <div className="border-l border-slate-200 dark:border-slate-700/50 space-y-8 py-8">
                    {loading ? <Skeleton className="h-20 w-full" /> : filteredActivity.length === 0 ? (
                        <div className="ml-8 text-sm text-slate-500">No activity found.</div>
                    ) : filteredActivity.map((log, i) => (<div key={i} className="ml-8 relative group"><span className="absolute -left-[41px] flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-sm group-hover:scale-110 group-hover:border-blue-400 transition-all z-10">{getActivityIcon(log.resource)}</span><div className="flex justify-between items-start bg-white/50 dark:bg-white/5 p-3 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-white/10 transition-colors"><div><p className="text-sm font-bold text-slate-800 dark:text-slate-200">{log.action}</p><p className="text-xs text-slate-500 mt-0.5 truncate max-w-[500px] font-medium leading-relaxed">{log.details}</p></div><span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide bg-slate-100 dark:bg-black/20 px-2 py-1 rounded-md ml-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div></div>))}
                </div>
            </div>
        </div>
    );
};
