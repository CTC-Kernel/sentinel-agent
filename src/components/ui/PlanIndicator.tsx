/**
 * PlanIndicator.tsx
 * Premium plan indicator for the topbar displaying the current subscription tier
 * Follows Apple design language with glassmorphism and refined typography
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Star, Building2, Sparkles, ChevronRight, Calendar, Zap } from './Icons';
import { useStore } from '../../store';
import { PlanType } from '../../types';

interface PlanIndicatorProps {
    className?: string;
    compact?: boolean;
}

const PLAN_CONFIG: Record<PlanType | 'unknown', {
    name: string;
    shortName: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    gradient: string;
    bgGradient: string;
    borderColor: string;
    textColor: string;
    glowColor: string;
    iconBg: string;
    ringColor: string;
}> = {
    discovery: {
        name: 'Discovery',
        shortName: 'Free',
        icon: Star,
        gradient: 'from-slate-400 to-slate-500',
        bgGradient: 'from-white/80 to-slate-50/80 dark:from-slate-800/60 dark:to-slate-900/60',
        borderColor: 'border-slate-200 dark:border-slate-700',
        textColor: 'text-slate-700 dark:text-slate-200',
        glowColor: 'shadow-slate-200/40 dark:shadow-slate-900/40',
        iconBg: 'bg-gradient-to-br from-slate-400 to-slate-500',
        ringColor: 'ring-slate-300/50 dark:ring-slate-600/50',
    },
    professional: {
        name: 'Professional',
        shortName: 'Pro',
        icon: Crown,
        gradient: 'from-brand-500 to-violet-600',
        bgGradient: 'from-brand-50/90 to-violet-50/90 dark:from-brand-900/40 dark:to-violet-900/40',
        borderColor: 'border-brand-200 dark:border-brand-700',
        textColor: 'text-brand-700 dark:text-brand-200',
        glowColor: 'shadow-brand-300/40 dark:shadow-brand-900/40',
        iconBg: 'bg-gradient-to-br from-brand-500 to-violet-600',
        ringColor: 'ring-brand-300 dark:ring-brand-500',
    },
    enterprise: {
        name: 'Enterprise',
        shortName: 'Ent',
        icon: Building2,
        gradient: 'from-purple-500 via-violet-500 to-fuchsia-500',
        bgGradient: 'from-purple-50/90 to-fuchsia-50/90 dark:from-purple-900/40 dark:to-fuchsia-900/40',
        borderColor: 'border-purple-200 dark:border-purple-700',
        textColor: 'text-purple-700 dark:text-purple-200',
        glowColor: 'shadow-purple-300/40 dark:shadow-purple-900/40',
        iconBg: 'bg-gradient-to-br from-purple-500 via-violet-500 to-fuchsia-500',
        ringColor: 'ring-purple-300/50 dark:ring-purple-600/50',
    },
    unknown: {
        name: 'Discovery',
        shortName: 'Free',
        icon: Star,
        gradient: 'from-slate-400 to-slate-500',
        bgGradient: 'from-white/80 to-slate-50/80 dark:from-slate-800/60 dark:to-slate-900/60',
        borderColor: 'border-slate-200 dark:border-slate-700',
        textColor: 'text-slate-700 dark:text-slate-200',
        glowColor: 'shadow-slate-200/40 dark:shadow-slate-900/40',
        iconBg: 'bg-gradient-to-br from-slate-400 to-slate-500',
        ringColor: 'ring-slate-300/50 dark:ring-slate-600/50',
    },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; pulse?: boolean }> = {
    active: { label: 'Actif', color: 'text-success-600 dark:text-success-400', bgColor: 'bg-success-500', pulse: false },
    trialing: { label: 'Essai', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500', pulse: true },
    past_due: { label: 'Impayé', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500', pulse: true },
    canceled: { label: 'Annulé', color: 'text-slate-500', bgColor: 'bg-slate-400', pulse: false },
    incomplete: { label: 'Incomplet', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500', pulse: false },
};

export const PlanIndicator: React.FC<PlanIndicatorProps> = ({ className = '', compact = false }) => {
    const { organization } = useStore();
    const [isHovered, setIsHovered] = useState(false);

    // Calculate days until renewal - move hooks before early return
    const [currentTime, setCurrentTime] = React.useState(() => Date.now());

    React.useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(Date.now());
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    // Fallback if organization is missing - show discovery plan
    const subscription = organization?.subscription || {
        planId: 'discovery' as PlanType,
        status: 'active',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false
    };

    const plan = subscription.planId || 'discovery';
    const status = subscription.status || 'active';
    const config = PLAN_CONFIG[plan] || PLAN_CONFIG.discovery;
    const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.active;
    const Icon = config.icon;

    // Calculate days until renewal
    const periodEnd = subscription.currentPeriodEnd;
    const daysUntilRenewal = periodEnd
        ? Math.ceil((new Date(periodEnd).getTime() - currentTime) / (1000 * 60 * 60 * 24))
        : null;

    const isTrialing = status === 'trialing';
    const isPastDue = status === 'past_due';
    const showUpgradeHint = plan === 'discovery';

    return (
        <Link
            to="/pricing"
            className={`group relative ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Main Badge */}
            <motion.div
                className={`
                    relative flex items-center gap-2.5 px-3 py-1.5 rounded-xl
                    bg-gradient-to-br ${config.bgGradient}
                    backdrop-blur-sm
                    border ${config.borderColor}
                    shadow-sm ${config.glowColor}
                    ring-1 ${config.ringColor}
                    transition-all duration-300
                    group-hover:shadow-md group-hover:scale-[1.02]
                    cursor-pointer
                `}
                whileTap={{ scale: 0.98 }}
            >
                {/* Animated shimmer for premium plans */}
                {(plan === 'professional' || plan === 'enterprise') && (
                    <motion.div
                        className={`absolute inset-0 rounded-xl bg-gradient-to-r ${config.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-300`}
                    />
                )}

                {/* Icon with gradient background */}
                <div className={`
                    relative flex items-center justify-center w-7 h-7 rounded-lg
                    ${config.iconBg}
                    shadow-sm
                `}>
                    <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />

                    {/* Sparkle effect for enterprise */}
                    {plan === 'enterprise' && (
                        <motion.div
                            className="absolute -top-1 -right-1"
                            animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                        >
                            <Sparkles className="w-3 h-3 text-amber-400 drop-shadow-sm" />
                        </motion.div>
                    )}
                </div>

                {/* Plan name and status - Always visible */}
                <div className={`flex flex-col items-start leading-none ${compact ? 'hidden sm:flex' : ''}`}>
                    <span className={`text-xs font-bold tracking-tight ${config.textColor}`}>
                        {config.name}
                    </span>

                    {/* Status indicator with dot */}
                    <div className="flex items-center gap-1 mt-0.5">
                        {statusConfig.pulse ? (
                            <span className="relative flex h-1.5 w-1.5">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isPastDue ? 'bg-red-400' : 'bg-amber-400'} opacity-75`}></span>
                                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isPastDue ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                            </span>
                        ) : (
                            <span className={`inline-flex rounded-full h-1.5 w-1.5 ${statusConfig.bgColor}`}></span>
                        )}
                        <span className={`text-[11px] font-semibold uppercase tracking-wider ${statusConfig.color}`}>
                            {statusConfig.label}
                        </span>
                    </div>
                </div>

                {/* Chevron indicator */}
                <ChevronRight className={`
                    w-3.5 h-3.5 ${config.textColor} opacity-40
                    group-hover:opacity-70 group-hover:translate-x-0.5
                    transition-all duration-200
                `} />
            </motion.div>

            {/* Hover tooltip with more details */}
            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full right-0 mt-2 z-50"
                    >
                        <div className="
                            w-64 p-4 rounded-2xl
                            bg-white/95 dark:bg-slate-900/95
                            backdrop-blur-xl
                            border border-slate-200/50 dark:border-white/10
                            shadow-xl shadow-slate-200/30 dark:shadow-black/30
                        ">
                            {/* Header */}
                            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-100 dark:border-white/10">
                                <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${config.iconBg} shadow-md`}>
                                    <Icon className="w-5 h-5 text-white" strokeWidth={2} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                                        Plan {config.name}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className={`inline-flex rounded-full h-2 w-2 ${statusConfig.bgColor}`}></span>
                                        <p className={`text-xs font-semibold ${statusConfig.color}`}>
                                            {statusConfig.label}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Renewal info */}
                            {daysUntilRenewal !== null && status === 'active' && (
                                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 mb-2.5">
                                    <div className="p-1.5 rounded-lg bg-slate-200/50 dark:bg-slate-700/50">
                                        <Calendar className="w-4 h-4 text-slate-500" />
                                    </div>
                                    <span className="text-xs text-slate-600 dark:text-muted-foreground">
                                        Renouvellement dans <strong className="text-slate-800 dark:text-slate-200">{daysUntilRenewal} jours</strong>
                                    </span>
                                </div>
                            )}

                            {/* Trial info */}
                            {isTrialing && daysUntilRenewal !== null && (
                                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 mb-2.5">
                                    <div className="p-1.5 rounded-lg bg-amber-200/50 dark:bg-amber-500">
                                        <Zap className="w-4 h-4 text-amber-500" />
                                    </div>
                                    <span className="text-xs text-amber-700 dark:text-amber-300">
                                        Essai termine dans <strong>{daysUntilRenewal} jours</strong>
                                    </span>
                                </div>
                            )}

                            {/* Upgrade CTA */}
                            {showUpgradeHint && (
                                <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50 border border-slate-200 dark:border-slate-600/30">
                                    <div>
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 dark:text-slate-100">
                                            Passez à Pro
                                        </span>
                                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                                            Fonctionnalités avancées
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-brand-500 to-violet-600 text-white text-xs font-bold shadow-sm">
                                        <Sparkles className="w-3 h-3" />
                                        Upgrade
                                    </div>
                                </div>
                            )}

                            {/* Footer */}
                            <p className="text-[11px] text-center text-slate-400 mt-3">
                                Cliquer pour gérer l'abonnement
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Link>
    );
};
