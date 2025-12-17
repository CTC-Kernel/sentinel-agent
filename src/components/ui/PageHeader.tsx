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
  'ctc-engine': 'CTC Engine',
  'admin_management': 'Administration',
  'integrations': 'Intégrations',
  'threat-library': 'Bibliothèque des menaces',
  'calendar': 'Calendrier',
  'intake': 'Collecte',
  'pricing': 'Plans & Facturation'
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
    <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 min-w-0 ${className}`}>
      <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-left-4 duration-500">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 mb-4 min-w-0" aria-label="Breadcrumb">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
            aria-label="Retour à l'accueil"
          >
            <Home className="h-4 w-4 group-hover:scale-110 transition-transform" />
          </button>

          {items.map((crumb, index) => (
            <React.Fragment key={index}>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
              {crumb.path ? (
                <button
                  onClick={() => navigate(crumb.path!)}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors capitalize hover:underline underline-offset-4"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-sm font-semibold text-foreground capitalize">
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Title Section with Icon */}
        <div className="flex items-start gap-4 sm:gap-5 min-w-0">
          {icon && (
            <div className="flex shrink-0 items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/25 ring-1 ring-black/5 dark:ring-white/10 group-hover:scale-105 transition-transform duration-300 mt-1">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex flex-col gap-1.5 pt-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-display text-foreground tracking-tight break-words leading-tight">
                {title}
              </h1>
              {trustType && <SecurityBadge feature={trustType} className="translate-y-[1px]" />}
            </div>
            {subtitle && (
              <p className="text-sm sm:text-base font-medium text-muted-foreground leading-relaxed max-w-3xl">
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
