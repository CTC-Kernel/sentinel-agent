
import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'text' | 'circular' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'default' }) => {
  const variantClasses = {
    default: 'rounded-lg',
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-none'
  };

  return (
    <div className={`relative overflow-hidden bg-gray-200 dark:bg-white/5 ${variantClasses[variant]} ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent"></div>
    </div>
  );
};

// Table Skeleton Component
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ rows = 5, columns = 4 }) => {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-10" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} className="h-16" />
          ))}
        </div>
      ))}
    </div>
  );
};

// Card Skeleton Component
export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-panel p-6 rounded-[2rem] space-y-4">
          <div className="flex justify-between items-start">
            <Skeleton variant="circular" className="w-12 h-12" />
            <Skeleton className="w-16 h-6" />
          </div>
          <Skeleton className="h-8 w-20" />
          <Skeleton variant="text" className="w-32" />
        </div>
      ))}
    </div>
  );
};

// List Skeleton Component  
export const ListSkeleton: React.FC<{ items?: number }> = ({ items = 5 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="glass-panel p-4 rounded-2xl flex items-center space-x-4">
          <Skeleton variant="circular" className="w-12 h-12 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="w-3/4" />
            <Skeleton variant="text" className="w-1/2 h-3" />
          </div>
          <Skeleton className="w-20 h-8" />
        </div>
      ))}
    </div>
  );
};
