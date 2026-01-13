/**
 * EmailService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendEmail, sendBulkEmail, scheduleEmail, EmailPayload, EmailType } from '../emailService';

// Mock Firebase
vi.mock('../../firebase', () => ({
    functions: {}
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => vi.fn(() => Promise.resolve()))
}));

vi.mock('../logger', () => ({
    logAction: vi.fn(() => Promise.resolve())
}));

vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

describe('sendEmail', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should send email via Cloud Function', async () => {
        const { httpsCallable } = await import('firebase/functions');
        const mockCallable = vi.fn(() => Promise.resolve());
        vi.mocked(httpsCallable).mockReturnValue(mockCallable as unknown as ReturnType<typeof httpsCallable>);

        const user = { uid: 'user-1', email: 'sender@test.com' };
        const payload: EmailPayload = {
            to: 'recipient@test.com',
            subject: 'Test Subject',
            html: '<p>Test content</p>',
            type: 'GENERIC'
        };

        const result = await sendEmail(user, payload);

        expect(result).toBe(true);
        expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'sendEmail');
        expect(mockCallable).toHaveBeenCalledWith(expect.objectContaining({
            to: 'recipient@test.com',
            subject: 'Test Subject',
            type: 'GENERIC'
        }));
    });

    it('should log action after sending', async () => {
        const { logAction } = await import('../logger');

        const user = { uid: 'user-1', email: 'sender@test.com' };
        const payload: EmailPayload = {
            to: 'recipient@test.com',
            subject: 'Test',
            html: '<p>Test</p>',
            type: 'INVITATION'
        };

        await sendEmail(user, payload);

        expect(logAction).toHaveBeenCalledWith(
            user,
            'EMAIL_QUEUED',
            'System',
            expect.stringContaining('INVITATION')
        );
    });

    it('should return false on error', async () => {
        const { httpsCallable } = await import('firebase/functions');
        vi.mocked(httpsCallable).mockReturnValue(
            vi.fn().mockRejectedValueOnce(new Error('Function error')) as unknown as ReturnType<typeof httpsCallable>
        );

        const payload: EmailPayload = {
            to: 'recipient@test.com',
            subject: 'Test',
            html: '<p>Test</p>',
            type: 'GENERIC'
        };

        const result = await sendEmail(null, payload);

        expect(result).toBe(false);
    });

    it('should log errors', async () => {
        const { httpsCallable } = await import('firebase/functions');
        vi.mocked(httpsCallable).mockReturnValue(
            vi.fn().mockRejectedValueOnce(new Error('Function error')) as unknown as ReturnType<typeof httpsCallable>
        );
        const { ErrorLogger } = await import('../errorLogger');

        const payload: EmailPayload = {
            to: 'recipient@test.com',
            subject: 'Test',
            html: '<p>Test</p>',
            type: 'GENERIC'
        };

        await sendEmail(null, payload);

        expect(ErrorLogger.error).toHaveBeenCalledWith(
            expect.any(Error),
            'emailService.sendEmail',
            expect.objectContaining({
                metadata: expect.objectContaining({
                    to: 'recipient@test.com',
                    type: 'GENERIC'
                })
            })
        );
    });

    it('should handle null user', async () => {
        const payload: EmailPayload = {
            to: 'recipient@test.com',
            subject: 'Test',
            html: '<p>Test</p>',
            type: 'GENERIC'
        };

        const result = await sendEmail(null, payload);

        expect(result).toBe(true);
    });

    it('should include metadata in payload', async () => {
        const { httpsCallable } = await import('firebase/functions');
        const mockCallable = vi.fn(() => Promise.resolve());
        vi.mocked(httpsCallable).mockReturnValue(mockCallable as unknown as ReturnType<typeof httpsCallable>);

        const payload: EmailPayload = {
            to: 'recipient@test.com',
            subject: 'Test',
            html: '<p>Test</p>',
            type: 'GENERIC',
            metadata: { key: 'value' }
        };

        await sendEmail(null, payload);

        expect(mockCallable).toHaveBeenCalledWith(expect.objectContaining({
            metadata: { key: 'value' }
        }));
    });
});

describe('sendBulkEmail', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should send email to multiple recipients', async () => {
        const { httpsCallable } = await import('firebase/functions');
        const mockCallable = vi.fn(() => Promise.resolve());
        vi.mocked(httpsCallable).mockReturnValue(mockCallable as unknown as ReturnType<typeof httpsCallable>);

        const user = { uid: 'user-1', email: 'sender@test.com' };
        const recipients = ['a@test.com', 'b@test.com', 'c@test.com'];
        const payload = {
            subject: 'Bulk Email',
            html: '<p>Bulk content</p>',
            type: 'WEEKLY_DIGEST' as EmailType
        };

        const result = await sendBulkEmail(user, recipients, payload);

        expect(result).toBe(true);
        expect(mockCallable).toHaveBeenCalledTimes(3);
    });

    it('should log bulk email action', async () => {
        const { logAction } = await import('../logger');

        const user = { uid: 'user-1', email: 'sender@test.com' };
        const recipients = ['a@test.com', 'b@test.com'];
        const payload = {
            subject: 'Bulk',
            html: '<p>Test</p>',
            type: 'AUDIT_REMINDER' as EmailType
        };

        await sendBulkEmail(user, recipients, payload);

        expect(logAction).toHaveBeenCalledWith(
            user,
            'BULK_EMAIL_QUEUED',
            'System',
            expect.stringContaining('2 emails')
        );
    });

    it('should handle individual email failures gracefully', async () => {
        // sendEmail catches errors internally and returns false
        // so sendBulkEmail will complete even if some emails fail
        const { httpsCallable } = await import('firebase/functions');
        let callCount = 0;
        vi.mocked(httpsCallable).mockReturnValue(
            vi.fn(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.reject(new Error('Error'));
                }
                return Promise.resolve();
            }) as unknown as ReturnType<typeof httpsCallable>
        );

        // sendBulkEmail returns true because sendEmail catches errors internally
        const result = await sendBulkEmail(
            null,
            ['a@test.com', 'b@test.com'],
            { subject: 'Test', html: '<p>Test</p>', type: 'GENERIC' }
        );

        expect(result).toBe(true);
    });
});

describe('scheduleEmail', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should schedule email via Cloud Function', async () => {
        const { httpsCallable } = await import('firebase/functions');
        const mockCallable = vi.fn(() => Promise.resolve());
        vi.mocked(httpsCallable).mockReturnValue(mockCallable as unknown as ReturnType<typeof httpsCallable>);

        const user = { uid: 'user-1', email: 'sender@test.com' };
        const payload: EmailPayload = {
            to: 'recipient@test.com',
            subject: 'Scheduled Email',
            html: '<p>Scheduled content</p>',
            type: 'AUDIT_REMINDER'
        };
        const scheduledFor = new Date('2024-12-01T10:00:00Z');

        const result = await scheduleEmail(user, payload, scheduledFor);

        expect(result).toBe(true);
        expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'scheduleEmail');
        expect(mockCallable).toHaveBeenCalledWith(expect.objectContaining({
            scheduledFor: scheduledFor.toISOString()
        }));
    });

    it('should log scheduled email action', async () => {
        const { logAction } = await import('../logger');

        const user = { uid: 'user-1', email: 'sender@test.com' };
        const payload: EmailPayload = {
            to: 'recipient@test.com',
            subject: 'Scheduled',
            html: '<p>Test</p>',
            type: 'TASK_ASSIGNMENT'
        };
        const scheduledFor = new Date('2024-12-01T10:00:00Z');

        await scheduleEmail(user, payload, scheduledFor);

        expect(logAction).toHaveBeenCalledWith(
            user,
            'EMAIL_SCHEDULED',
            'System',
            expect.stringContaining('programmé')
        );
    });

    it('should return false on error', async () => {
        const { httpsCallable } = await import('firebase/functions');
        vi.mocked(httpsCallable).mockReturnValue(
            vi.fn().mockRejectedValueOnce(new Error('Error')) as unknown as ReturnType<typeof httpsCallable>
        );

        const payload: EmailPayload = {
            to: 'recipient@test.com',
            subject: 'Test',
            html: '<p>Test</p>',
            type: 'GENERIC'
        };

        const result = await scheduleEmail(null, payload, new Date());

        expect(result).toBe(false);
    });

    it('should log errors', async () => {
        const { httpsCallable } = await import('firebase/functions');
        vi.mocked(httpsCallable).mockReturnValue(
            vi.fn().mockRejectedValueOnce(new Error('Error')) as unknown as ReturnType<typeof httpsCallable>
        );
        const { ErrorLogger } = await import('../errorLogger');

        const payload: EmailPayload = {
            to: 'recipient@test.com',
            subject: 'Test',
            html: '<p>Test</p>',
            type: 'INCIDENT_ALERT'
        };

        await scheduleEmail(null, payload, new Date());

        expect(ErrorLogger.error).toHaveBeenCalledWith(
            expect.any(Error),
            'emailService.scheduleEmail',
            expect.objectContaining({
                metadata: expect.objectContaining({
                    to: 'recipient@test.com',
                    type: 'INCIDENT_ALERT'
                })
            })
        );
    });
});

describe('EmailPayload interface', () => {
    it('should have correct structure', () => {
        const payload: EmailPayload = {
            to: 'test@example.com',
            subject: 'Test Subject',
            html: '<p>Content</p>',
            type: 'WELCOME_EMAIL',
            metadata: { key: 'value' }
        };

        expect(payload.to).toBe('test@example.com');
        expect(payload.type).toBe('WELCOME_EMAIL');
    });
});

describe('EmailType', () => {
    it('should support all email types', () => {
        const types: EmailType[] = [
            'INVITATION',
            'INCIDENT_ALERT',
            'DOCUMENT_REVIEW',
            'TASK_ASSIGNMENT',
            'AUDIT_REMINDER',
            'RISK_TREATMENT_DUE',
            'COMPLIANCE_ALERT',
            'PASSWORD_RESET',
            'WELCOME_EMAIL',
            'WEEKLY_DIGEST',
            'SUPPLIER_REVIEW',
            'JOIN_REQUEST',
            'JOIN_REQUEST_APPROVED',
            'JOIN_REQUEST_REJECTED',
            'AUDIT_INVITATION',
            'MAINTENANCE_ALERT',
            'GENERIC'
        ];

        types.forEach(type => {
            const payload: EmailPayload = {
                to: 'test@test.com',
                subject: 'Test',
                html: '<p>Test</p>',
                type
            };
            expect(payload.type).toBe(type);
        });
    });
});
