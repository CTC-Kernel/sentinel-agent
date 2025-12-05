import React from 'react';
import { ShieldCheck, Lock, EyeOff, FileCheck } from './Icons';

export type SecurityFeature = 'general' | 'storage' | 'confidentiality' | 'integrity';

interface SecurityBadgeProps {
    feature: SecurityFeature;
    className?: string;
}

const BADGE_CONFIG: Record<SecurityFeature, {
    icon: React.ElementType<any>;
    label: string;
    detail: string;
    subDetail: string;
    color: string;
}> = {
    general: {
        icon: ShieldCheck,
        label: "Environnement Sécurisé",
        detail: "Chiffrement AES-256 de bout en bout",
        subDetail: "Hébergement certifié ISO 27001 & HDS",
        color: "emerald"
    },
    storage: {
        icon: Lock,
        label: "Stockage Chiffré",
        detail: "Protection contre les ransomwares",
        subDetail: "Sauvegardes immuables et redondantes",
        color: "blue"
    },
    confidentiality: {
        icon: EyeOff,
        label: "Accès Restreint",
        detail: "Visibilité par rôles (RBAC) stricte",
        subDetail: "Journalisation de chaque accès",
        color: "indigo"
    },
    integrity: {
        icon: FileCheck,
        label: "Intégrité Garanties",
        detail: "Traçabilité inaltérable des actions",
        subDetail: "Conforme aux normes d'audit",
        color: "purple"
    }
};

export const SecurityBadge: React.FC<SecurityBadgeProps> = ({ feature, className = '' }) => {
    const config = BADGE_CONFIG[feature];
    const Icon: any = config.icon;

    const colorClasses = {
        emerald: "bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-200/50 dark:ring-emerald-500/20 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20",
        blue: "bg-blue-50/50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-blue-200/50 dark:ring-blue-500/20 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20",
        indigo: "bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 ring-indigo-200/50 dark:ring-indigo-500/20 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20",
        purple: "bg-purple-50/50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 ring-purple-200/50 dark:ring-purple-500/20 group-hover:bg-purple-100 dark:group-hover:bg-purple-500/20"
    };

    return (
        <div className={`group relative z-20 inline-block pointer-events-auto ${className}`}>
            <div className={`
                flex items-center gap-1.5 px-2.5 py-1 
                rounded-full ring-1 transition-all duration-300 cursor-help
                ${colorClasses[config.color as keyof typeof colorClasses]}
            `}>
                <Icon className="w-3 h-3" strokeWidth={2.5} />
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">{config.label}</span>
            </div>

            {/* Hover Tooltip/Card */}
            <div className="absolute left-0 top-full mt-2 w-64 opacity-0 scale-95 invisible group-hover:opacity-100 group-hover:scale-100 group-hover:visible transition-all duration-200 origin-top-left z-50">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 p-4 relative overflow-hidden">
                    {/* Decorative background glow */}
                    <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-10 -mr-10 -mt-10 bg-${config.color}-500`}></div>

                    <div className="relative z-10">
                        <div className="flex items-start gap-3 mb-2">
                            <div className={`p-2 rounded-lg bg-${config.color}-50 dark:bg-${config.color}-500/10 shrink-0`}>
                                <Icon className={`w-4 h-4 text-${config.color}-600 dark:text-${config.color}-400`} />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-0.5">{config.label}</h4>
                                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Protocoles de Sécurité Actifs</p>
                            </div>
                        </div>

                        <div className="space-y-2 mt-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-1 h-1 rounded-full bg-${config.color}-500`}></div>
                                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">{config.detail}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-1 h-1 rounded-full bg-${config.color}-500`}></div>
                                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">{config.subDetail}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
