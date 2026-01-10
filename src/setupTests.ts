import '@testing-library/jest-dom';

import React from 'react';
import { vi } from 'vitest';

// Global mocks if needed
global.React = React;

// ResizeObserver mock
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

// Mock framer-motion for all tests
vi.mock('framer-motion', () => ({
    motion: {
        div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ children, className, ...props }, ref) => 
            React.createElement('div', { className, ref, ...props }, children)
        ),
        button: React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(({ children, className, ...props }, ref) => 
            React.createElement('button', { className, ref, ...props }, children)
        ),
        svg: React.forwardRef<SVGSVGElement, React.SVGAttributes<SVGSVGElement>>(({ children, className, ...props }, ref) => 
            React.createElement('svg', { className, ref, ...props }, children)
        ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    layoutId: 'test-layout-id',
}));
