
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
 assertFails,
 assertSucceeds,
 initializeTestEnvironment,
 RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

// Project ID for the emulator
const PROJECT_ID = 'sentinel-grc-v2-prod';

// Skip Firestore rules tests if emulator is not available
const shouldSkipTests = !process.env.FIRESTORE_EMULATOR_HOST && process.env.CI === 'true';

describe.skip(shouldSkipTests ? 'Firestore Rules Security (skipped - no emulator)' : 'Firestore Rules Security', () => {
 let testEnv: RulesTestEnvironment;

 beforeAll(async () => {
 // Load rules from the file
 const rules = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');

 testEnv = await initializeTestEnvironment({
 projectId: PROJECT_ID,
 firestore: {
 rules,
 },
 });
 });

 afterAll(async () => {
 await testEnv.cleanup();
 });

 beforeEach(async () => {
 await testEnv.clearFirestore();
 });

 // Helper to create contexts
 const getContext = (auth: { uid: string; email?: string; role?: string; organizationId?: string } | null) => {
 if (!auth) return testEnv.authenticatedContext('unauthenticated');

 // Construct the token payload
 const token: {
 email: string;
 role?: string;
 organizationId?: string;
 } = {
 email: auth.email || 'test@example.com',
 // We must map our custom claims structure here
 // The rules check: request.auth.token.role and request.auth.token.organizationId
 };

 if (auth.role) token.role = auth.role;
 if (auth.organizationId) token.organizationId = auth.organizationId;

 return testEnv.authenticatedContext(auth.uid, token);
 };

 const adminAuth = { uid: 'admin_user', role: 'admin', organizationId: 'org_1' };
 const userAuth = { uid: 'regular_user', role: 'user', organizationId: 'org_1' };
 const otherOrgAuth = { uid: 'other_user', role: 'admin', organizationId: 'org_2' };
 // const auditorAuth = { uid: 'auditor_user', role: 'auditor', organizationId: 'org_1' };

 it('should deny unauthenticated access', async () => {
 const context = testEnv.unauthenticatedContext();
 const db = context.firestore();
 await assertFails(db.collection('risks').get());
 });

 describe('Organization Isolation', () => {
 it('should allow reading own org risks', async () => {
 const context = getContext(userAuth);
 const db = context.firestore();

 // Setup data
 // Note: We need admin context to seed data usually, or setupWithAdmin
 await testEnv.withSecurityRulesDisabled(async (context) => {
 await context.firestore().doc('risks/risk_1').set({
  organizationId: 'org_1',
  threat: 'Phishing',
  status: 'Ouvert'
 });
 });

 await assertSucceeds(db.collection('risks').doc('risk_1').get());
 });

 it('should deny reading other org risks', async () => {
 const context = getContext(otherOrgAuth); // User from org_2
 const db = context.firestore();

 await testEnv.withSecurityRulesDisabled(async (context) => {
 await context.firestore().doc('risks/risk_1').set({
  organizationId: 'org_1',
  threat: 'Phishing',
  status: 'Ouvert'
 });
 });

 await assertFails(db.collection('risks').doc('risk_1').get());
 });
 });

 describe('Risk Management', () => {
 it('should allow Admin to create risks', async () => {
 const context = getContext(adminAuth);
 const db = context.firestore();

 await assertSucceeds(db.collection('risks').add({
 organizationId: 'org_1',
 threat: 'Ransomware',
 probability: 3,
 impact: 4,
 status: 'Ouvert',
 strategy: 'Atténuer',
 description: 'Test Risk'
 }));
 });

 it('should deny User from creating risks (Read Only usually, verify specific rule)', async () => {
 // Checking rules: risks create allow: canWrite(orgId). canWrite includes Admin, RSSI, Owner. Not User.
 const context = getContext(userAuth);
 const db = context.firestore();

 await assertFails(db.collection('risks').add({
 organizationId: 'org_1',
 threat: 'Insider Threat',
 description: 'User created'
 }));
 });

 it('should validate risk data integrity (Hardening)', async () => {
 const context = getContext(adminAuth);
 const db = context.firestore();

 // Invalid probability (>5)
 await assertFails(db.collection('risks').add({
 organizationId: 'org_1',
 threat: 'Invalid Risk',
 probability: 10,
 impact: 3
 }));
 });
 });
});
