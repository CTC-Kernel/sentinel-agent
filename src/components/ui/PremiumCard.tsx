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
 const baseClasses = "rounded-2xl p-6 transition-all duration-normal active:duration-75 ease-apple relative group border border-border/40 shadow-sm";

 const variantClasses = cn(
 glass && "bg-[var(--glass-bg)] backdrop-blur-xl border-[var(--glass-border)] text-foreground",
 gradient && "bg-gradient-to-br from-card to-muted/50 dark:from-background dark:to-card/80",
 hover && [
 "hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/20 hover:bg-[var(--glass-medium-bg)]",
 onClick && "cursor-pointer"
 ],
 glow && "shadow-lg shadow-primary/20 dark:shadow-primary/30",
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
 <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
 </>
 )}

 {/* Glow Effect */}
 {glow && (
 <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
 )}

 <div className="relative z-decorator">
 {children}
 </div>
 </motion.div>
 );
};
