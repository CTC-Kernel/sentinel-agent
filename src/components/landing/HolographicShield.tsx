import { Shield } from '../ui/Icons';

export const HolographicShield = () => {
    return (
        <div className="relative w-96 h-96 flex items-center justify-center pointer-events-none select-none perspective-1000">
            {/* Outer Rotating Ring */}
            <div className="absolute inset-0 rounded-full border border-brand-500/20 border-t-brand-500/60 border-b-brand-500/60 animate-[spin_10s_linear_infinite] shadow-[0_0_30px_rgba(59,130,246,0.2)]"></div>

            {/* Inner Counter-Rotating Ring */}
            <div className="absolute inset-8 rounded-full border border-dashed border-violet-400/30 animate-[spin_15s_linear_infinite_reverse]"></div>

            {/* Pulsing Core Field */}
            <div className="absolute inset-20 rounded-full bg-brand-500/10 blur-3xl animate-pulse"></div>

            {/* Center Emblem */}
            <div className="relative z-10 p-8 rounded-full bg-slate-900/50 backdrop-blur-md border border-brand-500/30 shadow-[0_0_50px_rgba(59,130,246,0.3)] animate-float">
                <Shield className="w-24 h-24 text-brand-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]" />
            </div>

            {/* Scanning Effect (Horizontal Line) */}
            <div className="absolute inset-0 overflow-hidden rounded-full opacity-30">
                <div className="w-full h-[2px] bg-brand-400/50 blur-[1px] animate-[scanline_3s_linear_infinite] shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
            </div>

            {/* Orbital Particles */}
            <div className="absolute w-full h-full animate-[spin_8s_linear_infinite]">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-brand-400 rounded-full shadow-[0_0_10px_rgba(59,130,246,1)]"></div>
            </div>
            <div className="absolute w-[80%] h-[80%] animate-[spin_12s_linear_infinite_reverse]">
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-violet-400 rounded-full shadow-[0_0_10px_rgba(139,92,246,1)]"></div>
            </div>
        </div>
    );
};
