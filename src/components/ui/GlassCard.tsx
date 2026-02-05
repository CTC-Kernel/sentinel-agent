import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
 hoverEffect?: boolean;
 children: React.ReactNode;
}

export const GlassCard: React.FC<GlassCardProps> = ({
 className,
 hoverEffect = false,
 children,
 ...props
}) => {
 return (
 <div
 className={cn(
 "relative overflow-hidden rounded-2xl border border-border/40 bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm transition-all duration-300",
 hoverEffect && "hover:shadow-md hover:scale-[1.01] hover:bg-[var(--glass-medium-bg)] cursor-pointer",
 className
 )}
 {...props}
 >
 {children}
 </div>
 );
};
