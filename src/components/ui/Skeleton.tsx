import React from 'react';
import { motion } from 'framer-motion';
import { appleEasing } from '../../utils/microInteractions';

interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'text' | 'circular' | 'rectangular';
  /** Animation delay for stagger effect (in seconds) */
  delay?: number;
  /** Disable entrance animation */
  noAnimation?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'default',
  delay = 0,
  noAnimation = false
}) => {
  const variantClasses = {
    default: 'rounded-lg',
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-none'
  };

  const content = (
    <div className={`relative overflow-hidden bg-muted/50 dark:bg-white/5 ${variantClasses[variant]} ${className}`}>
      {/* Primary shimmer - uses skeleton-shimmer class from index.css */}
      <div className="absolute inset-0 skeleton-shimmer" />
      {/* Secondary accent shimmer for depth */}
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-primary/10 to-transparent w-1/2 blur-sm"
        style={{ animationDelay: '0.1s' }}
      />
    </div>
  );

  if (noAnimation) {
    return content;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3, ease: appleEasing }}
    >
      {content}
    </motion.div>
  );
};

// Table Skeleton Component with stagger animation
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ rows = 5, columns = 4 }) => {
  return (
    <motion.div
      className="space-y-3"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
      }}
    >
      {/* Header */}
      <motion.div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        variants={{ hidden: { opacity: 0, y: -10 }, visible: { opacity: 1, y: 0 } }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-col-${i}`} className="h-10" noAnimation />
        ))}
      </motion.div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <motion.div
          key={`table-row-${rowIndex}`}
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-col-${colIndex}`} className="h-16" noAnimation />
          ))}
        </motion.div>
      ))}
    </motion.div>
  );
};

// Single Card Skeleton with stagger animation
export const SkeletonCard: React.FC<{ className?: string; delay?: number }> = ({ className = '', delay = 0 }) => {
  return (
    <motion.div
      className={`glass-premium p-6 rounded-[2rem] space-y-4 ${className}`}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: appleEasing }}
    >
      <div className="flex justify-between items-start">
        <Skeleton variant="circular" className="w-12 h-12" noAnimation />
        <Skeleton className="w-16 h-6" noAnimation />
      </div>
      <Skeleton className="h-8 w-20" noAnimation />
      <Skeleton variant="text" className="w-32" noAnimation />
    </motion.div>
  );
};

// Card Skeleton Grid with stagger animation
export const CardSkeleton: React.FC<{ count?: number; className?: string }> = ({ count = 3, className = '' }) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={`card-skeleton-${i}`} delay={i * 0.1} />
      ))}
    </div>
  );
};

// List Skeleton Component with stagger animation
export const ListSkeleton: React.FC<{ items?: number }> = ({ items = 5 }) => {
  return (
    <motion.div
      className="space-y-3"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
      }}
    >
      {Array.from({ length: items }).map((_, i) => (
        <motion.div
          key={`list-item-skeleton-${i}`}
          className="glass-premium p-4 rounded-2xl flex items-center space-x-4"
          variants={{
            hidden: { opacity: 0, x: -30 },
            visible: { opacity: 1, x: 0, transition: { ease: appleEasing } }
          }}
        >
          <Skeleton variant="circular" className="w-12 h-12 flex-shrink-0" noAnimation />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="w-3/4" noAnimation />
            <Skeleton variant="text" className="w-1/2 h-3" noAnimation />
          </div>
          <Skeleton className="w-20 h-8" noAnimation />
        </motion.div>
      ))}
    </motion.div>
  );
};
