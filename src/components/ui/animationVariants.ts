
import { Variants } from 'framer-motion';

export const fadeInVariants: Variants = {
    hidden: { opacity: 0 },
    initial: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
    },
    in: {
        opacity: 1,
        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
    },
    exit: { opacity: 0, transition: { duration: 0.3 } },
    out: { opacity: 0, transition: { duration: 0.3 } }
};

export const slideUpVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    initial: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
    },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3 } }
};

export const premiumHoverVariants: Variants = {
    initial: { scale: 1, y: 0 },
    hover: { 
        scale: 1.05, 
        y: -4,
        transition: { 
            duration: 0.4, 
            ease: [0.22, 1, 0.36, 1],
            type: "spring",
            stiffness: 300,
            damping: 20
        } 
    },
    tap: { scale: 0.98, transition: { duration: 0.1 } }
};

export const glowVariants: Variants = {
    initial: { opacity: 0, scale: 0.8 },
    animate: { 
        opacity: [0, 1, 0], 
        scale: [0.8, 1.2, 0.8],
        transition: { 
            duration: 3, 
            repeat: Infinity,
            ease: "easeInOut"
        } 
    }
};

export const staggerContainerVariants: Variants = {
    hidden: { opacity: 0 },
    initial: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1
        }
    },
    in: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1
        }
    },
    exit: {},
    out: {}
};
