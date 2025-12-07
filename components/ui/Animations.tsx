import React from 'react';
import { motion, HTMLMotionProps, Variants } from 'framer-motion';

// --- Variants ---

export const fadeInVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } // Apple-like ease
    },
    exit: { opacity: 0, transition: { duration: 0.3 } }
};

export const slideUpVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
    },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3 } }
};

export const staggerContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1
        }
    }
};

// --- Components ---

interface AnimationProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
    className?: string;
    delay?: number;
}

export const FadeIn: React.FC<AnimationProps> = ({ children, className, delay = 0, ...props }) => {
    return (
        <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={fadeInVariants}
            transition={{ delay }}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    );
};

export const SlideUp: React.FC<AnimationProps> = ({ children, className, delay = 0, ...props }) => {
    return (
        <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={slideUpVariants}
            transition={{ delay }}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    );
};

export const StaggerContainer: React.FC<AnimationProps> = ({ children, className, delay = 0, ...props }) => {
    return (
        <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={staggerContainerVariants}
            transition={{ delay }}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    );
};
