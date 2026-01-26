/**
 * RadialGauge Component
 * Apple-style radial gauge for displaying metrics
 */

import React from 'react';
import { cn } from '../../lib/utils';

export interface RadialGaugeProps {
    /** Current value */
    value: number;
    /** Maximum value */
    max?: number;
    /** Size of the gauge */
    size?: number;
    /** Stroke thickness */
    thickness?: number;
    /** Label text */
    label?: string;
    /** Unit to display */
    unit?: string;
    /** Show tick marks */
    showTicks?: boolean;
    /** Custom color class for the progress */
    colorClass?: string;
    /** Additional class name */
    className?: string;
}

export const RadialGauge: React.FC<RadialGaugeProps> = ({
    value,
    max = 100,
    size = 120,
    thickness = 12,
    label,
    unit = '%',
    showTicks = false,
    colorClass,
    className,
}) => {
    const percentage = Math.min((value / max) * 100, 100);
    const radius = (size - thickness) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    const center = size / 2;

    // Determine color based on value
    const getColorClass = () => {
        if (colorClass) return colorClass;
        if (percentage >= 80) return 'text-success';
        if (percentage >= 60) return 'text-warning';
        return 'text-danger';
    };

    return (
        <div className={cn('relative inline-flex items-center justify-center', className)}>
            <svg
                width={size}
                height={size}
                className="transform -rotate-90"
            >
                {/* Background circle */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={thickness}
                    fill="none"
                    className="text-muted/30"
                />

                {/* Progress circle */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={thickness}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className={cn('transition-all duration-700 ease-out', getColorClass())}
                />

                {/* Tick marks */}
                {showTicks && (
                    <>
                        {[0, 25, 50, 75, 100].map((tick) => {
                            const angle = (tick / 100) * 360 - 90;
                            const rad = (angle * Math.PI) / 180;
                            const innerRadius = radius - thickness / 2 - 4;
                            const outerRadius = radius - thickness / 2 - 8;
                            const x1 = center + innerRadius * Math.cos(rad);
                            const y1 = center + innerRadius * Math.sin(rad);
                            const x2 = center + outerRadius * Math.cos(rad);
                            const y2 = center + outerRadius * Math.sin(rad);

                            return (
                                <line
                                    key={tick}
                                    x1={x1}
                                    y1={y1}
                                    x2={x2}
                                    y2={y2}
                                    stroke="currentColor"
                                    strokeWidth="1"
                                    className="text-muted-foreground/30"
                                />
                            );
                        })}
                    </>
                )}
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn('font-bold font-display', getColorClass())} style={{ fontSize: size * 0.22 }}>
                    {Math.round(value)}
                </span>
                {unit && (
                    <span className="text-muted-foreground" style={{ fontSize: size * 0.1 }}>
                        {unit}
                    </span>
                )}
                {label && (
                    <span className="text-muted-foreground text-center" style={{ fontSize: size * 0.08, maxWidth: size * 0.7 }}>
                        {label}
                    </span>
                )}
            </div>
        </div>
    );
};

export default RadialGauge;
