import { useEffect, useRef } from 'react';

/**
 * Custom hook for safely attaching event listeners with guaranteed cleanup.
 * Prevents memory leaks by automatically removing the listener on unmount
 * or when dependencies change.
 *
 * @param eventName - The event name (e.g., 'click', 'resize', 'keydown')
 * @param handler - The event handler function
 * @param element - The target element (defaults to window)
 * @param options - addEventListener options (capture, passive, etc.)
 */
export function useEventListener<K extends keyof WindowEventMap>(
    eventName: K,
    handler: (event: WindowEventMap[K]) => void,
    element?: undefined | null,
    options?: boolean | AddEventListenerOptions
): void;

export function useEventListener<K extends keyof DocumentEventMap>(
    eventName: K,
    handler: (event: DocumentEventMap[K]) => void,
    element: Document,
    options?: boolean | AddEventListenerOptions
): void;

export function useEventListener<K extends keyof HTMLElementEventMap>(
    eventName: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    element: HTMLElement | null,
    options?: boolean | AddEventListenerOptions
): void;

export function useEventListener(
    eventName: string,
    handler: (event: Event) => void,
    element?: HTMLElement | Document | Window | null,
    options?: boolean | AddEventListenerOptions
): void {
    // Store the handler in a ref to avoid re-registering listeners
    // when only the handler changes (common with inline functions)
    const savedHandler = useRef(handler);

    useEffect(() => {
        savedHandler.current = handler;
    }, [handler]);

    useEffect(() => {
        const targetElement = element === undefined ? window : element;
        if (!targetElement?.addEventListener) return;

        const eventListener = (event: Event) => savedHandler.current(event);

        targetElement.addEventListener(eventName, eventListener, options);

        return () => {
            targetElement.removeEventListener(eventName, eventListener, options);
        };
    }, [eventName, element, options]);
}
