import React from 'react';
import { cn } from '../../lib/utils';
// import { useStore } from '../../store'; // Unused

interface MasterpieceBackgroundProps {
    className?: string;
}

export const MasterpieceBackground: React.FC<MasterpieceBackgroundProps> = ({
    className
}) => {
    // const { theme } = useStore();

    return (
        <div className={cn("fixed inset-0 pointer-events-none overflow-hidden -z-10", className)}>
            {/* Base Background Color - Deep Space in Dark Mode */}
            <div className="absolute inset-0 bg-slate-50 dark:bg-[#020617] transition-colors duration-500" />

            {/* High-Tech Grid Pattern - subtle structure */}
            <div className="absolute inset-0 bg-grid-slate-900/[0.04] dark:bg-grid-white/[0.02] [mask-image:linear-gradient(to_bottom,white,transparent)]" />

            {/* Ambient Aurora/Orb Effects - Living Breath */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-brand-500/10 dark:bg-brand-500/20 rounded-full blur-[120px] animate-blob mix-blend-multiply dark:mix-blend-screen" />
            <div className="absolute top-[40%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 dark:bg-indigo-500/10 rounded-full blur-[120px] animate-blob animation-delay-2000 mix-blend-multiply dark:mix-blend-screen" />
            <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] bg-blue-400/10 dark:bg-cyan-500/10 rounded-full blur-[100px] animate-blob animation-delay-4000 mix-blend-multiply dark:mix-blend-screen" />

            {/* Command Center Interaction Lines (Optional, very subtle) */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0),rgba(255,255,255,0))]" />

            {/* Active Monitoring Scanline - The "Alive" Feel */}
            <div className="animate-scanline" />

            {/* Noise Texture for that "Tactile" feel (Optional, keep opacity very low) */}
            <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03] pointer-events-none mix-blend-overlay"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
            />
        </div>
    );
};
