import React from 'react';
import { createPortal } from 'react-dom';
import { Lock } from 'lucide-react';
import { motion, Easing } from 'framer-motion';

interface LoadingScreenProps {
    message?: string;
    description?: string;
}

// Apple-style spring easing for that "natural" feel
const IOS_EASE: Easing = [0.16, 1, 0.3, 1];

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
    message = "Securing Environment...",
    description
}) => {
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden">
            {/* Background: Living Aurora */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 bg-slate-50 dark:bg-slate-950 z-0"
            />

            {/* Floating Orbs (Aurora effect) */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{
                        x: [0, 50, 0],
                        y: [0, 30, 0],
                        opacity: [0.3, 0.5, 0.3]
                    }}
                    transition={{
                        duration: 10,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-[100px]"
                />
                <motion.div
                    animate={{
                        x: [0, -30, 0],
                        y: [0, -50, 0],
                        opacity: [0.3, 0.5, 0.3]
                    }}
                    transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 1
                    }}
                    className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]"
                />
            </div>

            <div className="relative z-10 flex flex-col items-center">
                {/* Zero Gravity Icon Container */}
                <div className="relative flex items-center justify-center">
                    {/* Organic Pulse Ring */}
                    <motion.div
                        animate={{
                            scale: [1, 1.15, 1],
                            opacity: [0.2, 0, 0.2],
                            rotate: [0, 90, 0] // Subtle rotation for organic feel
                        }}
                        transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="absolute w-32 h-32 rounded-full border border-brand-500/20 blur-md"
                    />

                    {/* The "Zero Gravity" Icon Box */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            y: [0, -10, 0], // Floating effect
                            rotate: [0, 2, -2, 0] // Subtle tilt
                        }}
                        transition={{
                            y: {
                                duration: 4,
                                repeat: Infinity,
                                ease: "easeInOut"
                            },
                            rotate: {
                                duration: 6,
                                repeat: Infinity,
                                ease: "easeInOut"
                            },
                            opacity: { duration: 0.6, ease: IOS_EASE },
                            scale: { duration: 0.6, ease: IOS_EASE }
                        }}
                        // MATCHING LOGIN PAGE STYLE: bg-slate-900 (light) / bg-white (dark)
                        className="relative w-20 h-20 bg-slate-900 dark:bg-white rounded-[24px] shadow-2xl ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center isolate overflow-hidden"
                    >
                        {/* Internal Shine/Reflection (Adjusted for dark bg in light mode) */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent opacity-30" />

                        {/* Breathing Icon */}
                        <motion.div
                            animate={{
                                scale: [1, 1.08, 1],
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        >
                            {/* Inverted text color: White in light mode, Black in dark mode */}
                            <Lock className="w-10 h-10 text-white dark:text-slate-900 drop-shadow-sm" strokeWidth={2.5} />
                        </motion.div>
                    </motion.div>
                </div>

                {/* Masked Text Reveal */}
                <div className="mt-12 flex flex-col items-center gap-2 overflow-hidden">
                    <div className="overflow-hidden">
                        <motion.p
                            initial={{ y: "100%", opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{
                                duration: 0.8,
                                ease: IOS_EASE,
                                delay: 0.2
                            }}
                            className="text-sm font-semibold text-slate-800 dark:text-slate-100 tracking-wide uppercase"
                        >
                            {message}
                        </motion.p>
                    </div>

                    {description && (
                        <div className="overflow-hidden">
                            <motion.p
                                initial={{ y: "100%", opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{
                                    duration: 0.8,
                                    ease: IOS_EASE,
                                    delay: 0.3
                                }}
                                className="text-xs text-slate-500 dark:text-slate-400 font-medium"
                            >
                                {description}
                            </motion.p>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
