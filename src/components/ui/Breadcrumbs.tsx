import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const routeNameMap: Record<string, string> = {
    'assets': 'Actifs',
    'risks': 'Risques',
    'controls': 'Contrôles',
    'audits': 'Audits',
    'projects': 'Projets',
    'incidents': 'Incidents',
    'suppliers': 'Fournisseurs',
    'compliance': 'Conformité',
    'documents': 'Documents',
    'settings': 'Paramètres',
    'team': 'Équipe',
    'privacy': 'Confidentialité',
    'continuity': 'Continuité',
    'analytics': 'Analytique',
    'timeline': 'Chronologie',
    'audit-trail': "Journal d'audit",
    'vulnerabilities': 'Vulnérabilités',
    'threat-library': 'Bibliothèque de menaces',
    'threat-intelligence': 'Renseignement',
    'reports': 'Rapports',
    'system-health': 'Santé du système',
    'backup': 'Sauvegarde',
    'admin_management': 'Admin',
    'integrations': 'Intégrations'
};

export const Breadcrumbs: React.FC = () => {
    const location = useLocation();
    const pathnames = location.pathname.split('/').filter((x) => x);

    if (pathnames.length === 0) {
        return null; // Don't show on Dashboard/Home
    }

    return (
        <nav aria-label="Breadcrumb" className="hidden lg:flex items-center text-sm text-slate-500 dark:text-slate-400 animate-fade-in mr-6">
            <Link to="/" className="flex items-center hover:text-brand-500 transition-colors">
                <Home className="w-4 h-4" />
                <span className="sr-only">Accueil</span>
            </Link>

            {pathnames.map((value, index) => {
                const to = `/${pathnames.slice(0, index + 1).join('/')}`;
                const isLast = index === pathnames.length - 1;
                const name = routeNameMap[value] || (value.length > 20 ? 'Détails' : value.charAt(0).toUpperCase() + value.slice(1));

                return (
                    <div key={to} className="flex items-center">
                        <ChevronRight className="w-4 h-4 mx-2 text-slate-400" />
                        {isLast ? (
                            <span className="font-medium text-slate-900 dark:text-white" aria-current="page">
                                {name}
                            </span>
                        ) : (
                            <Link to={to} className="hover:text-brand-500 transition-colors">
                                {name}
                            </Link>
                        )}
                    </div>
                );
            })}
        </nav>
    );
};
