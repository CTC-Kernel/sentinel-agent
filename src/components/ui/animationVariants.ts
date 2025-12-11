
import { Variants } from 'framer-motion';

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
