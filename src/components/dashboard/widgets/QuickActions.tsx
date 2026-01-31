import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Settings as Settings3D, Siren, ShieldAlert, Server, User } from '../../ui/Icons'; // Settings aliased as Settings3D

interface QuickActionProps {
    navigate: (path: string) => void;
    t: (key: string) => string;
    stats?: {
        activeIncidents: number;
        highRisks: number;
        assets: number;
        teamSize?: number;
    };
}

export const QuickActions: React.FC<QuickActionProps> = ({ navigate, t, stats }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [timeoutId]);

    const handleMouseEnter = () => {
        if (timeoutId) clearTimeout(timeoutId);
        setIsVisible(true);
    };

    const handleMouseLeave = () => {
        const id = setTimeout(() => {
            setIsVisible(false);
        }, 300); // 300ms delay before hiding
        setTimeoutId(id);
    };

    return createPortal(
        <div
            className="fixed right-6 top-24 z-sticky"
            data-tour="quick-actions"
            role="toolbar"
            aria-label="Actions rapides"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onKeyDown={(e) => {
                if (e.key === 'Escape') {
                    handleMouseLeave();
                }
            }}
            tabIndex={0}
        >
            {/* Subtle indicator when hidden */}
            <AnimatePresence>
                {!isVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute right-0 top-1/2 transform -translate-y-1/2 w-2 h-12 bg-gradient-to-b from-brand-500/50 to-brand-600/50 rounded-l-full shadow-lg"
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="bg-[var(--glass-bg)] backdrop-blur-xl px-4 py-6 rounded-2xl flex flex-col items-center gap-4 relative border border-[var(--glass-border)] shadow-premium"
                    >
                        {/* Dock Background Glow */}
                        <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-xl opacity-60 -z-10" />

                        <DockItem
                            icon={Settings3D}
                            label={t('dashboard.voxel3d')}
                            onClick={() => navigate('/ctc-engine')}
                            color="purple"
                            delay={0}
                        />

                        <DockItem
                            icon={Siren}
                            label={t('dashboard.incidents')}
                            onClick={() => navigate('/incidents?action=create')}
                            color="red"
                            badge={stats?.activeIncidents}
                            delay={0.1}
                        />

                        <DockItem
                            icon={ShieldAlert}
                            label={t('dashboard.risks')}
                            onClick={() => navigate('/risks?action=create')}
                            color="orange"
                            badge={stats?.highRisks}
                            delay={0.2}
                        />

                        <DockItem
                            icon={Server}
                            label={t('dashboard.assets')}
                            onClick={() => navigate('/assets?action=create')}
                            color="blue"
                            badge={stats?.assets}
                            delay={0.3}
                        />

                        <DockItem
                            icon={User}
                            label={t('dashboard.team')}
                            onClick={() => navigate('/team')}
                            color="emerald"
                            delay={0.4}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
        , document.body);
};

interface DockItemProps {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    color: 'purple' | 'red' | 'orange' | 'blue' | 'emerald';
    badge?: number;
    delay: number;
}

const DockItem: React.FC<DockItemProps> = ({ icon: Icon, label, onClick, color, badge, delay }) => {
    const colorStyles = {
        purple: 'text-primary group-hover:bg-primary/10',
        red: 'text-destructive dark:text-destructive group-hover:bg-error-bg dark:group-hover:bg-destructive/20',
        orange: 'text-warning-text dark:text-warning group-hover:bg-warning-bg dark:group-hover:bg-warning/20',
        blue: 'text-info-text dark:text-info group-hover:bg-info-bg dark:group-hover:bg-info/20',
        emerald: 'text-success-text dark:text-success group-hover:bg-success-bg dark:group-hover:bg-success/20'
    };

    const badgeColors = {
        purple: 'bg-primary',
        red: 'bg-destructive',
        orange: 'bg-warning',
        blue: 'bg-info',
        emerald: 'bg-success'
    };

    return (
        <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.15, y: -5 }}
            whileTap={{ scale: 0.95 }}
            transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            }}
            className="group relative flex flex-col items-center gap-2 p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={label}
        >
            <div className={`p-3 rounded-xl transition-all duration-normal ease-apple bg-transparent ${colorStyles[color]} shadow-sm group-hover:shadow-lg`}>
                {/* @ts-expect-error: Icon component type mismatch */}
                <Icon className="h-7 w-7" />
            </div>
            {(badge || 0) > 0 && (
                <span className={`absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ${badgeColors[color]} text-[11px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900`}>
                    {badge}
                </span>
            )}
            <span className="absolute right-full mr-3 top-1/2 transform -translate-y-1/2 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-1 rounded-full shadow-sm whitespace-nowrap z-50 pointer-events-none">
                {label}
            </span>
            <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 opacity-70 md:opacity-0 md:group-hover:opacity-70 transition-opacity" />
        </motion.button>
    );
};
