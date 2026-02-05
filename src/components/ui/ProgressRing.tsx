import React, { useId } from 'react';
import { BRAND_COLORS } from '../../constants/colors';

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
    color = BRAND_COLORS[500],
    backgroundColor = 'hsl(var(--border) / 0.6)',
    showLabel = true,
    label,
    className = ''
}) => {
    const uid = useId();
    const gradientId = `progressGradient-${uid}`;
    const glowId = `progressGlow-${uid}`;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    // Calculate the position of the progress tip for the glow effect
    const progressAngle = (progress / 100) * 360 - 90; // -90 to start from top
    const radians = (progressAngle * Math.PI) / 180;
    const tipX = size / 2 + radius * Math.cos(radians);
    const tipY = size / 2 + radius * Math.sin(radians);

    const isComplete = progress >= 100;

    return (
        <div className={`relative inline-flex items-center justify-center ${className}`} role="meter" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label={label || `${Math.round(progress)}%`}>
            <svg width={size} height={size} className="transform -rotate-90 overflow-visible" aria-hidden="true">
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={color} stopOpacity={1} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                    </linearGradient>
                    <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
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

                {/* Progress circle with gradient */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={`url(#${gradientId})`}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                    filter={`url(#${glowId})`}
                />

                {/* Animated tip glow */}
                {progress > 0 && (
                    <circle
                        cx={tipX}
                        cy={tipY}
                        r={strokeWidth * 1.2}
                        fill={color}
                        className={`transition-all duration-1000 ${isComplete ? 'animate-pulse' : ''}`}
                        style={{
                            filter: `drop-shadow(0 0 ${strokeWidth}px ${color})`,
                            transform: 'rotate(90deg)',
                            transformOrigin: `${size / 2}px ${size / 2}px`
                        }}
                    />
                )}
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
