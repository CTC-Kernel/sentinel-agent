import { useSyncExternalStore, useCallback } from 'react';

export function useMediaQuery(query: string): boolean {
 const subscribe = useCallback(
 (callback: () => void) => {
 const matchMedia = window.matchMedia(query);
 // Modern browsers
 if (matchMedia.addEventListener) {
 matchMedia.addEventListener('change', callback);
 return () => matchMedia.removeEventListener('change', callback);
 } else {
 // Fallback
 matchMedia.addListener(callback);
 return () => matchMedia.removeListener(callback);
 }
 },
 [query]
 );

 const getSnapshot = () => {
 if (typeof window === 'undefined') return false;
 return window.matchMedia(query).matches;
 };

 const getServerSnapshot = () => false;

 return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
