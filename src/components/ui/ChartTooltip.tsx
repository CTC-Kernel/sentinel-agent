import React from 'react';

interface ChartTooltipPayload {
    name: string;
    value: number | string;
    color: string;
    payload?: Record<string, unknown>;
    dataKey?: string;
    [key: string]: unknown;
}

interface ChartTooltipProps {
    active?: boolean;
    payload?: ChartTooltipPayload[];
    label?: string;
    formatter?: (value: number, name?: string) => string;
    hideLabel?: boolean;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label, formatter, hideLabel }) => {
    if (active && payload && payload.length) {
        return (
            <div className="glass-premium p-3 rounded-xl border border-border/40 shadow-apple animate-scale-in max-w-xs" role="tooltip">
                {!hideLabel && label && (
                    <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide border-b border-border/40 pb-1">
                        {label}
                    </p>
                )}
                <div className="space-y-1">
                    {payload.map((entry, index) => (
                        <div key={entry.name || index} className="flex items-center gap-2 text-sm font-medium">
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: entry.color, boxShadow: `0 0 10px ${entry.color}` }}
                            />
                            <span className="text-foreground">
                                {entry.name}:
                            </span>
                            <span className="font-bold text-foreground">
                                {formatter && typeof entry.value === 'number' ? formatter(entry.value) : entry.value}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};
