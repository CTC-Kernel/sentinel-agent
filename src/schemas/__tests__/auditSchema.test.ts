/**
 * Unit tests for auditSchema.ts
 * Tests validation of audit forms
 */

import { describe, it, expect } from 'vitest';
import { auditSchema } from '../auditSchema';

describe('auditSchema', () => {
 const validAudit = {
 name: 'Annual Security Audit 2024',
 type: 'Interne' as const,
 auditor: 'External Auditor Inc.',
 dateScheduled: '2024-03-15',
 status: 'Planifié' as const
 };

 describe('required fields', () => {
 it('accepts valid audit data', () => {
 const result = auditSchema.safeParse(validAudit);
 expect(result.success).toBe(true);
 });

 it('rejects missing name', () => {
 const { name: _name, ...data } = validAudit;
 const result = auditSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty name', () => {
 const result = auditSchema.safeParse({ ...validAudit, name: '' });
 expect(result.success).toBe(false);
 });

 it('rejects missing type', () => {
 const { type: _type, ...data } = validAudit;
 const result = auditSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing auditor', () => {
 const { auditor: _auditor, ...data } = validAudit;
 const result = auditSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty auditor', () => {
 const result = auditSchema.safeParse({ ...validAudit, auditor: '' });
 expect(result.success).toBe(false);
 });

 it('rejects missing dateScheduled', () => {
 const { dateScheduled: _dateScheduled, ...data } = validAudit;
 const result = auditSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty dateScheduled', () => {
 const result = auditSchema.safeParse({ ...validAudit, dateScheduled: '' });
 expect(result.success).toBe(false);
 });

 it('rejects missing status', () => {
 const { status: _status, ...data } = validAudit;
 const result = auditSchema.safeParse(data);
 expect(result.success).toBe(false);
 });
 });

 describe('field length constraints', () => {
 it('rejects name longer than 200 characters', () => {
 const result = auditSchema.safeParse({ ...validAudit, name: 'a'.repeat(201) });
 expect(result.success).toBe(false);
 });

 it('accepts name at max length (200)', () => {
 const result = auditSchema.safeParse({ ...validAudit, name: 'a'.repeat(200) });
 expect(result.success).toBe(true);
 });

 it('rejects auditor longer than 100 characters', () => {
 const result = auditSchema.safeParse({ ...validAudit, auditor: 'a'.repeat(101) });
 expect(result.success).toBe(false);
 });

 it('accepts auditor at max length (100)', () => {
 const result = auditSchema.safeParse({ ...validAudit, auditor: 'a'.repeat(100) });
 expect(result.success).toBe(true);
 });

 it('rejects description longer than 5000 characters', () => {
 const result = auditSchema.safeParse({
 ...validAudit,
 description: 'a'.repeat(5001)
 });
 expect(result.success).toBe(false);
 });

 it('rejects scope longer than 5000 characters', () => {
 const result = auditSchema.safeParse({
 ...validAudit,
 scope: 'a'.repeat(5001)
 });
 expect(result.success).toBe(false);
 });
 });

 describe('type validation', () => {
 it.each(['Interne', 'Externe', 'Certification', 'Fournisseur'] as const)(
 'accepts valid type: %s',
 (type) => {
 const result = auditSchema.safeParse({ ...validAudit, type });
 expect(result.success).toBe(true);
 }
 );

 it('rejects invalid type', () => {
 const result = auditSchema.safeParse({ ...validAudit, type: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('status validation', () => {
 it.each(['Planifié', 'En cours', 'Terminé', 'Validé'] as const)(
 'accepts valid status: %s',
 (status) => {
 const result = auditSchema.safeParse({ ...validAudit, status });
 expect(result.success).toBe(true);
 }
 );

 it('rejects invalid status', () => {
 const result = auditSchema.safeParse({ ...validAudit, status: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('framework validation', () => {
 it.each(['ISO27001', 'ISO27005', 'NIS2', 'DORA', 'GDPR', 'SOC2', 'HDS', 'PCI_DSS'] as const)(
 'accepts valid framework: %s',
 (framework) => {
 const result = auditSchema.safeParse({ ...validAudit, framework });
 expect(result.success).toBe(true);
 }
 );

 it('accepts undefined framework', () => {
 const result = auditSchema.safeParse(validAudit);
 expect(result.success).toBe(true);
 });

 it('rejects invalid framework', () => {
 const result = auditSchema.safeParse({ ...validAudit, framework: 'INVALID' });
 expect(result.success).toBe(false);
 });
 });

 describe('related IDs arrays', () => {
 it('accepts related asset IDs', () => {
 const result = auditSchema.safeParse({
 ...validAudit,
 relatedAssetIds: ['asset-1', 'asset-2', 'asset-3']
 });
 expect(result.success).toBe(true);
 });

 it('accepts related risk IDs', () => {
 const result = auditSchema.safeParse({
 ...validAudit,
 relatedRiskIds: ['risk-1', 'risk-2']
 });
 expect(result.success).toBe(true);
 });

 it('accepts related control IDs', () => {
 const result = auditSchema.safeParse({
 ...validAudit,
 relatedControlIds: ['ctrl-1', 'ctrl-2', 'ctrl-3']
 });
 expect(result.success).toBe(true);
 });

 it('accepts related project IDs', () => {
 const result = auditSchema.safeParse({
 ...validAudit,
 relatedProjectIds: ['proj-1']
 });
 expect(result.success).toBe(true);
 });

 it('accepts empty arrays', () => {
 const result = auditSchema.safeParse({
 ...validAudit,
 relatedAssetIds: [],
 relatedRiskIds: [],
 relatedControlIds: [],
 relatedProjectIds: []
 });
 expect(result.success).toBe(true);
 });
 });

 describe('optional fields', () => {
 it('accepts all optional fields', () => {
 const result = auditSchema.safeParse({
 ...validAudit,
 description: 'Comprehensive security audit',
 scope: 'All IT systems and processes',
 framework: 'ISO27001',
 relatedAssetIds: ['asset-1'],
 relatedRiskIds: ['risk-1'],
 relatedControlIds: ['ctrl-1'],
 relatedProjectIds: ['proj-1']
 });
 expect(result.success).toBe(true);
 });
 });

 describe('whitespace trimming', () => {
 it('trims whitespace from name', () => {
 const result = auditSchema.safeParse({
 ...validAudit,
 name: ' Audit Name '
 });
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.name).toBe('Audit Name');
 }
 });

 it('trims whitespace from auditor', () => {
 const result = auditSchema.safeParse({
 ...validAudit,
 auditor: ' Auditor Name '
 });
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.auditor).toBe('Auditor Name');
 }
 });

 it('trims whitespace from description', () => {
 const result = auditSchema.safeParse({
 ...validAudit,
 description: ' Description '
 });
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.description).toBe('Description');
 }
 });

 it('trims whitespace from scope', () => {
 const result = auditSchema.safeParse({
 ...validAudit,
 scope: ' Scope '
 });
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.scope).toBe('Scope');
 }
 });
 });
});
