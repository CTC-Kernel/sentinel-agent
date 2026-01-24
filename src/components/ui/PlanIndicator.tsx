/**
 * PlanIndicator.tsx
 * Elegant plan indicator for the topbar displaying the current subscription tier
 * Follows Apple design language with subtle gradients and refined typography
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
    accentColor: string;
}> = {
    discovery: {
        name: 'Discovery',
        shortName: 'Free',
        icon: Star,
        gradient: 'from-slate-500 to-slate-600',
        bgGradient: 'from-slate-50 to-slate-100/80 dark:from-slate-800/40 dark:to-slate-900/40',
        borderColor: 'border-slate-200/60 dark:border-slate-700/60',
        textColor: 'text-slate-700 dark:text-slate-300',
        glowColor: 'shadow-slate-200/50 dark:shadow-slate-800/50',
        accentColor: 'bg-slate-500',
    },
    professional: {
        name: 'Professional',
        shortName: 'Pro',
        icon: Crown,
        gradient: 'from-blue-500 to-indigo-600',
        bgGradient: 'from-blue-50 to-indigo-50/80 dark:from-blue-900/20 dark:to-indigo-900/20',
        borderColor: 'border-blue-200/60 dark:border-blue-800/60',
        textColor: 'text-blue-700 dark:text-blue-300',
        glowColor: 'shadow-blue-200/50 dark:shadow-blue-900/50',
        accentColor: 'bg-blue-500',
    },
    enterprise: {
        name: 'Enterprise',
        shortName: 'Ent',
        icon: Building2,
        gradient: 'from-purple-500 via-violet-500 to-fuchsia-500',
        bgGradient: 'from-purple-50 to-fuchsia-50/80 dark:from-purple-900/20 dark:to-fuchsia-900/20',
        borderColor: 'border-purple-200/60 dark:border-purple-800/60',
        textColor: 'text-purple-700 dark:text-purple-300',
        glowColor: 'shadow-purple-200/50 dark:shadow-purple-900/50',
        accentColor: 'bg-purple-500',
    },
    unknown: {
        name: 'Unknown',
        shortName: '?',
        icon: Star,
        gradient: 'from-slate-400 to-slate-500',
        bgGradient: 'from-slate-50 to-slate-100/80 dark:from-slate-800/40 dark:to-slate-900/40',
        borderColor: 'border-slate-200/60 dark:border-slate-700/60',
        textColor: 'text-slate-600 dark:text-slate-400',
        glowColor: 'shadow-slate-200/50 dark:shadow-slate-800/50',
        accentColor: 'bg-slate-500',
    },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; pulse?: boolean }> = {
    active: { label: 'Actif', color: 'text-emerald-600 dark:text-emerald-400', pulse: false },
    trialing: { label: 'Essai', color: 'text-amber-600 dark:text-amber-400', pulse: true },
    past_due: { label: 'Impayé', color: 'text-red-600 dark:text-red-400', pulse: true },
    canceled: { label: 'Annulé', color: 'text-slate-500 dark:text-slate-500', pulse: false },
    incomplete: { label: 'Incomplet', color: 'text-orange-600 dark:text-orange-400', pulse: false },
};

export const PlanIndicator: React.FC<PlanIndicatorProps> = ({ className = '', compact = false }) => {
    const { organization } = useStore();
    const [isHovered, setIsHovered] = useState(false);

    // Calculate days until renewal - move hooks before early return
    const [currentTime, setCurrentTime] = React.useState(() => Date.now());

    React.useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(Date.now());
        }, 60000); // Update every minute

        return () => clearInterval(timer);
    }, []);

    if (!organization) {
        return null;
    }

    // Fallback if subscription is missing (legacy orgs)
    const subscription = organization.subscription || {
        planId: 'discovery',
        status: 'active',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false
    };

    const plan = subscription.planId || 'discovery';
    const status = subscription.status || 'active';
    const config = PLAN_CONFIG[plan] || PLAN_CONFIG.unknown;
    const statusConfig = STATUS_CONFIG[status] || { label: status, color: 'text-slate-500' };
    const Icon = config.icon || Star;

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
                    relative flex items-center gap-2 px-3 py-1.5 rounded-xl
                    bg-gradient-to-br ${config.bgGradient}
                    border ${config.borderColor}
                    shadow-sm ${config.glowColor}
                    transition-all duration-300
                    group-hover:shadow-md group-hover:scale-[1.02]
                    cursor-pointer
                `}
                whileTap={{ scale: 0.98 }}
            >
                {/* Animated glow effect for premium plans */}
                {(plan === 'enterprise' || isTrialing) && (
                    <motion.div
                        className={`absolute inset-0 rounded-xl bg-gradient-to-r ${config.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                    />
                )}

                {/* Icon with gradient background */}
                <div className={`
                    relative flex items-center justify-center w-6 h-6 rounded-lg
                    bg-gradient-to-br ${config.gradient}
                    shadow-sm
                `}>
                    <Icon className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />

                    {/* Sparkle effect for enterprise */}
                    {plan === 'enterprise' && (
                        <motion.div
                            className="absolute -top-0.5 -right-0.5"
                            animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                        >
                            <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                        </motion.div>
                    )}
                </div>

                {/* Plan name and status */}
                <div className={`flex flex-col items-start leading-none ${compact ? 'hidden' : 'hidden sm:flex'}`}>
                    <span className={`text-xs font-bold tracking-tight ${config.textColor}`}>
                        {compact ? config.shortName : config.name}
                    </span>

                    {/* Status indicator (only show if not active) */}
                    {status !== 'active' && (
                        <span className={`text-[9px] font-semibold uppercase tracking-wider ${statusConfig.color} flex items-center gap-1`}>
                            {statusConfig.pulse && (
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isPastDue ? 'bg-red-400' : 'bg-amber-400'} opacity-75`}></span>
                                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isPastDue ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                                </span>
                            )}
                            {statusConfig.label}
                        </span>
                    )}
                </div>

                {/* Chevron indicator */}
                <ChevronRight className={`
                    w-3 h-3 ${config.textColor} opacity-0 -translate-x-1
                    group-hover:opacity-60 group-hover:translate-x-0
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
                            w-56 p-3 rounded-2xl
                            bg-white/95 dark:bg-slate-900/95
                            backdrop-blur-xl
                            border border-slate-200/50 dark:border-white/10
                            shadow-xl shadow-slate-200/30 dark:shadow-black/30
                        ">
                            {/* Header */}
                            <div className="flex items-center gap-2 mb-3">
                                <div className={`flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br ${config.gradient}`}>
                                    <Icon className="w-4 h-4 text-white" strokeWidth={2} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                                        Plan {config.name}
                                    </p>
                                    <p className={`text-xs font-medium ${statusConfig.color}`}>
                                        {String(statusConfig.label)}
                                    </p>
                                </div>
                            </div>

                            {/* Renewal info */}
                            {daysUntilRenewal !== null && status === 'active' && (
                                <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 mb-2">
                                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                    <span className="text-xs text-slate-600 dark:text-slate-400">
                                        Renouvellement dans <strong className="text-slate-800 dark:text-slate-200">{daysUntilRenewal}j</strong>
                                    </span>
                                </div>
                            )}

                            {/* Trial info */}
                            {isTrialing && daysUntilRenewal !== null && (
                                <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 mb-2">
                                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                                    <span className="text-xs text-amber-700 dark:text-amber-300">
                                        Essai termine dans <strong>{daysUntilRenewal}j</strong>
                                    </span>
                                </div>
                            )}

                            {/* Upgrade CTA */}
                            {showUpgradeHint && (
                                <div className="flex items-center justify-between p-2 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                        Passer à Pro
                                    </span>
                                    <div className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400">
                                        <Sparkles className="w-3 h-3" />
                                        Upgrade
                                    </div>
                                </div>
                            )}

                            {/* Footer */}
                            <p className="text-[11px] text-center text-slate-500 mt-2">
                                Cliquer pour gérer l'abonnement
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Link>
    );
};
