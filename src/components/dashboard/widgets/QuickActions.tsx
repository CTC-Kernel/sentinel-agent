import React from 'react';
import { motion } from 'framer-motion';
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
    return (
        <div className="flex items-center justify-center py-2" data-tour="quick-actions">
            <div className="glass-premium px-6 py-4 rounded-[2rem] flex items-center gap-4 relative">
                {/* Dock Background Glow */}
                <div className="absolute inset-0 bg-white/40 dark:bg-slate-900/40 rounded-[2rem] blur-xl opacity-50 -z-10" />

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
                    onClick={() => navigate('/incidents')}
                    color="red"
                    badge={stats?.activeIncidents}
                    delay={0.1}
                />

                <DockItem
                    icon={ShieldAlert}
                    label={t('dashboard.risks')}
                    onClick={() => navigate('/risks')}
                    color="orange"
                    badge={stats?.highRisks}
                    delay={0.2}
                />

                <DockItem
                    icon={Server}
                    label={t('dashboard.assets')}
                    onClick={() => navigate('/assets')}
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
            </div>
        </div>
    );
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
        purple: 'text-purple-600 dark:text-purple-400 group-hover:bg-purple-100 dark:group-hover:bg-purple-500/20',
        red: 'text-red-600 dark:text-red-400 group-hover:bg-red-100 dark:group-hover:bg-red-500/20',
        orange: 'text-orange-600 dark:text-orange-400 group-hover:bg-orange-100 dark:group-hover:bg-orange-500/20',
        blue: 'text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20',
        emerald: 'text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20'
    };

    const badgeColors = {
        purple: 'bg-purple-500',
        red: 'bg-red-500',
        orange: 'bg-orange-500',
        blue: 'bg-blue-500',
        emerald: 'bg-emerald-500'
    };

    return (
        <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4, type: "spring" }}
            whileHover={{ scale: 1.15, y: -5 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            className="group relative flex flex-col items-center gap-2 p-2 focus:outline-none"
        >
            <div className={`p-3 rounded-2xl transition-all duration-300 bg-transparent ${colorStyles[color]} shadow-sm group-hover:shadow-lg`}>
                {/* @ts-ignore */}
                <Icon className="h-7 w-7" />
            </div>
            {badge && badge > 0 && (
                <span className={`absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full ${badgeColors[color]} text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900`}>
                    {badge}
                </span>
            )}
            <span className="absolute -bottom-8 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-1 rounded-full shadow-sm whitespace-nowrap pointer-events-none">
                {label}
            </span>
            <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        </motion.button>
    );
};
