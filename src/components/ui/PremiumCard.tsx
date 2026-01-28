import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';
import { appleEasing } from '../../utils/microInteractions';

export interface PremiumCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  glass?: boolean;
  gradient?: boolean;
  gradientOverlay?: boolean;
}

export const PremiumCard: React.FC<PremiumCardProps> = ({
  children,
  className = '',
  hover = true,
  glow = false,
  glass = false,
  gradient = false,
  gradientOverlay = false,
  onClick,
  ...props
}) => {
  const baseClasses = "rounded-3xl p-6 transition-all duration-300 relative overflow-hidden group border border-transparent";

  const variantClasses = cn(
    glass && "glass-premium",
    gradient && "bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-border/50",
    !glass && !gradient && "bg-card text-card-foreground border-border/60 shadow-sm",
    hover && [
      "hover:shadow-lg",
      onClick && "cursor-pointer"
    ],
    glow && "shadow-lg shadow-primary/5 dark:shadow-primary/10",
    className
  );

  return (
    <motion.div
      className={cn(baseClasses, variantClasses)}
      whileHover={hover ? { y: -4 } : {}}
      transition={{ duration: 0.4, ease: appleEasing }}
      onClick={onClick}
      {...props}
    >
      {/* Gradient Overlays for Glass/Premium feel */}
      {(glass || glow || gradientOverlay) && (
        <>
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent dark:from-white/5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </>
      )}

      {/* Glow Effect */}
      {glow && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      )}

      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};
