import React from 'react';

interface ChartTooltipProps {
    active?: boolean;
    payload?: any[];
    label?: string;
    formatter?: (value: number) => string;
    hideLabel?: boolean;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label, formatter, hideLabel }) => {
    if (active && payload && payload.length) {
        return (
            <div className="glass-panel p-3 rounded-xl border border-white/60 dark:border-white/10 shadow-apple bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl animate-scale-in">
                {!hideLabel && label && (
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide border-b border-slate-200 dark:border-white/10 pb-1">
                        {label}
                    </p>
                )}
                <div className="space-y-1">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-sm font-medium">
                            <div
                                className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.3)]"
                                style={{ backgroundColor: entry.color, boxShadow: `0 0 10px ${entry.color}` }}
                            />
                            <span className="text-slate-700 dark:text-slate-200">
                                {entry.name}:
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white">
                                {formatter ? formatter(entry.value) : entry.value}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};
