import React from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar, ResponsiveContainer, Tooltip } from 'recharts';
import { Server, ClipboardCheck, FileText, Zap, ArrowRight, CalendarDays, Download } from '../../ui/Icons';
import { ChartTooltip } from '../../ui/ChartTooltip';

interface DashboardHeaderProps {
    user: any;
    organizationName: string;
    scoreGrade: string;
    stats: any;
    radarData: any[];
    loading: boolean;
    isEmpty: boolean;
    navigate: (path: string) => void;
    t: (key: string) => string;
    theme: string;
    insight: any;
    teamSize: number | null;
    generateICal: () => void;
    generateExecutiveReport: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    user, organizationName, scoreGrade, stats, radarData, loading, isEmpty, navigate, t, theme, insight, teamSize, generateICal, generateExecutiveReport
}) => {
    return (
        <div className="relative overflow-hidden rounded-[2.5rem] bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-slate-200/60 dark:ring-white/5 transition-all duration-500 group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-purple-500/5 dark:from-blue-500/10 dark:via-indigo-500/10 dark:to-purple-500/10 opacity-100"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>

            <div className="relative z-10 p-6 md:p-8">
                {isEmpty && !loading ? (
                    <div className="flex flex-col items-center justify-center text-center py-8">
                        <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-slate-900/5 dark:bg-white/10 border border-slate-900/10 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-widest mb-6 backdrop-blur-md shadow-sm">
                            <span className="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full mr-2.5 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                            {organizationName || user?.organizationName || t('dashboard.operationalSystem')}
                        </div>

                        <h2 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 tracking-tight font-display mb-6">
                            {t('dashboard.welcomeTitle')}
                        </h2>
                        <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mb-10 leading-relaxed font-medium">
                            {t('dashboard.welcomeSubtitle1')}<br />
                            {t('dashboard.welcomeSubtitle2')}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl w-full mx-auto">
                            <button
                                onClick={() => navigate('/assets')}
                                className="group relative p-8 bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-3xl hover:border-blue-400 dark:hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl"></div>
                                <div className="flex flex-col items-center gap-4 relative z-10">
                                    <div className="p-4 bg-blue-50 dark:bg-slate-900 dark:bg-blue-500/20 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                                        <Server className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('dashboard.createAsset')}</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t('dashboard.createAssetDesc')}</p>
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={() => navigate('/compliance')}
                                className="group relative p-8 bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-3xl hover:border-emerald-400 dark:hover:border-emerald-500/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl"></div>
                                <div className="flex flex-col items-center gap-4 relative z-10">
                                    <div className="p-4 bg-emerald-50 dark:bg-emerald-500/20 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                                        <ClipboardCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('dashboard.configureControls')}</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t('dashboard.configureControlsDesc')}</p>
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={() => navigate('/documents')}
                                className="group relative p-8 bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-3xl hover:border-purple-400 dark:hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl"></div>
                                <div className="flex flex-col items-center gap-4 relative z-10">
                                    <div className="p-4 bg-purple-50 dark:bg-purple-500/20 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                                        <FileText className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('dashboard.addDocuments')}</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t('dashboard.addDocumentsDesc')}</p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                        <div className="flex-1 min-w-0 space-y-6">
                            <div className="flex items-center gap-5">
                                <div className={`flex items-center justify-center w-16 h-16 shrink-0 rounded-2xl text-4xl font-black shadow-xl border-4 ${scoreGrade === 'A' ? 'bg-emerald-500 border-emerald-400/50 text-white shadow-emerald-500/20' : scoreGrade === 'B' ? 'bg-indigo-500 border-indigo-400/50 text-white shadow-indigo-500/20' : scoreGrade === 'C' ? 'bg-orange-500 border-orange-400/50 text-white shadow-orange-500/20' : 'bg-red-500 border-red-400/50 text-white shadow-red-500/20'}`}>
                                    {scoreGrade}
                                </div>
                                <div>
                                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-display">Sentinel GRC</h1>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-900/5 dark:bg-white/10 border border-slate-900/10 dark:border-white/10 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-widest">
                                            {organizationName || user?.organizationName || t('dashboard.operationalSystem')}
                                        </span>
                                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                                            <strong className="text-slate-900 dark:text-white">{loading ? '...' : stats.compliance}%</strong> {t('dashboard.compliance')}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className={`flex items-center p-4 rounded-xl backdrop-blur-md border transition-all duration-300 hover:scale-[1.01] shadow-sm ${insight.type === 'danger' ? 'bg-red-50/60 dark:bg-red-900/10 border-red-200/60 dark:border-red-500/20' : insight.type === 'warning' ? 'bg-orange-50/60 dark:bg-orange-900/10 border-orange-200/60 dark:border-orange-500/20' : 'bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-200/60 dark:border-emerald-500/20'}`}>
                                <div className={`p-2 rounded-lg shrink-0 mr-4 ${insight.type === 'danger' ? 'bg-red-200/50 dark:bg-red-500/20 text-red-600 dark:text-red-400' : insight.type === 'warning' ? 'bg-orange-200/50 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400' : 'bg-emerald-200/50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
                                    <Zap className="h-5 w-5" fill="currentColor" strokeWidth={0} />
                                </div>
                                <div className="flex-1 min-w-0 mr-4">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{insight.text}</p>
                                    {insight.details && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{insight.details}</p>}
                                </div>
                                {insight.link && (
                                    <button onClick={() => navigate(insight.link!)} className="shrink-0 px-3 py-1.5 bg-white/60 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 rounded-lg text-xs font-bold transition-all flex items-center border border-black/5 dark:border-white/10 shadow-sm">
                                        <span className="hidden sm:inline mr-1">{insight.action}</span> <ArrowRight className="h-3 w-3" />
                                    </button>
                                )}
                            </div>

                            {teamSize !== null && (
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-900/3 dark:bg-white/5 border border-slate-900/5 dark:border-white/10">
                                        {t('dashboard.team')} : {teamSize <= 1 ? t('dashboard.teamAlone') : `${teamSize} ${t('dashboard.teamMembers')}`}
                                    </span>
                                    {teamSize <= 1 && (
                                        <button
                                            onClick={() => navigate('/team')}
                                            className="inline-flex items-center px-3 py-1.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-bold shadow-sm hover:scale-105 transition-all"
                                        >
                                            {t('dashboard.inviteTeam')}
                                            <ArrowRight className="h-3 w-3 ml-1" />
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="flex flex-wrap gap-3 mt-4">
                                <button
                                    onClick={generateICal}
                                    className="group flex items-center px-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white text-xs font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm"
                                >
                                    <CalendarDays className="h-3.5 w-3.5 mr-2" /> {t('dashboard.exportIcal')}
                                </button>
                                <button
                                    onClick={generateExecutiveReport}
                                    className="group flex items-center px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-slate-900/20 dark:shadow-none"
                                >
                                    <Download className="h-3.5 w-3.5 mr-2" /> {t('dashboard.executiveReport')}
                                </button>
                            </div>
                        </div>

                        <div className="w-full max-w-[280px] h-[280px] shrink-0 cursor-pointer hover:scale-105 transition-transform duration-500 relative" onClick={() => navigate('/compliance')}>
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                    <defs>
                                        <linearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={theme === 'dark' ? '#3b82f6' : '#0f172a'} stopOpacity={0.6} />
                                            <stop offset="95%" stopColor={theme === 'dark' ? '#3b82f6' : '#0f172a'} stopOpacity={0.1} />
                                        </linearGradient>
                                    </defs>
                                    <PolarGrid
                                        stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)'}
                                        strokeDasharray="4 4"
                                    />
                                    <PolarAngleAxis
                                        dataKey="subject"
                                        tick={{
                                            fill: theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(15,23,42,0.7)',
                                            fontSize: 10,
                                            fontWeight: 700,
                                            fontFamily: 'var(--font-sans)'
                                        }}
                                    />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                    <RechartsRadar
                                        name={t('dashboard.maturity')}
                                        dataKey="A"
                                        stroke={theme === 'dark' ? '#60a5fa' : '#0f172a'}
                                        strokeWidth={3}
                                        fill="url(#radarFill)"
                                        fillOpacity={1}
                                    />
                                    <Tooltip
                                        content={<ChartTooltip />}
                                        cursor={{ stroke: theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.2)', strokeWidth: 1 }}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                            <div className="absolute bottom-0 w-full text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60">{t('dashboard.isoMaturity')}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
