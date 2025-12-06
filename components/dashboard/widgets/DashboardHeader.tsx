import React from 'react';
import { Server, ClipboardCheck, FileText, Zap, ArrowRight, CalendarDays, Download, X, ChevronRight, Activity } from '../../ui/Icons';
import { MaturityRadarWidget } from './MaturityRadarWidget';
import { SecurityBadge } from '../../ui/SecurityBadge';

const InsightCard: React.FC<{ insight: any, navigate: (path: string) => void }> = ({ insight, navigate }) => {
    const [isVisible, setIsVisible] = React.useState(true);

    if (!isVisible) return null;

    const styles = {
        danger: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-600 dark:text-red-400', iconBg: 'bg-red-500/20' },
        warning: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-600 dark:text-orange-400', iconBg: 'bg-orange-500/20' },
        success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-500/20' }
    };

    const type = insight.type as keyof typeof styles || 'success';
    const style = styles[type];

    return (
        <div className={`relative overflow-hidden p-4 rounded-xl border ${style.bg} ${style.border} backdrop-blur-md transition-all duration-300 animate-slide-up group`}>
            <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg shrink-0 ${style.iconBg} ${style.text}`}>
                    <Zap className="h-4 w-4" fill="currentColor" strokeWidth={0} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white mb-0.5 pr-6">{insight.text}</p>
                    {insight.details && <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-[90%]">{insight.details}</p>}

                    {insight.link && (
                        <button
                            onClick={() => navigate(insight.link!)}
                            className={`mt-2 inline-flex items-center text-xs font-bold ${style.text} hover:underline decoration-2 underline-offset-4`}
                        >
                            {insight.action} <ArrowRight className="h-3 w-3 ml-1" />
                        </button>
                    )}
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); setIsVisible(false); }}
                    className="absolute top-3 right-3 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                    <X className="h-3.5 w-3.5 text-slate-400" />
                </button>
            </div>
        </div>
    );
};

interface DashboardHeaderProps {
    user: any;
    organizationName: string;
    scoreGrade?: string;
    stats?: any;
    radarData?: any[];
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
    // Determine gradient based on score
    const getGradeColor = (g?: string) => {
        if (!g) return 'from-slate-500 to-slate-600';
        if (g === 'A') return 'from-emerald-400 to-emerald-600';
        if (g === 'B') return 'from-indigo-400 to-indigo-600';
        if (g === 'C') return 'from-orange-400 to-orange-600';
        return 'from-red-400 to-red-600';
    };

    const role = user?.role || 'user';
    const welcomeKey = `dashboard.welcomeTitle_${['admin', 'rssi', 'direction', 'auditor', 'project_manager'].includes(role) ? role : 'user'}`;
    const subtitleKey1 = `dashboard.welcomeSubtitle1_${['admin', 'rssi', 'direction', 'auditor', 'project_manager'].includes(role) ? role : 'user'}`;
    const subtitleKey2 = `dashboard.welcomeSubtitle2_${['admin', 'rssi', 'direction', 'auditor', 'project_manager'].includes(role) ? role : 'user'}`;

    const cards = [
        { title: t('dashboard.createAsset'), desc: role === 'admin' ? t('dashboard.createAssetDesc_rssi') : t('dashboard.createAssetDesc'), icon: Server, color: 'blue', link: '/assets' },
        { title: t('dashboard.configureControls'), desc: t('dashboard.configureControlsDesc'), icon: ClipboardCheck, color: 'emerald', link: '/compliance' },
        { title: t('dashboard.addDocuments'), desc: t('dashboard.addDocumentsDesc'), icon: FileText, color: 'purple', link: '/documents' },
    ];

    if (isEmpty && !loading) {
        return (
            <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-glass dark:shadow-none border border-slate-200/50 dark:border-white/5 p-8 md:p-12 text-center animate-fade-in group">
                <div className="absolute inset-0 bg-gradient-to-b from-slate-50/50 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center max-w-2xl mx-auto">
                    <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 mb-8 backdrop-blur-sm">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse" />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">{organizationName || t('dashboard.operationalSystem')}</span>
                    </div>

                    <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-6 font-display">
                        {t(welcomeKey)}
                    </h2>
                    <p className="text-lg text-slate-600 dark:text-slate-400 mb-12 leading-relaxed">
                        {t(subtitleKey1)} {t(subtitleKey2)}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
                        {cards.map((card, i) => (
                            <button key={i} onClick={() => navigate(card.link)} className="group/card relative p-6 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-brand-300 dark:hover:border-brand-500/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                                <div className={`w-12 h-12 rounded-xl bg-${card.color}-50 dark:bg-${card.color}-500/10 flex items-center justify-center mb-4 group-hover/card:scale-110 transition-transform`}>
                                    <card.icon className={`h-6 w-6 text-${card.color}-600 dark:text-${card.color}-400`} />
                                </div>
                                <h3 className="font-bold text-slate-900 dark:text-white mb-2">{card.title}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{card.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="group relative rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl shadow-apple dark:shadow-glass-dark border border-white/20 dark:border-white/5 overflow-hidden transition-all duration-500">
            {/* Subtle Gradient Backdrops - No Noise */}
            <div className="absolute top-0 right-0 p-32 bg-brand-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            <div className="absolute bottom-0 left-0 p-24 bg-indigo-500/5 rounded-full blur-3xl -ml-12 -mb-12 pointer-events-none" />

            <div className="relative z-10 p-6 sm:p-8">
                <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">

                    {/* Left Column: Essential Info */}
                    <div className="flex-1 space-y-8">
                        {/* Header Row */}
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight font-display">
                                        Sentinel GRC
                                    </h1>
                                    <SecurityBadge feature="general" className="scale-90" />
                                </div>
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    {organizationName || user?.organizationName || t('dashboard.operationalSystem')}
                                </div>
                            </div>

                            {/* Score Box - Mobile */}
                            <div className="lg:hidden">
                                <div className={`relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${getGradeColor(scoreGrade)} shadow-lg`}>
                                    <span className="text-2xl font-black text-white drop-shadow-md">{scoreGrade || '-'}</span>
                                    <div className="absolute inset-0 rounded-2xl border border-white/20" />
                                </div>
                            </div>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="flex flex-col p-4 rounded-2xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/5 backdrop-blur-sm transition-colors hover:bg-slate-100/50 dark:hover:bg-white/10">
                                <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Grade</div>
                                <div className="text-2xl font-black text-slate-900 dark:text-white">{scoreGrade || '-'}</div>
                            </div>
                            <div className="flex flex-col p-4 rounded-2xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/5 backdrop-blur-sm transition-colors hover:bg-slate-100/50 dark:hover:bg-white/10">
                                <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Membres</div>
                                <div className="text-2xl font-black text-slate-900 dark:text-white">{teamSize || 0}</div>
                            </div>
                            <div className="flex flex-col p-4 rounded-2xl bg-red-500/5 border border-red-500/10 backdrop-blur-sm transition-colors hover:bg-red-500/10 cursor-pointer" title="Incidents Actifs">
                                <div className="text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Zap className="h-3 w-3" /> Incidents</div>
                                <div className="text-2xl font-black text-red-700 dark:text-red-400">{activeIncidentsCount}</div>
                            </div>
                            <div className="flex flex-col p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 backdrop-blur-sm transition-colors hover:bg-blue-500/10 cursor-pointer" title="Audits Ouverts">
                                <div className="text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><ClipboardCheck className="h-3 w-3" /> Audits</div>
                                <div className="text-2xl font-black text-blue-700 dark:text-blue-400">{openAuditsCount}</div>
                            </div>
                        </div>

                        {/* Insight & Actions */}
                        <div className="space-y-4">
                            {insight?.text && <InsightCard insight={insight} navigate={navigate} />}

                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    onClick={generateExecutiveReport}
                                    className="flex items-center px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95"
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    {t('dashboard.executiveReport')}
                                </button>
                                <button
                                    onClick={generateICal}
                                    className="flex items-center px-5 py-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/10 transition-all"
                                >
                                    <CalendarDays className="h-4 w-4 mr-2 text-slate-400" />
                                    {t('dashboard.exportIcal')}
                                </button>
                                {role === 'admin' && (
                                    <button
                                        onClick={() => navigate('/team')}
                                        className="flex items-center px-5 py-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/10 transition-all ml-auto"
                                    >
                                        Inviter <ChevronRight className="h-3 w-3 ml-2 opacity-50" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Radar (Desktop) / Grade (Desktop) */}
                    {/* Reorganized to feature the Radar elegantly */}
                    {radarData && (
                        <div className="hidden lg:flex flex-col gap-6 w-[340px] shrink-0">
                            {/* Grade Card */}
                            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 shadow-xl">
                                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${getGradeColor(scoreGrade)} blur-2xl opacity-40 -mr-10 -mt-10`} />
                                <div className="relative z-10 flex items-center justify-between mb-4">
                                    <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Score Global</span>
                                    <Activity className="h-5 w-5 text-slate-400" />
                                </div>
                                <div className="relative z-10 flex items-end gap-3">
                                    <span className="text-6xl font-black tracking-tighter leading-none">{scoreGrade || '-'}</span>
                                    <div className="mb-2 px-2 py-1 rounded bg-white/10 text-xs font-bold border border-white/10 backdrop-blur-md">
                                        Niveau {scoreGrade === 'A' ? 'Excel.' : scoreGrade === 'B' ? 'Bon' : scoreGrade === 'C' ? 'Moyen' : 'Critique'}
                                    </div>
                                </div>
                            </div>

                            {/* Radar Embedded */}
                            <div className="flex-1 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 backdrop-blur-sm p-2 flex items-center justify-center">
                                <MaturityRadarWidget
                                    radarData={radarData}
                                    t={t}
                                    theme={theme || 'light'}
                                    navigate={navigate}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
