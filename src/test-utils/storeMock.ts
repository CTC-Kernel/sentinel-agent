/**
 * Standardized store mock for testing
 * This provides consistent mocking for useStore across all test files
 */

import { vi } from 'vitest';

export const createMockStore = (overrides = {}) => {
    return {
        language: 'fr',
        setLanguage: vi.fn(),
        t: vi.fn((key: string, options?: Record<string, unknown>) => {
            // Return defaultValue if provided, otherwise return the key
            if (options && 'defaultValue' in options) {
                return (options as { defaultValue?: string }).defaultValue || key;
            }
            return key;
        }),
        user: null,
        setUser: vi.fn(),
        organization: null,
        setOrganization: vi.fn(),
        addToast: vi.fn(),
        activeFramework: null,
        setActiveFramework: vi.fn(),
        demoMode: false,
        setDemoMode: vi.fn(),
        ...overrides,
    };
};

// Mock the store module
export const mockStore = () => {
    vi.mock('../../../store', () => ({
        useStore: () => createMockStore(),
    }));
};

// Mock with custom overrides
export const mockStoreWithOverrides = (overrides: Record<string, unknown>) => {
    vi.mock('../../../store', () => ({
        useStore: () => createMockStore(overrides),
    }));
};
