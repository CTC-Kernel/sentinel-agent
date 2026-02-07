import React from 'react';
import { cn } from '../../lib/utils';

type BadgeIconComponent = React.ElementType<{ className?: string }>;

interface BadgeProps {
 children: React.ReactNode;
 variant?: 'default' | 'outline' | 'soft' | 'glass';
 status?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'brand';
 size?: 'sm' | 'md';
 className?: string;
 icon?: BadgeIconComponent;
 onClick?: () => void;
}

export const Badge: React.FC<BadgeProps> = React.memo(({
 children,
 variant = 'soft',
 status = 'neutral',
 size = 'sm',
 className = '',
 icon: Icon,
 onClick,
 ...props
}) => {
 // Base styles - added focus styles for accessibility
 const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-200 animate-badge-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1";

 // Size styles - WCAG AAA: increased font sizes from 10px/12px to 11px/13px minimum
 // Also ensured minimum touch target height of 24px
 const sizeStyles = {
 sm: "px-2.5 py-1 text-xs min-h-[24px] rounded-full gap-1.5 uppercase tracking-wider",
 md: "px-3 py-1.5 text-xs min-h-[28px] rounded-full gap-2 uppercase tracking-wide"
 };

 // Status & Variant styles
 const getStatusStyles = () => {
 switch (status) {
 case 'success':
 if (variant === 'outline') return "border border-success-border text-success-text";
 if (variant === 'glass') return "bg-success-bg/60 backdrop-blur-md text-success-text border border-success-border/40 shadow-sm";
 if (variant === 'soft') return "bg-success-bg text-success-text border border-success-border/50";
 return "bg-gradient-success text-primary-foreground shadow-sm shadow-success/25";

 case 'warning':
 if (variant === 'outline') return "border border-warning-border text-warning-text";
 if (variant === 'glass') return "bg-warning-bg/60 backdrop-blur-md text-warning-text border border-warning-border/40 shadow-sm";
 if (variant === 'soft') return "bg-warning-bg text-warning-text border border-warning-border/50";
 return "bg-gradient-warning text-primary-foreground shadow-sm shadow-warning/25";

 case 'error':
 if (variant === 'outline') return "border border-error-border text-error-text";
 if (variant === 'glass') return "bg-error-bg/60 backdrop-blur-md text-error-text border border-error-border/40 shadow-sm";
 if (variant === 'soft') return "bg-error-bg text-error-text border border-error-border/50";
 return "bg-gradient-danger text-primary-foreground shadow-sm shadow-error/25";

 case 'info':
 if (variant === 'outline') return "border border-info-border text-info-text";
 if (variant === 'glass') return "bg-info-bg/60 backdrop-blur-md text-info-text border border-info-border/40 shadow-sm";
 if (variant === 'soft') return "bg-info-bg text-info-text border border-info-border/50";
 return "bg-gradient-info text-primary-foreground shadow-sm shadow-info/25";

 case 'brand':
 if (variant === 'outline') return "border border-primary text-primary dark:text-primary dark:border-primary/60";
 if (variant === 'glass') return "bg-primary/20 backdrop-blur-md text-primary dark:text-primary-foreground border border-primary/40 shadow-sm";
 if (variant === 'soft') return "bg-primary/10 text-primary dark:text-primary-foreground border border-primary/20 dark:border-primary/60";
 return "bg-gradient-primary text-primary-foreground shadow-sm shadow-primary/25";

 case 'neutral':
 default:
 if (variant === 'outline') return "border border-border text-muted-foreground";
 if (variant === 'glass') return "bg-muted/60 backdrop-blur-md text-muted-foreground border border-border/40 shadow-sm";
 if (variant === 'soft') return "bg-muted text-muted-foreground border border-border/40";
 return "bg-foreground text-background shadow-sm";
 }
 };

 const Component = onClick ? 'button' : 'span';

 return (
 <Component
 className={cn(baseStyles, sizeStyles[size], getStatusStyles(), onClick && 'cursor-pointer hover:opacity-90 active:scale-95', className)}
 onClick={onClick}
 type={onClick ? "button" : undefined}
 {...props}
 >
 {Icon && (
 <Icon
  className={size === 'sm' ? "w-3.5 h-3.5" : "w-4 h-4"}
  aria-hidden="true"
 />
 )}
 {children}
 </Component>
 );
});

Badge.displayName = 'Badge';
