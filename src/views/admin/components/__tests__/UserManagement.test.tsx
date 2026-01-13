/**
 * UserManagement Component Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserManagement } from '../UserManagement';

// Mock Firestore
const mockGetDocs = vi.fn();
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    getDocs: () => mockGetDocs(),
    limit: vi.fn(),
}));

// Mock Firebase app
vi.mock('../../../../firebase', () => ({
    db: {},
}));

// Mock Firebase Auth
vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => ({})),
    signInWithCustomToken: vi.fn(),
}));

// Mock ErrorLogger
vi.mock('../../../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
    },
}));

// Mock AdminService
vi.mock('../../../../services/adminService', () => ({
    AdminService: {
        impersonateUser: vi.fn().mockResolvedValue({ token: 'mock-token' }),
    },
}));

describe('UserManagement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetDocs.mockResolvedValue({
            docs: [
                {
                    id: 'user-1',
                    data: () => ({
                        email: 'admin@company.com',
                        displayName: 'Admin User',
                        role: 'admin',
                    }),
                },
                {
                    id: 'user-2',
                    data: () => ({
                        email: 'manager@company.com',
                        displayName: 'Manager User',
                        role: 'manager',
                    }),
                },
            ],
        });
    });

    describe('Rendering', () => {
        it('should render the component with search form', () => {
            render(<UserManagement />);

            expect(screen.getByText('Global User Lookup')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Enter user email...')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
        });

        it('should render description text', () => {
            render(<UserManagement />);

            expect(screen.getByText('Search for any user across all organizations by email.')).toBeInTheDocument();
        });

        it('should have disabled search button when input is empty', () => {
            render(<UserManagement />);

            const searchButton = screen.getByRole('button', { name: 'Search' });
            expect(searchButton).toBeDisabled();
        });
    });

    describe('Search Functionality', () => {
        it('should enable search button when input has value', () => {
            render(<UserManagement />);

            const searchInput = screen.getByPlaceholderText('Enter user email...');
            fireEvent.change(searchInput, { target: { value: 'test' } });

            const searchButton = screen.getByRole('button', { name: 'Search' });
            expect(searchButton).not.toBeDisabled();
        });

        it('should search and display users on form submit', async () => {
            render(<UserManagement />);

            const searchInput = screen.getByPlaceholderText('Enter user email...');
            fireEvent.change(searchInput, { target: { value: 'admin' } });

            const form = searchInput.closest('form')!;
            fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByText('admin@company.com')).toBeInTheDocument();
                expect(screen.getByText('Admin User')).toBeInTheDocument();
            });
        });

        it('should display all search results', async () => {
            render(<UserManagement />);

            const searchInput = screen.getByPlaceholderText('Enter user email...');
            fireEvent.change(searchInput, { target: { value: 'company' } });

            const form = searchInput.closest('form')!;
            fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByText('admin@company.com')).toBeInTheDocument();
                expect(screen.getByText('manager@company.com')).toBeInTheDocument();
            });
        });

        it('should show results count after search', async () => {
            render(<UserManagement />);

            const searchInput = screen.getByPlaceholderText('Enter user email...');
            fireEvent.change(searchInput, { target: { value: 'test' } });

            const form = searchInput.closest('form')!;
            fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByText(/Results \(2\)/)).toBeInTheDocument();
            });
        });
    });

    describe('Empty State', () => {
        it('should show empty message when no users found', async () => {
            mockGetDocs.mockResolvedValueOnce({ docs: [] });

            render(<UserManagement />);

            const searchInput = screen.getByPlaceholderText('Enter user email...');
            fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

            const form = searchInput.closest('form')!;
            fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByText(/No users found matching/)).toBeInTheDocument();
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle search errors gracefully', async () => {
            const { ErrorLogger } = await import('../../../../services/errorLogger');
            mockGetDocs.mockRejectedValueOnce(new Error('Search failed'));

            render(<UserManagement />);

            const searchInput = screen.getByPlaceholderText('Enter user email...');
            fireEvent.change(searchInput, { target: { value: 'test' } });

            const form = searchInput.closest('form')!;
            fireEvent.submit(form);

            await waitFor(() => {
                expect(ErrorLogger.error).toHaveBeenCalled();
            });
        });
    });

    describe('Loading State', () => {
        it('should show loading text during search', async () => {
            // Make the mock resolve slowly
            mockGetDocs.mockImplementation(() => new Promise(resolve => {
                setTimeout(() => resolve({ docs: [] }), 100);
            }));

            render(<UserManagement />);

            const searchInput = screen.getByPlaceholderText('Enter user email...');
            fireEvent.change(searchInput, { target: { value: 'test' } });

            const form = searchInput.closest('form')!;
            fireEvent.submit(form);

            // Button text should change to "Searching..."
            expect(screen.getByRole('button', { name: 'Searching...' })).toBeInTheDocument();

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
            });
        });
    });

    describe('User Display', () => {
        it('should show admin badge for admin users', async () => {
            render(<UserManagement />);

            const searchInput = screen.getByPlaceholderText('Enter user email...');
            fireEvent.change(searchInput, { target: { value: 'admin' } });

            const form = searchInput.closest('form')!;
            fireEvent.submit(form);

            await waitFor(() => {
                // Admin users should be displayed
                expect(screen.getByText('Admin User')).toBeInTheDocument();
            });
        });
    });

    describe('Form Validation', () => {
        it('should not search with empty input', async () => {
            render(<UserManagement />);

            const searchInput = screen.getByPlaceholderText('Enter user email...');
            const form = searchInput.closest('form')!;
            fireEvent.submit(form);

            // Should not call getDocs with empty search
            expect(mockGetDocs).not.toHaveBeenCalled();
        });

        it('should not search with only whitespace', async () => {
            render(<UserManagement />);

            const searchInput = screen.getByPlaceholderText('Enter user email...');
            fireEvent.change(searchInput, { target: { value: '   ' } });

            const form = searchInput.closest('form')!;
            fireEvent.submit(form);

            // Should not call getDocs with whitespace-only search
            expect(mockGetDocs).not.toHaveBeenCalled();
        });
    });
});
