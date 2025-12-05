import React from 'react';
import { Server, ClipboardCheck, FileText, Zap, ArrowRight, CalendarDays, Download, X } from '../../ui/Icons';
import { MaturityRadarWidget } from './MaturityRadarWidget';
import { SecurityBadge } from '../../ui/SecurityBadge';

const InsightCard: React.FC<{ insight: any, navigate: (path: string) => void }> = ({ insight, navigate }) => {
    const [isVisible, setIsVisible] = React.useState(true);

    if (!isVisible) return null;

    return (
        <div
            className={`relative overflow-hidden p-4 sm:p-5 rounded-2xl border transition-all duration-300 hover:scale-[1.01] hover:shadow-lg group/insight animate-fade-in ${insight.type === 'danger' ? 'bg-red-50/80 dark:bg-red-950/30 border-red-200 dark:border-red-500/30' : insight.type === 'warning' ? 'bg-orange-50/80 dark:bg-orange-950/30 border-orange-200 dark:border-orange-500/30' : 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-500/30'}`}
        // Allow clicking the card background to dismiss on mobile if desired, or just rely on the X button. 
        // The user said "should also close on touch". Adding a touch listener to body is intrusive. 
        // Let's add a dedicated close button that is large enough.
        >
            <button
                onClick={(e) => { e.stopPropagation(); setIsVisible(false); }}
                className="absolute top-2 right-2 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors z-20"
                aria-label="Fermer"
            >
                <X className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </button>

            <div className="flex items-start gap-3 sm:gap-4 relative z-10 pr-6">
                <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 shadow-sm ${insight.type === 'danger' ? 'bg-white dark:bg-red-500/20 text-red-600 dark:text-red-400 ring-1 ring-red-100 dark:ring-red-500/40' : insight.type === 'warning' ? 'bg-white dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 ring-1 ring-orange-100 dark:ring-orange-500/40' : 'bg-white dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-100 dark:ring-emerald-500/40'}`}>
                    <Zap className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" strokeWidth={0} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5 sm:pt-1">
                    <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-1 pr-4">{insight.text}</p>
                    {insight.details && <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-2">{insight.details}</p>}

                    {insight.link && (
                        <button onClick={() => navigate(insight.link!)} className="mt-1 sm:mt-3 inline-flex items-center text-xs sm:text-sm font-bold hover:underline underline-offset-4 transition-all opacity-90 hover:opacity-100 p-1 -ml-1">
                            <span className={`${insight.type === 'danger' ? 'text-red-700 dark:text-red-300' : insight.type === 'warning' ? 'text-orange-700 dark:text-orange-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                                {insight.action}
                            </span>
                            <ArrowRight className={`h-3 w-3 sm:h-4 sm:w-4 ml-1.5 ${insight.type === 'danger' ? 'text-red-700 dark:text-red-300' : insight.type === 'warning' ? 'text-orange-700 dark:text-orange-300' : 'text-emerald-700 dark:text-emerald-300'}`} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};


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
    const gradeColor =
        !scoreGrade ? 'from-slate-400 to-slate-600 shadow-slate-500/20' :
            scoreGrade === 'A' ? 'from-emerald-400 to-emerald-600 shadow-emerald-500/30' :
                scoreGrade === 'B' ? 'from-indigo-400 to-indigo-600 shadow-indigo-500/30' :
                    scoreGrade === 'C' ? 'from-orange-400 to-orange-600 shadow-orange-500/30' :
                        'from-red-400 to-red-600 shadow-red-500/30';

    const role = user?.role || 'user';

    let welcomeTitleKey = 'dashboard.welcomeTitle';
    let welcomeSubtitle1Key = 'dashboard.welcomeSubtitle1';
    let welcomeSubtitle2Key = 'dashboard.welcomeSubtitle2';

    if (role === 'admin' || role === 'rssi') {
        welcomeTitleKey = 'dashboard.welcomeTitle_rssi';
        welcomeSubtitle1Key = 'dashboard.welcomeSubtitle1_rssi';
        welcomeSubtitle2Key = 'dashboard.welcomeSubtitle2_rssi';
    } else if (role === 'direction') {
        welcomeTitleKey = 'dashboard.welcomeTitle_direction';
        welcomeSubtitle1Key = 'dashboard.welcomeSubtitle1_direction';
        welcomeSubtitle2Key = 'dashboard.welcomeSubtitle2_direction';
    } else if (role === 'auditor') {
        welcomeTitleKey = 'dashboard.welcomeTitle_auditor';
        welcomeSubtitle1Key = 'dashboard.welcomeSubtitle1_auditor';
        welcomeSubtitle2Key = 'dashboard.welcomeSubtitle2_auditor';
    } else if (role === 'project_manager') {
        welcomeTitleKey = 'dashboard.welcomeTitle_project_manager';
        welcomeSubtitle1Key = 'dashboard.welcomeSubtitle1_project_manager';
        welcomeSubtitle2Key = 'dashboard.welcomeSubtitle2_project_manager';
    } else {
        welcomeTitleKey = 'dashboard.welcomeTitle_user';
        welcomeSubtitle1Key = 'dashboard.welcomeSubtitle1_user';
        welcomeSubtitle2Key = 'dashboard.welcomeSubtitle2_user';
    }

    const welcomeTitle = t(welcomeTitleKey);
    const welcomeSubtitle1 = t(welcomeSubtitle1Key);
    const welcomeSubtitle2 = t(welcomeSubtitle2Key);

    const cards = [
        { title: t('dashboard.createAsset'), desc: role === 'admin' ? t('dashboard.createAssetDesc_rssi') : t('dashboard.createAssetDesc'), icon: Server, color: 'blue', link: '/assets' },
        { title: t('dashboard.configureControls'), desc: t('dashboard.configureControlsDesc'), icon: ClipboardCheck, color: 'emerald', link: '/compliance' },
        { title: t('dashboard.addDocuments'), desc: t('dashboard.addDocumentsDesc'), icon: FileText, color: 'purple', link: '/documents' },
    ];

    return (
        <div className="relative overflow-hidden rounded-[2.5rem] bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-slate-200/50 dark:ring-white/5 transition-all duration-500 group isolation-auto">
            {/* Enhanced Background Effects - Premium Gradients */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 via-white/50 to-slate-100/50 dark:from-slate-900/80 dark:via-slate-900/90 dark:to-slate-950/90 pointer-events-none"></div>
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-500/10 dark:bg-brand-400/5 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none mix-blend-multiply dark:mix-blend-screen"></div>
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/10 dark:bg-indigo-400/5 rounded-full blur-[80px] -ml-20 -mb-20 pointer-events-none mix-blend-multiply dark:mix-blend-screen"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] dark:opacity-[0.05] mix-blend-overlay pointer-events-none"></div>

            <div className="relative z-10 p-6 sm:p-8 md:p-10">
                {isEmpty && !loading ? (
                    <div className="flex flex-col items-center justify-center text-center py-12 animate-fade-in">
                        <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-widest mb-8 backdrop-blur-md shadow-sm">
                            <span className="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full mr-2.5 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                            {organizationName || user?.organizationName || t('dashboard.operationalSystem')}
                        </div>

                        <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight font-display mb-6 drop-shadow-sm leading-tight">
                            {welcomeTitle}
                        </h2>
                        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mb-12 leading-relaxed font-medium">
                            {welcomeSubtitle1} {welcomeSubtitle2}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full mx-auto">
                            {cards.map((card, i) => (
                                <button
                                    key={i}
                                    onClick={() => navigate(card.link)}
                                    className={`group relative p-8 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-[2rem] hover:border-${card.color}-400 dark:hover:border-${card.color}-500/50 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 overflow-hidden text-left`}
                                >
                                    <div className={`flex flex-col items-center gap-5 relative z-10`}>
                                        <div className={`p-5 bg-${card.color}-50 dark:bg-${card.color}-500/20 rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-sm ring-1 ring-${card.color}-100 dark:ring-${card.color}-500/30`}>
                                            <card.icon className={`h-10 w-10 text-${card.color}-600 dark:text-${card.color}-400`} />
                                        </div>
                                        <div className="text-center">
                                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{card.title}</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{card.desc}</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 lg:gap-14">
                        <div className="flex-1 min-w-0 space-y-8 w-full">
                            {/* Header Section */}
                            <div className="flex flex-col sm:flex-row items-start gap-6 sm:items-center">
                                <div className={`relative flex items-center justify-center w-24 h-24 shrink-0 rounded-[2rem] text-6xl font-black shadow-2xl bg-gradient-to-br ${gradeColor} text-white transform transition-transform hover:scale-105 duration-300`}>
                                    <span className="drop-shadow-lg relative z-10">{scoreGrade || '?'}</span>
                                    <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-t from-black/20 to-transparent mix-blend-overlay"></div>
                                    <div className="absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/20"></div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 tracking-tight font-display">
                                            Sentinel GRC
                                        </h1>
                                        <SecurityBadge feature="general" className="scale-90 origin-left" />
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100/80 dark:bg-white/10 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-widest shadow-sm backdrop-blur-sm">
                                            {organizationName || user?.organizationName || t('dashboard.operationalSystem')}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 pt-1">
                                        {/* Metrics Pills */}
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg border border-red-100 dark:border-red-900/30 text-xs font-bold shadow-sm cursor-help transition-all hover:bg-red-100 dark:hover:bg-red-900/30" title="Incidents Actifs">
                                            <Zap className="h-3.5 w-3.5" />
                                            {loading ? '...' : activeIncidentsCount} Incidents
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-100 dark:border-blue-900/30 text-xs font-bold shadow-sm cursor-help transition-all hover:bg-blue-100 dark:hover:bg-blue-900/30" title="Audits Ouverts">
                                            <ClipboardCheck className="h-3.5 w-3.5" />
                                            {loading ? '...' : openAuditsCount} Audits
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Insight Card */}
                            {insight.text && (
                                <div className="animate-slide-up">
                                    <InsightCard insight={insight} navigate={navigate} />
                                </div>
                            )}

                            {/* Actions & Team */}
                            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-6 pt-2 border-t border-slate-200/50 dark:border-white/5 mt-4">
                                {teamSize !== null && (
                                    <div className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate('/team')}>
                                        <div className="flex -space-x-3 overflow-hidden p-1">
                                            {[...Array(Math.min(3, teamSize))].map((_, i) => (
                                                <div key={i} className="inline-block h-9 w-9 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 shadow-sm relative z-0 transition-transform hover:z-10 hover:scale-110">
                                                    {String.fromCharCode(65 + i)}
                                                </div>
                                            ))}
                                            {teamSize > 3 && (
                                                <div className="inline-block h-9 w-9 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 shadow-sm relative z-0">
                                                    +{teamSize - 3}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                            <div className="font-bold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{teamSize} Membres</div>
                                            <div>{t('dashboard.teamMembers')}</div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={generateICal}
                                        className="flex items-center justify-center px-4 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white text-xs font-bold rounded-2xl hover:bg-slate-50 dark:hover:bg-white/10 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                                    >
                                        <CalendarDays className="h-4 w-4 mr-2 text-slate-400" />
                                        {t('dashboard.exportIcal')}
                                    </button>
                                    <button
                                        onClick={generateExecutiveReport}
                                        className="flex items-center justify-center px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-2xl hover:scale-105 transition-all shadow-lg shadow-slate-900/20 dark:shadow-white/10 active:scale-95"
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        {t('dashboard.executiveReport')}
                                    </button>
                                </div>
                            </div>
                        </div>


                        {/* Radar Chart Section - Desktop Only */}
                        {radarData && (
                            <div className="hidden lg:block relative shrink-0">
                                {/* Decorator container for Radar to make it look embedded */}
                                <div className="p-3 bg-slate-50/50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5 backdrop-blur-sm">
                                    <MaturityRadarWidget
                                        radarData={radarData}
                                        t={t}
                                        theme={theme || 'light'}
                                        navigate={navigate}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Radar Mobile Substitute - if needed, but usually hidden is fine as it's additional info */}
                    </div>
                )}
            </div>
        </div>
    );
};
