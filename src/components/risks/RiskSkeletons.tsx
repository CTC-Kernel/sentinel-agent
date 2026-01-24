import React from 'react';
import { Skeleton, ListSkeleton, CardSkeleton } from '../ui/Skeleton';

/**
 * Skeleton specific to Risk Dashboard Overview
 */
export const RiskDashboardSkeleton: React.FC = () => {
    return (
        <div className="space-y-8 animate-fade-in">
            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="glass-premium p-6 rounded-3xl h-32 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <Skeleton className="h-4 w-24" variant="text" />
                            <Skeleton variant="circular" className="h-8 w-8" />
                        </div>
                        <Skeleton className="h-8 w-16" />
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="glass-premium p-8 rounded-4xl h-[400px] flex flex-col gap-4">
                    <Skeleton className="h-6 w-48 mb-4" />
                    <Skeleton className="flex-1 w-full rounded-2xl" />
                </div>
                <div className="glass-premium p-8 rounded-4xl h-[400px] flex flex-col gap-4">
                    <Skeleton className="h-6 w-48 mb-4" />
                    <Skeleton className="flex-1 w-full rounded-2xl" />
                </div>
            </div>
        </div>
    );
};

/**
 * Skeleton for Risk Mapped Matrix
 */
export const RiskMatrixSkeleton: React.FC = () => {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <Skeleton className="h-10 w-64" />
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                </div>
            </div>

            <div className="glass-premium p-6 rounded-4xl h-[600px] relative">
                {/* Matrix Grid Simulation */}
                <div className="grid grid-cols-5 gap-4 h-full">
                    {Array.from({ length: 25 }).map((_, i) => (
                        <Skeleton key={i} className="h-full w-full rounded-xl opacity-50" />
                    ))}
                </div>
            </div>
        </div>
    );
};

/**
 * Skeleton for Risk List View
 */
export const RiskListSkeleton: React.FC = () => {
    return (
        <div className="space-y-4 animate-fade-in">
            {/* Toolbar Skeleton */}
            <div className="flex justify-between items-center mb-6">
                <Skeleton className="h-10 w-64" />
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                </div>
            </div>
            <ListSkeleton items={8} />
        </div>
    );
};

/**
 * Skeleton for Context Tab
 */
export const RiskContextSkeleton: React.FC = () => {
    return (
        <div className="glass-premium p-8 rounded-5xl border border-white/60 dark:border-white/10 shadow-apple-sm space-y-8 animate-fade-in">
            <div className="flex justify-between items-center">
                <Skeleton className="h-8 w-64" variant="text" />
                <Skeleton className="h-10 w-32" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <Skeleton className="h-6 w-40" variant="text" />
                    <CardSkeleton count={2} className="grid-cols-1" />
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-6 w-40" variant="text" />
                    <CardSkeleton count={2} className="grid-cols-1" />
                </div>
            </div>
        </div>
    );
};
