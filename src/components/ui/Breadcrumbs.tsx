import React, { useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

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

    const crumbs = useMemo(() => {
        const pathnames = location.pathname.split('/').filter((x) => x);
        return pathnames.map((value, index) => {
            const to = `/${pathnames.slice(0, index + 1).join('/')}`;
            const name = routeNameMap[value] || (value.length > 20 ? 'Détails' : value.charAt(0).toUpperCase() + value.slice(1));
            return {
                label: name,
                path: to,
                isLast: index === pathnames.length - 1
            };
        });
    }, [location.pathname]);

    if (crumbs.length === 0) {
        return null;
    }

    return (
        <nav aria-label="Breadcrumb" className="hidden lg:flex items-center space-x-1 text-sm animate-fade-in mr-6">
            <Link
                to="/"
                className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200",
                    "text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
            >
                <Home className="w-4 h-4" />
                <span className="sr-only">Accueil</span>
            </Link>

            <AnimatePresence mode="wait">
                {crumbs.map((crumb, index) => {
                    return (
                        <React.Fragment key={crumb.path}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center text-slate-400 dark:text-slate-600"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.2, delay: index * 0.05 }}
                            >
                                {crumb.isLast ? (
                                    <span
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-900 dark:text-white font-semibold bg-slate-100 dark:bg-white/10"
                                        aria-current="page"
                                    >
                                        {crumb.label}
                                    </span>
                                ) : (
                                    <Link
                                        to={crumb.path}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200",
                                            "text-slate-600 dark:text-muted-foreground hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/10"
                                        )}
                                    >
                                        {crumb.label}
                                    </Link>
                                )}
                            </motion.div>
                        </React.Fragment>
                    );
                })}
            </AnimatePresence>
        </nav>
    );
};
