import React from 'react';

interface ProgressRingProps {
    progress: number; // 0-100
    size?: number;
    strokeWidth?: number;
    color?: string;
    backgroundColor?: string;
    showLabel?: boolean;
    label?: string;
    className?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
    progress,
    size = 120,
    strokeWidth = 8,
    color = '#3b82f6',
    backgroundColor = 'hsl(var(--border) / 0.6)',
    showLabel = true,
    label,
    className = ''
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div className={`relative inline-flex items-center justify-center ${className}`}>
            <svg width={size} height={size} className="transform -rotate-90 overflow-visible">
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={backgroundColor}
                    strokeWidth={strokeWidth}
                    fill="none"
                    className="dark:opacity-20"
                />

                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                    style={{
                        filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.3))'
                    }}
                />
            </svg>

            {/* Center label */}
            {showLabel && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-foreground">
                        {Math.round(progress)}%
                    </span>
                    {label && (
                        <span className="text-xs text-muted-foreground mt-1">
                            {label}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};
