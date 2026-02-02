import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { appleEasing } from '../../utils/microInteractions';

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
    position = 'bottom',
    delay = 200,
    className = '',
    sideOffset = 5
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const tooltipId = React.useId();

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

    const toggleTooltip = () => {
        if (isVisible) hideTooltip();
        else showTooltip();
    };

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isVisible) {
                setIsVisible(false);
            }
        };

        if (isVisible) {
            window.addEventListener('keydown', handleEscape);
        }
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isVisible]);

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
            className={`relative inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg ${className}`}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
            onFocus={showTooltip}
            onBlur={hideTooltip}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleTooltip();
                }
            }}
            tabIndex={0}
            role="button"
            aria-describedby={isVisible ? tooltipId : undefined}
        >
            {children}
            {createPortal(
                <AnimatePresence>
                    {isVisible && (
                        <motion.div
                            id={tooltipId}
                            role="tooltip"
                            initial={variants.initial}
                            animate={variants.animate}
                            exit={variants.exit}
                            transition={{ duration: 0.2, ease: appleEasing }}
                            className="fixed z-supreme px-3 py-2 text-sm font-medium text-background bg-foreground/95 backdrop-blur-md border border-border/40 rounded-3xl shadow-xl shadow-black/20 whitespace-normal max-w-[280px] pointer-events-none leading-relaxed"
                            style={{
                                top: coords.top,
                                left: coords.left,
                            }}
                        >
                            {content}
                            {/* Arrow */}
                            <div
                                className={`absolute w-2 h-2 bg-foreground/90 rotate-45 border border-border/40
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
