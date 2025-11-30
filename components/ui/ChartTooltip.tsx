import React from 'react';

interface TooltipPayload {
    name: string;
    value: number | string;
    color?: string;
    fill?: string;
    payload?: unknown;
}

interface ChartTooltipProps {
    active?: boolean;
    payload?: TooltipPayload[];
    label?: string;
    valueFormatter?: (value: number) => string;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label, valueFormatter }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-xl rounded-xl p-3 animate-in fade-in zoom-in-95 duration-200">
                {label && <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">{label}</p>}
                <div className="space-y-1">
                    {payload.map((entry: TooltipPayload, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                            <div
                                className="w-2 h-2 rounded-full shadow-sm"
                                style={{ backgroundColor: entry.color || entry.fill }}
                            />
                            <span className="font-medium text-slate-700 dark:text-slate-200">
                                {entry.name}:
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white">
                                {valueFormatter ? valueFormatter(Number(entry.value)) : entry.value}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};
