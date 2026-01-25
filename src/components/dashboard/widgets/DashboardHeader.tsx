import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Server, ClipboardCheck, FileText, ArrowRight, CalendarDays, Loader2, Activity, ShieldCheck, Users, AlertTriangle, LayoutDashboard, Check, Sun, Cloud, CloudRain, CloudSnow, CloudLightning, Lightbulb, Sparkles, Target, Calendar, Download, Bot } from '../../ui/Icons';
import { Rocket } from '../../ui/Icons';
import { GlassCard } from '../../ui/GlassCard';
import { ShinyText } from '../../ui/ShinyText';
import { Spotlight } from '../../ui/aceternity/Spotlight';
import { BorderBeam } from '../../ui/aceternity/BorderBeam';
import { SparklesCore } from '../../ui/aceternity/Sparkles.tsx';

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

type NextDeadline = {
    title: string;
    date: Date;
    type: 'audit' | 'project' | 'control' | 'task';
    link?: string;
};

interface DashboardHeaderProps {
    user: DashboardUserLike | null;
    organizationName: string;
    scoreGrade?: string;
    loading: boolean;
    isEmpty?: boolean;
    navigate?: (path: string) => void;
    t?: (key: string, options?: Record<string, unknown>) => string;
    insight?: DashboardInsight;
    generateICal?: () => void;
    generateExecutiveReport?: () => void;
    isGeneratingReport?: boolean;
    isEditing?: boolean;
    onToggleEdit?: () => void;
    onShowGettingStarted?: () => void;
    isGettingStartedClosed?: boolean;
    activeIncidentsCount?: number;
    nextDeadline?: NextDeadline | null;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    user, organizationName, loading, isEmpty,
    navigate = () => { },
    t = (k, _o) => k,
    insight,
    generateICal = () => { },
    generateExecutiveReport = () => { },
    isGeneratingReport = false,
    isEditing = false,
    onToggleEdit,
    onShowGettingStarted,
    isGettingStartedClosed,
    activeIncidentsCount = 0,
    nextDeadline
}) => {

    type Role = 'admin' | 'rssi' | 'direction' | 'auditor' | 'project_manager' | 'user';
    const rawRole = user?.role;
    const role: Role = (rawRole === 'admin' || rawRole === 'rssi' || rawRole === 'direction' || rawRole === 'auditor' || rawRole === 'project_manager') ? rawRole : 'user';

    // État pour l'heure en temps réel
    const [currentTime, setCurrentTime] = useState(new Date());

    // État pour la météo
    const [weather, setWeather] = useState<{ temp: number; condition: string; icon: string } | null>(null);

    // Mise à jour de l'heure toutes les secondes
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Récupération de la météo (Paris par défaut)
    useEffect(() => {
        const fetchWeather = async () => {
            try {
                const response = await fetch(
                    'https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&current=temperature_2m,weather_code'
                );
                const data = await response.json();
                const weatherCode = data.current?.weather_code || 0;
                let condition = 'sunny';
                let icon = 'sun';

                if (weatherCode >= 0 && weatherCode <= 3) {
                    condition = 'sunny';
                    icon = 'sun';
                } else if (weatherCode >= 45 && weatherCode <= 48) {
                    condition = 'cloudy';
                    icon = 'cloud';
                } else if (weatherCode >= 51 && weatherCode <= 67) {
                    condition = 'rainy';
                    icon = 'rain';
                } else if (weatherCode >= 71 && weatherCode <= 77) {
                    condition = 'snowy';
                    icon = 'snow';
                } else if (weatherCode >= 80 && weatherCode <= 99) {
                    condition = 'stormy';
                    icon = 'storm';
                }

                setWeather({
                    temp: Math.round(data.current?.temperature_2m || 0),
                    condition,
                    icon
                });
            } catch {
                // Silently fail
            }
        };

        fetchWeather();
    }, []);

    // Fonction pour obtenir l'icône météo
    const getWeatherIcon = () => {
        const baseClass = "h-6 w-6 drop-shadow-sm";
        if (!weather) return <Sun className={`${baseClass} text-amber-400`} />;
        switch (weather.icon) {
            case 'sun': return <Sun className={`${baseClass} text-amber-400 animate-pulse-slow`} />;
            case 'cloud': return <Cloud className={`${baseClass} text-slate-500`} />;
            case 'rain': return <CloudRain className={`${baseClass} text-blue-500`} />;
            case 'snow': return <CloudSnow className={`${baseClass} text-sky-500`} />;
            case 'storm': return <CloudLightning className={`${baseClass} text-purple-500`} />;
            default: return <Sun className={`${baseClass} text-amber-500`} />;
        }
    };

    // Salutation intelligente basée sur l'heure
    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour >= 5 && hour < 12) return t('dashboard.greetingMorning') || 'Bonjour';
        if (hour >= 12 && hour < 18) return t('dashboard.greetingAfternoon') || 'Bon après-midi';
        if (hour >= 18 && hour < 22) return t('dashboard.greetingEvening') || 'Bonsoir';
        return t('dashboard.greetingNight') || 'Bonne nuit';
    };

    // Conseils sécurité du jour (rotatif basé sur le jour de l'année)
    const securityTips = [
        { tip: "Activez l'authentification à deux facteurs sur tous vos comptes critiques.", icon: "shield" },
        { tip: "Vérifiez régulièrement les accès et permissions de vos utilisateurs.", icon: "users" },
        { tip: "Sauvegardez vos données sensibles et testez vos restaurations.", icon: "database" },
        { tip: "Mettez à jour vos systèmes dès qu'un correctif de sécurité est disponible.", icon: "refresh" },
        { tip: "Formez vos équipes à reconnaître les tentatives de phishing.", icon: "mail" },
        { tip: "Documentez vos procédures de réponse aux incidents.", icon: "file" },
        { tip: "Auditez vos logs de sécurité au moins une fois par semaine.", icon: "search" },
        { tip: "Chiffrez les données sensibles au repos et en transit.", icon: "lock" },
        { tip: "Testez régulièrement vos plans de continuité d'activité.", icon: "activity" },
        { tip: "Limitez les privilèges administrateurs au strict nécessaire.", icon: "key" },
        { tip: "Surveillez les comportements anormaux sur votre réseau.", icon: "eye" },
        { tip: "Effectuez des tests de pénétration au moins une fois par an.", icon: "target" },
    ];
    const dayOfYear = Math.floor((currentTime.getTime() - new Date(currentTime.getFullYear(), 0, 0).getTime()) / 86400000);
    const todayTip = securityTips[dayOfYear % securityTips.length];

    const welcomeKey = `dashboard.welcomeTitle_${role}`;

    const subtitleKey1 = `dashboard.welcomeSubtitle1_${role}`;

    const cards = [
        { title: t('dashboard.createAsset'), desc: role === 'admin' ? t('dashboard.createAssetDesc_rssi') : t('dashboard.createAssetDesc'), icon: Server, color: 'blue', link: '/assets?action=create' },
        { title: t('dashboard.configureControls'), desc: t('dashboard.configureControlsDesc'), icon: ClipboardCheck, color: 'emerald', link: '/compliance' },
        { title: t('dashboard.addDocuments'), desc: t('dashboard.addDocumentsDesc'), icon: FileText, color: 'purple', link: '/documents?action=create' },
    ];

    // Static mappings for Tailwind JIT
    const CARD_STYLES: Record<string, {
        bg: string;
        bgHover: string;
        iconBg: string;
        iconText: string;
    }> = {
        blue: {
            bg: 'bg-info-bg',
            bgHover: 'group-hover/card:bg-info-bg/80',
            iconBg: 'bg-info-bg shadow-sm ring-1 ring-inset ring-info-border/30',
            iconText: 'text-info-text'
        },
        emerald: {
            bg: 'bg-success-bg',
            bgHover: 'group-hover/card:bg-success-bg/80',
            iconBg: 'bg-success-bg shadow-sm ring-1 ring-inset ring-success-border/30',
            iconText: 'text-success-text'
        },
        purple: {
            bg: 'bg-slate-100 dark:bg-slate-800',
            bgHover: 'group-hover/card:bg-slate-200 dark:group-hover/card:bg-slate-700',
            iconBg: 'bg-slate-100 dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-slate-200 dark:ring-slate-700',
            iconText: 'text-slate-600 dark:text-slate-400'
        }
    };

    if (isEmpty && !loading) {
        return (
            <GlassCard className="relative overflow-hidden rounded-5xl p-8 md:p-16 text-center animate-fade-in group shadow-apple" gradientOverlay={true}>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-500/20 via-background/0 to-background/0 dark:from-brand-500/10 dark:via-background/0 dark:to-background/0 opacity-50 transition-opacity duration-1000 group-hover:opacity-70" />
                <div className="relative z-10 flex flex-col items-center max-w-5xl mx-auto">
                    <div className="inline-flex items-center px-4 py-2 rounded-full bg-background/60 border border-border mb-4 backdrop-blur-md shadow-sm">
                        <span className="relative flex h-2.5 w-2.5 mr-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success/60 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
                        </span>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{organizationName || t('dashboard.operationalSystem')}</span>
                    </div>

                    <div className="mb-4">
                        {/* Welcome Text with Shiny Effect */}
                        <h2 className="text-2xl sm:text-3xl font-bold font-display text-foreground tracking-tight mb-3">
                            {t(welcomeKey).split(',')[0]}, <ShinyText speed={3} className="text-foreground">{user?.displayName || 'Utilisateur'}</ShinyText>
                        </h2>
                        <p className="text-lg font-medium text-muted-foreground max-w-2xl leading-relaxed">
                            {t(subtitleKey1)}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
                        {cards.map((card, i) => {
                            const styles = CARD_STYLES[card.color] || CARD_STYLES.blue;
                            return (
                                <button key={card.link || `card-${i}`} onClick={() => {
                                    if (card.link && card.link.startsWith('/')) navigate(card.link); // validateUrl check
                                }} className="group/card relative p-8 rounded-3xl bg-card/60 border border-border hover:border-brand-500/50 dark:hover:border-brand-400/50 transition-all duration-500 hover:shadow-xl hover:-translate-y-2 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" aria-label={card.title}>
                                    <div className={`absolute -right-10 -bottom-10 w-40 h-40 ${styles.bg} rounded-full blur-3xl ${styles.bgHover} transition-all duration-500`} />

                                    <div className={`w-14 h-14 rounded-2xl ${styles.iconBg} flex items-center justify-center mb-3 group-hover/card:scale-110 transition-transform duration-500 shadow-sm`}>
                                        <card.icon className={`h-7 w-7 ${styles.iconText}`} />
                                    </div>
                                    <h3 className="text-lg font-bold text-foreground mb-2 tracking-tight group-hover/card:text-brand-600 dark:group-hover/card:text-brand-400 transition-colors">{card.title}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed relative z-10">{card.desc}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </GlassCard>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.96, filter: 'blur(20px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="group relative rounded-5xl p-[2px] overflow-hidden shadow-2xl shadow-brand-500/10"
        >
            {/* Premium Animated Border Gradient */}
            <div className="absolute inset-0 bg-[conic-gradient(from_var(--shimmer-angle),var(--brand-400)_0%,var(--info-400)_25%,var(--brand-500)_50%,var(--success-400)_75%,var(--brand-400)_100%)] animate-shimmer-rotate opacity-60 group-hover:opacity-100 transition-opacity duration-1000" style={{ '--shimmer-angle': '0deg' } as React.CSSProperties} />
            <div className="absolute inset-[1px] rounded-5xl bg-background/95 dark:bg-slate-950/95" />

            <GlassCard className="glass-premium relative rounded-5xl overflow-hidden shadow-none border-none bg-gradient-to-br from-white/80 via-white/60 to-slate-50/80 dark:from-slate-900/90 dark:via-slate-900/70 dark:to-slate-950/90">
                {/* Multi-layer Spotlight Effects */}
                <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="var(--brand-500)" />
                <Spotlight className="-top-20 right-0 md:right-40 md:-top-10 opacity-50" fill="var(--info-400)" />

                {/* Premium Border Beam */}
                <BorderBeam size={600} duration={15} colorFrom="var(--brand-400)" colorTo="var(--info-500)" />

                {/* Layered Aurora Background */}
                <div className="absolute inset-0 bg-aurora animate-aurora opacity-40 dark:opacity-20 pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(var(--brand-500-rgb),0.3),transparent)] pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_80%_at_80%_50%,rgba(var(--info-500-rgb),0.15),transparent)] pointer-events-none" />
                <div className="absolute inset-0 bg-grid-slate-900/[0.02] dark:bg-grid-white/[0.02] pointer-events-none" />

                {/* Floating Orbs */}
                <div className="absolute top-10 left-[20%] w-32 h-32 bg-brand-500/20 rounded-full blur-3xl animate-float pointer-events-none" />
                <div className="absolute bottom-10 right-[15%] w-40 h-40 bg-info-500/15 rounded-full blur-3xl animate-float-delayed pointer-events-none" />

                {/* Inner Content Container */}
                <div className="relative z-10 p-6 md:p-8 lg:p-10">
                    <div className="relative z-10">
                        {/* Main Grid Layout */}
                        <div className="grid grid-cols-1 xl:grid-cols-[auto_1fr_auto] gap-6 lg:gap-8 items-center">

                            {/* Left: Logo */}
                            <div className="flex justify-center xl:justify-start">
                                <div className="relative shrink-0 group/orb cursor-default">
                                    {/* Outer Glow Ring */}
                                    <div className="absolute -inset-4 bg-gradient-to-r from-brand-500/30 via-info-500/30 to-brand-500/30 rounded-[2.5rem] blur-2xl opacity-0 group-hover/orb:opacity-100 transition-all duration-700 animate-pulse-slow" />

                                    {/* Main Logo Container */}
                                    <div className="relative w-32 h-32 sm:w-40 sm:h-40 lg:w-44 lg:h-44 rounded-[1.5rem] bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] overflow-hidden transition-all duration-700 ease-apple group-hover/orb:scale-[1.03] group-hover/orb:shadow-[0_25px_80px_-15px_rgba(var(--brand-500-rgb),0.25)] ring-1 ring-white/80 dark:ring-white/10">

                                        {/* Inner Gradient Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 via-transparent to-info-500/10 opacity-0 group-hover/orb:opacity-100 transition-opacity duration-700" />

                                        {/* Shimmer Effect */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover/orb:translate-x-full transition-transform duration-1000 ease-out" />

                                        {/* Sparkles */}
                                        <div className="absolute inset-0 opacity-0 group-hover/orb:opacity-100 transition-opacity duration-1000">
                                            <SparklesCore
                                                id="logo-sparkles"
                                                background="transparent"
                                                minSize={0.6}
                                                maxSize={1.8}
                                                particleDensity={60}
                                                className="w-full h-full"
                                                particleColor="var(--brand-400)"
                                            />
                                        </div>

                                        <img
                                            src="/images/pilotage.png"
                                            alt="PILOTAGE"
                                            className="w-full h-full object-contain relative z-10 p-3 drop-shadow-[0_10px_30px_rgba(0,0,0,0.12)] group-hover/orb:drop-shadow-[0_15px_40px_rgba(var(--brand-500-rgb),0.2)] transition-all duration-700"
                                        />

                                        {/* Premium Holographic Rings */}
                                        <div className="absolute inset-2 border-2 border-brand-500/20 rounded-[1.25rem] animate-spin-slow" />
                                        <div className="absolute inset-4 border border-info-500/15 rounded-[1rem] animate-spin-slow-reverse" />
                                        <div className="absolute inset-0 border border-white/40 dark:border-white/10 rounded-[1.5rem]" />
                                    </div>

                                    {/* Status Indicator - Premium */}
                                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-slate-900 backdrop-blur-xl flex items-center justify-center shadow-lg shadow-success/20 border-2 border-white dark:border-slate-800">
                                        <div className="relative w-3 h-3 rounded-full bg-success">
                                            <div className="absolute inset-0 rounded-full bg-success animate-ping opacity-50" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Center: Organization Info */}
                            <div className="flex flex-col gap-3 text-center xl:text-left p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border border-white/50 dark:border-slate-700/50 shadow-sm">
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                    className="flex items-center gap-3 justify-center xl:justify-start"
                                >
                                    <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-[0.35em] px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600">
                                        {t('common.pilotage')}
                                    </span>
                                    <div className="hidden sm:block h-[2px] w-10 bg-gradient-to-r from-slate-400 to-transparent rounded-full" />
                                </motion.div>

                                {/* Salutation personnalisée */}
                                <motion.div
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                >
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                                        {getGreeting()}, <span className="text-slate-700 dark:text-slate-200 font-semibold">{user?.displayName || 'Utilisateur'}</span>
                                    </p>
                                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black font-display text-slate-900 dark:text-white tracking-tight leading-none">
                                        {organizationName || user?.organizationName || t('sidebar.dashboard')}
                                    </h1>
                                </motion.div>

                                {/* Date, Heure & Météo - Modern Card */}
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                    className="flex items-center gap-4 mt-1"
                                >
                                    {/* Heure - Grand format */}
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                                            {currentTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="text-lg font-bold text-slate-500 dark:text-slate-500 tabular-nums">
                                            {currentTime.toLocaleTimeString(undefined, { second: '2-digit' }).slice(-2)}
                                        </span>
                                    </div>

                                    {/* Séparateur vertical */}
                                    <div className="hidden sm:block w-px h-10 bg-gradient-to-b from-transparent via-slate-300 dark:via-slate-600 to-transparent" />

                                    {/* Date & Météo */}
                                    <div className="hidden sm:flex flex-col gap-1">
                                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 capitalize">
                                            {currentTime.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                                        </span>
                                        {weather && (
                                            <div className="flex items-center gap-2">
                                                {getWeatherIcon()}
                                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                                    {weather.temp}°C · Paris
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            </div>

                            {/* Right: Actions - Premium Buttons */}
                            <div className="flex items-center gap-2 justify-center xl:justify-end flex-wrap">
                                {/* Quick Actions Group */}
                                <div className="flex items-center gap-1 p-1.5 bg-white/80 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-sm backdrop-blur-sm">
                                    {onToggleEdit && (
                                        <Tooltip content={isEditing ? t('dashboard.edit.finish') : t('dashboard.edit.customize')} position="bottom">
                                            <button
                                                onClick={onToggleEdit}
                                                className={`p-2.5 rounded-xl transition-all duration-300 ${isEditing
                                                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30'
                                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                                                    }`}
                                                aria-label={isEditing ? t('dashboard.edit.finish') : t('dashboard.edit.customize')}
                                            >
                                                {isEditing ? <Check className="h-4 w-4" /> : <LayoutDashboard className="h-4 w-4" />}
                                            </button>
                                        </Tooltip>
                                    )}

                                    <Tooltip content={t('dashboard.executiveReport')} position="bottom">
                                        <button
                                            onClick={generateExecutiveReport}
                                            disabled={isGeneratingReport}
                                            className="p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all duration-300 disabled:opacity-50"
                                            aria-label={t('dashboard.executiveReport')}
                                        >
                                            {isGeneratingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                                        </button>
                                    </Tooltip>

                                    <Tooltip content={t('dashboard.exportIcal')} position="bottom">
                                        <button
                                            onClick={generateICal}
                                            className="p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all duration-300"
                                            aria-label={t('dashboard.exportIcal')}
                                        >
                                            <CalendarDays className="h-4 w-4" />
                                        </button>
                                    </Tooltip>

                                    {isGettingStartedClosed && onShowGettingStarted && (
                                        <Tooltip content={t('dashboard.showGettingStarted')} position="bottom">
                                            <button
                                                onClick={onShowGettingStarted}
                                                className="p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-all duration-300"
                                                aria-label={t('dashboard.showGettingStarted')}
                                            >
                                                <Rocket className="h-4 w-4" />
                                            </button>
                                        </Tooltip>
                                    )}
                                </div>

                                {/* Download Agents Button */}
                                <Tooltip content="Télécharger les agents" position="bottom">
                                    <button
                                        onClick={() => navigate('/settings?tab=agents')}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
                                        aria-label="Télécharger les agents"
                                    >
                                        <Bot className="h-4 w-4" />
                                        <span className="hidden lg:inline">Agents</span>
                                        <Download className="h-3.5 w-3.5 opacity-60" />
                                    </button>
                                </Tooltip>

                                {/* Invite Team Button (Admin only) */}
                                {role === 'admin' && (
                                    <Tooltip content={t('dashboard.inviteTooltip')} position="bottom">
                                        <button
                                            onClick={() => navigate('/team')}
                                            className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-all duration-300"
                                            aria-label={t('dashboard.inviteMember')}
                                        >
                                            <Users className="h-4 w-4" />
                                            <span className="hidden xl:inline">{t('dashboard.inviteMember')}</span>
                                        </button>
                                    </Tooltip>
                                )}
                            </div>
                        </div>

                        {/* Conseil Sécurité & Prochaine Échéance */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                            {/* Conseil Sécurité du Jour */}
                            <motion.div
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/50 backdrop-blur-sm"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700/50 shrink-0">
                                        <Lightbulb className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Conseil du jour
                                            </span>
                                            <Sparkles className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                        </div>
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed">
                                            {todayTip.tip}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Prochaine Échéance */}
                            <motion.div
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
                                className={`p-4 rounded-2xl backdrop-blur-sm cursor-pointer group/deadline transition-all duration-300 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600`}
                                onClick={() => nextDeadline?.link && navigate(nextDeadline.link)}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-xl shrink-0 bg-slate-100 dark:bg-slate-700/50">
                                        {nextDeadline ? (
                                            <Target className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                                        ) : (
                                            <Check className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                Prochaine échéance
                                            </span>
                                        </div>
                                        {nextDeadline ? (
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                                                    {nextDeadline.title}
                                                </p>
                                                <div className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-full bg-slate-200/80 dark:bg-slate-700/80">
                                                    <Calendar className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                                        {nextDeadline.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                                Aucune échéance à venir
                                            </p>
                                        )}
                                    </div>
                                    {nextDeadline && (
                                        <ArrowRight className="h-4 w-4 text-slate-400 opacity-0 group-hover/deadline:opacity-100 transition-opacity shrink-0" />
                                    )}
                                </div>
                            </motion.div>
                        </div>

                        {/* Bottom Row: Stats Cards */}
                        <div className="flex flex-col sm:flex-row items-stretch gap-4 mt-4">
                            {/* Active Incidents Quick View - Premium */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                className="relative flex flex-col p-5 rounded-2xl bg-gradient-to-br from-white/60 via-white/40 to-slate-50/60 dark:from-slate-800/60 dark:via-slate-900/40 dark:to-slate-950/60 border border-white/30 dark:border-slate-700/30 backdrop-blur-xl shadow-sm min-w-[200px] group/incidents hover:border-brand-500/40 hover:shadow-md transition-all duration-500 overflow-hidden"
                            >
                                <div className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br from-brand-500/15 to-info-500/10 rounded-full blur-2xl opacity-0 group-hover/incidents:opacity-100 transition-opacity duration-500" />

                                <div className="relative flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                        {t('dashboard.incidents')} Actifs
                                    </span>
                                    <div className="relative">
                                        <div className={`w-2.5 h-2.5 rounded-full ${activeIncidentsCount > 0 ? 'bg-destructive animate-pulse' : 'bg-success'} transition-colors duration-500`} />
                                        {activeIncidentsCount > 0 && (
                                            <div className="absolute inset-0 rounded-full bg-destructive animate-ping opacity-30" />
                                        )}
                                    </div>
                                </div>
                                <div className="relative flex items-end gap-3">
                                    <span className="text-4xl font-black text-foreground leading-none tracking-tighter">
                                        {activeIncidentsCount}
                                    </span>
                                    <div className="flex flex-col -mb-0.5">
                                        <span className="text-[11px] font-bold text-muted-foreground leading-tight">
                                            En cours
                                        </span>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Insight Card */}
                            {insight?.text ? (
                                <motion.button
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                    onClick={() => {
                                        if (insight.link && insight.link.startsWith('/')) navigate(insight.link);
                                    }}
                                    className={`relative flex-1 flex text-left items-center gap-4 p-5 rounded-2xl border transition-all duration-500 cursor-pointer group/insight focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 backdrop-blur-xl overflow-hidden
                                        ${insight.type === 'danger'
                                            ? 'bg-error-500/5 border-error-500/20 hover:bg-error-500/10 hover:border-error-500/40'
                                            : insight.type === 'warning'
                                                ? 'bg-warning-500/5 border-warning-500/20 hover:bg-warning-500/10 hover:border-warning-500/40'
                                                : 'bg-success-500/5 border-success-500/20 hover:bg-success-500/10 hover:border-success-500/40'
                                        }`}
                                >
                                    <div className={`p-3 rounded-xl shrink-0 transition-transform duration-500 group-hover/insight:scale-110
                                        ${insight.type === 'danger' ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success'}`}>
                                        {insight.type === 'danger' ? <AlertTriangle className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-foreground truncate pr-2 tracking-tight mb-0.5">{insight.text}</p>
                                        <p className="text-xs text-muted-foreground truncate">{insight.details}</p>
                                    </div>
                                    <div className="p-2 rounded-lg bg-background/50 opacity-0 group-hover/insight:opacity-100 transition-all duration-300">
                                        <ArrowRight className="h-4 w-4 text-brand-500" />
                                    </div>
                                </motion.button>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                    className="flex-1 flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-white/60 via-white/40 to-slate-50/60 dark:from-slate-800/60 dark:via-slate-900/40 dark:to-slate-950/60 border border-white/30 dark:border-slate-700/30 backdrop-blur-xl shadow-sm"
                                >
                                    <div className="w-11 h-11 rounded-xl bg-brand-500/10 flex items-center justify-center">
                                        <Activity className="h-5 w-5 text-brand-500 animate-pulse" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-foreground tracking-tight leading-none mb-1">{t('dashboard.allSystemsOperational')}</p>
                                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                            Surveillance active
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </div>
            </GlassCard>

        </motion.div >
    );
};
