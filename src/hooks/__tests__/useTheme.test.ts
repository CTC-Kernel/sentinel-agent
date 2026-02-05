/**
 * useTheme Hook Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { useTheme } from '../useTheme';
import { ThemeContext } from '../../contexts/ThemeContext';

describe('useTheme', () => {
 const mockThemeContext = {
 theme: 'light' as const,
 setTheme: vi.fn(),
 colorScheme: 'default' as const,
 setColorScheme: vi.fn(),
 setCustomColors: vi.fn()
 };

 const wrapper = ({ children }: { children: React.ReactNode }) =>
 React.createElement(ThemeContext.Provider, { value: mockThemeContext }, children);

 it('should return theme context values', () => {
 const { result } = renderHook(() => useTheme(), { wrapper });

 expect(result.current.theme).toBe('light');
 });

 it('should provide setTheme function', () => {
 const { result } = renderHook(() => useTheme(), { wrapper });

 expect(typeof result.current.setTheme).toBe('function');
 });



 it('should throw error when used outside ThemeProvider', () => {
 expect(() => {
 renderHook(() => useTheme());
 }).toThrow('useTheme must be used within a ThemeProvider');
 });

 it('should reflect dark theme context', () => {
 const darkContext = {
 theme: 'dark' as const,
 setTheme: vi.fn(),
 colorScheme: 'default' as const,
 setColorScheme: vi.fn(),
 setCustomColors: vi.fn()
 };

 const darkWrapper = ({ children }: { children: React.ReactNode }) =>
 React.createElement(ThemeContext.Provider, { value: darkContext }, children);

 const { result } = renderHook(() => useTheme(), { wrapper: darkWrapper });

 expect(result.current.theme).toBe('dark');
 });
});
