import React from 'react';
import { cn } from '../../lib/utils';

interface MasterpieceBackgroundProps {
    className?: string;
    // showGrid?: boolean; // Removed
}

// showGrid prop removed as grid is permanently disabled
export const MasterpieceBackground: React.FC<MasterpieceBackgroundProps> = ({
    className
}) => {
    return (
        <div className={cn("fixed inset-0 pointer-events-none overflow-hidden -z-10", className)}>
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-500/5 rounded-full blur-[120px] animate-blob" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px] animate-blob animation-delay-2000" />

            {/* Grid removed as per user request */}
        </div>
    );
};
