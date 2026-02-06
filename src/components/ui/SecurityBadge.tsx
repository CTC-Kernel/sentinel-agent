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
 emerald: "bg-success-bg text-success-text ring-success-border group-hover:bg-success/20",
 blue: "bg-info-bg text-info-text ring-info-border group-hover:bg-info/20",
 indigo: "bg-primary/10 text-primary dark:text-primary/90 ring-primary/20 group-hover:bg-primary/20",
 purple: "bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 ring-violet-500/20 group-hover:bg-violet-500/20",
 red: "bg-error-bg text-error-text ring-error-border group-hover:bg-error/20"
 };

 return (
 <div className={`group relative z-20 inline-block pointer-events-auto ${className}`}>
 <div className={`
 flex items-center gap-1.5 px-2.5 py-1 
 rounded-full ring-1 transition-all duration-300 cursor-help
 ${colorClasses[config.color as keyof typeof colorClasses]}
 `}>
 <Icon className="w-3 h-3" strokeWidth={2.5} />
 <span className="text-xs font-bold uppercase tracking-wider opacity-90">{config.label}</span>
 </div>

 </div>
 );
};
