import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedPageProps {
    children: React.ReactNode;
    className?: string;
}

const pageVariants = {
    initial: {
        opacity: 0,
        y: 20,
        scale: 0.98,
        filter: 'blur(10px)',
    },
    in: {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
    },
    out: {
        opacity: 0,
        y: -20,
        scale: 0.98,
        filter: 'blur(10px)',
    },
};

const pageTransition = {
    type: 'tween',
    ease: [0.16, 1, 0.3, 1],
    duration: 0.6,
} as const;

export const AnimatedPage: React.FC<AnimatedPageProps> = ({ children, className = '' }) => {
    return (
        <motion.div
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className={`w-full h-full ${className}`}
        >
            {children}
        </motion.div>
    );
};
