import React from 'react';
import { ShieldCheck, Lock, EyeOff, FileCheck } from './Icons';

type SecurityBadgeIconComponent = React.ElementType<{ className?: string; strokeWidth?: number }>;

export type SecurityFeature = 'general' | 'storage' | 'confidentiality' | 'integrity' | 'availability';

interface SecurityBadgeProps {
    feature: SecurityFeature;
    className?: string;
}

const BADGE_CONFIG: Record<SecurityFeature, {
    icon: SecurityBadgeIconComponent;
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
        label: "Intégrité Garantie",
        detail: "Traçabilité inaltérable des actions",
        subDetail: "Conforme aux normes d'audit",
        color: "purple"
    },
    availability: {
        icon: ShieldCheck,
        label: "Haute Disponibilité",
        detail: "Garantie de continuité de service",
        subDetail: "SLA 99.9% et réplication temps réel",
        color: "emerald"
    }
};

export const SecurityBadge: React.FC<SecurityBadgeProps> = ({ feature, className = '' }) => {
    const config = BADGE_CONFIG[feature];
    const Icon = config.icon;

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


        </div>
    );
};
