import React from 'react';
import { LayerType } from '../../types';

export const VoxelSilhouettes: Record<LayerType, React.ReactNode> = {
    asset: (
        <svg viewBox="0 0 64 64" className="w-full h-full text-blue-500 fill-current">
            <rect x="10" y="28" width="16" height="26" rx="2" className="opacity-80" />
            <rect x="28" y="18" width="18" height="36" rx="2" className="opacity-90" />
            <rect x="48" y="34" width="8" height="20" rx="2" className="opacity-70" />
            <rect x="14" y="34" width="6" height="8" className="text-white fill-current" />
            <rect x="34" y="24" width="6" height="8" className="text-white fill-current" />
        </svg>
    ),
    risk: (
        <svg viewBox="0 0 64 64" className="w-full h-full text-orange-500 fill-current">
            <path d="M32 6 L50 16 V34 C50 44 42 53 32 56 C22 53 14 44 14 34 V16 Z" className="opacity-80" />
            <path d="M32 17 L42 23 V33 C42 40 37 46 32 48 C27 46 22 40 22 33 V23 Z" className="text-white fill-current opacity-70" />
        </svg>
    ),
    project: (
        <svg viewBox="0 0 64 64" className="w-full h-full text-purple-500 fill-current">
            <rect x="10" y="40" width="44" height="10" rx="4" className="opacity-60" />
            <rect x="14" y="28" width="36" height="10" rx="4" className="opacity-75" />
            <rect x="20" y="16" width="24" height="10" rx="4" className="opacity-100" />
            <circle cx="32" cy="21" r="3" className="text-white fill-current" />
        </svg>
    ),
    audit: (
        <svg viewBox="0 0 64 64" className="w-full h-full text-cyan-500 fill-current">
            <rect x="16" y="10" width="32" height="44" rx="4" className="opacity-80" />
            <rect x="22" y="16" width="20" height="4" className="text-white fill-current" />
            <rect x="22" y="24" width="20" height="4" className="text-white/80 fill-current" />
            <rect x="22" y="32" width="12" height="4" className="text-white/60 fill-current" />
            <path d="M36 36 L44 44" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <circle cx="33" cy="38" r="4" className="text-white fill-current" />
        </svg>
    ),
    incident: (
        <svg viewBox="0 0 64 64" className="w-full h-full text-rose-500 fill-current">
            <path d="M32 8 C32 16 20 18 24 30 C20 28 16 32 16 38 C16 48 24 56 32 56 C40 56 48 48 48 38 C48 28 40 20 36 18 C38 26 32 28 32 20" className="opacity-90" />
        </svg>
    ),
    control: (
        <svg viewBox="0 0 64 64" className="w-full h-full text-teal-500 fill-current">
            <rect x="12" y="12" width="40" height="40" rx="8" className="opacity-80" />
            <path d="M22 32 L30 40 L42 24" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
    ),
    supplier: (
        <svg viewBox="0 0 64 64" className="w-full h-full text-green-500 fill-current">
            <circle cx="32" cy="20" r="6" className="opacity-85" />
            <circle cx="16" cy="42" r="5" className="opacity-75" />
            <circle cx="48" cy="42" r="5" className="opacity-75" />
            <circle cx="32" cy="52" r="4" className="opacity-65" />
            <line x1="32" y1="26" x2="32" y2="48" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <line x1="26" y1="38" x2="38" y2="38" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <line x1="32" y1="20" x2="16" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="32" y1="20" x2="48" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
};
