import { useEffect, useRef } from 'react';

/**
 * Custom hook for safely using setInterval with guaranteed cleanup.
 * Prevents memory leaks by automatically clearing the interval on unmount
 * or when the delay changes.
 *
 * Pass `null` as the delay to pause the interval.
 *
 * @param callback - The function to call on each interval tick
 * @param delay - The interval delay in ms, or null to pause
 */
export function useInterval(callback: () => void, delay: number | null): void {
 const savedCallback = useRef(callback);

 // Remember the latest callback
 useEffect(() => {
 savedCallback.current = callback;
 }, [callback]);

 // Set up the interval
 useEffect(() => {
 if (delay === null) return;

 const id = setInterval(() => savedCallback.current(), delay);
 return () => clearInterval(id);
 }, [delay]);
}

/**
 * Custom hook for safely using setTimeout with guaranteed cleanup.
 * Prevents memory leaks by automatically clearing the timeout on unmount
 * or when dependencies change.
 *
 * Pass `null` as the delay to cancel the timeout.
 *
 * @param callback - The function to call when the timeout fires
 * @param delay - The timeout delay in ms, or null to cancel
 */
export function useTimeout(callback: () => void, delay: number | null): void {
 const savedCallback = useRef(callback);

 useEffect(() => {
 savedCallback.current = callback;
 }, [callback]);

 useEffect(() => {
 if (delay === null) return;

 const id = setTimeout(() => savedCallback.current(), delay);
 return () => clearTimeout(id);
 }, [delay]);
}
