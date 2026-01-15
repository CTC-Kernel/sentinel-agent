/**
 * Unit tests for aiPrivacyService
 * Tests data sanitization and anonymization for AI processing
 */

import { describe, it, expect } from 'vitest';
import { aiPrivacyService } from '../aiPrivacyService';

describe('aiPrivacyService', () => {
    describe('sanitizeInput', () => {
        it('returns null/undefined data as-is', () => {
            expect(aiPrivacyService.sanitizeInput(null)).toBeNull();
            expect(aiPrivacyService.sanitizeInput(undefined)).toBeUndefined();
        });

        it('redacts email addresses', () => {
            const data = { message: 'Contact john.doe@example.com for help' };
            const result = aiPrivacyService.sanitizeInput(data);
            expect(result.message).toBe('Contact [EMAIL_REDACTED] for help');
        });

        it('redacts multiple email addresses', () => {
            const data = {
                contacts: 'Email admin@company.org and support@service.com'
            };
            const result = aiPrivacyService.sanitizeInput(data);
            expect(result.contacts).toContain('[EMAIL_REDACTED]');
            expect(result.contacts).not.toContain('@');
        });

        it('redacts international phone numbers with + prefix', () => {
            const data = { phone: 'Call +33 1 42 68 53 00' };
            const result = aiPrivacyService.sanitizeInput(data);
            expect(result.phone).toBe('Call [PHONE_REDACTED]');
        });

        it('redacts international phone numbers with 00 prefix', () => {
            const data = { phone: 'Number: 0033 1 42 68 53 00' };
            const result = aiPrivacyService.sanitizeInput(data);
            expect(result.phone).toBe('Number: [PHONE_REDACTED]');
        });

        it('handles nested objects', () => {
            const data = {
                user: {
                    email: 'user@test.com',
                    details: {
                        phone: '+1 555 123 4567'
                    }
                }
            };
            const result = aiPrivacyService.sanitizeInput(data);
            expect(result.user.email).toBe('[EMAIL_REDACTED]');
            expect(result.user.details.phone).toBe('[PHONE_REDACTED]');
        });

        it('handles arrays', () => {
            const data = ['user1@test.com', 'user2@example.org'];
            const result = aiPrivacyService.sanitizeInput(data);
            expect(result).toEqual(['[EMAIL_REDACTED]', '[EMAIL_REDACTED]']);
        });

        it('preserves non-PII data', () => {
            const data = {
                title: 'Risk Assessment',
                score: 15,
                status: 'Open'
            };
            const result = aiPrivacyService.sanitizeInput(data);
            expect(result).toEqual(data);
        });
    });

    describe('anonymizeData', () => {
        it('handles null and undefined', () => {
            expect(aiPrivacyService.anonymizeData(null)).toBeNull();
            expect(aiPrivacyService.anonymizeData(undefined)).toBeUndefined();
        });

        it('handles primitive values', () => {
            expect(aiPrivacyService.anonymizeData('test')).toBe('test');
            expect(aiPrivacyService.anonymizeData(123)).toBe(123);
            expect(aiPrivacyService.anonymizeData(true)).toBe(true);
        });

        it('redacts owner field', () => {
            const data = { owner: 'John Doe', title: 'Risk Title' };
            const result = aiPrivacyService.anonymizeData(data);
            expect(result).toEqual({ owner: '[REDACTED]', title: 'Risk Title' });
        });

        it('redacts contactEmail field', () => {
            const data = { contactEmail: 'john@example.com' };
            const result = aiPrivacyService.anonymizeData(data);
            expect(result).toEqual({ contactEmail: '[REDACTED]' });
        });

        it('redacts contactName field', () => {
            const data = { contactName: 'Jane Smith' };
            const result = aiPrivacyService.anonymizeData(data);
            expect(result).toEqual({ contactName: '[REDACTED]' });
        });

        it('redacts email field', () => {
            const data = { email: 'user@company.org' };
            const result = aiPrivacyService.anonymizeData(data);
            expect(result).toEqual({ email: '[REDACTED]' });
        });

        it('redacts phone field', () => {
            const data = { phone: '+33 1 23 45 67 89' };
            const result = aiPrivacyService.anonymizeData(data);
            expect(result).toEqual({ phone: '[REDACTED]' });
        });

        it('redacts displayName field', () => {
            const data = { displayName: 'John Doe' };
            const result = aiPrivacyService.anonymizeData(data);
            expect(result).toEqual({ displayName: '[REDACTED]' });
        });

        it('preserves name, title, and description fields', () => {
            const data = {
                name: 'Project Alpha',
                title: 'Risk Assessment',
                description: 'Critical vulnerability'
            };
            const result = aiPrivacyService.anonymizeData(data);
            expect(result).toEqual(data);
        });

        it('handles nested objects', () => {
            const data = {
                risk: {
                    owner: 'John Doe',
                    threat: 'SQL Injection'
                },
                contact: {
                    email: 'admin@test.com'
                }
            };
            const result = aiPrivacyService.anonymizeData(data) as Record<string, unknown>;
            expect((result.risk as Record<string, unknown>).owner).toBe('[REDACTED]');
            expect((result.risk as Record<string, unknown>).threat).toBe('SQL Injection');
            expect((result.contact as Record<string, unknown>).email).toBe('[REDACTED]');
        });

        it('handles arrays of objects', () => {
            const data = [
                { owner: 'User 1', score: 10 },
                { owner: 'User 2', score: 20 }
            ];
            const result = aiPrivacyService.anonymizeData(data) as Array<Record<string, unknown>>;
            expect(result[0].owner).toBe('[REDACTED]');
            expect(result[0].score).toBe(10);
            expect(result[1].owner).toBe('[REDACTED]');
            expect(result[1].score).toBe(20);
        });

        it('handles deeply nested structures', () => {
            const data = {
                level1: {
                    level2: {
                        level3: {
                            owner: 'Deep Owner',
                            data: 'safe data'
                        }
                    }
                }
            };
            const result = aiPrivacyService.anonymizeData(data) as Record<string, any>;
            expect(result.level1.level2.level3.owner).toBe('[REDACTED]');
            expect(result.level1.level2.level3.data).toBe('safe data');
        });
    });
});
