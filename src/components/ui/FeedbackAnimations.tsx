import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { appleEasing } from '../../utils/microInteractions';

/**
 * Composant Button avec animation de feedback au clic
 * Fournit un retour visuel immédiat à l'utilisateur
 */
interface AnimatedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  onClick,
  ...props
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setIsPressed(true);
    
    // Clear previous timeouts
    timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
    timeoutRefs.current = [];

    const pressTimeout = setTimeout(() => setIsPressed(false), 200);
    timeoutRefs.current.push(pressTimeout);

    // Créer effet ripple
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const ripple = document.createElement('span');
    const diameter = Math.max(rect.width, rect.height);
    const radius = diameter / 2;

    ripple.style.width = ripple.style.height = `${diameter}px`;
    ripple.style.left = `${e.clientX - rect.left - radius}px`;
    ripple.style.top = `${e.clientY - rect.top - radius}px`;
    ripple.className = 'ripple';

    button.appendChild(ripple);
    
    const rippleTimeout = setTimeout(() => {
      ripple.remove();
    }, 600);
    timeoutRefs.current.push(rippleTimeout);

    onClick?.(e);
  }, [onClick]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  const baseClasses = 'font-bold rounded-3xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

  const variantClasses = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white focus-visible:ring-primary shadow-lg shadow-brand-500/20',
    secondary: 'bg-white dark:bg-slate-800 border border-border/40 dark:border-border/40 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 focus-visible:ring-primary',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 shadow-lg shadow-red-500/20',
    success: 'bg-success-600 hover:bg-success-700 text-white focus:ring-success-500 shadow-lg shadow-success-500/20'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  return (
    <button
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${isPressed ? 'scale-95' : 'hover:scale-105'}
        ${loading ? 'opacity-75 cursor-not-allowed' : ''}
        ${className}
        relative overflow-hidden
      `}
      onClick={handleClick}
      disabled={loading}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
        </span>
      )}
      <span className={loading ? 'opacity-0' : ''}>{children}</span>

      <style>{`
        .ripple {
          position: absolute;
          border-radius: 50%;
          background-color: rgba(255, 255, 255, 0.6);
          transform: scale(0);
          animation: ripple-animation 600ms ease-out;
          pointer-events: none;
        }

        @keyframes ripple-animation {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }
      `}</style>
    </button>
  );
};

/**
 * Composant Card avec animation au hover
 */
interface AnimatedCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  interactive?: boolean;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  onClick,
  className = '',
  interactive = false
}) => {
  if (interactive || onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onClick?.();
          }
        }}
        className={`
          w-full text-left
          glass-premium rounded-4xl border border-border/40
          transition-all duration-300
          cursor-pointer hover:scale-[1.02] hover:shadow-xl
          hover:-translate-y-1
          ${className}
        `}
      >
        {children}
      </button>
    );
  }

  return (
    <div
      className={`
        glass-premium rounded-4xl border border-border/40
        transition-all duration-300
        ${className}
      `}
    >
      {children}
    </div>
  );
};

/**
 * Skeleton avec pulse amélioré
 */
interface PulseSkeletonProps {
  className?: string;
  count?: number;
  variant?: 'text' | 'circular' | 'rectangular';
}

export const PulseSkeleton: React.FC<PulseSkeletonProps> = ({
  className = '',
  count = 1,
  variant = 'rectangular'
}) => {
  const baseClasses = 'bg-slate-200 dark:bg-slate-700 animate-pulse';

  const variantClasses = {
    text: 'h-4 rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-3xl'
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`pulse-${i || 'unknown'}`}
          className={`${baseClasses} ${variantClasses[variant]} ${className}`}
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </>
  );
};

/**
 * Badge avec animation de notification
 */
interface NotificationBadgeProps {
  count: number;
  max?: number;
  showZero?: boolean;
  className?: string;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  max = 99,
  showZero = false,
  className = ''
}) => {
  if (!showZero && count === 0) return null;

  const displayCount = count > max ? `${max}+` : count;

  return (
    <span
      className={`
        inline-flex items-center justify-center
        min-w-[20px] h-5 px-1.5
        bg-red-500 text-white
        text-[11px] font-bold
        rounded-full
        animate-bounce
        ${className}
      `}
      style={{
        animation: count > 0 ? 'bounce 1s ease-in-out 2' : 'none'
      }}
    >
      {displayCount}
    </span>
  );
};

/**
 * Progress bar animée avec Framer Motion
 */
interface AnimatedProgressProps {
  value: number;
  max?: number;
  color?: 'brand' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  /** Show pulse glow effect */
  showGlow?: boolean;
  /** Indeterminate mode (loading animation) */
  indeterminate?: boolean;
}

export const AnimatedProgress: React.FC<AnimatedProgressProps> = ({
  value,
  max = 100,
  color = 'brand',
  size = 'md',
  showLabel = false,
  showGlow = false,
  indeterminate = false
}) => {
  const percentage = Math.min((value / max) * 100, 100);

  const colorClasses = {
    brand: 'bg-brand-500',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    danger: 'bg-error-500'
  };

  const glowClasses = {
    brand: 'shadow-brand-500/250',
    success: 'shadow-success-500/50',
    warning: 'shadow-warning-500/50',
    danger: 'shadow-error-500/50'
  };

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className="w-full">
      {showLabel && (
        <motion.div
          className="flex justify-between items-center mb-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ease: appleEasing }}
        >
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 dark:text-muted-foreground">
            Progression
          </span>
          <motion.span
            className="text-sm font-bold text-slate-900 dark:text-white tabular-nums"
            key={Math.round(percentage) || 'unknown'}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            {Math.round(percentage)}%
          </motion.span>
        </motion.div>
      )}
      <div className={`w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        {indeterminate ? (
          <motion.div
            className={`${colorClasses[color]} ${sizeClasses[size]} rounded-full w-1/3`}
            animate={{ x: ['0%', '200%', '0%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : (
          <motion.div
            className={`${colorClasses[color]} ${sizeClasses[size]} rounded-full ${showGlow ? `shadow-lg ${glowClasses[color]}` : ''}`}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: appleEasing }}
          />
        )}
      </div>
    </div>
  );
};

/**
 * Circular progress indicator
 */
interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: 'brand' | 'success' | 'warning' | 'danger';
  showValue?: boolean;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  max = 100,
  size = 60,
  strokeWidth = 6,
  color = 'brand',
  showValue = true
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const colorClasses = {
    brand: 'stroke-brand-500',
    success: 'stroke-success-500',
    warning: 'stroke-warning-500',
    danger: 'stroke-error-500'
  };

  const textColorClasses = {
    brand: 'text-brand-600',
    success: 'text-success-600',
    warning: 'text-warning-600',
    danger: 'text-error-600'
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200 dark:text-slate-700"
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={colorClasses[color]}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: appleEasing }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      {showValue && (
        <motion.span
          className={`absolute text-sm font-bold ${textColorClasses[color]}`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, ease: appleEasing }}
        >
          {Math.round(percentage)}%
        </motion.span>
      )}
    </div>
  );
};
