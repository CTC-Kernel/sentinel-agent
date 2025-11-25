import React, { useState } from 'react';

interface TooltipProps {
    content: string;
    children: React.ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
    delay?: number;
    className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
    content,
    children,
    position = 'top',
    delay = 200,
    className = ''
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

    const showTooltip = () => {
        const id = setTimeout(() => setIsVisible(true), delay);
        setTimeoutId(id);
    };

    const hideTooltip = () => {
        if (timeoutId) clearTimeout(timeoutId);
        setIsVisible(false);
    };

    const getPositionClasses = () => {
        switch (position) {
            case 'top':
                return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
            case 'bottom':
                return 'top-full left-1/2 -translate-x-1/2 mt-2';
            case 'left':
                return 'right-full top-1/2 -translate-y-1/2 mr-2';
            case 'right':
                return 'left-full top-1/2 -translate-y-1/2 ml-2';
            default:
                return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
        }
    };

    return (
        <div
            className={`relative inline-block ${className}`}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
        >
            {children}
            {isVisible && (
                <div className={`absolute z-50 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-xl shadow-xl whitespace-nowrap animate-fade-in ${getPositionClasses()}`}>
                    {content}
                    <div className={`absolute w-2 h-2 bg-white/90 dark:bg-slate-900/90 border-r border-b border-white/20 dark:border-white/10 transform rotate-45 ${position === 'top' ? 'bottom-[-5px] left-1/2 -translate-x-1/2' :
                        position === 'bottom' ? 'top-[-5px] left-1/2 -translate-x-1/2 rotate-180' :
                            position === 'left' ? 'right-[-5px] top-1/2 -translate-y-1/2 -rotate-45' :
                                'left-[-5px] top-1/2 -translate-y-1/2 rotate-135'
                        }`}></div>
                </div>
            )}
        </div>
    );
};
