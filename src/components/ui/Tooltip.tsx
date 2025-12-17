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
            // Since we use position: fixed, we use viewport coordinates directly (no scroll addition)

            let top = 0;
            let left = 0;

            switch (position) {
                case 'top':
                    top = rect.top - sideOffset;
                    left = rect.left + rect.width / 2;
                    break;
                case 'bottom':
                    top = rect.bottom + sideOffset;
                    left = rect.left + rect.width / 2;
                    break;
                case 'left':
                    top = rect.top + rect.height / 2;
                    left = rect.left - sideOffset;
                    break;
                case 'right':
                    top = rect.top + rect.height / 2;
                    left = rect.right + sideOffset;
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
        window.addEventListener('scroll', updatePosition, true); // true for capturing scroll in sub-elements
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [updatePosition]);

    // Animation variants based on position
    const getVariants = () => {
        switch (position) {
            case 'top':
                return {
                    initial: { opacity: 0, scale: 0.9, x: '-50%', y: 'calc(-100% + 4px)' },
                    animate: { opacity: 1, scale: 1, x: '-50%', y: '-100%' },
                    exit: { opacity: 0, scale: 0.95, x: '-50%', y: '-100%' }
                };
            case 'bottom':
                return {
                    initial: { opacity: 0, scale: 0.9, x: '-50%', y: -4 },
                    animate: { opacity: 1, scale: 1, x: '-50%', y: 0 },
                    exit: { opacity: 0, scale: 0.95, x: '-50%', y: 0 }
                };
            case 'left':
                return {
                    initial: { opacity: 0, scale: 0.9, x: 'calc(-100% + 4px)', y: '-50%' },
                    animate: { opacity: 1, scale: 1, x: '-100%', y: '-50%' },
                    exit: { opacity: 0, scale: 0.95, x: '-100%', y: '-50%' }
                };
            case 'right':
                return {
                    initial: { opacity: 0, scale: 0.9, x: -4, y: '-50%' },
                    animate: { opacity: 1, scale: 1, x: 0, y: '-50%' },
                    exit: { opacity: 0, scale: 0.95, x: 0, y: '-50%' }
                };
        }
    };

    const variants = getVariants();

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
            {createPortal(
                <AnimatePresence>
                    {isVisible && (
                        <motion.div
                            initial={variants.initial}
                            animate={variants.animate}
                            exit={variants.exit}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="fixed z-[99999] px-3 py-1.5 text-xs font-semibold text-white bg-slate-900/90 dark:bg-white/95 dark:text-slate-900 backdrop-blur-md border border-white/10 dark:border-slate-900/10 rounded-lg shadow-xl shadow-black/20 whitespace-normal max-w-[250px] pointer-events-none"
                            style={{
                                top: coords.top,
                                left: coords.left,
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
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};
