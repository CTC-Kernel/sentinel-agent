/**
 * AnimatedWidgetGrid Component
 *
 * A grid container that animates children with staggered entrance effects.
 * Creates a cascade effect for dashboard widgets appearing on page load.
 *
 * @example
 * ```tsx
 * <AnimatedWidgetGrid columns={3} gap={4}>
 *   <DashboardWidget />
 *   <DashboardWidget />
 *   <DashboardWidget />
 * </AnimatedWidgetGrid>
 * ```
 */

import React, { Children, isValidElement } from 'react';
import { motion, Variants, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { appleEasing, cardHover } from '@/utils/microInteractions';

export interface AnimatedWidgetGridProps {
  /** Children widgets to render */
  children: React.ReactNode;
  /** Number of columns (responsive by default) */
  columns?: 1 | 2 | 3 | 4 | 'auto';
  /** Gap between items (Tailwind spacing scale) */
  gap?: 2 | 3 | 4 | 5 | 6 | 8;
  /** Delay between each item animation */
  staggerDelay?: number;
  /** Initial delay before first item animates */
  initialDelay?: number;
  /** Animation duration for each item */
  itemDuration?: number;
  /** Whether items should animate on hover */
  hoverEffect?: boolean;
  /** Custom class name */
  className?: string;
  /** Animation direction */
  direction?: 'up' | 'down' | 'left' | 'right' | 'scale';
}

const columnClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  auto: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
};

const gapClasses = {
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  5: 'gap-5',
  6: 'gap-6',
  8: 'gap-8',
};

const getDirectionOffset = (direction: AnimatedWidgetGridProps['direction']) => {
  switch (direction) {
    case 'up':
      return { y: 30, x: 0 };
    case 'down':
      return { y: -30, x: 0 };
    case 'left':
      return { y: 0, x: 30 };
    case 'right':
      return { y: 0, x: -30 };
    case 'scale':
    default:
      return { y: 0, x: 0 };
  }
};

/**
 * Create item variants based on direction
 */
const createItemVariants = (
  direction: AnimatedWidgetGridProps['direction'],
  duration: number
): Variants => {
  const offset = getDirectionOffset(direction);
  const useScale = direction === 'scale';

  return {
    hidden: {
      opacity: 0,
      y: offset.y,
      x: offset.x,
      scale: useScale ? 0.9 : 1,
    },
    visible: {
      opacity: 1,
      y: 0,
      x: 0,
      scale: 1,
      transition: {
        ease: appleEasing,
        duration,
      },
    },
  };
};
interface AnimatedWidgetItemProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  index: number;
  itemDuration: number;
  hoverEffect: boolean;
  direction: AnimatedWidgetGridProps['direction'];
}

const AnimatedWidgetItem: React.FC<AnimatedWidgetItemProps> = ({
  children,
  index,
  itemDuration,
  hoverEffect,
  direction,
  ...props
}) => {
  const itemVariants = createItemVariants(direction, itemDuration);

  return (
    <motion.div
      variants={itemVariants}
      custom={index}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      whileHover={hoverEffect ? (cardHover as any) : undefined}
      className="will-change-transform"
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const AnimatedWidgetGrid: React.FC<AnimatedWidgetGridProps> = ({
  children,
  columns = 3,
  gap = 4,
  staggerDelay = 0.1,
  initialDelay = 0.1,
  itemDuration = 0.5,
  hoverEffect = true,
  className,
  direction = 'up',
}) => {
  // Create custom container variants with provided delays
  const customContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: initialDelay,
      },
    },
  };

  // Wrap each child in an animated container
  const animatedChildren = Children.map(children, (child, index) => {
    if (!isValidElement(child)) return child;

    return (
      <AnimatedWidgetItem
        key={child.key || index}
        index={index}
        itemDuration={itemDuration}
        hoverEffect={hoverEffect}
        direction={direction}
      >
        {child}
      </AnimatedWidgetItem>
    );
  });

  return (
    <motion.div
      variants={customContainerVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        'grid',
        columnClasses[columns],
        gapClasses[gap],
        className
      )}
    >
      {animatedChildren}
    </motion.div>
  );
};

/**
 * Single animated widget card with glass morphism
 */
export interface AnimatedWidgetCardProps {
  children: React.ReactNode;
  title?: string;
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  isLoading?: boolean;
}

export const AnimatedWidgetCard: React.FC<AnimatedWidgetCardProps> = ({
  children,
  title,
  icon,
  className,
  onClick,
  isLoading,
}) => {
  return (
    <motion.div
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      whileHover={onClick ? (cardHover as any) : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'bg-white/80 dark:bg-slate-800/80',
        'backdrop-blur-sm',
        'border border-slate-200/50 dark:border-slate-700/50',
        'shadow-apple dark:shadow-none',
        'p-4 md:p-6',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {/* Loading shimmer overlay */}
      {isLoading && (
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{
            repeat: Infinity,
            duration: 1.5,
            ease: 'linear',
          }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        />
      )}

      {/* Header */}
      {(title || icon) && (
        <div className="flex items-center gap-2 mb-4">
          {icon && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              className="text-brand-500"
            >
              {icon}
            </motion.div>
          )}
          {title && (
            <motion.h3
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="text-sm font-medium text-slate-600 dark:text-slate-300"
            >
              {title}
            </motion.h3>
          )}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

export default AnimatedWidgetGrid;
