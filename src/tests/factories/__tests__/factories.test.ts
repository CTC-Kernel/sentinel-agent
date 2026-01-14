/**
 * Test Factories Tests
 * Ensures factories create valid test data
 * Story 13-4: Test Coverage Improvement
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    createRisk,
    createRiskList,
    createCriticalRisk,
    createLowRisk,
    resetRiskCounter,
} from '../riskFactory';
import {
    createControl,
    createControlList,
    createImplementedControl,
    resetControlCounter,
} from '../controlFactory';
import {
    createAudit,
    createAuditList,
    createCompletedAudit,
    createInProgressAudit,
    resetAuditCounter,
} from '../auditFactory';
import {
    createDocument,
    createDocumentList,
    createApprovedDocument,
    createArchivedDocument,
    resetDocumentCounter,
} from '../documentFactory';
import {
    createUser,
    createUserList,
    createAdminUser,
    createRSSIUser,
    resetUserCounter,
} from '../userFactory';

describe('Test Factories', () => {
    beforeEach(() => {
        resetRiskCounter();
        resetControlCounter();
        resetAuditCounter();
        resetDocumentCounter();
        resetUserCounter();
    });

    describe('Risk Factory', () => {
        it('should create a valid risk with defaults', () => {
            const risk = createRisk();

            expect(risk.id).toBe('risk-1');
            expect(risk.organizationId).toBe('org-test');
            expect(risk.threat).toContain('Test Threat');
            expect(risk.probability).toBe(3);
            expect(risk.impact).toBe(3);
            expect(risk.score).toBe(9);
            expect(risk.status).toBe('Ouvert');
            expect(risk.strategy).toBe('Atténuer');
        });

        it('should create risk with custom options', () => {
            const risk = createRisk({
                id: 'custom-risk',
                probability: 5,
                impact: 4,
                status: 'En cours',
            });

            expect(risk.id).toBe('custom-risk');
            expect(risk.probability).toBe(5);
            expect(risk.impact).toBe(4);
            expect(risk.score).toBe(20);
            expect(risk.status).toBe('En cours');
        });

        it('should create multiple risks with unique ids', () => {
            const risks = createRiskList(5);

            expect(risks).toHaveLength(5);
            const ids = risks.map(r => r.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(5);
        });

        it('should create critical risk with high probability and impact', () => {
            const risk = createCriticalRisk();

            expect(risk.probability).toBe(5);
            expect(risk.impact).toBe(5);
            expect(risk.score).toBe(25);
            expect(risk.status).toBe('Ouvert');
        });

        it('should create low risk with low probability and impact', () => {
            const risk = createLowRisk();

            expect(risk.probability).toBe(1);
            expect(risk.impact).toBe(1);
            expect(risk.score).toBe(1);
            expect(risk.status).toBe('Fermé');
        });
    });

    describe('Control Factory', () => {
        it('should create a valid control with defaults', () => {
            const control = createControl();

            expect(control.id).toBe('ctrl-1');
            expect(control.code).toBe('A.1.1');
            expect(control.status).toBe('Non commencé');
            expect(control.framework).toBe('ISO27001');
        });

        it('should create control with custom options', () => {
            const control = createControl({
                code: 'B.2.3',
                status: 'Implémenté',
                framework: 'GDPR',
            });

            expect(control.code).toBe('B.2.3');
            expect(control.status).toBe('Implémenté');
            expect(control.framework).toBe('GDPR');
        });

        it('should create multiple controls', () => {
            const controls = createControlList(3);

            expect(controls).toHaveLength(3);
            expect(controls[0].code).toBe('A.1.1');
            expect(controls[1].code).toBe('A.2.1');
            expect(controls[2].code).toBe('A.3.1');
        });

        it('should create implemented control', () => {
            const control = createImplementedControl();

            expect(control.status).toBe('Implémenté');
        });
    });

    describe('Audit Factory', () => {
        it('should create a valid audit with defaults', () => {
            const audit = createAudit();

            expect(audit.id).toBe('audit-1');
            expect(audit.type).toBe('Interne');
            expect(audit.status).toBe('Planifié');
            expect(audit.framework).toBe('ISO27001');
        });

        it('should create audit with custom options', () => {
            const audit = createAudit({
                title: 'Custom Audit',
                type: 'Externe',
                status: 'En cours',
            });

            expect(audit.type).toBe('Externe');
            expect(audit.status).toBe('En cours');
        });

        it('should create multiple audits', () => {
            const audits = createAuditList(4);

            expect(audits).toHaveLength(4);
        });

        it('should create completed audit', () => {
            const audit = createCompletedAudit();

            expect(audit.status).toBe('Terminé');
        });

        it('should create in-progress audit', () => {
            const audit = createInProgressAudit();

            expect(audit.status).toBe('En cours');
        });
    });

    describe('Document Factory', () => {
        it('should create a valid document with defaults', () => {
            const document = createDocument();

            expect(document.id).toBe('doc-1');
            expect(document.type).toBe('Politique');
            expect(document.status).toBe('Brouillon');
            expect(document.version).toBe('1.0');
        });

        it('should create document with custom options', () => {
            const document = createDocument({
                title: 'Security Policy',
                status: 'Approuvé',
                version: '2.0',
            });

            expect(document.title).toBe('Security Policy');
            expect(document.status).toBe('Approuvé');
            expect(document.version).toBe('2.0');
        });

        it('should create multiple documents', () => {
            const documents = createDocumentList(3);

            expect(documents).toHaveLength(3);
        });

        it('should create approved document', () => {
            const document = createApprovedDocument();

            expect(document.status).toBe('Approuvé');
        });

        it('should create archived document', () => {
            const document = createArchivedDocument();

            expect(document.status).toBe('Archivé');
        });
    });

    describe('User Factory', () => {
        it('should create a valid user with defaults', () => {
            const user = createUser();

            expect(user.uid).toBe('user-1');
            expect(user.role).toBe('user');
        });

        it('should create user with custom options', () => {
            const user = createUser({
                email: 'custom@test.com',
                role: 'admin',
            });

            expect(user.email).toBe('custom@test.com');
            expect(user.role).toBe('admin');
        });

        it('should create multiple users', () => {
            const users = createUserList(5);

            expect(users).toHaveLength(5);
        });

        it('should create admin user', () => {
            const user = createAdminUser();

            expect(user.role).toBe('admin');
        });

        it('should create RSSI user', () => {
            const user = createRSSIUser();

            expect(user.role).toBe('rssi');
        });
    });
});
