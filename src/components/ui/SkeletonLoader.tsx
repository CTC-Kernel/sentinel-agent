import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface SkeletonLoaderProps {
  className?: string;
  lines?: number;
  height?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  className = '',
  lines = 1,
  height = 'h-4',
  variant = 'text'
}) => {
  const baseClasses = "bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 bg-[length:200%_100%] animate-shimmer rounded";
  
  const variantClasses = cn(
    variant === 'circular' && 'rounded-full',
    variant === 'rectangular' && 'rounded-none',
    variant === 'rounded' && 'rounded-lg',
    variant === 'text' && 'rounded',
    className
  );

  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <motion.div
          key={i}
          className={cn(baseClasses, variantClasses, height)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.1, duration: 0.5 }}
          style={{
            backgroundPosition: '0% 50%',
            animation: 'shimmer 2s infinite'
          }}
        />
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={cn("p-6 space-y-4", className)}>
    <SkeletonLoader variant="circular" height="h-12 w-12" />
    <SkeletonLoader height="h-6 w-3/4" />
    <SkeletonLoader height="h-4 w-full" />
    <SkeletonLoader height="h-4 w-5/6" />
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ 
  rows = 5, 
  cols = 4 
}) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4">
        {Array.from({ length: cols }).map((_, j) => (
          <SkeletonLoader key={j} height="h-4" className="flex-1" />
        ))}
      </div>
    ))}
  </div>
);
