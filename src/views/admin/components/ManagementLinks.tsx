import React from 'react';
import { cn } from '../../../lib/utils';
import { useStore } from '../../../store';

interface ManagementLink {
    name: string;
    url: string;
    description: string;
}

interface LinkCategory {
    category: string;
    icon: string;
    links: ManagementLink[];
}

const MANAGEMENT_LINKS: LinkCategory[] = [
    {
        category: 'Core Application',
        icon: '🛡️',
        links: [
            {
                name: 'Frontend',
                url: 'https://cyber-threat-consulting.com/',
                description: 'Interface Utilisateur (SPA)',
            },
            {
                name: 'Backend API',
                url: 'https://cyber-threat-consulting.com/api/',
                description: 'API REST Principale',
            },
            {
                name: 'Admin API',
                url: 'https://cyber-threat-consulting.com/admin/',
                description: 'Interface Admin Django',
            },
            {
                name: 'Agentic MCP',
                url: 'https://cyber-threat-consulting.com/mcp-server',
                description: 'Model Context Protocol Server',
            },
        ],
    },
    {
        category: 'Observabilité & Monitoring',
        icon: '📊',
        links: [
            {
                name: 'Grafana',
                url: 'https://cyber-threat-consulting.com/grafana',
                description: 'Tableaux de bord & Visualisation',
            },
            {
                name: 'Prometheus',
                url: 'https://cyber-threat-consulting.com/prometheus',
                description: 'Métriques Time-Series',
            },
            {
                name: 'AlertManager',
                url: 'https://cyber-threat-consulting.com/alertmanager',
                description: 'Gestion des alertes infra',
            },
        ],
    },
    {
        category: 'Automatisation & Sécurité',
        icon: '⚡',
        links: [
            {
                name: 'n8n',
                url: 'https://cyber-threat-consulting.com/n8n',
                description: 'Workflow Automation',
            },
            {
                name: 'Security Platform',
                url: 'https://cyber-threat-consulting.com/security-platform',
                description: 'BreachScope Offensive Platform',
            },
        ],
    },
];

export const ManagementLinks: React.FC = () => {
    const { t } = useStore();

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold text-foreground">
                    {t('admin.managementLinks', { defaultValue: 'Liens de gestion' })}
                </h2>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    Super Admin
                </span>
            </div>
            <p className="text-sm text-muted-foreground -mt-4">
                {t('admin.managementLinksDesc', { defaultValue: 'Accès rapide aux consoles et services de gestion de la plateforme.' })}
            </p>

            {MANAGEMENT_LINKS.map((category) => (
                <div key={category.category} className="space-y-3">
                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                        <span className="text-lg">{category.icon}</span>
                        {category.category}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {category.links.map((link) => (
                            <a
                                key={link.name}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                    "group relative flex flex-col gap-1.5 p-4 rounded-xl",
                                    "bg-card/50 border border-border/40",
                                    "hover:border-primary/40 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/5",
                                    "transition-all duration-200 cursor-pointer"
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                        {link.name}
                                    </span>
                                    <svg
                                        className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </div>
                                <span className="text-xs text-muted-foreground leading-relaxed">
                                    {link.description}
                                </span>
                            </a>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};
