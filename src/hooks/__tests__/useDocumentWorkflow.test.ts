/**
 * Unit tests for useDocumentWorkflow hook
 * Tests document workflow operations (submit, approve, reject, publish)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock DocumentWorkflowService
const mockSubmitForReview = vi.fn();
const mockApproveDocument = vi.fn();
const mockRejectDocument = vi.fn();
const mockPublishDocument = vi.fn();

vi.mock('../../services/DocumentWorkflowService', () => ({
    DocumentWorkflowService: {
        submitForReview: (...args: unknown[]) => mockSubmitForReview(...args),
        approveDocument: (...args: unknown[]) => mockApproveDocument(...args),
        rejectDocument: (...args: unknown[]) => mockRejectDocument(...args),
        publishDocument: (...args: unknown[]) => mockPublishDocument(...args)
    }
}));

// Mock store
const mockAddToast = vi.fn();
vi.mock('../../store', () => ({
    useStore: () => ({
        user: { uid: 'user-1', email: 'test@example.com', displayName: 'Test User' },
        addToast: mockAddToast
    })
}));

// Mock ErrorLogger
vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        handleErrorWithToast: vi.fn()
    }
}));

import { useDocumentWorkflow } from '../useDocumentWorkflow';

describe('useDocumentWorkflow', () => {
    const mockDocument = {
        id: 'doc-1',
        title: 'Test Document',
        version: '1.0',
        status: 'Draft'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockSubmitForReview.mockResolvedValue(undefined);
        mockApproveDocument.mockResolvedValue(undefined);
        mockRejectDocument.mockResolvedValue(undefined);
        mockPublishDocument.mockResolvedValue(undefined);
    });

    describe('initialization', () => {
        it('provides all expected functions', () => {
            const { result } = renderHook(() => useDocumentWorkflow());

            expect(typeof result.current.submitForReview).toBe('function');
            expect(typeof result.current.approveDocument).toBe('function');
            expect(typeof result.current.rejectDocument).toBe('function');
            expect(typeof result.current.publishDocument).toBe('function');
            expect(result.current.loading).toBe(false);
        });
    });

    describe('submitForReview', () => {
        it('submits document for review', async () => {
            const { result } = renderHook(() => useDocumentWorkflow());

            await act(async () => {
                await result.current.submitForReview(
                    mockDocument as any,
                    ['reviewer1@test.com', 'reviewer2@test.com'],
                    'Please review this document'
                );
            });

            expect(mockSubmitForReview).toHaveBeenCalledWith(
                mockDocument,
                expect.objectContaining({ uid: 'user-1' }),
                ['reviewer1@test.com', 'reviewer2@test.com'],
                'Please review this document'
            );
            expect(mockAddToast).toHaveBeenCalledWith('Document soumis pour revue', 'success');
        });

        it('sets loading state during submission', async () => {
            let resolveSubmit: () => void;
            const submitPromise = new Promise<void>(r => { resolveSubmit = r; });
            mockSubmitForReview.mockImplementation(() => submitPromise);

            const { result } = renderHook(() => useDocumentWorkflow());

            act(() => {
                result.current.submitForReview(mockDocument as any, ['reviewer@test.com']);
            });

            expect(result.current.loading).toBe(true);

            await act(async () => {
                resolveSubmit!();
                await submitPromise;
            });

            expect(result.current.loading).toBe(false);
        });

        it('handles errors', async () => {
            mockSubmitForReview.mockRejectedValue(new Error('Submit failed'));

            const { result } = renderHook(() => useDocumentWorkflow());

            await act(async () => {
                await result.current.submitForReview(mockDocument as any, ['reviewer@test.com']);
            });

            // Error should be handled by ErrorLogger
            expect(result.current.loading).toBe(false);
        });
    });

    describe('approveDocument', () => {
        it('approves document', async () => {
            const { result } = renderHook(() => useDocumentWorkflow());

            await act(async () => {
                await result.current.approveDocument(mockDocument as any, 'Looks good!');
            });

            expect(mockApproveDocument).toHaveBeenCalledWith(
                mockDocument,
                expect.objectContaining({ uid: 'user-1' }),
                'Looks good!'
            );
            expect(mockAddToast).toHaveBeenCalledWith('Document approuvé', 'success');
        });

        it('approves without comment', async () => {
            const { result } = renderHook(() => useDocumentWorkflow());

            await act(async () => {
                await result.current.approveDocument(mockDocument as any);
            });

            expect(mockApproveDocument).toHaveBeenCalledWith(
                mockDocument,
                expect.any(Object),
                undefined
            );
        });

        it('handles errors', async () => {
            mockApproveDocument.mockRejectedValue(new Error('Approve failed'));

            const { result } = renderHook(() => useDocumentWorkflow());

            await act(async () => {
                await result.current.approveDocument(mockDocument as any);
            });

            expect(result.current.loading).toBe(false);
        });
    });

    describe('rejectDocument', () => {
        it('rejects document with comment', async () => {
            const { result } = renderHook(() => useDocumentWorkflow());

            await act(async () => {
                await result.current.rejectDocument(mockDocument as any, 'Needs more details');
            });

            expect(mockRejectDocument).toHaveBeenCalledWith(
                mockDocument,
                expect.objectContaining({ uid: 'user-1' }),
                'Needs more details'
            );
            expect(mockAddToast).toHaveBeenCalledWith('Document rejeté', 'info');
        });

        it('handles errors', async () => {
            mockRejectDocument.mockRejectedValue(new Error('Reject failed'));

            const { result } = renderHook(() => useDocumentWorkflow());

            await act(async () => {
                await result.current.rejectDocument(mockDocument as any, 'Rejection reason');
            });

            expect(result.current.loading).toBe(false);
        });
    });

    describe('publishDocument', () => {
        it('publishes document', async () => {
            const { result } = renderHook(() => useDocumentWorkflow());

            await act(async () => {
                await result.current.publishDocument(mockDocument as any);
            });

            expect(mockPublishDocument).toHaveBeenCalledWith(
                mockDocument,
                expect.objectContaining({ uid: 'user-1' })
            );
            expect(mockAddToast).toHaveBeenCalledWith('Document publié', 'success');
        });

        it('handles errors', async () => {
            mockPublishDocument.mockRejectedValue(new Error('Publish failed'));

            const { result } = renderHook(() => useDocumentWorkflow());

            await act(async () => {
                await result.current.publishDocument(mockDocument as any);
            });

            expect(result.current.loading).toBe(false);
        });
    });

    describe('loading state management', () => {
        it('resets loading on success', async () => {
            const { result } = renderHook(() => useDocumentWorkflow());

            await act(async () => {
                await result.current.submitForReview(mockDocument as any, ['reviewer@test.com']);
            });

            expect(result.current.loading).toBe(false);
        });

        it('resets loading on error', async () => {
            mockSubmitForReview.mockRejectedValue(new Error('Failed'));

            const { result } = renderHook(() => useDocumentWorkflow());

            await act(async () => {
                await result.current.submitForReview(mockDocument as any, ['reviewer@test.com']);
            });

            expect(result.current.loading).toBe(false);
        });
    });
});
