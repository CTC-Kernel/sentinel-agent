import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SpinnerProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
};

export const Spinner = ({ className, size = 'md' }: SpinnerProps) => {
    return (
        <Loader2
            className={cn(
                "animate-spin text-current",
                sizeClasses[size],
                className
            )}
        />
    );
};
