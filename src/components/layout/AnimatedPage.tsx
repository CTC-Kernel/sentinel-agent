import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedPageProps {
    children: React.ReactNode;
    className?: string;
}

const pageVariants = {
    initial: {
        opacity: 0,
        y: 12,
        scale: 0.99,
        filter: 'blur(4px)',
    },
    in: {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        transition: {
            staggerChildren: 0.05,
            delayChildren: 0.1,
        }
    },
    out: {
        opacity: 0,
        y: -12,
        scale: 0.99,
        filter: 'blur(4px)',
    },
};

const pageTransition = {
    type: 'tween',
    ease: [0.25, 1, 0.35, 1], // Apple-esque ease
    duration: 0.5,
} as const;

import { LoadingScreen } from '../ui/LoadingScreen';

// ...

export const AnimatedPage: React.FC<AnimatedPageProps> = ({ children, className = '' }) => {
    return (
        <motion.div
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className={`w-full flex flex-col p-6 md:p-8 max-w-[1920px] mx-auto space-y-6 pb-20 relative min-h-screen animate-fade-in ${className}`}
        >
            <React.Suspense fallback={<LoadingScreen />}>
                {children}
            </React.Suspense>
        </motion.div>
    );
};
