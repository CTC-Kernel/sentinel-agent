/**
 * Unit tests for useAIGemini hook
 * Tests AI content generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock aiService
const mockGenerateText = vi.fn();
vi.mock('../../services/aiService', () => ({
    aiService: {
        generateText: (...args: unknown[]) => mockGenerateText(...args)
    }
}));

// Mock ErrorLogger
vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

import { useAIGemini } from '../useAIGemini';

describe('useAIGemini', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGenerateText.mockResolvedValue('Generated content response');
    });

    describe('initialization', () => {
        it('initializes with default state', () => {
            const { result } = renderHook(() => useAIGemini());

            expect(result.current.loading).toBe(false);
            expect(result.current.error).toBeNull();
        });

        it('provides generateContent function', () => {
            const { result } = renderHook(() => useAIGemini());

            expect(typeof result.current.generateContent).toBe('function');
        });
    });

    describe('generateContent', () => {
        it('generates content successfully', async () => {
            const { result } = renderHook(() => useAIGemini());

            let content: string | null = null;
            await act(async () => {
                content = await result.current.generateContent('Write a security policy');
            });

            expect(mockGenerateText).toHaveBeenCalledWith('Write a security policy');
            expect(content).toBe('Generated content response');
        });

        it('returns null on error', async () => {
            mockGenerateText.mockRejectedValue(new Error('API Error'));

            const { result } = renderHook(() => useAIGemini());

            let content: string | null = 'initial';
            await act(async () => {
                content = await result.current.generateContent('Test prompt');
            });

            expect(content).toBeNull();
        });

        it('resets loading state on completion', async () => {
            const { result } = renderHook(() => useAIGemini());

            await act(async () => {
                await result.current.generateContent('Test prompt');
            });

            expect(result.current.loading).toBe(false);
        });

        it('handles multiple calls', async () => {
            mockGenerateText
                .mockResolvedValueOnce('First response')
                .mockResolvedValueOnce('Second response');

            const { result } = renderHook(() => useAIGemini());

            let content1: string | null = null;
            let content2: string | null = null;

            await act(async () => {
                content1 = await result.current.generateContent('First prompt');
            });

            await act(async () => {
                content2 = await result.current.generateContent('Second prompt');
            });

            expect(content1).toBe('First response');
            expect(content2).toBe('Second response');
        });
    });

    describe('error handling', () => {
        it('handles API errors', async () => {
            mockGenerateText.mockRejectedValue(new Error('API Error'));

            const { result } = renderHook(() => useAIGemini());

            let content: string | null = 'initial';
            await act(async () => {
                content = await result.current.generateContent('Test');
            });

            expect(content).toBeNull();
            expect(result.current.loading).toBe(false);
        });
    });
});
