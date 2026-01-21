/**
 * Unit tests for mockDataService
 * Tests mock data generation for various collections
 */

import { describe, it, expect } from 'vitest';
import { MockDataService } from '../mockDataService';

describe('MockDataService', () => {
    describe('getCollection', () => {
        describe('risks collection', () => {
            it('returns array of risks', () => {
                const risks = MockDataService.getCollection('risks');

                expect(Array.isArray(risks)).toBe(true);
                expect(risks.length).toBeGreaterThan(0);
            });

            it('each risk has required properties', () => {
                const risks = MockDataService.getCollection('risks');

                risks.forEach(risk => {
                    expect(risk.id).toBeDefined();
                    expect(risk.threat).toBeDefined();
                    expect(risk.probability).toBeDefined();
                    expect(risk.impact).toBeDefined();
                    expect(risk.score).toBeDefined();
                    expect(risk.status).toBeDefined();
                });
            });
        });

        describe('assets collection', () => {
            it('returns array of assets', () => {
                const assets = MockDataService.getCollection('assets');

                expect(Array.isArray(assets)).toBe(true);
                expect(assets.length).toBeGreaterThan(0);
            });

            it('each asset has required properties', () => {
                const assets = MockDataService.getCollection('assets');

                assets.forEach(asset => {
                    expect(asset.id).toBeDefined();
                    expect(asset.name).toBeDefined();
                    expect(asset.type).toBeDefined();
                });
            });
        });

        describe('incidents collection', () => {
            it('returns array of incidents', () => {
                const incidents = MockDataService.getCollection('incidents');

                expect(Array.isArray(incidents)).toBe(true);
                expect(incidents.length).toBeGreaterThan(0);
            });
        });

        describe('controls collection', () => {
            it('returns array of controls', () => {
                const controls = MockDataService.getCollection('controls');

                expect(Array.isArray(controls)).toBe(true);
                expect(controls.length).toBeGreaterThan(0);
            });

            it('each control has ISO code', () => {
                const controls = MockDataService.getCollection('controls');

                controls.forEach(control => {
                    expect(control.code).toMatch(/^A\.\d+/);
                });
            });
        });

        describe('documents collection', () => {
            it('returns array of documents', () => {
                const documents = MockDataService.getCollection('documents');

                expect(Array.isArray(documents)).toBe(true);
                expect(documents.length).toBeGreaterThan(0);
            });
        });

        describe('projects collection', () => {
            it('returns array of projects', () => {
                const projects = MockDataService.getCollection('projects');

                expect(Array.isArray(projects)).toBe(true);
                expect(projects.length).toBeGreaterThan(0);
            });
        });

        describe('suppliers collection', () => {
            it('returns array of suppliers', () => {
                const suppliers = MockDataService.getCollection('suppliers');

                expect(Array.isArray(suppliers)).toBe(true);
                expect(suppliers.length).toBeGreaterThan(0);
            });
        });

        describe('business_processes collection', () => {
            it('returns array of business processes', () => {
                const processes = MockDataService.getCollection('business_processes');

                expect(Array.isArray(processes)).toBe(true);
                expect(processes.length).toBeGreaterThan(0);
            });
        });

        describe('audits collection', () => {
            it('returns array of audits', () => {
                const audits = MockDataService.getCollection('audits');

                expect(Array.isArray(audits)).toBe(true);
                expect(audits.length).toBeGreaterThan(0);
            });
        });

        describe('system_logs collection', () => {
            it('returns array of system logs', () => {
                const logs = MockDataService.getCollection('system_logs');

                expect(Array.isArray(logs)).toBe(true);
                expect(logs.length).toBeGreaterThan(0);
            });
        });

        describe('vulnerabilities collection', () => {
            it('returns array of vulnerabilities', () => {
                const vulns = MockDataService.getCollection('vulnerabilities');

                expect(Array.isArray(vulns)).toBe(true);
                expect(vulns.length).toBeGreaterThan(0);
            });

            it('vulnerabilities have CVE IDs', () => {
                const vulns = MockDataService.getCollection('vulnerabilities');

                vulns.forEach(vuln => {
                    expect(vuln.cveId).toMatch(/^CVE-/);
                });
            });
        });

        describe('threats collection', () => {
            it('returns array of threats', () => {
                const threats = MockDataService.getCollection('threats');

                expect(Array.isArray(threats)).toBe(true);
                expect(threats.length).toBeGreaterThan(0);
            });
        });

        describe('threat_library collection', () => {
            it('returns array of threat library items', () => {
                const threatLib = MockDataService.getCollection('threat_library');

                expect(Array.isArray(threatLib)).toBe(true);
                expect(threatLib.length).toBeGreaterThan(0);
            });

            it('each threat library item has required properties', () => {
                const threatLib = MockDataService.getCollection('threat_library');

                threatLib.forEach(item => {
                    expect(item.id).toBeDefined();
                    expect(item.name).toBeDefined();
                    expect(item.type).toBeDefined();
                    expect(item.severity).toBeDefined();
                });
            });
        });

        describe('users collection', () => {
            it('returns array of users', () => {
                const users = MockDataService.getCollection('users');

                expect(Array.isArray(users)).toBe(true);
                expect(users.length).toBeGreaterThan(0);
            });

            it('each user has email and role', () => {
                const users = MockDataService.getCollection('users');

                users.forEach(user => {
                    expect(user.email).toBeDefined();
                    expect(user.role).toBeDefined();
                });
            });
        });

        describe('bcp_drills collection', () => {
            it('returns array of BCP drills', () => {
                const drills = MockDataService.getCollection('bcp_drills');

                expect(Array.isArray(drills)).toBe(true);
                expect(drills.length).toBeGreaterThan(0);
            });
        });

        describe('threat_intelligence collection', () => {
            it('returns array of threat intelligence items', () => {
                const ti = MockDataService.getCollection('threat_intelligence');

                expect(Array.isArray(ti)).toBe(true);
                expect(ti.length).toBeGreaterThan(0);
            });
        });

        describe('backups collection', () => {
            it('returns array of backups', () => {
                const backups = MockDataService.getCollection('backups');

                expect(Array.isArray(backups)).toBe(true);
                expect(backups.length).toBeGreaterThan(0);
            });
        });

        describe('unknown collection', () => {
            it('returns empty array for unknown collection', () => {
                const unknown = MockDataService.getCollection('unknown_collection');

                expect(unknown).toEqual([]);
            });
        });
    });

    describe('getDocument', () => {
        it('returns document by id', () => {
            const risk = MockDataService.getDocument('risks', 'risk-1');

            expect(risk).not.toBeNull();
            expect(risk?.id).toBe('risk-1');
        });

        it('returns null for non-existent document', () => {
            const result = MockDataService.getDocument('risks', 'non-existent-id');

            expect(result).toBeNull();
        });

        it('returns null for unknown collection', () => {
            const result = MockDataService.getDocument('unknown', 'any-id');

            expect(result).toBeNull();
        });

        it('can retrieve asset by id', () => {
            const asset = MockDataService.getDocument('assets', 'asset-1');

            expect(asset).not.toBeNull();
            expect(asset?.id).toBe('asset-1');
        });

        it('can retrieve user by id', () => {
            const user = MockDataService.getDocument('users', 'user-1');

            expect(user).not.toBeNull();
            expect(user?.id).toBe('user-1');
        });
    });
});
