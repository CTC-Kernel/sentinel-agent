import React, { useEffect, useRef } from 'react';
import Lenis from 'lenis';

interface SmoothScrollProps {
    children: React.ReactNode;
    className?: string;
    id?: string;
}

export const SmoothScroll: React.FC<SmoothScrollProps> = ({ children, className, id }) => {
    const wrapperRef = useRef<HTMLElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const lenisRef = useRef<Lenis | null>(null);

    useEffect(() => {
        if (!wrapperRef.current || !contentRef.current) return;

        const lenis = new Lenis({
            wrapper: wrapperRef.current,
            content: contentRef.current,
            duration: 0.8,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            wheelMultiplier: 1.2,
            touchMultiplier: 2,
        });

        lenisRef.current = lenis;

        function raf(time: number) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }

        requestAnimationFrame(raf);

        // Fix for nested scrolling: Identify scrollable elements and opt them out of Lenis
        // We use capture: true to intercept the event before Lenis sees it (on bubble)
        const handleScrollFix = (e: Event) => {
            const target = e.target as HTMLElement;
            // Check for common scrollable class patterns or explicit styles
            const scrollable = target.closest('.overflow-y-auto, .overflow-scroll, .overflow-auto, [style*="overflow-y: auto"], [style*="overflow-y: scroll"]');

            if (scrollable && scrollable !== wrapperRef.current && scrollable !== contentRef.current) {
                // Only prevent Lenis if the element actually has scrollable content
                const hasOverflow = scrollable.scrollHeight > scrollable.clientHeight;
                if (hasOverflow) {
                    scrollable.setAttribute('data-lenis-prevent', 'true');
                    // Note: We don't stop propagation here because we want the browser native scroll to handle it.
                    // Lenis respects 'data-lenis-prevent' and will skip its own logic.
                }
            }
        };

        const wrapper = wrapperRef.current;
        // Listen for wheel and touch events to dynamically tag elements
        wrapper.addEventListener('wheel', handleScrollFix, { capture: true, passive: true });
        wrapper.addEventListener('touchstart', handleScrollFix, { capture: true, passive: true });

        return () => {
            lenis.destroy();
            lenisRef.current = null;
            wrapper.removeEventListener('wheel', handleScrollFix, { capture: true } as EventListenerOptions);
            wrapper.removeEventListener('touchstart', handleScrollFix, { capture: true } as EventListenerOptions);
        };
    }, []);

    return (
        <main ref={wrapperRef} id={id} className={className}>
            <div ref={contentRef}>
                {children}
            </div>
        </main>
    );
};
