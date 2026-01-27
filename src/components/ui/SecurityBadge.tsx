import React from 'react';
import { ShieldCheck, Lock, EyeOff, FileCheck } from './Icons';

type SecurityBadgeIconComponent = React.ElementType<{ className?: string; strokeWidth?: number }>;

export type SecurityFeature = 'general' | 'storage' | 'confidentiality' | 'integrity' | 'availability' | 'admin';

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
    },
    admin: {
        icon: Lock,
        label: "Zone Administration",
        detail: "Accès réservé aux administrateurs",
        subDetail: "Actions critiques auditées",
        color: "red"
    }
};

export const SecurityBadge: React.FC<SecurityBadgeProps> = ({ feature, className = '' }) => {
    const config = BADGE_CONFIG[feature];
    const Icon = config.icon;

    const colorClasses = {
        emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20 group-hover:bg-emerald-500/20",
        blue: "bg-blue-50 text-blue-700 dark:text-blue-400 dark:text-blue-300 ring-blue-500/20 group-hover:bg-blue-500/20",
        indigo: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-indigo-500/20 group-hover:bg-indigo-500/20",
        purple: "bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-purple-500/20 group-hover:bg-purple-500/20",
        red: "bg-red-50 text-red-700 dark:text-red-400 dark:text-red-300 ring-red-500/20 group-hover:bg-red-500/20"
    };

    return (
        <div className={`group relative z-20 inline-block pointer-events-auto ${className}`}>
            <div className={`
                flex items-center gap-1.5 px-2.5 py-1 
                rounded-full ring-1 transition-all duration-300 cursor-help
                ${colorClasses[config.color as keyof typeof colorClasses]}
            `}>
                <Icon className="w-3 h-3" strokeWidth={2.5} />
                <span className="text-[11px] font-bold uppercase tracking-wider opacity-90">{config.label}</span>
            </div>

        </div>
    );
};
