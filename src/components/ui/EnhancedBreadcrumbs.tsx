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
 /** On mobile, only show last N items (default: 2). Set to 0 to disable truncation. */
 mobileTruncate?: number;
}

export const EnhancedBreadcrumbs: React.FC<EnhancedBreadcrumbsProps> = ({
 items,
 className = '',
 separator = <ChevronRight className="w-4 h-4" />,
 mobileTruncate = 2,
}) => {
 const location = useLocation();

 // On mobile (< 640px), show ellipsis for long breadcrumb trails
 const shouldTruncate = mobileTruncate > 0 && items.length > mobileTruncate + 1;
 const visibleItems = shouldTruncate ? [items[0], ...items.slice(-mobileTruncate)] : items;

 return (
 <nav aria-label="Breadcrumb" className={cn("flex items-center space-x-1 text-sm", className)}>
 <AnimatePresence mode="popLayout">
 {visibleItems.map((item, index) => {
 const showEllipsis = shouldTruncate && index === 1;
 const isLast = index === visibleItems.length - 1;
 const isActive = item.path === location.pathname;

 return (
 <React.Fragment key={item.label || 'unknown'}>
 {showEllipsis && (
  <>
  <span className="text-muted-foreground px-1 hidden sm:inline" aria-hidden="true">{separator}</span>
  <span className="text-muted-foreground px-2 text-xs hidden sm:hidden" aria-hidden="true">...</span>
  </>
 )}
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
  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all duration-200",
  isActive
  ? "bg-primary text-primary-foreground font-medium"
  : "text-muted-foreground hover:text-foreground dark:hover:text-foreground hover:bg-muted"
  )}
  >
  {item.icon || (index === 0 && <Home className="w-4 h-4" />)}
  <span className="truncate max-w-[120px] sm:max-w-[150px]">{item.label}</span>
  </Link>
 ) : (
  <div
  className={cn(
  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl",
  isLast
  ? "text-foreground font-semibold"
  : "text-muted-foreground"
  )}
  >
  {item.icon || (index === 0 && <Home className="w-4 h-4" />)}
  <span className="truncate max-w-[120px] sm:max-w-[150px]">{item.label}</span>
  </div>
 )}
 </motion.div>

 {!isLast && (
 <motion.div
  initial={{ opacity: 0, scale: 0.8 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.2, delay: index * 0.1 + 0.2 }}
  className="flex items-center text-muted-foreground"
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
 <AnimatePresence mode="popLayout">
 {items.map((item, index) => {
 const isLast = index === items.length - 1;

 return (
 <React.Fragment key={item.label || 'unknown'}>
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
  className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-[100px]"
  >
  {item.label}
  </Link>
 ) : (
  <span className="text-xs text-foreground font-medium truncate max-w-[100px]">
  {item.label}
  </span>
 )}
 </motion.div>

 {!isLast && (
 <motion.span
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.1 }}
  className="text-muted-foreground"
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
