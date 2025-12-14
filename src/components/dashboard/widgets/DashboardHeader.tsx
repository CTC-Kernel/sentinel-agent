import React from 'react';
import { Server, ClipboardCheck, FileText, Zap, ArrowRight, CalendarDays, Download, X, ChevronRight, Activity, ShieldCheck, Users, AlertTriangle, Loader2 } from '../../ui/Icons';
import { MaturityRadarWidget } from './MaturityRadarWidget';
import { ShinyText } from '../../ui/ShinyText';


type DashboardInsight = {
    type?: 'danger' | 'warning' | 'success' | string;
    text?: string;
    details?: string;
    link?: string;
    action?: string;
};

type DashboardUserLike = {
    role?: string;
    displayName?: string;
    organizationName?: string;
};

type RadarDatum = { subject: string; A: number; fullMark?: number };


const InsightCard: React.FC<{ insight: DashboardInsight, navigate: (path: string) => void }> = ({ insight, navigate }) => {
    const [isVisible, setIsVisible] = React.useState(true);

    if (!isVisible) return null;

    const styles = {
        danger: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-600 dark:text-red-400', iconBg: 'bg-red-500/20', icon: AlertTriangle },
        warning: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-600 dark:text-orange-400', iconBg: 'bg-orange-500/20', icon: AlertTriangle },
        success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-500/20', icon: ShieldCheck }
    };

    const type = (insight.type as keyof typeof styles) || 'success';
    const style = styles[type];
    const Icon = style.icon;

    return (
        <div className={`relative overflow-hidden p-5 rounded-2xl border ${style.bg} ${style.border} backdrop-blur-md transition-all duration-300 animate-slide-up group hover:shadow-lg`}>
            <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl shrink-0 ${style.iconBg} ${style.text} shadow-sm`}>
                    <Icon className="h-5 w-5" fill="currentColor" fillOpacity={0.2} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-base font-bold text-foreground mb-1 pr-6 tracking-tight">{insight.text || ''}</p>
                    {insight.details && <p className="text-sm text-muted-foreground leading-relaxed max-w-[95%] opacity-90">{insight.details}</p>}

                    {insight.link && (
                        <button
                            onClick={() => navigate(insight.link ?? '')}
                            className={`mt-3 inline-flex items-center text-xs font-bold ${style.text} uppercase tracking-wider hover:opacity-80 transition-opacity`}
                        >
                            {insight.action || ''} <ArrowRight className="h-3 w-3 ml-1" />
                        </button>
                    )}
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); setIsVisible(false); }}
                    className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-accent transition-colors"
                >
                    <X className="h-4 w-4 text-muted-foreground" />
                </button>
            </div>
        </div>
    );
};

interface DashboardHeaderProps {
    user: DashboardUserLike | null;
    organizationName: string;
    scoreGrade?: string;
    stats?: unknown;
    radarData?: RadarDatum[];
    loading: boolean;
    isEmpty?: boolean;
    navigate?: (path: string) => void;
    t?: (key: string) => string;
    theme?: string;
    insight?: DashboardInsight;
    teamSize: number | null;
    activeIncidentsCount: number;
    openAuditsCount: number;
    generateICal?: () => void;
    generateExecutiveReport?: () => void;
    isGeneratingReport?: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    user, organizationName, scoreGrade, radarData, loading, isEmpty,
    navigate = () => { },
    t = (k) => k,
    theme, insight, teamSize,
    activeIncidentsCount, openAuditsCount,
    generateICal = () => { },
    generateExecutiveReport = () => { },
    isGeneratingReport = false
}) => {
    // Determine gradient based on score
    const getGradeColor = (g?: string) => {
        if (!g) return 'from-slate-500 to-slate-600';
        if (g === 'A') return 'from-emerald-400 to-emerald-600';
        if (g === 'B') return 'from-blue-400 to-blue-600';
        if (g === 'C') return 'from-orange-400 to-orange-600';
        return 'from-red-500 to-red-700';
    };

    type Role = 'admin' | 'rssi' | 'direction' | 'auditor' | 'project_manager' | 'user';
    const rawRole = user?.role;
    const role: Role = (rawRole === 'admin' || rawRole === 'rssi' || rawRole === 'direction' || rawRole === 'auditor' || rawRole === 'project_manager') ? rawRole : 'user';

    const welcomeKey = `dashboard.welcomeTitle_${role}`;

    const subtitleKey1 = `dashboard.welcomeSubtitle1_${role}`;

    const cards = [
        { title: t('dashboard.createAsset'), desc: role === 'admin' ? t('dashboard.createAssetDesc_rssi') : t('dashboard.createAssetDesc'), icon: Server, color: 'blue', link: '/assets' },
        { title: t('dashboard.configureControls'), desc: t('dashboard.configureControlsDesc'), icon: ClipboardCheck, color: 'emerald', link: '/compliance' },
        { title: t('dashboard.addDocuments'), desc: t('dashboard.addDocumentsDesc'), icon: FileText, color: 'purple', link: '/documents' },
    ];

    if (isEmpty && !loading) {
        return (
            <div className="relative overflow-hidden rounded-[2.5rem] bg-card text-card-foreground shadow-2xl dark:shadow-none border border-border p-8 md:p-16 text-center animate-fade-in group">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/10 via-slate-50/50 to-white dark:from-indigo-500/10 dark:via-slate-900/50 dark:to-slate-900 pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center max-w-4xl mx-auto">
                    <div className="inline-flex items-center px-4 py-2 rounded-full bg-background/60 border border-border mb-8 backdrop-blur-md shadow-sm">
                        <span className="relative flex h-2.5 w-2.5 mr-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{organizationName || t('dashboard.operationalSystem')}</span>
                    </div>

                    <div className="mb-8">
                        {/* Welcome Text with Shiny Effect */}
                        <h2 className="text-4xl sm:text-5xl font-black font-display text-foreground tracking-tight mb-3">
                            {t(welcomeKey).split(',')[0]}, <ShinyText speed={3} className="text-foreground">{user?.displayName || 'Utilisateur'}</ShinyText>
                        </h2>
                        <p className="text-lg font-medium text-muted-foreground max-w-2xl leading-relaxed">
                            {t(subtitleKey1)}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
                        {cards.map((card, i) => (
                            <button key={i} onClick={() => navigate(card.link)} className="group/card relative p-8 rounded-3xl bg-card/60 border border-border hover:border-brand-500/50 dark:hover:border-brand-400/50 transition-all duration-500 hover:shadow-xl hover:-translate-y-2 overflow-hidden">
                                <div className={`absolute -right-10 -bottom-10 w-40 h-40 bg-${card.color}-500/10 rounded-full blur-3xl group-hover/card:bg-${card.color}-500/20 transition-all duration-500`} />

                                <div className={`w-14 h-14 rounded-2xl bg-${card.color}-50 dark:bg-${card.color}-500/10 flex items-center justify-center mb-6 group-hover/card:scale-110 transition-transform duration-500 shadow-sm`}>
                                    <card.icon className={`h-7 w-7 text-${card.color}-600 dark:text-${card.color}-400`} />
                                </div>
                                <h3 className="text-lg font-bold text-foreground mb-2 tracking-tight group-hover/card:text-brand-600 dark:group-hover/card:text-brand-400 transition-colors">{card.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed relative z-10">{card.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="group relative rounded-[2.5rem] bg-card backdrop-blur-3xl shadow-2xl dark:shadow-none border border-border overflow-hidden transition-all duration-700 hover:shadow-3xl">
            {/* Dynamic Mesh Gradients */}
            <div className="absolute top-0 right-0 w-[50rem] h-[50rem] bg-gradient-to-b from-brand-500/10 to-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none opacity-40 animate-pulse-slow" />
            <div className="absolute bottom-0 left-0 w-[40rem] h-[40rem] bg-gradient-to-t from-blue-500/10 to-emerald-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none opacity-40 mix-blend-multiply dark:mix-blend-screen" />

            {/* Subtle Grid Texture */}
            <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.02] dark:opacity-[0.04] pointer-events-none" />

            <div className="relative z-10 p-8 sm:p-12">
                <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">

                    {/* Left Column: Essential Info */}
                    <div className="flex-1 space-y-10">
                        {/* Header Row */}
                        <div className="flex items-start justify-between">
                            <div className="space-y-3">
                                <div className="flex items-center gap-4 mb-1">
                                    <div className="px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-300 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">Workspace</div>
                                </div>
                                <h1 className="text-4xl sm:text-5xl font-black text-foreground tracking-tight font-display drop-shadow-sm leading-tight">
                                    {organizationName || user?.organizationName || t('dashboard.operationalSystem')}
                                </h1>
                                <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                    </span>
                                    <span className="text-muted-foreground font-mono text-xs uppercase tracking-wide">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                                </div>
                            </div>

                            {/* Score Box - Mobile */}
                            <div className="lg:hidden">
                                <div className={`relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br ${getGradeColor(scoreGrade)} shadow-xl ring-4 ring-background`}>
                                    <span className="text-3xl font-black text-white drop-shadow-md font-display">{scoreGrade || '-'}</span>
                                    <div className="absolute inset-0 rounded-2xl border border-border/20" />
                                </div>
                            </div>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                            <div className="group/metric relative flex flex-col p-5 rounded-3xl bg-card/50 border border-border backdrop-blur-sm hover:bg-card/80 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-xl bg-background/60 text-muted-foreground group-hover/metric:bg-brand-50 group-hover/metric:text-brand-600 transition-colors">
                                        <Activity className="h-4 w-4" />
                                    </div>
                                    <div className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Score</div>
                                </div>
                                <div className="text-2xl font-bold text-foreground tracking-tight">{scoreGrade || '-'}</div>
                            </div>

                            <div className="group/metric relative flex flex-col p-5 rounded-3xl bg-card/50 border border-border backdrop-blur-sm hover:bg-card/80 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-xl bg-background/60 text-muted-foreground group-hover/metric:bg-blue-50 group-hover/metric:text-blue-600 transition-colors">
                                        <Users className="h-4 w-4" />
                                    </div>
                                    <div className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Équipe</div>
                                </div>
                                <div className="text-2xl font-bold text-foreground tracking-tight">{teamSize || 0}</div>
                            </div>

                            <div
                                onClick={() => navigate('/incidents')}
                                className="group/metric relative flex flex-col p-5 rounded-3xl bg-red-500/5 border border-red-500/10 backdrop-blur-sm hover:bg-red-500/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer"
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 group-hover/metric:bg-red-500/20 transition-colors">
                                        <Zap className="h-4 w-4" />
                                    </div>
                                    <div className="text-red-600/70 dark:text-red-400/70 text-[10px] font-bold uppercase tracking-widest">Incidents</div>
                                </div>
                                <div className="text-2xl font-bold text-red-700 dark:text-red-400 tracking-tight">{activeIncidentsCount}</div>
                            </div>

                            <div
                                onClick={() => navigate('/audits')}
                                className="group/metric relative flex flex-col p-5 rounded-3xl bg-blue-500/5 border border-blue-500/10 backdrop-blur-sm hover:bg-blue-500/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer"
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover/metric:bg-blue-500/20 transition-colors">
                                        <ClipboardCheck className="h-4 w-4" />
                                    </div>
                                    <div className="text-blue-600/70 dark:text-blue-400/70 text-[10px] font-bold uppercase tracking-widest">Audits</div>
                                </div>
                                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 tracking-tight">{openAuditsCount}</div>
                            </div>
                        </div>

                        {/* Insight & Actions */}
                        <div className="space-y-6">
                            {insight?.text && <InsightCard insight={insight} navigate={navigate} />}

                            <div className="flex flex-wrap items-center gap-4">
                                <button
                                    onClick={generateExecutiveReport}
                                    disabled={isGeneratingReport}
                                    className="flex items-center px-6 py-3.5 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-xl shadow-slate-900/10 hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isGeneratingReport ? <Loader2 className="h-4 w-4 mr-2.5 animate-spin" /> : <Download className="h-4 w-4 mr-2.5 transition-transform group-hover:translate-y-0.5" />}
                                    {t('dashboard.executiveReport')}
                                </button>
                                <button
                                    onClick={generateICal}
                                    className="flex items-center px-6 py-3.5 bg-card border border-border text-foreground rounded-2xl font-bold text-sm hover:bg-accent transition-all hover:-translate-y-0.5"
                                >
                                    <CalendarDays className="h-4 w-4 mr-2.5 text-muted-foreground group-hover:text-foreground" />
                                    {t('dashboard.exportIcal')}
                                </button>
                                {role === 'admin' && (
                                    <button
                                        onClick={() => navigate('/team')}
                                        className="flex items-center px-6 py-3.5 bg-transparent border-2 border-dashed border-border text-muted-foreground rounded-2xl font-bold text-sm hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/5 transition-all ml-auto"
                                    >
                                        Inviter un membre <ChevronRight className="h-3 w-3 ml-2 opacity-50 transition-transform group-hover:translate-x-1" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Radar (Desktop) / Grade (Desktop) */}
                    {radarData && (
                        <div className="hidden lg:flex flex-col gap-8 w-[420px] shrink-0">
                            {/* Grade Card - Premium Glass */}
                            <div className="group relative overflow-hidden rounded-[2.5rem] bg-foreground text-background p-10 shadow-2xl transition-all duration-500 hover:shadow-brand-500/20">
                                <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${getGradeColor(scoreGrade)} rounded-full blur-[80px] opacity-30 -mr-20 -mt-20 transition-all duration-700 group-hover:opacity-50 transform-gpu`} />
                                <div className={`absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr ${getGradeColor(scoreGrade)} rounded-full blur-[60px] opacity-10 -ml-16 -mb-16 transform-gpu`} />

                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-8">
                                        <div>
                                            <span className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Gouvernance Score</span>
                                            <h3 className="text-xl font-bold text-background">Indice de Maturité</h3>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-background/10 backdrop-blur-md border border-border/20 flex items-center justify-center">
                                            <Activity className="h-6 w-6 text-background" />
                                        </div>
                                    </div>

                                    <div className="flex items-end justify-between">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-8xl font-black tracking-tighter leading-none font-display bg-clip-text text-transparent bg-gradient-to-b from-background to-muted-foreground/80 filter drop-shadow-sm">{scoreGrade || '-'}</span>
                                            <span className="text-xl font-medium text-muted-foreground mb-2">/ A</span>
                                        </div>
                                        <div className={`mb-3 px-4 py-2 rounded-xl bg-background/10 backdrop-blur-md text-sm font-bold border border-border/20 shadow-lg ${scoreGrade === 'A' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : scoreGrade === 'B' ? 'text-blue-300 bg-blue-500/10 border-blue-500/20' : 'text-orange-300 bg-orange-500/10 border-orange-500/20'}`}>
                                            {scoreGrade === 'A' ? 'Excellent' : scoreGrade === 'B' ? 'Bon' : scoreGrade === 'C' ? 'Moyen' : 'Critique'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Radar Embedded - Glass Container */}
                            <div className="flex-1 bg-card/40 rounded-[2.5rem] border border-border/60 backdrop-blur-xl p-8 flex flex-col shadow-sm dark:shadow-none">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6 text-center">Couverture par Domaine</h4>
                                <div className="flex-1 flex items-center justify-center -ml-2 min-h-[220px]">
                                    <MaturityRadarWidget
                                        radarData={radarData}
                                        t={t}
                                        theme={theme || 'light'}
                                        navigate={navigate}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
