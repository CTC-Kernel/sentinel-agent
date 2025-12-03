import React from 'react';
import { Flame, ShieldAlert } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { Risk } from '../../../types';

interface PriorityRisksWidgetProps {
    topRisks: Risk[];
    loading: boolean;
    navigate: (path: string) => void;
    t: (key: string) => string;
    title?: string;
}

export const PriorityRisksWidget: React.FC<PriorityRisksWidgetProps> = ({ topRisks, loading, navigate, t, title }) => {
    return (
        <div className="glass-panel p-0 rounded-[2rem] lg:col-span-2 overflow-hidden shadow-sm group hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between px-8 pt-8 pb-6 bg-slate-50/80 dark:bg-white/5 border-b border-slate-200/60 dark:border-white/5 backdrop-blur-sm">
                <div><h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{title || t('dashboard.priorityRisks')}</h3><p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">{t('dashboard.topCriticality')}</p></div>
                <div className="p-2 bg-red-500/10 rounded-xl"><Flame className="w-5 h-5 text-red-500" /></div>
            </div>
            <div className="p-8 space-y-3 bg-white/40 dark:bg-transparent">
                {loading ? [1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />) : topRisks.slice(0, 3).map(risk => (<div key={risk.id} onClick={() => navigate('/risks')} className="p-4 rounded-2xl bg-white/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 hover:bg-white dark:hover:bg-white/10 transition-all group flex items-center justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer"><div className="flex items-center"><div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-100 dark:border-red-500/20 flex items-center justify-center mr-4 text-red-600 dark:text-red-400 font-black text-lg shadow-inner">{risk.score}</div><div><h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{risk.threat}</h4><p className="text-xs text-slate-500 font-medium mt-1">{risk.vulnerability}</p></div></div><span className="text-[10px] font-bold bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">{risk.strategy}</span></div>))}
                {topRisks.length === 0 && !loading && <div className="flex flex-col items-center justify-center py-8 text-center"><ShieldAlert className="h-10 w-10 text-slate-300 mb-2" /><p className="text-sm text-slate-500 font-medium">{t('dashboard.noCriticalRisks')}</p></div>}
            </div>
        </div>
    );
};
