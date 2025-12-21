import React from 'react';
import { motion } from 'framer-motion';
import { Server, ClipboardCheck, FileText, ArrowRight, CalendarDays, Loader2, Activity, ShieldCheck, Users, AlertTriangle, LayoutDashboard, Check } from '../../ui/Icons';
import { ShinyText } from '../../ui/ShinyText';


type DashboardInsight = {
    type?: 'danger' | 'warning' | 'success' | string;
    text?: string;
    details?: string;
    link?: string;
    action?: string;
};

import { Tooltip } from '../../ui/Tooltip';

type DashboardUserLike = {
    role?: string;
    displayName?: string;
    organizationName?: string;
};




interface DashboardHeaderProps {
    user: DashboardUserLike | null;
    organizationName: string;
    scoreGrade?: string;
    loading: boolean;
    isEmpty?: boolean;
    navigate?: (path: string) => void;
    t?: (key: string) => string;
    insight?: DashboardInsight;
    generateICal?: () => void;
    generateExecutiveReport?: () => void;
    isGeneratingReport?: boolean;
    isEditing?: boolean;
    onToggleEdit?: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    user, organizationName, scoreGrade, loading, isEmpty,
    navigate = () => { },
    t = (k) => k,
    insight,
    generateICal = () => { },
    generateExecutiveReport = () => { },
    isGeneratingReport = false,
    isEditing = false,
    onToggleEdit
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
        <motion.div
            initial={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            className="glass-panel relative rounded-3xl p-1 border border-glass-border shadow-lg overflow-hidden group"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />

            {/* Inner Content Container */}
            <div className="relative z-10 rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-6 md:p-8 transition-all duration-500 group-hover:bg-white/50 dark:group-hover:bg-slate-900/50">

                <div className="relative z-10 px-6 py-5">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">

                        {/* Left: Organization & Welcome */}
                        <div className="flex items-center gap-5 min-w-[280px]">
                            <div className="relative shrink-0">
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getGradeColor(scoreGrade)} flex items-center justify-center shadow-lg relative overflow-hidden`}>
                                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                    <span className="text-xl font-black text-white font-display relative z-10">{scoreGrade || '-'}</span>
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-background flex items-center justify-center">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-monitoring-ping absolute" />
                                    <div className="w-3 h-3 rounded-full bg-emerald-500 relative z-10" />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-none mb-1">
                                    {organizationName || user?.organizationName || 'Dashboard'}
                                </h1>
                                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                    <span>{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                                    <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                    <span className="uppercase tracking-wide">Workspace</span>
                                </div>
                            </div>
                        </div>

                        {/* Middle: Integrated Insight Banner */}
                        <div className="flex-1 w-full lg:w-auto">
                            {insight?.text ? (
                                <div className={`flex items-start sm:items-center gap-3 p-3 rounded-xl border ${insight.type === 'danger' ? 'bg-red-500/5 border-red-500/10' : insight.type === 'warning' ? 'bg-orange-500/5 border-orange-500/10' : 'bg-emerald-500/5 border-emerald-500/10'} hover:bg-opacity-80 transition-colors cursor-pointer group/insight`} onClick={() => navigate(insight.link || '')}>
                                    <div className={`p-1.5 rounded-lg shrink-0 ${insight.type === 'danger' ? 'bg-red-500/10 text-red-600' : 'bg-orange-500/10 text-orange-600'}`}>
                                        {insight.type === 'danger' ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate pr-2">{insight.text}</p>
                                        <p className="text-xs text-muted-foreground truncate hidden sm:block">{insight.details}</p>
                                    </div>
                                    {insight.link && <ArrowRight className="h-4 w-4 text-muted-foreground group-hover/insight:translate-x-1 transition-transform" />}
                                </div>
                            ) : (
                                <div className="hidden lg:flex items-center gap-2 p-3 rounded-xl bg-accent/30 border border-border/50 text-muted-foreground text-sm">
                                    <Activity className="h-4 w-4" />
                                    <span>All systems operational</span>
                                </div>
                            )}
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-3 shrink-0 w-full lg:w-auto flex-wrap lg:flex-nowrap justify-end">
                            {onToggleEdit && (
                                <Tooltip content={isEditing ? "Terminer l'édition" : "Personnaliser le tableau de bord"} position="bottom">
                                    <button
                                        onClick={onToggleEdit}
                                        className={`p-2 rounded-md transition-all ${isEditing ? 'bg-brand-500/10 text-brand-600 border border-brand-200' : 'text-muted-foreground hover:text-foreground hover:bg-background border border-transparent'}`}
                                    >
                                        {isEditing ? <Check className="h-4 w-4" /> : <LayoutDashboard className="h-4 w-4" />}
                                    </button>
                                </Tooltip>
                            )}

                            <div className="flex items-center gap-2 p-1 bg-accent/50 rounded-lg border border-border/50">
                                <Tooltip content={t('dashboard.executiveReport')} position="bottom">
                                    <button
                                        onClick={generateExecutiveReport}
                                        disabled={isGeneratingReport}
                                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-background rounded-md transition-all disabled:opacity-50"
                                    >
                                        {isGeneratingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                                    </button>
                                </Tooltip>
                                <Tooltip content={t('dashboard.exportIcal')} position="bottom">
                                    <button
                                        onClick={generateICal}
                                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-background rounded-md transition-all"
                                    >
                                        <CalendarDays className="h-4 w-4" />
                                    </button>
                                </Tooltip>
                            </div>

                            {role === 'admin' && (
                                <Tooltip content="Inviter un nouveau membre" position="bottom">
                                    <button
                                        onClick={() => navigate('/team')}
                                        className="hidden sm:flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-500/20 transition-all hover:-translate-y-0.5"
                                    >
                                        <Users className="h-4 w-4" />
                                        <span className="hidden xl:inline">Inviter</span>
                                    </button>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
