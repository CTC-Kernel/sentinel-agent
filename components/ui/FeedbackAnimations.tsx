import React, { useState } from 'react';

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

  const baseClasses = 'font-bold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white focus:ring-brand-500 shadow-lg shadow-brand-500/20',
    secondary: 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 focus:ring-brand-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 shadow-lg shadow-red-500/20',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500 shadow-lg shadow-emerald-500/20'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 200);
    
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
    setTimeout(() => ripple.remove(), 600);

    onClick?.(e);
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

      <style jsx>{`
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
  return (
    <div
      onClick={onClick}
      className={`
        glass-panel rounded-[2rem] border border-white/50 dark:border-white/5
        transition-all duration-300
        ${interactive ? 'cursor-pointer hover:scale-[1.02] hover:shadow-xl' : ''}
        ${interactive ? 'hover:-translate-y-1' : ''}
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
    rectangular: 'rounded-xl'
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
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
        text-[10px] font-bold
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
 * Progress bar animée
 */
interface AnimatedProgressProps {
  value: number;
  max?: number;
  color?: 'brand' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const AnimatedProgress: React.FC<AnimatedProgressProps> = ({
  value,
  max = 100,
  color = 'brand',
  size = 'md',
  showLabel = false
}) => {
  const percentage = Math.min((value / max) * 100, 100);

  const colorClasses = {
    brand: 'bg-brand-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500'
  };

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Progression
          </span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      <div className={`w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`${colorClasses[color]} ${sizeClasses[size]} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
