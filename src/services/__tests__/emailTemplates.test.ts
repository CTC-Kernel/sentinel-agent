/**
 * Unit tests for emailTemplates
 * Tests various email template functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getInvitationTemplate,
    getIncidentAlertTemplate,
    getDocumentReviewTemplate,
    getTaskAssignmentTemplate,
    getAuditReminderTemplate,
    getRiskTreatmentDueTemplate,
    getComplianceAlertTemplate,
    getPasswordResetTemplate,
    getWelcomeEmailTemplate,
    getWeeklyDigestTemplate,
    getSupplierReviewTemplate,
    getContactMessageTemplate,
    getJoinRequestTemplate,
    getJoinRequestApprovedTemplate,
    getJoinRequestRejectedTemplate,
    getMaintenanceTemplate,
    getAuditInvitationTemplate
} from '../emailTemplates';

describe('emailTemplates', () => {
    const mockDate = new Date('2024-06-15');

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(mockDate);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('getInvitationTemplate', () => {
        it('generates invitation email with inviter name', () => {
            const result = getInvitationTemplate('John Doe', 'Admin', 'https://example.com/invite');

            expect(result).toContain('John Doe');
            expect(result).toContain('Admin');
            expect(result).toContain('https://example.com/invite');
            expect(result).toContain("Accepter l'invitation");
        });
    });

    describe('getIncidentAlertTemplate', () => {
        it('generates critical incident alert with danger styling', () => {
            const result = getIncidentAlertTemplate('Security Breach', 'Critique', 'Admin', 'https://link');

            expect(result).toContain('Security Breach');
            expect(result).toContain('Critique');
            expect(result).toContain('alert-danger');
        });

        it('generates high severity incident with warning styling', () => {
            const result = getIncidentAlertTemplate('Suspicious Activity', 'Élevée', 'User', 'https://link');

            expect(result).toContain('alert-warning');
        });

        it('generates normal incident with info styling', () => {
            const result = getIncidentAlertTemplate('Minor Issue', 'Moyenne', 'User', 'https://link');

            expect(result).toContain('alert-info');
        });
    });

    describe('getDocumentReviewTemplate', () => {
        it('generates document review reminder', () => {
            const result = getDocumentReviewTemplate('Security Policy', 'Marie', '2024-12-31', 'https://link');

            expect(result).toContain('Security Policy');
            expect(result).toContain('Marie');
            expect(result).toContain('ISO 27001');
        });
    });

    describe('getTaskAssignmentTemplate', () => {
        it('generates task assignment notification', () => {
            const result = getTaskAssignmentTemplate('Review Controls', 'ISO Project', 'PM Name', 'https://link');

            expect(result).toContain('Review Controls');
            expect(result).toContain('ISO Project');
            expect(result).toContain('PM Name');
        });
    });

    describe('getAuditReminderTemplate', () => {
        it('generates audit reminder', () => {
            const result = getAuditReminderTemplate('Internal Audit Q1', 'Jean Dupont', '2024-07-01', 'https://link');

            expect(result).toContain('Internal Audit Q1');
            expect(result).toContain('Jean Dupont');
        });
    });

    describe('getRiskTreatmentDueTemplate', () => {
        it('generates risk treatment due notification', () => {
            const result = getRiskTreatmentDueTemplate('SQL Injection Risk', '2024-07-15', 'Security Team', 'https://link');

            expect(result).toContain('SQL Injection Risk');
            expect(result).toContain('Security Team');
            expect(result).toContain('alert-warning');
        });
    });

    describe('getComplianceAlertTemplate', () => {
        it('generates compliance alert', () => {
            const result = getComplianceAlertTemplate('A.5.1', 'Policy Review', 'Policy not updated', 'https://link');

            expect(result).toContain('A.5.1');
            expect(result).toContain('Policy Review');
            expect(result).toContain('Policy not updated');
            expect(result).toContain('alert-danger');
        });
    });

    describe('getPasswordResetTemplate', () => {
        it('generates password reset email', () => {
            const result = getPasswordResetTemplate('John', 'https://reset-link');

            expect(result).toContain('John');
            expect(result).toContain('https://reset-link');
            expect(result).toContain('1 heure');
        });
    });

    describe('getWelcomeEmailTemplate', () => {
        it('generates welcome email', () => {
            const result = getWelcomeEmailTemplate('Marie', 'Acme Corp', 'RSSI', 'https://dashboard');

            expect(result).toContain('Marie');
            expect(result).toContain('Acme Corp');
            expect(result).toContain('RSSI');
            expect(result).toContain('https://dashboard');
        });
    });

    describe('getWeeklyDigestTemplate', () => {
        it('generates weekly digest with stats', () => {
            const stats = {
                newRisks: 5,
                newIncidents: 2,
                tasksCompleted: 10,
                upcomingAudits: 3
            };
            const result = getWeeklyDigestTemplate('User', stats, 'https://link');

            expect(result).toContain('5');
            expect(result).toContain('2');
            expect(result).toContain('10');
            expect(result).toContain('3');
            expect(result).toContain('Nouveaux Risques');
            expect(result).toContain('Incidents');
        });
    });

    describe('getSupplierReviewTemplate', () => {
        it('generates critical supplier review with danger styling', () => {
            const result = getSupplierReviewTemplate('AWS', 'Critique', '2024-01-01', 'https://link');

            expect(result).toContain('AWS');
            expect(result).toContain('Critique');
            expect(result).toContain('alert-danger');
        });

        it('generates high criticality supplier review with warning styling', () => {
            const result = getSupplierReviewTemplate('Microsoft', 'Élevée', '2024-01-01', 'https://link');

            expect(result).toContain('alert-warning');
        });

        it('generates normal supplier review with success styling', () => {
            const result = getSupplierReviewTemplate('Vendor', 'Faible', '2024-01-01', 'https://link');

            expect(result).toContain('alert-success');
        });
    });

    describe('getContactMessageTemplate', () => {
        it('generates contact message email', () => {
            const result = getContactMessageTemplate('John', 'john@example.com', 'Question', 'Hello, I have a question.');

            expect(result).toContain('John');
            expect(result).toContain('john@example.com');
            expect(result).toContain('Question');
            expect(result).toContain('Hello, I have a question.');
        });

        it('converts newlines to br tags', () => {
            const result = getContactMessageTemplate('John', 'john@example.com', 'Subject', 'Line 1\nLine 2');

            expect(result).toContain('Line 1<br>Line 2');
        });
    });

    describe('getJoinRequestTemplate', () => {
        it('generates join request notification', () => {
            const result = getJoinRequestTemplate('New User', 'new@example.com', 'Acme Corp', 'https://link');

            expect(result).toContain('New User');
            expect(result).toContain('new@example.com');
            expect(result).toContain('Acme Corp');
        });
    });

    describe('getJoinRequestApprovedTemplate', () => {
        it('generates approval notification', () => {
            const result = getJoinRequestApprovedTemplate('John', 'Acme Corp', 'https://link');

            expect(result).toContain('John');
            expect(result).toContain('Acme Corp');
            expect(result).toContain('acceptée');
        });
    });

    describe('getJoinRequestRejectedTemplate', () => {
        it('generates rejection notification', () => {
            const result = getJoinRequestRejectedTemplate('John', 'Acme Corp');

            expect(result).toContain('John');
            expect(result).toContain('Acme Corp');
            expect(result).toContain('refusée');
        });
    });

    describe('getMaintenanceTemplate', () => {
        it('generates maintenance notification', () => {
            const result = getMaintenanceTemplate('Server A', '2024-07-01', 'Admin', 'https://link');

            expect(result).toContain('Server A');
            expect(result).toContain('Admin');
            expect(result).toContain('maintenance');
        });
    });

    describe('getAuditInvitationTemplate', () => {
        it('generates audit invitation', () => {
            const result = getAuditInvitationTemplate('Jean', 'Internal Audit Q2', 'Auditor', 'https://link');

            expect(result).toContain('Jean');
            expect(result).toContain('Internal Audit Q2');
            expect(result).toContain('Auditor');
            expect(result).toContain('ISO 27001');
        });
    });
});
