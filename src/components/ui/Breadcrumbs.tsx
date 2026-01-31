import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';



export const Breadcrumbs: React.FC = () => {
    const location = useLocation();


    const { t } = useTranslation();

    const crumbs = useMemo(() => {
        const pathnames = location.pathname.split('/').filter((x) => x);

        // Define map with exact translation keys
        const routeKeys: Record<string, string> = {
            'assets': 'common.assets',
            'risks': 'common.risks',
            'controls': 'common.controls',
            'audits': 'common.audits',
            'incidents': 'common.incidents',
            'suppliers': 'common.suppliers',
            'compliance': 'common.compliance',
            'documents': 'common.documents',
            'settings': 'common.settings.title',
            'team': 'common.team',
            'privacy': 'common.privacyGdpr',
            'backup': 'common.backup',
            'admin': 'common.adminShort'
        };

        return pathnames.map((value, index) => {
            const to = `/${pathnames.slice(0, index + 1).join('/')}`;

            // Try to find translation key, fallback to direct value
            const i18nKey = routeKeys[value] || `common.${value}`;
            let label = i18nKey ? t(i18nKey) : value;

            // If translation returns the key itself (missing key), capitalize the value
            if (label === i18nKey) {
                label = value.length > 20 ? t('common.details') : value.charAt(0).toUpperCase() + value.slice(1);
            }

            return {
                label: label,
                path: to,
                isLast: index === pathnames.length - 1
            };
        });
    }, [location.pathname, t]);

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

            <AnimatePresence mode="popLayout">
                {crumbs.map((crumb, index) => {
                    return (
                        <motion.div key={crumb.path || 'unknown'}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center text-slate-400 dark:text-slate-300"
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
                                            "text-slate-600 dark:text-muted-foreground hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-50 dark:bg-brand-900"
                                        )}
                                    >
                                        {crumb.label}
                                    </Link>
                                )}
                            </motion.div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </nav>
    );
};
