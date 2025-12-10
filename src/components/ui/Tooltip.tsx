import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

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
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const updatePosition = React.useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const scrollX = window.scrollX;
            const scrollY = window.scrollY;

            let top = 0;
            let left = 0;

            switch (position) {
                case 'top':
                    top = rect.top + scrollY - 10;
                    left = rect.left + scrollX + rect.width / 2;
                    break;
                case 'bottom':
                    top = rect.bottom + scrollY + 10;
                    left = rect.left + scrollX + rect.width / 2;
                    break;
                case 'left':
                    top = rect.top + scrollY + rect.height / 2;
                    left = rect.left + scrollX - 10;
                    break;
                case 'right':
                    top = rect.top + scrollY + rect.height / 2;
                    left = rect.right + scrollX + 10;
                    break;
            }
            setCoords({ top, left });
        }
    }, [position]);

    const showTooltip = () => {
        updatePosition();
        const id = setTimeout(() => setIsVisible(true), delay);
        timeoutRef.current = id;
    };

    const hideTooltip = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsVisible(false);
    };

    useEffect(() => {
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition);
        };
    }, [updatePosition]);

    return (
        <div
            ref={triggerRef}
            className={`relative inline-block ${className}`}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
        >
            {children}
            {isVisible && createPortal(
                <div
                    className="fixed z-[9999] px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-xl shadow-xl whitespace-nowrap animate-fade-in pointer-events-none"
                    style={{
                        top: coords.top,
                        left: coords.left,
                        transform: position === 'top' ? 'translate(-50%, -100%)' :
                            position === 'bottom' ? 'translate(-50%, 0)' :
                                position === 'left' ? 'translate(-100%, -50%)' :
                                    'translate(0, -50%)'
                    }}
                >
                    {content}
                </div>,
                document.body
            )}
        </div>
    );
};
