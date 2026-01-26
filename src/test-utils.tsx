/**
 * Test utilities for Sentinel GRC
 * Provides properly configured wrappers for testing components
 */

import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, MemoryRouterProps } from 'react-router-dom';

/**
 * Router wrapper with v7 future flags enabled to suppress deprecation warnings
 */
export const TestRouter: React.FC<{ children: ReactNode } & Partial<MemoryRouterProps>> = ({
    children,
    initialEntries = ['/'],
    ...props
}) => {
    return (
        <MemoryRouter
            initialEntries={initialEntries}
            future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
            }}
            {...props}
        >
            {children}
        </MemoryRouter>
    );
};

/**
 * Browser router wrapper with v7 future flags
 */
export const TestBrowserRouter: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <BrowserRouter
            future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
            }}
        >
            {children}
        </BrowserRouter>
    );
};

/**
 * All providers wrapper for comprehensive testing
 */
interface AllProvidersProps {
    children: ReactNode;
    initialEntries?: string[];
}

export const AllProviders: React.FC<AllProvidersProps> = ({
    children,
    initialEntries = ['/']
}) => {
    return (
        <TestRouter initialEntries={initialEntries}>
            {children}
        </TestRouter>
    );
};

/**
 * Custom render function that includes all necessary providers
 */
const customRender = (
    ui: ReactElement,
    options?: Omit<RenderOptions, 'wrapper'> & { initialEntries?: string[] }
) => {
    const { initialEntries, ...renderOptions } = options || {};

    return render(ui, {
        wrapper: ({ children }) => (
            <AllProviders initialEntries={initialEntries}>
                {children}
            </AllProviders>
        ),
        ...renderOptions,
    });
};

// Re-export everything from testing-library
export * from '@testing-library/react';
export { customRender as render };
