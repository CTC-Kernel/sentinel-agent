/**
 * usePrefersReducedMotion - Hook for respecting user's motion preferences
 *
 * Detects the user's prefers-reduced-motion setting and provides
 * a boolean flag for conditionally disabling animations.
 *
 * @see Story VOX-8.4: Reduced Motion Support
 * @see WCAG 2.1 Success Criterion 2.3.3
 */

import { useState, useEffect } from 'react';

/**
 * Media query for detecting reduced motion preference
 */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Hook that returns whether the user prefers reduced motion.
 *
 * Uses the prefers-reduced-motion media query to detect user preference.
 * Updates automatically if the user changes their system settings.
 *
 * @returns true if user prefers reduced motion, false otherwise
 *
 * @example
 * ```tsx
 * const prefersReducedMotion = usePrefersReducedMotion();
 *
 * useFrame((_, delta) => {
 * if (!prefersReducedMotion && meshRef.current) {
 * meshRef.current.rotation.y += delta * 0.5;
 * }
 * });
 * ```
 */
export function usePrefersReducedMotion(): boolean {
 const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
 // Check if we're in a browser environment
 if (typeof window === 'undefined' || !window.matchMedia) {
 return false;
 }
 return window.matchMedia(REDUCED_MOTION_QUERY).matches;
 });

 useEffect(() => {
 // SSR guard
 if (typeof window === 'undefined' || !window.matchMedia) {
 return;
 }

 const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);

 // Handler for media query changes
 const handleChange = (event: MediaQueryListEvent) => {
 setPrefersReducedMotion(event.matches);
 };

 // Modern browsers
 if (mediaQuery.addEventListener) {
 mediaQuery.addEventListener('change', handleChange);
 return () => mediaQuery.removeEventListener('change', handleChange);
 }
 // Legacy browsers (Safari < 14)
 else if (mediaQuery.addListener) {
 mediaQuery.addListener(handleChange);
 return () => mediaQuery.removeListener(handleChange);
 }
 }, []);

 return prefersReducedMotion;
}

/**
 * Get animation duration based on reduced motion preference.
 *
 * Returns 0 for instant transitions when reduced motion is preferred,
 * or the provided duration otherwise.
 *
 * @param duration - The normal animation duration in ms
 * @param prefersReducedMotion - Whether reduced motion is preferred
 * @returns 0 if reduced motion preferred, duration otherwise
 */
function getAnimationDuration(
 duration: number,
 prefersReducedMotion: boolean
): number {
 return prefersReducedMotion ? 0 : duration;
}

/**
 * Get transition style based on reduced motion preference.
 *
 * Returns 'none' for instant transitions when reduced motion is preferred,
 * or the provided transition otherwise.
 *
 * @param transition - The normal CSS transition value
 * @param prefersReducedMotion - Whether reduced motion is preferred
 * @returns 'none' if reduced motion preferred, transition otherwise
 */
function getTransitionStyle(
 transition: string,
 prefersReducedMotion: boolean
): string {
 return prefersReducedMotion ? 'none' : transition;
}

export default usePrefersReducedMotion;
