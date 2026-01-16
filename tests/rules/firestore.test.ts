
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import { describe, it, beforeAll, beforeEach, afterAll } from 'vitest';

const PROJECT_ID = 'sentinel-grc-test';
const FIRESTORE_RULES = fs.readFileSync('firestore.rules', 'utf8');

describe('Firestore Security Rules', () => {
    let testEnv: RulesTestEnvironment;

    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId: PROJECT_ID,
            firestore: {
                rules: FIRESTORE_RULES,
                host: '127.0.0.1',
                port: 8085,
            },
        });
    });

    beforeEach(async () => {
        await testEnv.clearFirestore();
    });

    afterAll(async () => {
        await testEnv.cleanup();
    });

    it('should allow everyone to read', async () => {
        // This is a dummy test to verify setup. 
        // Based on our rules, read is restricted. 
        // Let's test checking if unauthenticated user can read an org.
        const unauthedDb = testEnv.unauthenticatedContext().firestore();
        await assertFails(unauthedDb.collection('organizations').doc('org1').get());
    });

    describe('Organization Collection', () => {
        it('should allow authenticated users to create an organization if they own it', async () => {
            const userId = 'user123';
            const db = testEnv.authenticatedContext(userId).firestore();

            await assertSucceeds(
                db.collection('organizations').doc('org1').set({
                    ownerId: userId,
                    name: 'My Org'
                })
            );
        });

        it('should deny creating an organization for another user', async () => {
            const userId = 'user123';
            const db = testEnv.authenticatedContext(userId).firestore();

            await assertFails(
                db.collection('organizations').doc('org1').set({
                    ownerId: 'otherUser',
                    name: 'My Org'
                })
            );
        });

        it('should allow members to read their organization', async () => {
            // Setup: Create org first (as system/admin logic or bypass) or simulate existing data
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await context.firestore().collection('organizations').doc('org1').set({
                    ownerId: 'owner1',
                    name: 'Test Org'
                });
            });

            // User belongs to org1
            const db = testEnv.authenticatedContext('user1', { organizationId: 'org1' }).firestore();
            await assertSucceeds(db.collection('organizations').doc('org1').get());
        });

        it('should deny non-members from reading an organization', async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await context.firestore().collection('organizations').doc('org1').set({
                    ownerId: 'owner1',
                    name: 'Test Org'
                });
            });

            // User belongs to org2
            const db = testEnv.authenticatedContext('user2', { organizationId: 'org2' }).firestore();
            await assertFails(db.collection('organizations').doc('org1').get());
        });
    });

    describe('Users Collection', () => {
        it('should allow user to read their own profile', async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await context.firestore().collection('users').doc('user1').set({
                    email: 'user1@example.com',
                    organizationId: 'org1'
                });
            });
            const db = testEnv.authenticatedContext('user1', { organizationId: 'org1' }).firestore();
            await assertSucceeds(db.collection('users').doc('user1').get());
        });

        it('should deny user from updating their role', async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await context.firestore().collection('users').doc('user1').set({
                    role: 'user',
                    organizationId: 'org1'
                });
            });
            const db = testEnv.authenticatedContext('user1', { organizationId: 'org1', role: 'user' }).firestore();
            // Attempt to upgrade self to admin
            await assertFails(db.collection('users').doc('user1').update({ role: 'admin' }));
        });

        it('should allow admin to update other users in org', async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await context.firestore().collection('users').doc('user2').set({
                    role: 'user',
                    organizationId: 'org1'
                });
            });
            const db = testEnv.authenticatedContext('admin1', { organizationId: 'org1', role: 'admin' }).firestore();
            await assertSucceeds(db.collection('users').doc('user2').update({ role: 'manager' }));
        });
    });

    describe('Projects Collection', () => {
        const projectData = {
            organizationId: 'org1',
            name: 'ISO 27001 Implementation',
            description: 'Main project'
        };

        it('should allow Project Manager to create project', async () => {
            const db = testEnv.authenticatedContext('pm1', { organizationId: 'org1', role: 'project_manager' }).firestore();
            await assertSucceeds(db.collection('projects').add(projectData));
        });

        it('should allow Members to read projects', async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await context.firestore().collection('projects').doc('p1').set(projectData);
            });
            const db = testEnv.authenticatedContext('user1', { organizationId: 'org1' }).firestore();
            await assertSucceeds(db.collection('projects').doc('p1').get());
        });

        it('should deny regular User from creating project', async () => {
            const db = testEnv.authenticatedContext('user1', { organizationId: 'org1', role: 'user' }).firestore();
            await assertFails(db.collection('projects').add(projectData));
        });
    });

    describe('Suppliers Collection', () => {
        const supplierData = {
            organizationId: 'org1',
            name: 'AWS',
            category: 'Hébergement',
            criticality: 'Critique'
        };

        it('should allow Admin to create supplier', async () => {
            const db = testEnv.authenticatedContext('admin1', { organizationId: 'org1', role: 'admin' }).firestore();
            await assertSucceeds(db.collection('suppliers').add(supplierData));
        });

        it('should fail if invalid category', async () => {
            const db = testEnv.authenticatedContext('admin1', { organizationId: 'org1', role: 'admin' }).firestore();
            await assertFails(db.collection('suppliers').add({
                ...supplierData,
                category: 'INVALID_CATEGORY'
            }));
        });
    });

    describe('Business Processes Collection', () => {
        const processData = {
            organizationId: 'org1',
            name: 'HR Recruitment',
            status: 'Actif'
        };

        it('should allow members to read business processes', async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await context.firestore().collection('business_processes').doc('bp1').set(processData);
            });
            const db = testEnv.authenticatedContext('user1', { organizationId: 'org1' }).firestore();
            await assertSucceeds(db.collection('business_processes').doc('bp1').get());
        });

        it('should deny cross-tenant read', async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await context.firestore().collection('business_processes').doc('bp1').set(processData);
            });
            const db = testEnv.authenticatedContext('user2', { organizationId: 'org2' }).firestore();
            await assertFails(db.collection('business_processes').doc('bp1').get());
        });
    });

    describe('BCP Drills Collection', () => {
        const drillData = {
            organizationId: 'org1',
            name: 'Fire Drill 2025',
            status: 'Planned'
        };

        it('should allow Admin to create drill', async () => {
            const db = testEnv.authenticatedContext('admin1', { organizationId: 'org1', role: 'admin' }).firestore();
            await assertSucceeds(db.collection('bcp_drills').add(drillData));
        });

        it('should deny regular User from creating drill', async () => {
            const db = testEnv.authenticatedContext('user1', { organizationId: 'org1', role: 'user' }).firestore();
            await assertFails(db.collection('bcp_drills').add(drillData));
        });
    });

    describe('Risks Collection', () => {
        const riskData = {
            organizationId: 'org1',
            threat: 'Data Breach',
            probability: 3,
            impact: 4,
            status: 'Ouvert',
            strategy: 'Atténuer'
        };

        it('should allow members to read risks', async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await context.firestore().collection('risks').doc('risk1').set(riskData);
            });

            const db = testEnv.authenticatedContext('user1', { organizationId: 'org1' }).firestore();
            await assertSucceeds(db.collection('risks').doc('risk1').get());
        });

        it('should deny non-members from reading risks', async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await context.firestore().collection('risks').doc('risk1').set(riskData);
            });

            const db = testEnv.authenticatedContext('user2', { organizationId: 'org2' }).firestore();
            await assertFails(db.collection('risks').doc('risk1').get());
        });

        it('should allow admin to create risk', async () => {
            const db = testEnv.authenticatedContext('admin1', { organizationId: 'org1', role: 'admin' }).firestore();
            await assertSucceeds(db.collection('risks').add(riskData));
        });

        it('should deny user read-only to create risk (if verify write generic)', async () => {
            // Standard user role 'user' might not have 'canWrite' (admin/rssi/owner)
            // Let's check logic: canWrite = admin || rssi || owner.
            // So a regular 'user' role should fail.
            const db = testEnv.authenticatedContext('user1', { organizationId: 'org1', role: 'user' }).firestore();
            await assertFails(db.collection('risks').add(riskData));
        });
    });

    describe('Incidents Collection', () => {
        const incidentData = {
            organizationId: 'org1',
            title: 'Phishing Attack',
            severity: 'Critique',
            status: 'Nouveau'
        };

        it('should allow any user in org to create incident', async () => {
            // Logic: canWrite || isUser(). So regular user CAN report incident.
            const db = testEnv.authenticatedContext('user1', { organizationId: 'org1', role: 'user' }).firestore();
            await assertSucceeds(db.collection('incidents').add(incidentData));
        });

        it('should allow admin to update incident', async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await context.firestore().collection('incidents').doc('inc1').set(incidentData);
            });

            const db = testEnv.authenticatedContext('admin1', { organizationId: 'org1', role: 'admin' }).firestore();
            await assertSucceeds(db.collection('incidents').doc('inc1').update({ status: 'Résolu' }));
        });
    });

    describe('Controls Collection', () => {
        const controlData = {
            organizationId: 'org1',
            text: 'MFA',
            status: 'Implemented'
        };

        it('should allow members to read controls', async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await context.firestore().collection('controls').doc('c1').set(controlData);
            });
            const db = testEnv.authenticatedContext('user1', { organizationId: 'org1' }).firestore();
            await assertSucceeds(db.collection('controls').doc('c1').get());
        });

        it('should allow admin/RSSI to create control', async () => {
            const db = testEnv.authenticatedContext('rssi1', { organizationId: 'org1', role: 'rssi' }).firestore();
            await assertSucceeds(db.collection('controls').add(controlData));
        });

        // Example logic: Project Manager can update
        it('should allow Project Manager to update control', async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await context.firestore().collection('controls').doc('c1').set(controlData);
            });
            const db = testEnv.authenticatedContext('pm1', { organizationId: 'org1', role: 'project_manager' }).firestore();
            await assertSucceeds(db.collection('controls').doc('c1').update({ status: 'Review' }));
        });
    });

    describe('Audits Collection', () => {
        const auditData = {
            organizationId: 'org1',
            status: 'Planned'
        };

        it('should allow external auditors to read if listed', async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await context.firestore().collection('audits').doc('audit1').set({
                    ...auditData,
                    externalAuditors: ['ext@auditor.com']
                });
            });

            // Simulating external auditor auth
            const db = testEnv.authenticatedContext('extUser', { email: 'ext@auditor.com' }).firestore();
            await assertSucceeds(db.collection('audits').doc('audit1').get());
        });

        it('should deny external auditors read if NOT listed', async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await context.firestore().collection('audits').doc('audit1').set({
                    ...auditData,
                    externalAuditors: ['other@auditor.com']
                });
            });

            const db = testEnv.authenticatedContext('extUser', { email: 'ext@auditor.com' }).firestore();
            await assertFails(db.collection('audits').doc('audit1').get());
        });
    });
});
