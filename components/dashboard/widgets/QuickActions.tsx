import React from 'react';
import { Settings as Settings3D, Siren, ShieldAlert, Server, User } from '../../ui/Icons';

interface QuickActionsProps {
    navigate: (path: string) => void;
    t: (key: string) => string;
    stats?: {
        activeIncidents: number;
        highRisks: number;
        assets: number;
        teamSize?: number;
    };
}

export const QuickActions: React.FC<QuickActionsProps> = ({ navigate, t, stats }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
            <button onClick={() => navigate('/ctc-engine')} className="relative p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:scale-[1.05] hover:shadow-xl transition-all duration-300 group shadow-sm hover:border-purple-300 dark:hover:border-purple-500/50 active:scale-95">
                <div className="p-3 bg-purple-50 dark:bg-purple-500/20 rounded-xl group-hover:scale-110 transition-transform duration-300 group-hover:bg-purple-100 dark:group-hover:bg-purple-500/30">
                    <Settings3D className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{t('dashboard.voxel3d')}</span>
            </button>

            <button onClick={() => navigate('/incidents')} className="relative p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:scale-[1.05] hover:shadow-xl transition-all duration-300 group shadow-sm hover:border-red-300 dark:hover:border-red-500/50 active:scale-95">
                {stats && stats.activeIncidents > 0 && (
                    <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
                        {stats.activeIncidents}
                    </span>
                )}
                <div className="p-3 bg-red-50 dark:bg-red-500/20 rounded-xl group-hover:scale-110 transition-transform duration-300 group-hover:bg-red-100 dark:group-hover:bg-red-500/30">
                    <Siren className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">{t('dashboard.incidents')}</span>
            </button>

            <button onClick={() => navigate('/risks')} className="relative p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:scale-[1.05] hover:shadow-xl transition-all duration-300 group shadow-sm hover:border-orange-300 dark:hover:border-orange-500/50 active:scale-95">
                {stats && stats.highRisks > 0 && (
                    <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
                        {stats.highRisks}
                    </span>
                )}
                <div className="p-3 bg-orange-50 dark:bg-orange-500/20 rounded-xl group-hover:scale-110 transition-transform duration-300 group-hover:bg-orange-100 dark:group-hover:bg-orange-500/30">
                    <ShieldAlert className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{t('dashboard.risks')}</span>
            </button>

            <button onClick={() => navigate('/assets')} className="relative p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:scale-[1.05] hover:shadow-xl transition-all duration-300 group shadow-sm hover:border-blue-300 dark:hover:border-blue-500/50 active:scale-95">
                {stats && stats.assets > 0 && (
                    <span className="absolute top-3 right-3 flex h-auto min-w-[20px] px-1 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
                        {stats.assets}
                    </span>
                )}
                <div className="p-3 bg-blue-50 dark:bg-slate-900 dark:bg-blue-500/20 rounded-xl group-hover:scale-110 transition-transform duration-300 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/30">
                    <Server className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{t('dashboard.assets')}</span>
            </button>

            <button onClick={() => navigate('/team')} className="relative p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:scale-[1.05] hover:shadow-xl transition-all duration-300 group shadow-sm hover:border-emerald-300 dark:hover:border-emerald-500/50 active:scale-95">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-500/20 rounded-xl group-hover:scale-110 transition-transform duration-300 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/30">
                    <User className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{t('dashboard.team')}</span>
            </button>
        </div>
    );
};
