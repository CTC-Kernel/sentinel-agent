/**
 * Unit tests for useGlobalShortcuts hook
 * Tests global keyboard shortcuts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockLocation = { pathname: '/' };
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...(actual as object),
        useNavigate: () => mockNavigate,
        useLocation: () => mockLocation
    };
});

// Mock react-hotkeys-hook
const mockUseHotkeys = vi.fn();
vi.mock('react-hotkeys-hook', () => ({
    useHotkeys: (...args: unknown[]) => mockUseHotkeys(...args)
}));

// Mock store
const mockToggleTheme = vi.fn();
const mockAddToast = vi.fn();
const mockT = vi.fn((key, options) => options?.defaultValue || key);
vi.mock('../../store', () => ({
    useStore: () => ({
        toggleTheme: mockToggleTheme,
        addToast: mockAddToast,
        t: mockT
    })
}));

import { useGlobalShortcuts } from '../useGlobalShortcuts';

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

describe('useGlobalShortcuts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseHotkeys.mockImplementation(() => { });
    });

    describe('initialization', () => {
        it('provides showHelp state and setter', () => {
            const { result } = renderHook(() => useGlobalShortcuts(), { wrapper });

            expect(result.current.showHelp).toBe(false);
            expect(typeof result.current.setShowHelp).toBe('function');
        });

        it('registers multiple hotkey handlers', () => {
            renderHook(() => useGlobalShortcuts(), { wrapper });

            // Should register multiple hotkeys
            expect(mockUseHotkeys).toHaveBeenCalled();
        });
    });

    describe('help toggle', () => {
        it('can toggle showHelp state', () => {
            const { result } = renderHook(() => useGlobalShortcuts(), { wrapper });

            expect(result.current.showHelp).toBe(false);

            act(() => {
                result.current.setShowHelp(true);
            });

            expect(result.current.showHelp).toBe(true);

            act(() => {
                result.current.setShowHelp(false);
            });

            expect(result.current.showHelp).toBe(false);
        });
    });

    describe('hotkey registration', () => {
        it('registers navigation shortcuts', () => {
            renderHook(() => useGlobalShortcuts(), { wrapper });

            // Check that useHotkeys was called for navigation shortcuts
            const calls = mockUseHotkeys.mock.calls;
            const hotkeys = calls.map(call => call[0]);

            // Should include number shortcuts for navigation
            expect(hotkeys.some((key: string | string[]) =>
                typeof key === 'string' && key.includes('ctrl+1')
            )).toBe(true);
        });

        it('registers theme toggle shortcut', () => {
            renderHook(() => useGlobalShortcuts(), { wrapper });

            const calls = mockUseHotkeys.mock.calls;
            const hotkeys = calls.map(call => call[0]);

            // Should include theme toggle shortcut
            expect(hotkeys.some((key: string | string[]) =>
                typeof key === 'string' && key.includes('ctrl+shift+t')
            )).toBe(true);
        });

        it('registers search shortcut', () => {
            renderHook(() => useGlobalShortcuts(), { wrapper });

            const calls = mockUseHotkeys.mock.calls;
            const hotkeys = calls.map(call => call[0]);

            // Should include search shortcut
            expect(hotkeys.some((key: string | string[]) =>
                typeof key === 'string' && key.includes('ctrl+/')
            )).toBe(true);
        });

        it('registers help shortcut', () => {
            renderHook(() => useGlobalShortcuts(), { wrapper });

            const calls = mockUseHotkeys.mock.calls;
            const hotkeys = calls.map(call => call[0]);

            // Should include help shortcut (array format)
            expect(hotkeys.some((key: string | string[]) =>
                Array.isArray(key) && key.some(k => k.includes('ctrl+shift+h'))
            )).toBe(true);
        });

        it('registers home shortcut', () => {
            renderHook(() => useGlobalShortcuts(), { wrapper });

            const calls = mockUseHotkeys.mock.calls;
            const hotkeys = calls.map(call => call[0]);

            // Should include home shortcut
            expect(hotkeys.some((key: string | string[]) =>
                typeof key === 'string' && key.includes('ctrl+h')
            )).toBe(true);
        });

        it('registers new item shortcut', () => {
            renderHook(() => useGlobalShortcuts(), { wrapper });

            const calls = mockUseHotkeys.mock.calls;
            const hotkeys = calls.map(call => call[0]);

            // Should include new item shortcut
            expect(hotkeys.some((key: string | string[]) =>
                typeof key === 'string' && key.includes('ctrl+n')
            )).toBe(true);
        });

        it('registers save shortcut', () => {
            renderHook(() => useGlobalShortcuts(), { wrapper });

            const calls = mockUseHotkeys.mock.calls;
            const hotkeys = calls.map(call => call[0]);

            // Should include save shortcut
            expect(hotkeys.some((key: string | string[]) =>
                typeof key === 'string' && key.includes('ctrl+s')
            )).toBe(true);
        });
    });

    describe('shortcut handler behavior', () => {
        it('navigation shortcut calls navigate', () => {
            // Capture the handler for ctrl+1
            let navigationHandler: ((e: KeyboardEvent) => void) | undefined;
            mockUseHotkeys.mockImplementation((keys: string, handler: (e: KeyboardEvent) => void) => {
                if (typeof keys === 'string' && keys.includes('ctrl+1')) {
                    navigationHandler = handler;
                }
            });

            renderHook(() => useGlobalShortcuts(), { wrapper });

            if (navigationHandler) {
                const mockEvent = { preventDefault: vi.fn() };
                navigationHandler(mockEvent as unknown as KeyboardEvent);

                expect(mockEvent.preventDefault).toHaveBeenCalled();
                expect(mockNavigate).toHaveBeenCalledWith('/');
            }
        });

        it('theme shortcut calls toggleTheme', () => {
            let themeHandler: ((e: KeyboardEvent) => void) | undefined;
            mockUseHotkeys.mockImplementation((keys: string, handler: (e: KeyboardEvent) => void) => {
                if (typeof keys === 'string' && keys.includes('ctrl+shift+t')) {
                    themeHandler = handler;
                }
            });

            renderHook(() => useGlobalShortcuts(), { wrapper });

            if (themeHandler) {
                const mockEvent = { preventDefault: vi.fn() };
                themeHandler(mockEvent as unknown as KeyboardEvent);

                expect(mockEvent.preventDefault).toHaveBeenCalled();
                expect(mockToggleTheme).toHaveBeenCalled();
                expect(mockAddToast).toHaveBeenCalledWith('Thème changé');
            }
        });
    });
});
