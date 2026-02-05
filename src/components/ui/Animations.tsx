import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

import { fadeInVariants, slideUpVariants, staggerContainerVariants } from './animationVariants';

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
