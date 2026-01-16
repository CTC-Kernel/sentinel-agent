/**
 * Unit tests for riskTemplates.ts
 * Tests risk templates and risk creation from templates
 */

import { describe, it, expect } from 'vitest';
import { RISK_TEMPLATES, createRisksFromTemplate } from '../riskTemplates';

describe('RISK_TEMPLATES', () => {
    it('contains expected template categories', () => {
        const categories = RISK_TEMPLATES.map(t => t.id);
        expect(categories).toContain('owasp-top-10-2021');
        expect(categories).toContain('iso27001-common');
        expect(categories).toContain('rgpd-risks');
        expect(categories).toContain('cloud-risks');
    });

    describe('template structure', () => {
        it.each(RISK_TEMPLATES)('$name has valid structure', (template) => {
            expect(template).toHaveProperty('id');
            expect(template).toHaveProperty('name');
            expect(template).toHaveProperty('description');
            expect(template).toHaveProperty('category');
            expect(template).toHaveProperty('icon');
            expect(template).toHaveProperty('risks');

            expect(typeof template.id).toBe('string');
            expect(typeof template.name).toBe('string');
            expect(typeof template.description).toBe('string');
            expect(typeof template.icon).toBe('string');
            expect(Array.isArray(template.risks)).toBe(true);
            expect(template.risks.length).toBeGreaterThan(0);
        });
    });

    describe('OWASP Top 10 template', () => {
        const owaspTemplate = RISK_TEMPLATES.find(t => t.id === 'owasp-top-10-2021');

        it('exists and has correct name', () => {
            expect(owaspTemplate).toBeDefined();
            expect(owaspTemplate?.name).toBe('OWASP Top 10 2021');
        });

        it('has OWASP category', () => {
            expect(owaspTemplate?.category).toBe('OWASP');
        });

        it('contains web security risks', () => {
            const threats = owaspTemplate?.risks.map(r => r.threat) || [];
            expect(threats.some(t => t.includes('Injection'))).toBe(true);
            expect(threats.some(t => t.includes('Broken Access Control'))).toBe(true);
        });

        it('each risk has required properties', () => {
            owaspTemplate?.risks.forEach(risk => {
                expect(risk).toHaveProperty('assetId');
                expect(risk).toHaveProperty('threat');
                expect(risk).toHaveProperty('vulnerability');
                expect(risk).toHaveProperty('probability');
                expect(risk).toHaveProperty('impact');
                expect(risk).toHaveProperty('score');
                expect(risk).toHaveProperty('status');
                expect(risk).toHaveProperty('owner');
                expect(risk).toHaveProperty('strategy');

                expect(risk.probability).toBeGreaterThanOrEqual(1);
                expect(risk.probability).toBeLessThanOrEqual(5);
                expect(risk.impact).toBeGreaterThanOrEqual(1);
                expect(risk.impact).toBeLessThanOrEqual(5);
            });
        });

        it('has 10 OWASP risks', () => {
            expect(owaspTemplate?.risks.length).toBe(10);
        });
    });

    describe('ISO 27001 template', () => {
        const isoTemplate = RISK_TEMPLATES.find(t => t.id === 'iso27001-common');

        it('exists and has correct name', () => {
            expect(isoTemplate).toBeDefined();
            expect(isoTemplate?.name).toBe('Risques ISO 27001 Courants');
        });

        it('has ISO27001 category', () => {
            expect(isoTemplate?.category).toBe('ISO27001');
        });

        it('contains information security risks', () => {
            const threats = isoTemplate?.risks.map(r => r.threat) || [];
            expect(threats.some(t => t.includes('ransomware'))).toBe(true);
            expect(threats.some(t => t.includes('Perte ou vol'))).toBe(true);
        });
    });

    describe('RGPD template', () => {
        const rgpdTemplate = RISK_TEMPLATES.find(t => t.id === 'rgpd-risks');

        it('exists and has correct name', () => {
            expect(rgpdTemplate).toBeDefined();
            expect(rgpdTemplate?.name).toBe('Risques RGPD');
        });

        it('has RGPD category', () => {
            expect(rgpdTemplate?.category).toBe('RGPD');
        });

        it('contains privacy-related risks', () => {
            const threats = rgpdTemplate?.risks.map(r => r.threat) || [];
            expect(threats.some(t => t.toLowerCase().includes('données'))).toBe(true);
            expect(threats.some(t => t.includes('RGPD') || t.includes('consentement'))).toBe(true);
        });
    });

    describe('Cloud Security template', () => {
        const cloudTemplate = RISK_TEMPLATES.find(t => t.id === 'cloud-risks');

        it('exists and has correct name', () => {
            expect(cloudTemplate).toBeDefined();
            expect(cloudTemplate?.name).toBe('Risques Cloud');
        });

        it('has Cloud category', () => {
            expect(cloudTemplate?.category).toBe('Cloud');
        });

        it('contains cloud-specific risks', () => {
            const threats = cloudTemplate?.risks.map(r => r.threat) || [];
            expect(threats.some(t => t.toLowerCase().includes('s3') || t.toLowerCase().includes('cloud') || t.toLowerCase().includes('api'))).toBe(true);
        });
    });
});

