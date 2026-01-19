import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Home } from './Icons';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';

interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ReactNode;
}

interface EnhancedBreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  separator?: React.ReactNode;
}

export const EnhancedBreadcrumbs: React.FC<EnhancedBreadcrumbsProps> = ({
  items,
  className = '',
  separator = <ChevronRight className="w-4 h-4" />
}) => {
  const location = useLocation();

  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center space-x-1 text-sm", className)}>
      <AnimatePresence mode="wait">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isActive = item.path === location.pathname;

          return (
            <React.Fragment key={item.label}>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="flex items-center"
              >
                {item.path && !isLast ? (
                  <Link
                    to={item.path}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200",
                      isActive
                        ? "bg-brand-100 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 font-medium"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                  >
                    {item.icon || (index === 0 && <Home className="w-4 h-4" />)}
                    <span className="truncate max-w-[150px]">{item.label}</span>
                  </Link>
                ) : (
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
                      isLast
                        ? "text-slate-900 dark:text-white font-semibold"
                        : "text-slate-600 dark:text-slate-400"
                    )}
                  >
                    {item.icon || (index === 0 && <Home className="w-4 h-4" />)}
                    <span className="truncate max-w-[150px]">{item.label}</span>
                  </div>
                )}
              </motion.div>

              {!isLast && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: index * 0.1 + 0.2 }}
                  className="flex items-center text-slate-400 dark:text-slate-600"
                >
                  {separator}
                </motion.div>
              )}
            </React.Fragment>
          );
        })}
      </AnimatePresence>
    </nav>
  );
};

export const CompactBreadcrumbs: React.FC<EnhancedBreadcrumbsProps> = ({ items, className = '' }) => {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center space-x-1", className)}>
      <AnimatePresence mode="wait">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <React.Fragment key={item.label}>
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="flex items-center"
              >
                {item.path && !isLast ? (
                  <Link
                    to={item.path}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors truncate max-w-[100px]"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-xs text-slate-900 dark:text-white font-medium truncate max-w-[100px]">
                    {item.label}
                  </span>
                )}
              </motion.div>

              {!isLast && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.1 }}
                  className="text-slate-400 dark:text-slate-600"
                >
                  /
                </motion.span>
              )}
            </React.Fragment>
          );
        })}
      </AnimatePresence>
    </nav>
  );
};
