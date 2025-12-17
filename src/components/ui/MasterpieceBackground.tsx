import React from 'react';
import { cn } from '../../lib/utils';

interface MasterpieceBackgroundProps {
    className?: string;
    showGrid?: boolean;
}

export const MasterpieceBackground: React.FC<MasterpieceBackgroundProps> = ({
    className,
    showGrid = true
}) => {
    return (
        <div className={cn("fixed inset-0 pointer-events-none overflow-hidden -z-10", className)}>
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-500/5 rounded-full blur-[120px] animate-blob" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px] animate-blob animation-delay-2000" />

            {showGrid && (
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
            )}
        </div>
    );
};
