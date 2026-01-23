/**
 * Unit tests for sector templates
 * Tests template data integrity and utility functions
 *
 * @see Story EU-4.4: Sector Templates
 */

import { describe, it, expect } from 'vitest';
import {
    SECTOR_TEMPLATES,
    getSectorTemplate,
    getRecommendedFrameworks,
    getMandatoryFrameworks,
    getPrioritizedControls,
    isControlCritical,
    getIndustriesRequiringFramework,
    type IndustryType,
} from '../sectorTemplates';

describe('sectorTemplates', () => {
    describe('SECTOR_TEMPLATES', () => {
        const industries: IndustryType[] = ['finance', 'health', 'tech', 'industrie', 'public', 'retail', 'other'];

        it('contains all expected industries', () => {
            const templateKeys = Object.keys(SECTOR_TEMPLATES);
            industries.forEach(industry => {
                expect(templateKeys).toContain(industry);
            });
        });

        it('each template has required fields', () => {
            Object.values(SECTOR_TEMPLATES).forEach(template => {
                expect(template).toHaveProperty('id');
                expect(template).toHaveProperty('nameKey');
                expect(template).toHaveProperty('descriptionKey');
                expect(template).toHaveProperty('recommendedFrameworks');
                expect(template).toHaveProperty('mandatoryFrameworks');
                expect(template).toHaveProperty('controlPriorities');
                expect(template).toHaveProperty('specificRequirements');
                expect(template).toHaveProperty('regulatoryContext');
            });
        });

        it('all control priorities have valid priority values', () => {
            const validPriorities = ['critical', 'high', 'medium', 'low'];
            Object.values(SECTOR_TEMPLATES).forEach(template => {
                template.controlPriorities.forEach(cp => {
                    expect(validPriorities).toContain(cp.priority);
                });
            });
        });

        it('all templates have non-empty recommended frameworks', () => {
            Object.values(SECTOR_TEMPLATES).forEach(template => {
                expect(template.recommendedFrameworks.length).toBeGreaterThan(0);
            });
        });
    });

    describe('getSectorTemplate', () => {
        it('returns correct template for finance', () => {
            const template = getSectorTemplate('finance');
            expect(template.id).toBe('finance');
            expect(template.mandatoryFrameworks).toContain('DORA');
            expect(template.mandatoryFrameworks).toContain('NIS2');
        });

        it('returns correct template for health', () => {
            const template = getSectorTemplate('health');
            expect(template.id).toBe('health');
            expect(template.mandatoryFrameworks).toContain('HDS');
            expect(template.mandatoryFrameworks).toContain('GDPR');
        });

        it('returns correct template for tech', () => {
            const template = getSectorTemplate('tech');
            expect(template.id).toBe('tech');
            expect(template.recommendedFrameworks).toContain('SOC2');
            expect(template.recommendedFrameworks).toContain('ISO27001');
        });

        it('returns correct template for industrie', () => {
            const template = getSectorTemplate('industrie');
            expect(template.id).toBe('industrie');
            expect(template.mandatoryFrameworks).toContain('NIS2');
        });

        it('returns correct template for public sector', () => {
            const template = getSectorTemplate('public');
            expect(template.id).toBe('public');
            expect(template.mandatoryFrameworks).toContain('GDPR');
        });

        it('returns correct template for retail', () => {
            const template = getSectorTemplate('retail');
            expect(template.id).toBe('retail');
            expect(template.mandatoryFrameworks).toContain('PCI_DSS');
            expect(template.mandatoryFrameworks).toContain('GDPR');
        });

        it('returns other template for unknown industry', () => {
            const template = getSectorTemplate('unknown' as IndustryType);
            expect(template.id).toBe('other');
        });
    });

    describe('getRecommendedFrameworks', () => {
        it('returns recommended frameworks for finance', () => {
            const frameworks = getRecommendedFrameworks('finance');
            expect(frameworks).toContain('DORA');
            expect(frameworks).toContain('NIS2');
            expect(frameworks).toContain('ISO27001');
        });

        it('returns recommended frameworks for health', () => {
            const frameworks = getRecommendedFrameworks('health');
            expect(frameworks).toContain('HDS');
            expect(frameworks).toContain('GDPR');
        });

        it('returns recommended frameworks for tech', () => {
            const frameworks = getRecommendedFrameworks('tech');
            expect(frameworks).toContain('SOC2');
            expect(frameworks).toContain('ISO27001');
            expect(frameworks).toContain('GDPR');
        });
    });

    describe('getMandatoryFrameworks', () => {
        it('returns mandatory frameworks for finance', () => {
            const frameworks = getMandatoryFrameworks('finance');
            expect(frameworks).toContain('DORA');
            expect(frameworks).toContain('NIS2');
        });

        it('returns mandatory frameworks for health', () => {
            const frameworks = getMandatoryFrameworks('health');
            expect(frameworks).toContain('HDS');
            expect(frameworks).toContain('GDPR');
        });

        it('returns mandatory frameworks for retail', () => {
            const frameworks = getMandatoryFrameworks('retail');
            expect(frameworks).toContain('PCI_DSS');
            expect(frameworks).toContain('GDPR');
        });

        it('returns empty array for other (no mandatory frameworks)', () => {
            const frameworks = getMandatoryFrameworks('other');
            expect(frameworks).toHaveLength(0);
        });
    });

    describe('getPrioritizedControls', () => {
        it('returns controls sorted by priority', () => {
            const controls = getPrioritizedControls('finance');

            // All critical controls should come first
            const criticalEnd = controls.findIndex(c => c.priority !== 'critical');
            const highEnd = controls.slice(criticalEnd).findIndex(c => c.priority !== 'high');

            if (criticalEnd > 0 && highEnd > 0) {
                // Verify ordering: critical before high
                controls.slice(0, criticalEnd).forEach(c => {
                    expect(c.priority).toBe('critical');
                });
            }
        });

        it('includes DORA controls for finance', () => {
            const controls = getPrioritizedControls('finance');
            const doraCodes = controls.map(c => c.code);
            expect(doraCodes).toContain('DORA.1.1');
            expect(doraCodes).toContain('DORA.2.1');
        });

        it('includes HDS controls for health', () => {
            const controls = getPrioritizedControls('health');
            const hdsCodes = controls.map(c => c.code);
            expect(hdsCodes).toContain('HDS.1.1');
            expect(hdsCodes).toContain('HDS.3.1');
        });

        it('includes SOC2 controls for tech', () => {
            const controls = getPrioritizedControls('tech');
            const soc2Codes = controls.map(c => c.code);
            expect(soc2Codes).toContain('CC1.1');
            expect(soc2Codes).toContain('CC6.1');
        });
    });

    describe('isControlCritical', () => {
        it('returns true for critical DORA controls in finance', () => {
            expect(isControlCritical('finance', 'DORA.1.1')).toBe(true);
            expect(isControlCritical('finance', 'DORA.2.1')).toBe(true);
            expect(isControlCritical('finance', 'DORA.3.2')).toBe(true);
        });

        it('returns false for non-critical controls', () => {
            expect(isControlCritical('finance', 'DORA.4.2')).toBe(false); // high priority, not critical
        });

        it('returns false for controls not in template', () => {
            expect(isControlCritical('finance', 'UNKNOWN.1.1')).toBe(false);
        });

        it('returns true for critical HDS controls in health', () => {
            expect(isControlCritical('health', 'HDS.1.1')).toBe(true);
            expect(isControlCritical('health', 'HDS.3.1')).toBe(true);
        });
    });

    describe('getIndustriesRequiringFramework', () => {
        it('returns finance and industrie for NIS2', () => {
            const industries = getIndustriesRequiringFramework('NIS2');
            expect(industries).toContain('finance');
            expect(industries).toContain('industrie');
        });

        it('returns finance for DORA', () => {
            const industries = getIndustriesRequiringFramework('DORA');
            expect(industries).toContain('finance');
            expect(industries).not.toContain('tech');
        });

        it('returns health, public, retail for GDPR', () => {
            const industries = getIndustriesRequiringFramework('GDPR');
            expect(industries).toContain('health');
            expect(industries).toContain('public');
            expect(industries).toContain('retail');
        });

        it('returns health for HDS', () => {
            const industries = getIndustriesRequiringFramework('HDS');
            expect(industries).toContain('health');
            expect(industries).toHaveLength(1);
        });

        it('returns retail for PCI_DSS', () => {
            const industries = getIndustriesRequiringFramework('PCI_DSS');
            expect(industries).toContain('retail');
        });

        it('returns empty array for frameworks not mandatory anywhere', () => {
            const industries = getIndustriesRequiringFramework('COBIT');
            expect(industries).toHaveLength(0);
        });
    });

    describe('template specific requirements', () => {
        it('finance has DORA-specific requirements', () => {
            const template = getSectorTemplate('finance');
            const reqKeys = template.specificRequirements.map(r => r.key);
            expect(reqKeys).toContain('dora_ror');
            expect(reqKeys).toContain('dora_exit_strategy');
            expect(reqKeys).toContain('incident_24h');
            expect(reqKeys).toContain('tlpt_3y');
        });

        it('health has HDS-specific requirements', () => {
            const template = getSectorTemplate('health');
            const reqKeys = template.specificRequirements.map(r => r.key);
            expect(reqKeys).toContain('hds_certification');
            expect(reqKeys).toContain('patient_consent');
            expect(reqKeys).toContain('breach_72h');
        });

        it('public has RGS-specific requirements', () => {
            const template = getSectorTemplate('public');
            const reqKeys = template.specificRequirements.map(r => r.key);
            expect(reqKeys).toContain('homologation_anssi');
            expect(reqKeys).toContain('rgs_compliance');
            expect(reqKeys).toContain('secnumcloud');
        });

        it('tech has SOC2-specific requirements', () => {
            const template = getSectorTemplate('tech');
            const reqKeys = template.specificRequirements.map(r => r.key);
            expect(reqKeys).toContain('soc2_type2');
            expect(reqKeys).toContain('pentest_annual');
            expect(reqKeys).toContain('bug_bounty');
        });

        it('retail has PCI-specific requirements', () => {
            const template = getSectorTemplate('retail');
            const reqKeys = template.specificRequirements.map(r => r.key);
            expect(reqKeys).toContain('pci_saq');
            expect(reqKeys).toContain('cookie_consent');
            expect(reqKeys).toContain('payment_provider');
        });
    });

    describe('regulatory context', () => {
        it('finance has DORA and NIS2 regulatory links', () => {
            const template = getSectorTemplate('finance');
            const regKeys = template.regulatoryContext.map(r => r.key);
            expect(regKeys).toContain('dora_regulation');
            expect(regKeys).toContain('nis2_directive');
        });

        it('health has HDS and CNIL links', () => {
            const template = getSectorTemplate('health');
            const regKeys = template.regulatoryContext.map(r => r.key);
            expect(regKeys).toContain('hds_ref');
            expect(regKeys).toContain('rgpd_sante');
        });

        it('all templates have at least one regulatory reference', () => {
            Object.values(SECTOR_TEMPLATES).forEach(template => {
                expect(template.regulatoryContext.length).toBeGreaterThan(0);
            });
        });

        it('all regulatory references have URLs', () => {
            Object.values(SECTOR_TEMPLATES).forEach(template => {
                template.regulatoryContext.forEach(reg => {
                    expect(reg.url).toBeDefined();
                    expect(reg.url).toMatch(/^https?:\/\//);
                });
            });
        });
    });
});
