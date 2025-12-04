import React from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar, ResponsiveContainer, Tooltip } from 'recharts';
import { Server, ClipboardCheck, FileText, Zap, ArrowRight, CalendarDays, Download } from '../../ui/Icons';
import { ChartTooltip } from '../../ui/ChartTooltip';

interface DashboardHeaderProps {
    user: any;
    organizationName: string;
    scoreGrade?: string; // Made optional as it seems unused in parent
    stats?: any; // Made optional
    radarData?: any[]; // Made optional
    loading: boolean;
    isEmpty?: boolean;
    navigate?: (path: string) => void;
    t?: (key: string) => string;
    theme?: string;
    insight?: any;
    teamSize: number | null;
    activeIncidentsCount: number;
    openAuditsCount: number;
    generateICal?: () => void;
    generateExecutiveReport?: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    user, organizationName, scoreGrade, radarData, loading, isEmpty,
    navigate = () => { },
    t = (k) => k,
    theme, insight, teamSize,
    activeIncidentsCount, openAuditsCount,
    generateICal = () => { },
    generateExecutiveReport = () => { }
}) => {
    return (
        <div className="relative overflow-hidden rounded-[2.5rem] bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-slate-200/60 dark:ring-white/5 transition-all duration-500 group">
            {/* Enhanced Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-purple-500/5 dark:from-blue-500/10 dark:via-indigo-500/10 dark:to-purple-500/10 opacity-100"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>

            {/* Decorative blobs */}
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10 p-8 md:p-10">
                {isEmpty && !loading ? (
                    <div className="flex flex-col items-center justify-center text-center py-12">
                        <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-slate-900/5 dark:bg-white/10 border border-slate-900/10 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-widest mb-8 backdrop-blur-md shadow-sm">
                            <span className="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full mr-2.5 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                            {organizationName || user?.organizationName || t('dashboard.operationalSystem')}
                        </div>

                        <h2 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-600 dark:from-white dark:via-slate-200 dark:to-slate-400 tracking-tight font-display mb-8 drop-shadow-sm">
                            {t('dashboard.welcomeTitle')}
                        </h2>
                        <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 max-w-3xl mb-12 leading-relaxed font-medium">
                            {t('dashboard.welcomeSubtitle1')}<br />
                            {t('dashboard.welcomeSubtitle2')}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full mx-auto">
                            <button
                                onClick={() => navigate('/assets')}
                                className="group relative p-8 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-[2rem] hover:border-blue-400 dark:hover:border-blue-500/50 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                <div className="flex flex-col items-center gap-5 relative z-10">
                                    <div className="p-5 bg-blue-50 dark:bg-blue-500/20 rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-sm ring-1 ring-blue-100 dark:ring-blue-500/30">
                                        <Server className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('dashboard.createAsset')}</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{t('dashboard.createAssetDesc')}</p>
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={() => navigate('/compliance')}
                                className="group relative p-8 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-[2rem] hover:border-emerald-400 dark:hover:border-emerald-500/50 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                <div className="flex flex-col items-center gap-5 relative z-10">
                                    <div className="p-5 bg-emerald-50 dark:bg-emerald-500/20 rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-sm ring-1 ring-emerald-100 dark:ring-emerald-500/30">
                                        <ClipboardCheck className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('dashboard.configureControls')}</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{t('dashboard.configureControlsDesc')}</p>
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={() => navigate('/documents')}
                                className="group relative p-8 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-[2rem] hover:border-purple-400 dark:hover:border-purple-500/50 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                <div className="flex flex-col items-center gap-5 relative z-10">
                                    <div className="p-5 bg-purple-50 dark:bg-purple-500/20 rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-sm ring-1 ring-purple-100 dark:ring-purple-500/30">
                                        <FileText className="h-10 w-10 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('dashboard.addDocuments')}</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{t('dashboard.addDocumentsDesc')}</p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10">
                        <div className="flex-1 min-w-0 space-y-8">
                            {/* Header Section */}
                            <div className="flex items-start gap-6">
                                <div className={`relative flex items-center justify-center w-20 h-20 shrink-0 rounded-[1.5rem] text-5xl font-black shadow-2xl border-[3px] transition-transform duration-500 hover:scale-105 ${scoreGrade === 'A' ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-300/50 text-white shadow-emerald-500/30' : scoreGrade === 'B' ? 'bg-gradient-to-br from-indigo-400 to-indigo-600 border-indigo-300/50 text-white shadow-indigo-500/30' : scoreGrade === 'C' ? 'bg-gradient-to-br from-orange-400 to-orange-600 border-orange-300/50 text-white shadow-orange-500/30' : 'bg-gradient-to-br from-red-400 to-red-600 border-red-300/50 text-white shadow-red-500/30'}`}>
                                    <span className="drop-shadow-md">{scoreGrade || 'A'}</span>
                                    <div className="absolute inset-0 rounded-[1.5rem] bg-white/20 mix-blend-overlay"></div>
                                </div>
                                <div>
                                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight font-display mb-2">Sentinel GRC</h1>
                                    <div className="flex items-center gap-3">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-[11px] font-bold uppercase tracking-widest shadow-sm">
                                            {organizationName || user?.organizationName || t('dashboard.operationalSystem')}
                                        </span>
                                        <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                            <span className={`text-lg ${loading ? 'opacity-50' : ''} text-slate-900 dark:text-white`}>
                                                {loading ? '...' : activeIncidentsCount}
                                            </span>
                                            Incidents Actifs
                                        </span>
                                        <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                            <span className={`text-lg ${loading ? 'opacity-50' : ''} text-slate-900 dark:text-white`}>
                                                {loading ? '...' : openAuditsCount}
                                            </span>
                                            Audits en cours
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Insight Card */}
                            <div className={`relative overflow-hidden p-5 rounded-2xl border transition-all duration-300 hover:scale-[1.01] hover:shadow-lg group/insight ${insight.type === 'danger' ? 'bg-red-50/80 dark:bg-red-950/30 border-red-200 dark:border-red-500/30' : insight.type === 'warning' ? 'bg-orange-50/80 dark:bg-orange-950/30 border-orange-200 dark:border-orange-500/30' : 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-500/30'}`}>
                                <div className="flex items-start gap-4 relative z-10">
                                    <div className={`p-3 rounded-xl shrink-0 shadow-sm ${insight.type === 'danger' ? 'bg-white dark:bg-red-500/20 text-red-600 dark:text-red-400 ring-1 ring-red-100 dark:ring-red-500/40' : insight.type === 'warning' ? 'bg-white dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 ring-1 ring-orange-100 dark:ring-orange-500/40' : 'bg-white dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-100 dark:ring-emerald-500/40'}`}>
                                        <Zap className="h-6 w-6" fill="currentColor" strokeWidth={0} />
                                    </div>
                                    <div className="flex-1 min-w-0 pt-1">
                                        <p className="text-base font-bold text-slate-900 dark:text-white mb-1">{insight.text}</p>
                                        {insight.details && <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{insight.details}</p>}

                                        {insight.link && (
                                            <button onClick={() => navigate(insight.link!)} className="mt-3 inline-flex items-center text-sm font-bold hover:underline underline-offset-4 transition-all opacity-90 hover:opacity-100">
                                                <span className={`${insight.type === 'danger' ? 'text-red-700 dark:text-red-300' : insight.type === 'warning' ? 'text-orange-700 dark:text-orange-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                                                    {insight.action}
                                                </span>
                                                <ArrowRight className={`h-4 w-4 ml-1.5 ${insight.type === 'danger' ? 'text-red-700 dark:text-red-300' : insight.type === 'warning' ? 'text-orange-700 dark:text-orange-300' : 'text-emerald-700 dark:text-emerald-300'}`} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Actions & Team */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                                {teamSize !== null && (
                                    <div className="flex items-center gap-3">
                                        <div className="flex -space-x-2 overflow-hidden">
                                            {[...Array(Math.min(3, teamSize))].map((_, i) => (
                                                <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                    {String.fromCharCode(65 + i)}
                                                </div>
                                            ))}
                                            {teamSize > 3 && (
                                                <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                    +{teamSize - 3}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                            <span className="font-bold text-slate-900 dark:text-white">{teamSize}</span> {t('dashboard.teamMembers')}
                                            {teamSize <= 1 && (
                                                <button
                                                    onClick={() => navigate('/team')}
                                                    className="ml-2 text-blue-600 dark:text-blue-400 hover:underline font-bold"
                                                >
                                                    {t('dashboard.inviteTeam')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={generateICal}
                                        className="group flex items-center px-4 py-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white text-xs font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-all shadow-sm hover:shadow-md"
                                    >
                                        <CalendarDays className="h-4 w-4 mr-2 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                                        {t('dashboard.exportIcal')}
                                    </button>
                                    <button
                                        onClick={generateExecutiveReport}
                                        className="group flex items-center px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-slate-900/20 dark:shadow-white/10 hover:shadow-xl hover:shadow-slate-900/30 dark:hover:shadow-white/20"
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        {t('dashboard.executiveReport')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Radar Chart Section */}
                        <div className="relative group/chart">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-2xl opacity-0 group-hover/chart:opacity-100 transition-opacity duration-700"></div>
                            <div
                                className="relative w-full max-w-[320px] h-[320px] shrink-0 cursor-pointer transition-all duration-500 hover:scale-[1.02] bg-white/40 dark:bg-white/5 backdrop-blur-sm rounded-full border border-slate-200/50 dark:border-white/5 shadow-inner p-4"
                                onClick={() => navigate('/compliance')}
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                        <defs>
                                            <linearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={theme === 'dark' ? '#3b82f6' : '#0f172a'} stopOpacity={0.5} />
                                                <stop offset="95%" stopColor={theme === 'dark' ? '#3b82f6' : '#0f172a'} stopOpacity={0.05} />
                                            </linearGradient>
                                        </defs>
                                        <PolarGrid
                                            stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)'}
                                            strokeDasharray="4 4"
                                        />
                                        <PolarAngleAxis
                                            dataKey="subject"
                                            tick={{
                                                fill: theme === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.9)',
                                                fontSize: 11,
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
                                            isAnimationActive={true}
                                        />
                                        <Tooltip
                                            content={<ChartTooltip />}
                                            cursor={{ stroke: theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.2)', strokeWidth: 1 }}
                                        />
                                    </RadarChart>
                                </ResponsiveContainer>
                                <div className="absolute bottom-6 w-full text-center">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/50 dark:bg-black/20 backdrop-blur-md border border-slate-200/50 dark:border-white/10 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest shadow-sm">
                                        {t('dashboard.isoMaturity')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
