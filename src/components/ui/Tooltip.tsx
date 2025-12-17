import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
    delay?: number;
    className?: string;
    sideOffset?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
    content,
    children,
    position = 'top',
    delay = 200,
    className = '',
    sideOffset = 5
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
                    top = rect.top + scrollY - sideOffset;
                    left = rect.left + scrollX + rect.width / 2;
                    break;
                case 'bottom':
                    top = rect.bottom + scrollY + sideOffset;
                    left = rect.left + scrollX + rect.width / 2;
                    break;
                case 'left':
                    top = rect.top + scrollY + rect.height / 2;
                    left = rect.left + scrollX - sideOffset;
                    break;
                case 'right':
                    top = rect.top + scrollY + rect.height / 2;
                    left = rect.right + scrollX + sideOffset;
                    break;
            }
            setCoords({ top, left });
        }
    }, [position, sideOffset]);

    const showTooltip = () => {
        updatePosition();
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
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
            className={`relative inline-flex ${className}`}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
            onFocus={showTooltip}
            onBlur={hideTooltip}
        >
            {children}
            <AnimatePresence>
                {isVisible && (
                    createPortal(
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: position === 'top' ? 2 : -2 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="fixed z-[9999] px-3 py-1.5 text-xs font-semibold text-white bg-slate-900/90 dark:bg-white/95 dark:text-slate-900 backdrop-blur-md border border-white/10 dark:border-slate-900/10 rounded-lg shadow-xl shadow-black/20 whitespace-normal max-w-[250px] pointer-events-none"
                            style={{
                                top: coords.top,
                                left: coords.left,
                                transform: `translate(${position === 'left' || position === 'right' ? (position === 'left' ? '-100%' : '0') : '-50%'}, ${position === 'top' || position === 'bottom' ? (position === 'top' ? '-100%' : '0') : '-50%'})`
                            }}
                        >
                            {content}
                            {/* Arrow */}
                            <div
                                className={`absolute w-2 h-2 bg-slate-900/90 dark:bg-white/95 rotate-45 border border-white/10 dark:border-slate-900/10
                                    ${position === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2 border-t-0 border-l-0' : ''}
                                    ${position === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2 border-b-0 border-r-0' : ''}
                                    ${position === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2 border-b-0 border-l-0' : ''}
                                    ${position === 'right' ? 'left-[-4px] top-1/2 -translate-y-1/2 border-t-0 border-r-0' : ''}
                                `}
                            />
                        </motion.div>,
                        document.body
                    )
                )}
            </AnimatePresence>
        </div>
    );
};
