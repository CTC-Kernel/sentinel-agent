import { Loader2 } from './Icons';
import { cn } from '../../lib/utils';

interface SpinnerProps {
 className?: string;
 size?: 'sm' | 'md' | 'lg' | 'xl';
 label?: string;
}

const sizeClasses = {
 sm: 'h-4 w-4',
 md: 'h-6 w-6',
 lg: 'h-8 w-8',
 xl: 'h-12 w-12',
};

export const Spinner = ({ className, size = 'md', label = 'Chargement...' }: SpinnerProps) => {
 return (
 <span role="status" aria-live="polite" className="inline-flex items-center">
 <Loader2
 className={cn(
  "animate-spin text-current",
  sizeClasses[size],
  className
 )}
 aria-hidden="true"
 />
 <span className="sr-only">{label}</span>
 </span>
 );
};
