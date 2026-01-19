import React from 'react';
import { Skeleton, CardSkeleton } from '../ui/Skeleton';

export const DashboardSkeleton: React.FC = () => {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Header / Stats Area */}
            <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
                <div className="space-y-2 w-full md:w-1/3">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton variant="text" className="w-64" />
                </div>
                <div className="flex gap-4">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={`panel-${i}`} className="glass-panel p-6 rounded-2xl flex flex-col gap-2">
                        <Skeleton variant="text" className="w-24 bg-slate-200 dark:bg-slate-800" />
                        <Skeleton className="h-8 w-16 bg-slate-200 dark:bg-slate-800" />
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            <div className="glass-panel h-24 rounded-2xl p-4 flex gap-4 overflow-hidden">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={`tab-skel-${i}`} className="h-full w-24 rounded-xl flex-shrink-0" />
                ))}
            </div>

            {/* Main Content Area (Widgets) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <CardSkeleton count={2} />
                    <Skeleton className="h-64 w-full rounded-3xl" />
                </div>
                <div className="space-y-6">
                    <Skeleton className="h-48 w-full rounded-3xl" />
                    <CardSkeleton count={1} />
                </div>
            </div>
        </div>
    );
};
