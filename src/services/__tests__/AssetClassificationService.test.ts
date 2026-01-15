/**
 * Unit tests for AssetClassificationService
 * Tests asset classification and CIA ratings suggestions
 */

import { describe, it, expect } from 'vitest';
import { AssetClassificationService } from '../AssetClassificationService';
import { Asset, Risk, Criticality } from '../../types';

describe('AssetClassificationService', () => {
    describe('suggestClassification', () => {
        describe('data type assets', () => {
            it('suggests critical confidentiality for financial data', () => {
                const asset: Partial<Asset> = {
                    type: 'Données',
                    dataDetails: { dataCategory: 'Financier' }
                };
                const result = AssetClassificationService.suggestClassification(asset);
                expect(result.confidentiality).toBe(Criticality.CRITICAL);
                expect(result.integrity).toBe(Criticality.HIGH);
                expect(result.reason).toContain('Financier');
            });

            it('suggests critical confidentiality for IP data', () => {
                const asset: Partial<Asset> = {
                    type: 'Données',
                    dataDetails: { dataCategory: 'Propriété Intellectuelle' }
                };
                const result = AssetClassificationService.suggestClassification(asset);
                expect(result.confidentiality).toBe(Criticality.CRITICAL);
            });

            it('suggests high confidentiality for client data (GDPR)', () => {
                const asset: Partial<Asset> = {
                    type: 'Données',
                    dataDetails: { dataCategory: 'Client' }
                };
                const result = AssetClassificationService.suggestClassification(asset);
                expect(result.confidentiality).toBe(Criticality.HIGH);
                expect(result.reason).toContain('GDPR');
            });

            it('suggests high confidentiality for employee data', () => {
                const asset: Partial<Asset> = {
                    type: 'Données',
                    dataDetails: { dataCategory: 'Employé' }
                };
                const result = AssetClassificationService.suggestClassification(asset);
                expect(result.confidentiality).toBe(Criticality.HIGH);
            });

            it('suggests medium confidentiality for generic data', () => {
                const asset: Partial<Asset> = {
                    type: 'Données',
                    dataDetails: {}
                };
                const result = AssetClassificationService.suggestClassification(asset);
                expect(result.confidentiality).toBe(Criticality.MEDIUM);
            });
        });

        describe('service type assets', () => {
            it('suggests high availability for services', () => {
                const asset: Partial<Asset> = { type: 'Service' };
                const result = AssetClassificationService.suggestClassification(asset);
                expect(result.availability).toBe(Criticality.HIGH);
                expect(result.reason).toContain('disponibilité');
            });

            it('suggests critical availability for high SLA services', () => {
                const asset: Partial<Asset> = {
                    type: 'Service',
                    serviceDetails: { sla: '99.9% uptime' }
                };
                const result = AssetClassificationService.suggestClassification(asset);
                expect(result.availability).toBe(Criticality.CRITICAL);
                expect(result.reason).toContain('SLA');
            });
        });

        describe('hardware type assets', () => {
            it('suggests medium for generic hardware', () => {
                const asset: Partial<Asset> = { type: 'Matériel', name: 'Desktop PC' };
                const result = AssetClassificationService.suggestClassification(asset);
                expect(result.availability).toBe(Criticality.MEDIUM);
                expect(result.integrity).toBe(Criticality.MEDIUM);
            });

            it('suggests high for servers', () => {
                const asset: Partial<Asset> = { type: 'Matériel', name: 'Production Server' };
                const result = AssetClassificationService.suggestClassification(asset);
                expect(result.availability).toBe(Criticality.HIGH);
                expect(result.reason).toContain('Serveur');
            });

            it('suggests high for serveur (French)', () => {
                const asset: Partial<Asset> = { type: 'Matériel', name: 'Serveur Web' };
                const result = AssetClassificationService.suggestClassification(asset);
                expect(result.availability).toBe(Criticality.HIGH);
            });

            it('suggests critical for firewall', () => {
                const asset: Partial<Asset> = { type: 'Matériel', name: 'Main Firewall' };
                const result = AssetClassificationService.suggestClassification(asset);
                expect(result.availability).toBe(Criticality.CRITICAL);
                expect(result.reason).toContain('réseau critique');
            });

            it('suggests critical for router', () => {
                const asset: Partial<Asset> = { type: 'Matériel', name: 'Core Router' };
                const result = AssetClassificationService.suggestClassification(asset);
                expect(result.availability).toBe(Criticality.CRITICAL);
            });

            it('suggests higher rating for datacenter location', () => {
                const asset: Partial<Asset> = {
                    type: 'Matériel',
                    name: 'NAS Storage',
                    location: 'Datacenter Paris'
                };
                const result = AssetClassificationService.suggestClassification(asset);
                expect(result.reason).toContain('Datacenter');
            });

            it('suggests higher rating for expensive equipment', () => {
                const asset: Partial<Asset> = {
                    type: 'Matériel',
                    name: 'Basic Equipment',
                    purchasePrice: 10000
                };
                const result = AssetClassificationService.suggestClassification(asset);
                expect(result.reason).toContain('Valeur matérielle');
            });
        });

        describe('human type assets', () => {
            it('suggests high for human assets', () => {
                const asset: Partial<Asset> = { type: 'Humain' };
                const result = AssetClassificationService.suggestClassification(asset);
                expect(result.availability).toBe(Criticality.HIGH);
                expect(result.integrity).toBe(Criticality.HIGH);
                expect(result.reason).toContain('Humain');
            });
        });

        describe('scope-based classification', () => {
            it('suggests critical for HDS scope', () => {
                const asset: Partial<Asset> = {
                    type: 'Données',
                    scope: ['HDS']
                };
                const result = AssetClassificationService.suggestClassification(asset);
                expect(result.confidentiality).toBe(Criticality.CRITICAL);
                expect(result.integrity).toBe(Criticality.CRITICAL);
                expect(result.availability).toBe(Criticality.CRITICAL);
                expect(result.reason).toContain('HDS');
            });

            it('suggests high for PCI-DSS scope', () => {
                const asset: Partial<Asset> = {
                    type: 'Service',
                    scope: ['PCI_DSS']
                };
                const result = AssetClassificationService.suggestClassification(asset);
                expect(result.confidentiality).toBe(Criticality.CRITICAL);
                expect(result.integrity).toBe(Criticality.HIGH);
                expect(result.reason).toContain('PCI-DSS');
            });
        });

        it('returns default classification for empty asset', () => {
            const result = AssetClassificationService.suggestClassification({});
            expect(result.confidentiality).toBe(Criticality.LOW);
            expect(result.integrity).toBe(Criticality.LOW);
            expect(result.availability).toBe(Criticality.LOW);
            expect(result.reason).toBe('Classification par défaut.');
        });
    });

    describe('checkRiskImpactConsistency', () => {
        const createAsset = (overrides: Partial<Asset> = {}): Asset => ({
            id: 'asset-1',
            name: 'Test Asset',
            type: 'Données',
            description: 'Test',
            confidentiality: Criticality.MEDIUM,
            integrity: Criticality.MEDIUM,
            availability: Criticality.MEDIUM,
            organizationId: 'org-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides
        });

        const createRisk = (overrides: Partial<Risk> = {}): Risk => ({
            id: 'risk-1',
            assetId: 'asset-1',
            threat: 'Test Threat',
            vulnerability: 'Test Vulnerability',
            probability: 3,
            impact: 2 as 1 | 2 | 3 | 4 | 5,
            score: 6,
            status: 'Ouvert',
            strategy: 'Atténuer',
            owner: 'Owner',
            organizationId: 'org-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides
        });

        it('returns empty array when no risks need updating', () => {
            const asset = createAsset({ confidentiality: Criticality.MEDIUM });
            const risks = [createRisk({ impact: 3 })];

            const result = AssetClassificationService.checkRiskImpactConsistency(asset, risks);
            expect(result).toEqual([]);
        });

        it('suggests increased impact when risk impact is too low', () => {
            const asset = createAsset({
                confidentiality: Criticality.CRITICAL,
                integrity: Criticality.CRITICAL,
                availability: Criticality.CRITICAL
            });
            const risks = [createRisk({ impact: 1 })];

            const result = AssetClassificationService.checkRiskImpactConsistency(asset, risks);
            expect(result.length).toBe(1);
            expect(result[0].impact).toBeGreaterThan(1);
        });

        it('includes justification for updated risks', () => {
            const asset = createAsset({
                name: 'Critical Asset',
                confidentiality: Criticality.CRITICAL
            });
            const risks = [createRisk({ impact: 2 })];

            const result = AssetClassificationService.checkRiskImpactConsistency(asset, risks);
            expect(result.length).toBe(1);
            expect(result[0].justification).toContain('Critical Asset');
        });

        it('handles multiple risks', () => {
            const asset = createAsset({ confidentiality: Criticality.CRITICAL });
            const risks = [
                createRisk({ id: 'risk-1', impact: 1 }),
                createRisk({ id: 'risk-2', impact: 2 }),
                createRisk({ id: 'risk-3', impact: 4 }) // This one shouldn't need update
            ];

            const result = AssetClassificationService.checkRiskImpactConsistency(asset, risks);
            expect(result.length).toBe(2);
            expect(result.map(r => r.id)).toContain('risk-1');
            expect(result.map(r => r.id)).toContain('risk-2');
            expect(result.map(r => r.id)).not.toContain('risk-3');
        });

        it('uses highest CIA rating for comparison', () => {
            const asset = createAsset({
                confidentiality: Criticality.LOW,
                integrity: Criticality.LOW,
                availability: Criticality.CRITICAL
            });
            const risks = [createRisk({ impact: 1 })];

            const result = AssetClassificationService.checkRiskImpactConsistency(asset, risks);
            expect(result.length).toBe(1);
            // Critical = 5, so impact should be at least 4
            expect(result[0].impact).toBeGreaterThanOrEqual(4);
        });
    });
});
