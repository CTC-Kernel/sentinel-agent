import React from 'react';
import { ChevronRight, Home } from './Icons';
import { useNavigate, useLocation } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

import { SecurityBadge, SecurityFeature } from './SecurityBadge';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  trustType?: SecurityFeature;
  className?: string;
}

const ROUTE_LABELS: Record<string, string> = {
  'risks': 'Risques',
  'assets': 'Actifs',
  'compliance': 'Conformité',
  'incidents': 'Incidents',
  'projects': 'Projets',
  'audits': 'Audits',
  'team': 'Équipe',
  'settings': 'Paramètres',
  'documents': 'Documents',
  'suppliers': 'Fournisseurs',
  'privacy': 'Confidentialité',
  'continuity': 'Continuité',
  'analytics': 'Analytique',
  'search': 'Recherche',
  'help': 'Aide',
  'notifications': 'Notifications',
  'backup': 'Sauvegarde',
  'voxel': 'CTC Engine'
};

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
  icon,
  trustType,
  className = ''
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Generate breadcrumbs automatically if not provided
  const items = breadcrumbs || (() => {
    const pathnames = location.pathname.split('/').filter((x) => x);
    const crumbs: BreadcrumbItem[] = [];

    let currentPath = '';
    pathnames.forEach((value, index) => {
      currentPath += `/${value}`;
      const isLast = index === pathnames.length - 1;

      // Try to map the path segment to a readable label
      let label = ROUTE_LABELS[value] || value;

      // Capitalize first letter if not in map
      if (!ROUTE_LABELS[value]) {
        label = label.charAt(0).toUpperCase() + label.slice(1);
      }

      // If it looks like an ID (long string with numbers/dashes), truncate or label as "Détails"
      if (value.length > 20 || /\d/.test(value)) {
        label = 'Détails';
      }

      crumbs.push({
        label,
        path: isLast ? undefined : currentPath
      });
    });

    return crumbs;
  })();

  return (
    <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 ${className}`}>
      <div className="flex-1">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 mb-4" aria-label="Breadcrumb">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors group"
            aria-label="Retour à l'accueil"
          >
            <Home className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
          </button>

          {items.map((crumb, index) => (
            <React.Fragment key={index}>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
              {crumb.path ? (
                <button
                  onClick={() => navigate(crumb.path!)}
                  className="text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors capitalize"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-sm font-semibold text-slate-900 dark:text-white capitalize">
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Title Section with Icon */}
        <div className="flex items-center gap-4">
          {icon && (
            <div className="flex shrink-0 items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/25 ring-1 ring-black/5 dark:ring-white/10">
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl sm:text-4xl font-bold font-display text-slate-900 dark:text-white tracking-tight animate-blur-in">
                {title}
              </h1>
              {trustType && <SecurityBadge feature={trustType} />}
            </div>
            {subtitle && (
              <p className="text-base font-medium font-sans text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {actions && (
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
};