describe('createRisksFromTemplate', () => {
    const owaspTemplate = RISK_TEMPLATES.find(t => t.id === 'owasp-top-10-2021')!;
    const isoTemplate = RISK_TEMPLATES.find(t => t.id === 'iso27001-common')!;
    const rgpdTemplate = RISK_TEMPLATES.find(t => t.id === 'rgpd-risks')!;
    const cloudTemplate = RISK_TEMPLATES.find(t => t.id === 'cloud-risks')!;

    it('creates risks from OWASP template', () => {
        const organizationId = 'org-456';
        const defaultOwner = 'John Doe';

        const result = createRisksFromTemplate(owaspTemplate, organizationId, defaultOwner);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(10);
    });

    it('adds correct metadata to each risk', () => {
        const organizationId = 'org-456';
        const defaultOwner = 'Jane Smith';

        const result = createRisksFromTemplate(owaspTemplate, organizationId, defaultOwner);

        result.forEach(risk => {
            expect(risk.organizationId).toBe(organizationId);
            expect(risk.owner).toBe(defaultOwner);
            expect(risk.createdAt).toBeDefined();
        });
    });

    it('preserves original template risk properties', () => {
        const organizationId = 'org-456';
        const defaultOwner = 'John Doe';

        const result = createRisksFromTemplate(owaspTemplate, organizationId, defaultOwner);

        result.forEach(risk => {
            expect(risk.threat).toBeDefined();
            expect(risk.vulnerability).toBeDefined();
            expect(risk.probability).toBeGreaterThanOrEqual(1);
            expect(risk.probability).toBeLessThanOrEqual(5);
            expect(risk.impact).toBeGreaterThanOrEqual(1);
            expect(risk.impact).toBeLessThanOrEqual(5);
            expect(risk.strategy).toBeDefined();
            expect(risk.status).toBe('Ouvert');
        });
    });

    it('creates risks from ISO 27001 template', () => {
        const result = createRisksFromTemplate(isoTemplate, 'org-1', 'Owner');
        expect(result.length).toBeGreaterThan(0);
        expect(result.length).toBe(isoTemplate.risks.length);
    });

    it('creates risks from RGPD template', () => {
        const result = createRisksFromTemplate(rgpdTemplate, 'org-1', 'Owner');
        expect(result.length).toBeGreaterThan(0);
        expect(result.length).toBe(rgpdTemplate.risks.length);
    });

    it('creates risks from cloud template', () => {
        const result = createRisksFromTemplate(cloudTemplate, 'org-1', 'Owner');
        expect(result.length).toBeGreaterThan(0);
        expect(result.length).toBe(cloudTemplate.risks.length);
    });

    it('sets createdAt timestamp', () => {
        const beforeCreate = new Date().toISOString();
        const result = createRisksFromTemplate(owaspTemplate, 'org-1', 'Owner');
        const afterCreate = new Date().toISOString();

        result.forEach(risk => {
            expect(risk.createdAt >= beforeCreate).toBe(true);
            expect(risk.createdAt <= afterCreate).toBe(true);
        });
    });

    it('overrides owner from template', () => {
        const customOwner = 'Custom Security Team';
        const result = createRisksFromTemplate(owaspTemplate, 'org-1', customOwner);

        result.forEach(risk => {
            expect(risk.owner).toBe(customOwner);
        });
    });
});
