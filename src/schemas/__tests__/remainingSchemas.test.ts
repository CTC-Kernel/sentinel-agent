/**
 * Unit tests for remaining schemas
 * - findingSchema
 * - userSchema
 * - onboardingSchema
 * - backupSchema
 * - assessmentSchema
 * - tlptSchema
 * - treatmentActionSchema
 * - vulnerabilitySchema
 * - controlSchema
 * - privacySchema
 */

import { describe, it, expect } from 'vitest';
import { findingSchema } from '../findingSchema';
import { userSchema } from '../userSchema';
import { onboardingSchema } from '../onboardingSchema';
import { backupConfigSchema, restoreConfigSchema } from '../backupSchema';
import { assessmentSchema } from '../assessmentSchema';
import { tlptSchema } from '../tlptSchema';
import { treatmentActionSchema } from '../treatmentActionSchema';
import { vulnerabilitySchema } from '../vulnerabilitySchema';
import { controlSchema } from '../controlSchema';
import { processingActivitySchema } from '../privacySchema';

describe('findingSchema', () => {
 const validFinding = {
 description: 'A security finding that needs attention',
 type: 'Majeure' as const,
 severity: 'Haute' as const,
 status: 'Ouvert' as const
 };

 describe('required fields', () => {
 it('accepts valid finding data', () => {
 const result = findingSchema.safeParse(validFinding);
 expect(result.success).toBe(true);
 });

 it('rejects missing description', () => {
 const { description: _description, ...data } = validFinding;
 const result = findingSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects description shorter than 10 characters', () => {
 const result = findingSchema.safeParse({ ...validFinding, description: 'Short' });
 expect(result.success).toBe(false);
 });

 it('rejects missing type', () => {
 const { type: _type, ...data } = validFinding;
 const result = findingSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing severity', () => {
 const { severity: _severity, ...data } = validFinding;
 const result = findingSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing status', () => {
 const { status: _status, ...data } = validFinding;
 const result = findingSchema.safeParse(data);
 expect(result.success).toBe(false);
 });
 });

 describe('type validation', () => {
 it.each(['Majeure', 'Mineure', 'Observation', 'Opportunité'] as const)(
 'accepts valid type: %s',
 (type) => {
 const result = findingSchema.safeParse({ ...validFinding, type });
 expect(result.success).toBe(true);
 }
 );

 it('rejects invalid type', () => {
 const result = findingSchema.safeParse({ ...validFinding, type: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('severity validation', () => {
 it.each(['Critique', 'Haute', 'Moyenne', 'Faible', 'Info'] as const)(
 'accepts valid severity: %s',
 (severity) => {
 const result = findingSchema.safeParse({ ...validFinding, severity });
 expect(result.success).toBe(true);
 }
 );

 it('rejects invalid severity', () => {
 const result = findingSchema.safeParse({ ...validFinding, severity: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('status validation', () => {
 it.each(['Ouvert', 'En cours', 'Fermé', 'Accepté'] as const)(
 'accepts valid status: %s',
 (status) => {
 const result = findingSchema.safeParse({ ...validFinding, status });
 expect(result.success).toBe(true);
 }
 );

 it('rejects invalid status', () => {
 const result = findingSchema.safeParse({ ...validFinding, status: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('optional fields', () => {
 it('accepts all optional fields', () => {
 const result = findingSchema.safeParse({
 ...validFinding,
 relatedControlId: 'ctrl-123',
 evidenceIds: ['ev-1', 'ev-2'],
 ownerId: 'user-456',
 dueDate: '2024-06-30',
 recommendation: 'Implement additional controls'
 });
 expect(result.success).toBe(true);
 });

 it('rejects recommendation longer than 2000 characters', () => {
 const result = findingSchema.safeParse({
 ...validFinding,
 recommendation: 'a'.repeat(2001)
 });
 expect(result.success).toBe(false);
 });
 });
});

describe('userSchema', () => {
 const validUser = {
 email: 'user@example.com',
 role: 'rssi' as const
 };

 describe('required fields', () => {
 it('accepts valid user data', () => {
 const result = userSchema.safeParse(validUser);
 expect(result.success).toBe(true);
 });

 it('rejects missing email', () => {
 const { email: _email, ...data } = validUser;
 const result = userSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty email', () => {
 const result = userSchema.safeParse({ ...validUser, email: '' });
 expect(result.success).toBe(false);
 });

 it('rejects invalid email', () => {
 const result = userSchema.safeParse({ ...validUser, email: 'invalid' });
 expect(result.success).toBe(false);
 });

 it('rejects missing role', () => {
 const { role: _role, ...data } = validUser;
 const result = userSchema.safeParse(data);
 expect(result.success).toBe(false);
 });
 });

 describe('role validation', () => {
 it.each(['user', 'rssi', 'auditor', 'project_manager', 'direction', 'admin', 'super_admin'] as const)(
 'accepts standard role: %s',
 (role) => {
 const result = userSchema.safeParse({ ...validUser, role });
 expect(result.success).toBe(true);
 }
 );

 it('accepts custom role ID string', () => {
 const result = userSchema.safeParse({ ...validUser, role: 'custom-role-id-123' });
 expect(result.success).toBe(true);
 });
 });

 describe('optional fields', () => {
 it('accepts displayName', () => {
 const result = userSchema.safeParse({
 ...validUser,
 displayName: 'John Doe'
 });
 expect(result.success).toBe(true);
 });

 it('rejects displayName longer than 100 characters', () => {
 const result = userSchema.safeParse({
 ...validUser,
 displayName: 'a'.repeat(101)
 });
 expect(result.success).toBe(false);
 });

 it('accepts department', () => {
 const result = userSchema.safeParse({
 ...validUser,
 department: 'IT Security'
 });
 expect(result.success).toBe(true);
 });

 it('rejects department longer than 100 characters', () => {
 const result = userSchema.safeParse({
 ...validUser,
 department: 'a'.repeat(101)
 });
 expect(result.success).toBe(false);
 });
 });
});

describe('onboardingSchema', () => {
 const validOnboarding = {
 organizationName: 'Acme Corp',
 displayName: 'John Doe',
 department: 'IT Security',
 role: 'rssi' as const,
 industry: 'Technology'
 };

 describe('required fields', () => {
 it('accepts valid onboarding data', () => {
 const result = onboardingSchema.safeParse(validOnboarding);
 expect(result.success).toBe(true);
 });

 it('rejects missing organizationName', () => {
 const { organizationName: _organizationName, ...data } = validOnboarding;
 const result = onboardingSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty organizationName', () => {
 const result = onboardingSchema.safeParse({ ...validOnboarding, organizationName: '' });
 expect(result.success).toBe(false);
 });

 it('rejects missing displayName', () => {
 const { displayName: _displayName, ...data } = validOnboarding;
 const result = onboardingSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing department', () => {
 const { department: _department, ...data } = validOnboarding;
 const result = onboardingSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing role', () => {
 const { role: _role, ...data } = validOnboarding;
 const result = onboardingSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing industry', () => {
 const { industry: _industry, ...data } = validOnboarding;
 const result = onboardingSchema.safeParse(data);
 expect(result.success).toBe(false);
 });
 });

 describe('role validation', () => {
 it.each(['admin', 'rssi', 'direction', 'project_manager', 'auditor'] as const)(
 'accepts valid role: %s',
 (role) => {
 const result = onboardingSchema.safeParse({ ...validOnboarding, role });
 expect(result.success).toBe(true);
 }
 );

 it('rejects user role (not allowed in onboarding)', () => {
 const result = onboardingSchema.safeParse({ ...validOnboarding, role: 'user' });
 expect(result.success).toBe(false);
 });
 });

 describe('field length constraints', () => {
 it('rejects organizationName longer than 100 characters', () => {
 const result = onboardingSchema.safeParse({
 ...validOnboarding,
 organizationName: 'a'.repeat(101)
 });
 expect(result.success).toBe(false);
 });

 it('rejects displayName longer than 100 characters', () => {
 const result = onboardingSchema.safeParse({
 ...validOnboarding,
 displayName: 'a'.repeat(101)
 });
 expect(result.success).toBe(false);
 });

 it('rejects department longer than 100 characters', () => {
 const result = onboardingSchema.safeParse({
 ...validOnboarding,
 department: 'a'.repeat(101)
 });
 expect(result.success).toBe(false);
 });
 });
});

describe('backupSchema', () => {
 describe('backupConfigSchema', () => {
 const validConfig = {
 includeDocuments: true,
 includeAssets: true,
 includeRisks: true,
 includeControls: true,
 includeAudits: true,
 includeProjects: true,
 includeSuppliers: true,
 includeIncidents: true,
 includeUsers: false,
 includeComments: true
 };

 it('accepts valid backup config', () => {
 const result = backupConfigSchema.safeParse(validConfig);
 expect(result.success).toBe(true);
 });

 it('accepts all false values', () => {
 const result = backupConfigSchema.safeParse({
 includeDocuments: false,
 includeAssets: false,
 includeRisks: false,
 includeControls: false,
 includeAudits: false,
 includeProjects: false,
 includeSuppliers: false,
 includeIncidents: false,
 includeUsers: false,
 includeComments: false
 });
 expect(result.success).toBe(true);
 });

 it('rejects missing fields', () => {
 const { includeDocuments: _includeDocuments, ...data } = validConfig;
 const result = backupConfigSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects non-boolean values', () => {
 const result = backupConfigSchema.safeParse({
 ...validConfig,
 includeDocuments: 'yes'
 });
 expect(result.success).toBe(false);
 });
 });

 describe('restoreConfigSchema', () => {
 const validRestore = {
 backupId: 'backup-123',
 collections: ['documents', 'risks'],
 overwriteExisting: false,
 dryRun: true
 };

 it('accepts valid restore config', () => {
 const result = restoreConfigSchema.safeParse(validRestore);
 expect(result.success).toBe(true);
 });

 it('rejects missing backupId', () => {
 const { backupId: _backupId, ...data } = validRestore;
 const result = restoreConfigSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty backupId', () => {
 const result = restoreConfigSchema.safeParse({ ...validRestore, backupId: '' });
 expect(result.success).toBe(false);
 });

 it('rejects empty collections array', () => {
 const result = restoreConfigSchema.safeParse({ ...validRestore, collections: [] });
 expect(result.success).toBe(false);
 });

 it('requires at least one collection', () => {
 const result = restoreConfigSchema.safeParse({
 ...validRestore,
 collections: ['risks']
 });
 expect(result.success).toBe(true);
 });
 });
});

describe('assessmentSchema', () => {
 const validAssessment = {
 templateId: 'template-123',
 supplierId: 'supplier-456',
 supplierName: 'Vendor Inc',
 status: 'Draft' as const
 };

 describe('required fields', () => {
 it('accepts valid assessment data', () => {
 const result = assessmentSchema.safeParse(validAssessment);
 expect(result.success).toBe(true);
 });

 it('rejects missing templateId', () => {
 const { templateId: _templateId, ...data } = validAssessment;
 const result = assessmentSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty templateId', () => {
 const result = assessmentSchema.safeParse({ ...validAssessment, templateId: '' });
 expect(result.success).toBe(false);
 });

 it('rejects missing supplierId', () => {
 const { supplierId: _supplierId, ...data } = validAssessment;
 const result = assessmentSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing supplierName', () => {
 const { supplierName: _supplierName, ...data } = validAssessment;
 const result = assessmentSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing status', () => {
 const { status: _status, ...data } = validAssessment;
 const result = assessmentSchema.safeParse(data);
 expect(result.success).toBe(false);
 });
 });

 describe('status validation', () => {
 it.each(['Draft', 'Sent', 'In Progress', 'Submitted', 'Reviewed', 'Archived'] as const)(
 'accepts valid status: %s',
 (status) => {
 const result = assessmentSchema.safeParse({ ...validAssessment, status });
 expect(result.success).toBe(true);
 }
 );

 it('rejects invalid status', () => {
 const result = assessmentSchema.safeParse({ ...validAssessment, status: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('score validation', () => {
 it('accepts score within range (0-100)', () => {
 const result = assessmentSchema.safeParse({
 ...validAssessment,
 overallScore: 75
 });
 expect(result.success).toBe(true);
 });

 it('defaults overallScore to 0', () => {
 const result = assessmentSchema.safeParse(validAssessment);
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.overallScore).toBe(0);
 }
 });

 it('rejects score above 100', () => {
 const result = assessmentSchema.safeParse({
 ...validAssessment,
 overallScore: 101
 });
 expect(result.success).toBe(false);
 });

 it('rejects score below 0', () => {
 const result = assessmentSchema.safeParse({
 ...validAssessment,
 overallScore: -1
 });
 expect(result.success).toBe(false);
 });
 });

 describe('risk level validation', () => {
 it.each(['Low', 'Medium', 'High', 'Critical'] as const)(
 'accepts valid risk level: %s',
 (level) => {
 const result = assessmentSchema.safeParse({
  ...validAssessment,
  riskLevel: level
 });
 expect(result.success).toBe(true);
 }
 );

 it('accepts undefined risk level', () => {
 const result = assessmentSchema.safeParse(validAssessment);
 expect(result.success).toBe(true);
 });
 });

 describe('answers validation', () => {
 it('accepts valid answers record', () => {
 const result = assessmentSchema.safeParse({
 ...validAssessment,
 answers: {
  q1: { value: 'Yes', comment: 'Implemented' },
  q2: { value: 4 },
  q3: { value: true, evidenceUrl: 'https://evidence.com' },
  q4: { value: ['option1', 'option2'] }
 }
 });
 expect(result.success).toBe(true);
 });

 it('defaults answers to empty object', () => {
 const result = assessmentSchema.safeParse(validAssessment);
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.answers).toEqual({});
 }
 });
 });

 describe('optional fields', () => {
 it('accepts respondent email', () => {
 const result = assessmentSchema.safeParse({
 ...validAssessment,
 respondentEmail: 'vendor@supplier.com'
 });
 expect(result.success).toBe(true);
 });

 it('rejects invalid respondent email', () => {
 const result = assessmentSchema.safeParse({
 ...validAssessment,
 respondentEmail: 'invalid'
 });
 expect(result.success).toBe(false);
 });

 it('accepts due date', () => {
 const result = assessmentSchema.safeParse({
 ...validAssessment,
 dueDate: '2024-12-31'
 });
 expect(result.success).toBe(true);
 });
 });
});

describe('tlptSchema', () => {
 const validTlpt = {
 name: 'TIBER-EU Campaign 2024',
 scope: 'Critical banking infrastructure',
 methodology: 'TIBER-EU' as const,
 provider: 'Security Consulting Ltd',
 status: 'Planned' as const,
 startDate: new Date('2024-06-01')
 };

 describe('required fields', () => {
 it('accepts valid TLPT data', () => {
 const result = tlptSchema.safeParse(validTlpt);
 expect(result.success).toBe(true);
 });

 it('rejects missing name', () => {
 const { name: _name, ...data } = validTlpt;
 const result = tlptSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty name', () => {
 const result = tlptSchema.safeParse({ ...validTlpt, name: '' });
 expect(result.success).toBe(false);
 });

 it('rejects missing scope', () => {
 const { scope: _scope, ...data } = validTlpt;
 const result = tlptSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing methodology', () => {
 const { methodology: _methodology, ...data } = validTlpt;
 const result = tlptSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing provider', () => {
 const { provider: _provider, ...data } = validTlpt;
 const result = tlptSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing status', () => {
 const { status: _status, ...data } = validTlpt;
 const result = tlptSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing startDate', () => {
 const { startDate: _startDate, ...data } = validTlpt;
 const result = tlptSchema.safeParse(data);
 expect(result.success).toBe(false);
 });
 });

 describe('methodology validation', () => {
 it.each(['TIBER-EU', 'Red Team', 'Purple Team', 'Other'] as const)(
 'accepts valid methodology: %s',
 (methodology) => {
 const result = tlptSchema.safeParse({ ...validTlpt, methodology });
 expect(result.success).toBe(true);
 }
 );

 it('rejects invalid methodology', () => {
 const result = tlptSchema.safeParse({ ...validTlpt, methodology: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('status validation', () => {
 it.each(['Planned', 'In Progress', 'Analysis', 'Remediation', 'Closed'] as const)(
 'accepts valid status: %s',
 (status) => {
 const result = tlptSchema.safeParse({ ...validTlpt, status });
 expect(result.success).toBe(true);
 }
 );

 it('rejects invalid status', () => {
 const result = tlptSchema.safeParse({ ...validTlpt, status: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('field length constraints', () => {
 it('rejects name longer than 100 characters', () => {
 const result = tlptSchema.safeParse({ ...validTlpt, name: 'a'.repeat(101) });
 expect(result.success).toBe(false);
 });

 it('rejects scope longer than 500 characters', () => {
 const result = tlptSchema.safeParse({ ...validTlpt, scope: 'a'.repeat(501) });
 expect(result.success).toBe(false);
 });

 it('rejects provider longer than 100 characters', () => {
 const result = tlptSchema.safeParse({ ...validTlpt, provider: 'a'.repeat(101) });
 expect(result.success).toBe(false);
 });

 it('rejects notes longer than 2000 characters', () => {
 const result = tlptSchema.safeParse({ ...validTlpt, notes: 'a'.repeat(2001) });
 expect(result.success).toBe(false);
 });
 });

 describe('optional fields', () => {
 it('accepts end date', () => {
 const result = tlptSchema.safeParse({
 ...validTlpt,
 endDate: new Date('2024-12-31')
 });
 expect(result.success).toBe(true);
 });

 it('accepts budget', () => {
 const result = tlptSchema.safeParse({
 ...validTlpt,
 budget: 50000
 });
 expect(result.success).toBe(true);
 });

 it('rejects negative budget', () => {
 const result = tlptSchema.safeParse({
 ...validTlpt,
 budget: -1000
 });
 expect(result.success).toBe(false);
 });

 it('accepts notes', () => {
 const result = tlptSchema.safeParse({
 ...validTlpt,
 notes: 'Campaign notes and observations'
 });
 expect(result.success).toBe(true);
 });
 });
});

describe('treatmentActionSchema', () => {
 const validAction = {
 title: 'Implement MFA'
 };

 describe('required fields', () => {
 it('accepts valid action data', () => {
 const result = treatmentActionSchema.safeParse(validAction);
 expect(result.success).toBe(true);
 });

 it('rejects missing title', () => {
 const result = treatmentActionSchema.safeParse({});
 expect(result.success).toBe(false);
 });

 it('rejects empty title', () => {
 const result = treatmentActionSchema.safeParse({ title: '' });
 expect(result.success).toBe(false);
 });
 });

 describe('field length constraints', () => {
 it('rejects title longer than 200 characters', () => {
 const result = treatmentActionSchema.safeParse({ title: 'a'.repeat(201) });
 expect(result.success).toBe(false);
 });

 it('rejects description longer than 1000 characters', () => {
 const result = treatmentActionSchema.safeParse({
 ...validAction,
 description: 'a'.repeat(1001)
 });
 expect(result.success).toBe(false);
 });
 });

 describe('status validation', () => {
 it.each(['À faire', 'En cours', 'Terminé'] as const)(
 'accepts valid status: %s',
 (status) => {
 const result = treatmentActionSchema.safeParse({ ...validAction, status });
 expect(result.success).toBe(true);
 }
 );

 it('defaults to À faire', () => {
 const result = treatmentActionSchema.safeParse(validAction);
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.status).toBe('À faire');
 }
 });

 it('rejects invalid status', () => {
 const result = treatmentActionSchema.safeParse({ ...validAction, status: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('optional fields', () => {
 it('accepts all optional fields', () => {
 const result = treatmentActionSchema.safeParse({
 ...validAction,
 description: 'Detailed action description',
 ownerId: 'user-123',
 deadline: '2024-06-30'
 });
 expect(result.success).toBe(true);
 });
 });
});

describe('vulnerabilitySchema', () => {
 const validVuln = {
 title: 'SQL Injection Vulnerability',
 severity: 'High' as const,
 status: 'Open' as const
 };

 describe('required fields', () => {
 it('accepts valid vulnerability data', () => {
 const result = vulnerabilitySchema.safeParse(validVuln);
 expect(result.success).toBe(true);
 });

 it('rejects missing title', () => {
 const { title: _title, ...data } = validVuln;
 const result = vulnerabilitySchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty title', () => {
 const result = vulnerabilitySchema.safeParse({ ...validVuln, title: '' });
 expect(result.success).toBe(false);
 });

 it('rejects missing severity', () => {
 const { severity: _severity, ...data } = validVuln;
 const result = vulnerabilitySchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing status', () => {
 const { status: _status, ...data } = validVuln;
 const result = vulnerabilitySchema.safeParse(data);
 expect(result.success).toBe(false);
 });
 });

 describe('severity validation', () => {
 it.each(['Critical', 'High', 'Medium', 'Low'] as const)(
 'accepts valid severity: %s',
 (severity) => {
 const result = vulnerabilitySchema.safeParse({ ...validVuln, severity });
 expect(result.success).toBe(true);
 }
 );

 it('rejects invalid severity', () => {
 const result = vulnerabilitySchema.safeParse({ ...validVuln, severity: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('status validation', () => {
 it.each(['Open', 'In Progress', 'Resolved', 'False Positive', 'Patch Applied', 'Risk Accepted'] as const)(
 'accepts valid status: %s',
 (status) => {
 const result = vulnerabilitySchema.safeParse({ ...validVuln, status });
 expect(result.success).toBe(true);
 }
 );

 it('rejects invalid status', () => {
 const result = vulnerabilitySchema.safeParse({ ...validVuln, status: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('score validation', () => {
 it('accepts score within range (0-10)', () => {
 const result = vulnerabilitySchema.safeParse({ ...validVuln, score: 7.5 });
 expect(result.success).toBe(true);
 });

 it('accepts zero score', () => {
 const result = vulnerabilitySchema.safeParse({ ...validVuln, score: 0 });
 expect(result.success).toBe(true);
 });

 it('accepts max score (10)', () => {
 const result = vulnerabilitySchema.safeParse({ ...validVuln, score: 10 });
 expect(result.success).toBe(true);
 });

 it('rejects score above 10', () => {
 const result = vulnerabilitySchema.safeParse({ ...validVuln, score: 11 });
 expect(result.success).toBe(false);
 });

 it('rejects score below 0', () => {
 const result = vulnerabilitySchema.safeParse({ ...validVuln, score: -1 });
 expect(result.success).toBe(false);
 });
 });

 describe('field length constraints', () => {
 it('rejects title longer than 200 characters', () => {
 const result = vulnerabilitySchema.safeParse({ ...validVuln, title: 'a'.repeat(201) });
 expect(result.success).toBe(false);
 });

 it('rejects description longer than 2000 characters', () => {
 const result = vulnerabilitySchema.safeParse({
 ...validVuln,
 description: 'a'.repeat(2001)
 });
 expect(result.success).toBe(false);
 });

 it('rejects CVE ID longer than 20 characters', () => {
 const result = vulnerabilitySchema.safeParse({
 ...validVuln,
 cveId: 'a'.repeat(21)
 });
 expect(result.success).toBe(false);
 });

 it('rejects remediation plan longer than 2000 characters', () => {
 const result = vulnerabilitySchema.safeParse({
 ...validVuln,
 remediationPlan: 'a'.repeat(2001)
 });
 expect(result.success).toBe(false);
 });
 });

 describe('attachments validation', () => {
 it('accepts valid attachments array', () => {
 const result = vulnerabilitySchema.safeParse({
 ...validVuln,
 attachments: [
  {
  id: 'att-1',
  name: 'scan-report.pdf',
  url: '/attachments/scan-report.pdf',
  type: 'application/pdf',
  size: 1024,
  uploadedAt: '2024-01-15T10:00:00Z',
  uploadedBy: 'user-123',
  hash: 'sha256hash'
  }
 ]
 });
 expect(result.success).toBe(true);
 });

 it('accepts empty attachments array', () => {
 const result = vulnerabilitySchema.safeParse({ ...validVuln, attachments: [] });
 expect(result.success).toBe(true);
 });
 });

 describe('optional fields', () => {
 it('accepts all optional fields', () => {
 const result = vulnerabilitySchema.safeParse({
 ...validVuln,
 description: 'Detailed description',
 cveId: 'CVE-2024-1234',
 assetId: 'asset-123',
 remediationPlan: 'Apply patch'
 });
 expect(result.success).toBe(true);
 });
 });
});

describe('controlSchema', () => {
 const validControl = {
 code: 'A.5.1',
 name: 'Information Security Policy',
 status: 'Implémenté' as const
 };

 describe('required fields', () => {
 it('accepts valid control data', () => {
 const result = controlSchema.safeParse(validControl);
 expect(result.success).toBe(true);
 });

 it('rejects missing code', () => {
 const { code: _code, ...data } = validControl;
 const result = controlSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty code', () => {
 const result = controlSchema.safeParse({ ...validControl, code: '' });
 expect(result.success).toBe(false);
 });

 it('rejects missing name', () => {
 const { name: _name, ...data } = validControl;
 const result = controlSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty name', () => {
 const result = controlSchema.safeParse({ ...validControl, name: '' });
 expect(result.success).toBe(false);
 });

 it('rejects missing status', () => {
 const { status: _status, ...data } = validControl;
 const result = controlSchema.safeParse(data);
 expect(result.success).toBe(false);
 });
 });

 describe('code format validation', () => {
 it('accepts valid code formats', () => {
 const validCodes = ['A.5.1', 'CTRL-001', 'ISO27001_5.1', 'Test.Code-1'];
 validCodes.forEach(code => {
 const result = controlSchema.safeParse({ ...validControl, code });
 expect(result.success).toBe(true);
 });
 });

 it('rejects code with invalid characters', () => {
 const result = controlSchema.safeParse({ ...validControl, code: 'A.5.1 (test)' });
 expect(result.success).toBe(false);
 });

 it('rejects code with spaces', () => {
 const result = controlSchema.safeParse({ ...validControl, code: 'A 5 1' });
 expect(result.success).toBe(false);
 });
 });

 describe('field length constraints', () => {
 it('rejects code longer than 50 characters', () => {
 const result = controlSchema.safeParse({ ...validControl, code: 'a'.repeat(51) });
 expect(result.success).toBe(false);
 });

 it('rejects name longer than 200 characters', () => {
 const result = controlSchema.safeParse({ ...validControl, name: 'a'.repeat(201) });
 expect(result.success).toBe(false);
 });

 it('rejects description longer than 5000 characters', () => {
 const result = controlSchema.safeParse({
 ...validControl,
 description: 'a'.repeat(5001)
 });
 expect(result.success).toBe(false);
 });

 it('rejects justification longer than 2000 characters', () => {
 const result = controlSchema.safeParse({
 ...validControl,
 justification: 'a'.repeat(2001)
 });
 expect(result.success).toBe(false);
 });
 });

 describe('status validation', () => {
 const statuses = ['Non commencé', 'En cours', 'Implémenté', 'Partiel', 'Non applicable', 'Exclu', 'En revue', 'Actif', 'Inactif', 'Non conforme'] as const;

 it.each(statuses)(
 'accepts valid status: %s',
 (status) => {
 const result = controlSchema.safeParse({ ...validControl, status });
 expect(result.success).toBe(true);
 }
 );

 it('rejects invalid status', () => {
 const result = controlSchema.safeParse({ ...validControl, status: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('type validation', () => {
 it.each(['Préventif', 'Détectif', 'Correctif'] as const)(
 'accepts valid type: %s',
 (type) => {
 const result = controlSchema.safeParse({ ...validControl, type });
 expect(result.success).toBe(true);
 }
 );

 it('accepts undefined type', () => {
 const result = controlSchema.safeParse(validControl);
 expect(result.success).toBe(true);
 });
 });

 describe('applicability validation', () => {
 it.each(['Applicable', 'Non applicable'] as const)(
 'accepts valid applicability: %s',
 (applicability) => {
 const result = controlSchema.safeParse({ ...validControl, applicability });
 expect(result.success).toBe(true);
 }
 );
 });

 describe('evidence strength validation', () => {
 it.each(['Faible', 'Forte'] as const)(
 'accepts valid evidence strength: %s',
 (strength) => {
 const result = controlSchema.safeParse({ ...validControl, evidenceStrength: strength });
 expect(result.success).toBe(true);
 }
 );
 });

 describe('maturity validation', () => {
 it('accepts maturity within range (0-5)', () => {
 const result = controlSchema.safeParse({ ...validControl, maturity: 3 });
 expect(result.success).toBe(true);
 });

 it('rejects maturity above 5', () => {
 const result = controlSchema.safeParse({ ...validControl, maturity: 6 });
 expect(result.success).toBe(false);
 });

 it('rejects maturity below 0', () => {
 const result = controlSchema.safeParse({ ...validControl, maturity: -1 });
 expect(result.success).toBe(false);
 });
 });

 describe('related IDs with max limits', () => {
 it('accepts evidence IDs up to limit', () => {
 const result = controlSchema.safeParse({
 ...validControl,
 evidenceIds: Array(100).fill('evidence-id')
 });
 expect(result.success).toBe(true);
 });

 it('rejects evidence IDs over limit', () => {
 const result = controlSchema.safeParse({
 ...validControl,
 evidenceIds: Array(101).fill('evidence-id')
 });
 expect(result.success).toBe(false);
 });

 it('accepts related asset IDs up to limit', () => {
 const result = controlSchema.safeParse({
 ...validControl,
 relatedAssetIds: Array(100).fill('asset-id')
 });
 expect(result.success).toBe(true);
 });

 it('rejects related asset IDs over limit', () => {
 const result = controlSchema.safeParse({
 ...validControl,
 relatedAssetIds: Array(101).fill('asset-id')
 });
 expect(result.success).toBe(false);
 });
 });
});

describe('processingActivitySchema', () => {
 const validActivity = {
 name: 'Customer Data Processing',
 purpose: 'Processing customer orders and managing accounts',
 manager: 'Data Protection Officer',
 legalBasis: 'Contrat' as const,
 dataCategories: ['Personal', 'Financial'],
 dataSubjects: ['Customers'],
 retentionPeriod: '5 years',
 hasDPIA: true,
 status: 'Actif' as const
 };

 describe('required fields', () => {
 it('accepts valid processing activity data', () => {
 const result = processingActivitySchema.safeParse(validActivity);
 expect(result.success).toBe(true);
 });

 it('rejects missing name', () => {
 const { name: _name, ...data } = validActivity;
 const result = processingActivitySchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty name', () => {
 const result = processingActivitySchema.safeParse({ ...validActivity, name: '' });
 expect(result.success).toBe(false);
 });

 it('rejects missing purpose', () => {
 const { purpose: _purpose, ...data } = validActivity;
 const result = processingActivitySchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing manager', () => {
 const { manager: _manager, ...data } = validActivity;
 const result = processingActivitySchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing legalBasis', () => {
 const { legalBasis: _legalBasis, ...data } = validActivity;
 const result = processingActivitySchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty dataCategories', () => {
 const result = processingActivitySchema.safeParse({
 ...validActivity,
 dataCategories: []
 });
 expect(result.success).toBe(false);
 });

 it('rejects missing retentionPeriod', () => {
 const { retentionPeriod: _retentionPeriod, ...data } = validActivity;
 const result = processingActivitySchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing hasDPIA', () => {
 const { hasDPIA: _hasDPIA, ...data } = validActivity;
 const result = processingActivitySchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing status', () => {
 const { status: _status, ...data } = validActivity;
 const result = processingActivitySchema.safeParse(data);
 expect(result.success).toBe(false);
 });
 });

 describe('legal basis validation', () => {
 it.each(['Consentement', 'Contrat', 'Obligation Légale', 'Intérêt Légitime', 'Sauvegarde Intérêts', 'Mission Publique'] as const)(
 'accepts valid legal basis: %s',
 (legalBasis) => {
 const result = processingActivitySchema.safeParse({ ...validActivity, legalBasis });
 expect(result.success).toBe(true);
 }
 );

 it('rejects invalid legal basis', () => {
 const result = processingActivitySchema.safeParse({
 ...validActivity,
 legalBasis: 'Invalid'
 });
 expect(result.success).toBe(false);
 });
 });

 describe('status validation', () => {
 it.each(['Actif', 'En projet', 'Archivé'] as const)(
 'accepts valid status: %s',
 (status) => {
 const result = processingActivitySchema.safeParse({ ...validActivity, status });
 expect(result.success).toBe(true);
 }
 );

 it('rejects invalid status', () => {
 const result = processingActivitySchema.safeParse({ ...validActivity, status: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('field length constraints', () => {
 it('rejects name longer than 100 characters', () => {
 const result = processingActivitySchema.safeParse({
 ...validActivity,
 name: 'a'.repeat(101)
 });
 expect(result.success).toBe(false);
 });

 it('rejects purpose longer than 500 characters', () => {
 const result = processingActivitySchema.safeParse({
 ...validActivity,
 purpose: 'a'.repeat(501)
 });
 expect(result.success).toBe(false);
 });
 });

 describe('optional fields', () => {
 it('accepts manager ID', () => {
 const result = processingActivitySchema.safeParse({
 ...validActivity,
 managerId: 'user-123'
 });
 expect(result.success).toBe(true);
 });

 it('accepts related asset IDs', () => {
 const result = processingActivitySchema.safeParse({
 ...validActivity,
 relatedAssetIds: ['asset-1', 'asset-2']
 });
 expect(result.success).toBe(true);
 });

 it('accepts related risk IDs', () => {
 const result = processingActivitySchema.safeParse({
 ...validActivity,
 relatedRiskIds: ['risk-1']
 });
 expect(result.success).toBe(true);
 });
 });
});
