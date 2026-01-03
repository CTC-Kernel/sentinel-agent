import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface PremiumCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  glass?: boolean;
  gradient?: boolean;
}

export const PremiumCard: React.FC<PremiumCardProps> = ({
  children,
  className = '',
  hover = true,
  glow = false,
  glass = false,
  gradient = false
}) => {
  const baseClasses = "rounded-2xl p-6 transition-all duration-300 relative overflow-hidden";
  
  const variantClasses = cn(
    glass && "bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 dark:border-white/10",
    gradient && "bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900",
    !glass && !gradient && "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700",
    hover && "hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1",
    glow && "shadow-lg shadow-slate-200/25 dark:shadow-slate-800/25",
    className
  );

  return (
    <motion.div
      className={cn(baseClasses, variantClasses)}
      whileHover={hover ? { scale: 1.02, y: -4 } : {}}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {glow && (
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-30 transition-opacity duration-300" />
      )}
      {children}
    </motion.div>
  );
};
