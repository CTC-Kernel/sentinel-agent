/**
 * Unit tests for settingsSchema.ts
 * Tests validation of settings and profile forms
 */

import { describe, it, expect } from 'vitest';
import {
    profileSchema,
    passwordSchema,
    organizationSchema,
    aiSettingsSchema
} from '../settingsSchema';

describe('profileSchema', () => {
    const validProfile = {
        displayName: 'John Doe',
        role: 'rssi' as const
    };

    describe('required fields', () => {
        it('accepts valid profile data', () => {
            const result = profileSchema.safeParse(validProfile);
            expect(result.success).toBe(true);
        });

        it('rejects missing displayName', () => {
            const { displayName: _displayName, ...data } = validProfile;
            const result = profileSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects empty displayName', () => {
            const result = profileSchema.safeParse({ ...validProfile, displayName: '' });
            expect(result.success).toBe(false);
        });

        it('rejects missing role', () => {
            const { role: _role, ...data } = validProfile;
            const result = profileSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe('field length constraints', () => {
        it('rejects displayName longer than 100 characters', () => {
            const result = profileSchema.safeParse({
                ...validProfile,
                displayName: 'a'.repeat(101)
            });
            expect(result.success).toBe(false);
        });

        it('accepts displayName at max length (100)', () => {
            const result = profileSchema.safeParse({
                ...validProfile,
                displayName: 'a'.repeat(100)
            });
            expect(result.success).toBe(true);
        });

        it('rejects department longer than 100 characters', () => {
            const result = profileSchema.safeParse({
                ...validProfile,
                department: 'a'.repeat(101)
            });
            expect(result.success).toBe(false);
        });
    });

    describe('role validation', () => {
        it.each(['admin', 'rssi', 'direction', 'project_manager', 'auditor', 'user', 'super_admin'] as const)(
            'accepts valid role: %s',
            (role) => {
                const result = profileSchema.safeParse({ ...validProfile, role });
                expect(result.success).toBe(true);
            }
        );

        it('rejects invalid role', () => {
            const result = profileSchema.safeParse({ ...validProfile, role: 'invalid' });
            expect(result.success).toBe(false);
        });
    });

    describe('API keys', () => {
        it('accepts Shodan API key', () => {
            const result = profileSchema.safeParse({
                ...validProfile,
                shodanApiKey: 'api-key-123'
            });
            expect(result.success).toBe(true);
        });

        it('accepts HIBP API key', () => {
            const result = profileSchema.safeParse({
                ...validProfile,
                hibpApiKey: 'hibp-api-key'
            });
            expect(result.success).toBe(true);
        });

        it('accepts Safe Browsing API key', () => {
            const result = profileSchema.safeParse({
                ...validProfile,
                safeBrowsingApiKey: 'safe-browsing-key'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('notification preferences', () => {
        it('accepts valid notification preferences', () => {
            const result = profileSchema.safeParse({
                ...validProfile,
                notificationPreferences: {
                    risks: { email: true, push: true, inApp: true },
                    audits: { email: true, push: false, inApp: true },
                    tasks: { email: false, push: true, inApp: true },
                    system: { email: true, push: true, inApp: false }
                }
            });
            expect(result.success).toBe(true);
        });

        it('accepts undefined notification preferences', () => {
            const result = profileSchema.safeParse(validProfile);
            expect(result.success).toBe(true);
        });

        it('rejects invalid notification preference values', () => {
            const result = profileSchema.safeParse({
                ...validProfile,
                notificationPreferences: {
                    risks: { email: 'yes', push: true, inApp: true }
                }
            });
            expect(result.success).toBe(false);
        });
    });

    describe('optional fields', () => {
        it('accepts all optional fields', () => {
            const result = profileSchema.safeParse({
                ...validProfile,
                department: 'IT Security',
                shodanApiKey: 'shodan-key',
                hibpApiKey: 'hibp-key',
                safeBrowsingApiKey: 'safe-key'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('whitespace trimming', () => {
        it('trims whitespace from displayName', () => {
            const result = profileSchema.safeParse({
                ...validProfile,
                displayName: '  John Doe  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayName).toBe('John Doe');
            }
        });

        it('trims whitespace from department', () => {
            const result = profileSchema.safeParse({
                ...validProfile,
                department: '  IT Department  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.department).toBe('IT Department');
            }
        });
    });
});

describe('passwordSchema', () => {
    const validPassword = {
        newPassword: 'newpass123',
        confirmPassword: 'newpass123'
    };

    describe('required fields', () => {
        it('accepts valid matching passwords', () => {
            const result = passwordSchema.safeParse(validPassword);
            expect(result.success).toBe(true);
        });

        it('rejects missing newPassword', () => {
            const { newPassword: _newPassword, ...data } = validPassword;
            const result = passwordSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing confirmPassword', () => {
            const { confirmPassword: _confirmPassword, ...data } = validPassword;
            const result = passwordSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe('password length validation', () => {
        it('accepts passwords with 6+ characters', () => {
            const result = passwordSchema.safeParse({
                newPassword: '123456',
                confirmPassword: '123456'
            });
            expect(result.success).toBe(true);
        });

        it('rejects newPassword shorter than 6 characters', () => {
            const result = passwordSchema.safeParse({
                newPassword: '12345',
                confirmPassword: '12345'
            });
            expect(result.success).toBe(false);
        });

        it('rejects confirmPassword shorter than 6 characters', () => {
            const result = passwordSchema.safeParse({
                newPassword: '123456',
                confirmPassword: '12345'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('password matching refinement', () => {
        it('rejects non-matching passwords', () => {
            const result = passwordSchema.safeParse({
                newPassword: 'password123',
                confirmPassword: 'password456'
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some(i => i.path.includes('confirmPassword'))).toBe(true);
            }
        });

        it('accepts exactly matching passwords', () => {
            const result = passwordSchema.safeParse({
                newPassword: 'exactmatch',
                confirmPassword: 'exactmatch'
            });
            expect(result.success).toBe(true);
        });
    });
});

describe('organizationSchema', () => {
    const validOrg = {
        orgName: 'Acme Corporation'
    };

    describe('required fields', () => {
        it('accepts valid organization data', () => {
            const result = organizationSchema.safeParse(validOrg);
            expect(result.success).toBe(true);
        });

        it('rejects missing orgName', () => {
            const result = organizationSchema.safeParse({});
            expect(result.success).toBe(false);
        });

        it('rejects empty orgName', () => {
            const result = organizationSchema.safeParse({ orgName: '' });
            expect(result.success).toBe(false);
        });
    });

    describe('field length constraints', () => {
        it('rejects orgName longer than 100 characters', () => {
            const result = organizationSchema.safeParse({
                orgName: 'a'.repeat(101)
            });
            expect(result.success).toBe(false);
        });

        it('accepts orgName at max length (100)', () => {
            const result = organizationSchema.safeParse({
                orgName: 'a'.repeat(100)
            });
            expect(result.success).toBe(true);
        });
    });

    describe('contact email validation', () => {
        it('accepts valid contact email', () => {
            const result = organizationSchema.safeParse({
                ...validOrg,
                contactEmail: 'contact@acme.com'
            });
            expect(result.success).toBe(true);
        });

        it('accepts empty contact email', () => {
            const result = organizationSchema.safeParse({
                ...validOrg,
                contactEmail: ''
            });
            expect(result.success).toBe(true);
        });

        it('rejects invalid contact email', () => {
            const result = organizationSchema.safeParse({
                ...validOrg,
                contactEmail: 'invalid-email'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('AI settings', () => {
        it('accepts valid AI settings', () => {
            const result = organizationSchema.safeParse({
                ...validOrg,
                aiSettings: {
                    enabled: true,
                    consentGiven: true,
                    dataSanitization: true
                }
            });
            expect(result.success).toBe(true);
        });

        it('accepts AI settings with all false', () => {
            const result = organizationSchema.safeParse({
                ...validOrg,
                aiSettings: {
                    enabled: false,
                    consentGiven: false,
                    dataSanitization: false
                }
            });
            expect(result.success).toBe(true);
        });

        it('accepts undefined AI settings', () => {
            const result = organizationSchema.safeParse(validOrg);
            expect(result.success).toBe(true);
        });
    });

    describe('optional fields', () => {
        it('accepts all optional fields', () => {
            const result = organizationSchema.safeParse({
                ...validOrg,
                address: '123 Main St, City',
                vatNumber: 'FR12345678901',
                contactEmail: 'contact@org.com'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('whitespace trimming', () => {
        it('trims whitespace from orgName', () => {
            const result = organizationSchema.safeParse({
                orgName: '  Organization Name  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.orgName).toBe('Organization Name');
            }
        });

        it('trims whitespace from address', () => {
            const result = organizationSchema.safeParse({
                ...validOrg,
                address: '  123 Main St  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.address).toBe('123 Main St');
            }
        });

        it('trims whitespace from vatNumber', () => {
            const result = organizationSchema.safeParse({
                ...validOrg,
                vatNumber: '  FR123  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.vatNumber).toBe('FR123');
            }
        });

        it('trims whitespace from contactEmail', () => {
            const result = organizationSchema.safeParse({
                ...validOrg,
                contactEmail: '  contact@org.com  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.contactEmail).toBe('contact@org.com');
            }
        });
    });
});

describe('aiSettingsSchema', () => {
    describe('Gemini credential', () => {
        it('accepts valid Gemini credential', () => {
            const result = aiSettingsSchema.safeParse({
                geminiCredential: 'api-key-123'
            });
            expect(result.success).toBe(true);
        });

        it('accepts empty Gemini credential', () => {
            const result = aiSettingsSchema.safeParse({
                geminiCredential: ''
            });
            expect(result.success).toBe(true);
        });

        it('accepts undefined Gemini credential', () => {
            const result = aiSettingsSchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('trims whitespace from Gemini credential', () => {
            const result = aiSettingsSchema.safeParse({
                geminiCredential: '  api-key  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.geminiCredential).toBe('api-key');
            }
        });
    });
});
