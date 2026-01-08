import { describe, it, expect } from 'vitest';
import {
    validateAsset,
    validateRisk,
    validateProject,
    validateAudit,
    validateDocument,
    validateIncident,
    validateSupplier
} from '../formValidation';

describe('formValidation', () => {
    describe('validateAsset', () => {
        it('should return no errors for valid asset', () => {
            const validAsset = {
                name: 'Test Server',
                category: 'Infrastructure',
                criticality: 'High',
                value: 10000
            };

            const errors = validateAsset(validAsset);
            expect(errors).toHaveLength(0);
        });

        it('should return error for missing name', () => {
            const asset = {
                category: 'Infrastructure',
                criticality: 'High'
            };

            const errors = validateAsset(asset);
            expect(errors.some(e => e.field === 'name')).toBe(true);
        });

        it('should return error for empty name', () => {
            const asset = {
                name: '',
                category: 'Infrastructure',
                criticality: 'High'
            };

            const errors = validateAsset(asset);
            expect(errors.some(e => e.field === 'name')).toBe(true);
        });

        it('should return error for name too short', () => {
            const asset = {
                name: 'AB',
                category: 'Infrastructure',
                criticality: 'High'
            };

            const errors = validateAsset(asset);
            expect(errors.some(e => e.field === 'name' && e.message.includes('3 caractères'))).toBe(true);
        });

        it('should return error for missing category', () => {
            const asset = {
                name: 'Test Server',
                criticality: 'High'
            };

            const errors = validateAsset(asset);
            expect(errors.some(e => e.field === 'category')).toBe(true);
        });

        it('should return error for missing criticality', () => {
            const asset = {
                name: 'Test Server',
                category: 'Infrastructure'
            };

            const errors = validateAsset(asset);
            expect(errors.some(e => e.field === 'criticality')).toBe(true);
        });

        it('should return error for negative value', () => {
            const asset = {
                name: 'Test Server',
                category: 'Infrastructure',
                criticality: 'High',
                value: -100
            };

            const errors = validateAsset(asset);
            expect(errors.some(e => e.field === 'value')).toBe(true);
        });

        it('should return error for zero value', () => {
            const asset = {
                name: 'Test Server',
                category: 'Infrastructure',
                criticality: 'High',
                value: 0
            };

            const errors = validateAsset(asset);
            expect(errors.some(e => e.field === 'value')).toBe(true);
        });

        it('should validate CIA triad when provided', () => {
            const asset = {
                name: 'Test Server',
                category: 'Infrastructure',
                criticality: 'High',
                type: undefined,
                confidentiality: undefined,
                integrity: undefined,
                availability: undefined
            };

            const errors = validateAsset(asset);
            expect(errors.some(e => e.field === 'type')).toBe(true);
            expect(errors.some(e => e.field === 'confidentiality')).toBe(true);
            expect(errors.some(e => e.field === 'integrity')).toBe(true);
            expect(errors.some(e => e.field === 'availability')).toBe(true);
        });
    });

    describe('validateRisk', () => {
        it('should return no errors for valid risk', () => {
            const validRisk = {
                threat: 'Data Breach',
                category: 'Security',
                probability: 3,
                impact: 4
            };

            const errors = validateRisk(validRisk);
            expect(errors).toHaveLength(0);
        });

        it('should return error for missing threat', () => {
            const risk = {
                category: 'Security',
                probability: 3,
                impact: 4
            };

            const errors = validateRisk(risk);
            expect(errors.some(e => e.field === 'threat')).toBe(true);
        });

        it('should return error for empty threat', () => {
            const risk = {
                threat: '',
                category: 'Security',
                probability: 3,
                impact: 4
            };

            const errors = validateRisk(risk);
            expect(errors.some(e => e.field === 'threat')).toBe(true);
        });

        it('should return error for missing category', () => {
            const risk = {
                threat: 'Data Breach',
                probability: 3,
                impact: 4
            };

            const errors = validateRisk(risk);
            expect(errors.some(e => e.field === 'category')).toBe(true);
        });

        it('should return error for probability below 1', () => {
            const risk = {
                threat: 'Data Breach',
                category: 'Security',
                probability: 0,
                impact: 4
            };

            const errors = validateRisk(risk);
            expect(errors.some(e => e.field === 'probability')).toBe(true);
        });

        it('should return error for probability above 5', () => {
            const risk = {
                threat: 'Data Breach',
                category: 'Security',
                probability: 6,
                impact: 4
            };

            const errors = validateRisk(risk);
            expect(errors.some(e => e.field === 'probability')).toBe(true);
        });

        it('should return error for impact below 1', () => {
            const risk = {
                threat: 'Data Breach',
                category: 'Security',
                probability: 3,
                impact: 0
            };

            const errors = validateRisk(risk);
            expect(errors.some(e => e.field === 'impact')).toBe(true);
        });

        it('should return error for impact above 5', () => {
            const risk = {
                threat: 'Data Breach',
                category: 'Security',
                probability: 3,
                impact: 6
            };

            const errors = validateRisk(risk);
            expect(errors.some(e => e.field === 'impact')).toBe(true);
        });

        it('should accept valid probability and impact at boundaries', () => {
            const risk1 = {
                threat: 'Test',
                category: 'Security',
                probability: 1,
                impact: 1
            };

            const risk5 = {
                threat: 'Test',
                category: 'Security',
                probability: 5,
                impact: 5
            };

            expect(validateRisk(risk1)).toHaveLength(0);
            expect(validateRisk(risk5)).toHaveLength(0);
        });
    });

    describe('validateProject', () => {
        it('should return no errors for valid project', () => {
            const validProject = {
                name: 'ISO 27001 Implementation',
                status: 'active'
            };

            const errors = validateProject(validProject);
            expect(errors).toHaveLength(0);
        });

        it('should return error for missing name', () => {
            const project = {
                status: 'active'
            };

            const errors = validateProject(project);
            expect(errors.some(e => e.field === 'name')).toBe(true);
        });

        it('should return error for missing status', () => {
            const project = {
                name: 'Test Project'
            };

            const errors = validateProject(project);
            expect(errors.some(e => e.field === 'status')).toBe(true);
        });
    });

    describe('validateAudit', () => {
        it('should return no errors for valid audit', () => {
            const validAudit = {
                name: 'Annual Security Audit',
                type: 'internal',
                dateScheduled: new Date().toISOString(),
                auditor: 'John Doe'
            };

            const errors = validateAudit(validAudit);
            expect(errors).toHaveLength(0);
        });

        it('should return error for missing name', () => {
            const audit = {
                type: 'internal',
                dateScheduled: new Date().toISOString(),
                auditor: 'John Doe'
            };

            const errors = validateAudit(audit);
            expect(errors.some(e => e.field === 'name')).toBe(true);
        });

        it('should return error for missing type', () => {
            const audit = {
                name: 'Annual Audit',
                dateScheduled: new Date().toISOString(),
                auditor: 'John Doe'
            };

            const errors = validateAudit(audit);
            expect(errors.some(e => e.field === 'type')).toBe(true);
        });

        it('should return error for missing dateScheduled', () => {
            const audit = {
                name: 'Annual Audit',
                type: 'internal',
                auditor: 'John Doe'
            };

            const errors = validateAudit(audit);
            expect(errors.some(e => e.field === 'dateScheduled')).toBe(true);
        });

        it('should return error for missing auditor', () => {
            const audit = {
                name: 'Annual Audit',
                type: 'internal',
                dateScheduled: new Date().toISOString()
            };

            const errors = validateAudit(audit);
            expect(errors.some(e => e.field === 'auditor')).toBe(true);
        });
    });

    describe('validateDocument', () => {
        it('should return no errors for valid document', () => {
            const validDocument = {
                title: 'Security Policy',
                type: 'policy'
            };

            const errors = validateDocument(validDocument);
            expect(errors).toHaveLength(0);
        });

        it('should return error for missing title', () => {
            const document = {
                type: 'policy'
            };

            const errors = validateDocument(document);
            expect(errors.some(e => e.field === 'title')).toBe(true);
        });

        it('should return error for missing type', () => {
            const document = {
                title: 'Security Policy'
            };

            const errors = validateDocument(document);
            expect(errors.some(e => e.field === 'type')).toBe(true);
        });

        it('should return error for past review date', () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 10);

            const document = {
                title: 'Security Policy',
                type: 'policy',
                nextReviewDate: pastDate.toISOString()
            };

            const errors = validateDocument(document);
            expect(errors.some(e => e.field === 'nextReviewDate')).toBe(true);
        });
    });

    describe('validateIncident', () => {
        it('should return no errors for valid incident', () => {
            const validIncident = {
                title: 'Security Breach',
                description: 'A security breach occurred',
                severity: 'high',
                category: 'Security',
                dateReported: new Date().toISOString()
            };

            const errors = validateIncident(validIncident);
            expect(errors).toHaveLength(0);
        });

        it('should return error for missing title', () => {
            const incident = {
                description: 'A security breach',
                severity: 'high',
                category: 'Security',
                dateReported: new Date().toISOString()
            };

            const errors = validateIncident(incident);
            expect(errors.some(e => e.field === 'title')).toBe(true);
        });

        it('should return error for missing description', () => {
            const incident = {
                title: 'Security Breach',
                severity: 'high',
                category: 'Security',
                dateReported: new Date().toISOString()
            };

            const errors = validateIncident(incident);
            expect(errors.some(e => e.field === 'description')).toBe(true);
        });

        it('should return error for missing severity', () => {
            const incident = {
                title: 'Security Breach',
                description: 'A security breach',
                category: 'Security',
                dateReported: new Date().toISOString()
            };

            const errors = validateIncident(incident);
            expect(errors.some(e => e.field === 'severity')).toBe(true);
        });

        it('should return error for missing category', () => {
            const incident = {
                title: 'Security Breach',
                description: 'A security breach',
                severity: 'high',
                dateReported: new Date().toISOString()
            };

            const errors = validateIncident(incident);
            expect(errors.some(e => e.field === 'category')).toBe(true);
        });

        it('should return error for missing dateReported', () => {
            const incident = {
                title: 'Security Breach',
                description: 'A security breach',
                severity: 'high',
                category: 'Security'
            };

            const errors = validateIncident(incident);
            expect(errors.some(e => e.field === 'dateReported')).toBe(true);
        });
    });

    describe('validateSupplier', () => {
        it('should return no errors for valid supplier', () => {
            const validSupplier = {
                name: 'Cloud Provider Inc',
                category: 'Cloud Services',
                criticality: 'high'
            };

            const errors = validateSupplier(validSupplier);
            expect(errors).toHaveLength(0);
        });

        it('should return error for missing name', () => {
            const supplier = {
                category: 'Cloud Services',
                criticality: 'high'
            };

            const errors = validateSupplier(supplier);
            expect(errors.some(e => e.field === 'name')).toBe(true);
        });

        it('should return error for missing category', () => {
            const supplier = {
                name: 'Cloud Provider Inc',
                criticality: 'high'
            };

            const errors = validateSupplier(supplier);
            expect(errors.some(e => e.field === 'category')).toBe(true);
        });

        it('should return error for missing criticality', () => {
            const supplier = {
                name: 'Cloud Provider Inc',
                category: 'Cloud Services'
            };

            const errors = validateSupplier(supplier);
            expect(errors.some(e => e.field === 'criticality')).toBe(true);
        });

        it('should return error for invalid email', () => {
            const supplier = {
                name: 'Cloud Provider Inc',
                category: 'Cloud Services',
                criticality: 'high',
                contactEmail: 'invalid-email'
            };

            const errors = validateSupplier(supplier);
            expect(errors.some(e => e.field === 'contactEmail')).toBe(true);
        });

        it('should accept valid email', () => {
            const supplier = {
                name: 'Cloud Provider Inc',
                category: 'Cloud Services',
                criticality: 'high',
                contactEmail: 'contact@cloudprovider.com'
            };

            const errors = validateSupplier(supplier);
            expect(errors.some(e => e.field === 'contactEmail')).toBe(false);
        });
    });
});
