/**
 * Unit tests for supplierSchema.ts
 * Tests validation of supplier forms
 */

import { describe, it, expect } from 'vitest';
import { supplierSchema } from '../supplierSchema';
import { Criticality } from '../../types';

describe('supplierSchema', () => {
 const validSupplier = {
 name: 'Cloud Provider Inc.',
 category: 'SaaS' as const,
 criticality: Criticality.HIGH,
 status: 'Actif' as const
 };

 describe('required fields', () => {
 it('accepts valid supplier data', () => {
 const result = supplierSchema.safeParse(validSupplier);
 expect(result.success).toBe(true);
 });

 it('rejects missing name', () => {
 const { name: _name, ...data } = validSupplier;
 const result = supplierSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty name', () => {
 const result = supplierSchema.safeParse({ ...validSupplier, name: '' });
 expect(result.success).toBe(false);
 });

 it('rejects missing category', () => {
 const { category: _category, ...data } = validSupplier;
 const result = supplierSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing criticality', () => {
 const { criticality: _criticality, ...data } = validSupplier;
 const result = supplierSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing status', () => {
 const { status: _status, ...data } = validSupplier;
 const result = supplierSchema.safeParse(data);
 expect(result.success).toBe(false);
 });
 });

 describe('field length constraints', () => {
 it('rejects name longer than 200 characters', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 name: 'a'.repeat(201)
 });
 expect(result.success).toBe(false);
 });

 it('accepts name at max length (200)', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 name: 'a'.repeat(200)
 });
 expect(result.success).toBe(true);
 });

 it('rejects contact name longer than 100 characters', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 contactName: 'a'.repeat(101)
 });
 expect(result.success).toBe(false);
 });

 it('rejects description longer than 5000 characters', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 description: 'a'.repeat(5001)
 });
 expect(result.success).toBe(false);
 });

 it('rejects owner longer than 100 characters', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 owner: 'a'.repeat(101)
 });
 expect(result.success).toBe(false);
 });

 it('rejects VAT number longer than 50 characters', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 vatNumber: 'a'.repeat(51)
 });
 expect(result.success).toBe(false);
 });
 });

 describe('category validation', () => {
 it.each(['SaaS', 'Hébergement', 'Matériel', 'Consulting', 'Autre'] as const)(
 'accepts valid category: %s',
 (category) => {
 const result = supplierSchema.safeParse({ ...validSupplier, category });
 expect(result.success).toBe(true);
 }
 );

 it('rejects invalid category', () => {
 const result = supplierSchema.safeParse({ ...validSupplier, category: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('criticality validation', () => {
 it.each(Object.values(Criticality))(
 'accepts valid criticality: %s',
 (criticality) => {
 const result = supplierSchema.safeParse({ ...validSupplier, criticality });
 expect(result.success).toBe(true);
 }
 );

 it('rejects invalid criticality', () => {
 const result = supplierSchema.safeParse({ ...validSupplier, criticality: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('status validation', () => {
 it.each(['Actif', 'En cours', 'Terminé', 'Suspendu'] as const)(
 'accepts valid status: %s',
 (status) => {
 const result = supplierSchema.safeParse({ ...validSupplier, status });
 expect(result.success).toBe(true);
 }
 );

 it('rejects invalid status', () => {
 const result = supplierSchema.safeParse({ ...validSupplier, status: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('contact email validation', () => {
 it('accepts valid email', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 contactEmail: 'contact@supplier.com'
 });
 expect(result.success).toBe(true);
 });

 it('accepts empty email', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 contactEmail: ''
 });
 expect(result.success).toBe(true);
 });

 it('accepts undefined email', () => {
 const result = supplierSchema.safeParse(validSupplier);
 expect(result.success).toBe(true);
 });

 it('rejects invalid email format', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 contactEmail: 'invalid-email'
 });
 expect(result.success).toBe(false);
 });
 });

 describe('security score validation', () => {
 it('accepts score within range (0-100)', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 securityScore: 85
 });
 expect(result.success).toBe(true);
 });

 it('accepts zero score', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 securityScore: 0
 });
 expect(result.success).toBe(true);
 });

 it('accepts max score (100)', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 securityScore: 100
 });
 expect(result.success).toBe(true);
 });

 it('rejects score below 0', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 securityScore: -1
 });
 expect(result.success).toBe(false);
 });

 it('rejects score above 100', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 securityScore: 101
 });
 expect(result.success).toBe(false);
 });
 });

 describe('assessment validation', () => {
 it('accepts valid assessment object', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 assessment: {
  hasIso27001: true,
  hasGdprPolicy: true,
  hasEncryption: true,
  hasBcp: false,
  hasIncidentProcess: true,
  lastAssessmentDate: '2024-01-15'
 }
 });
 expect(result.success).toBe(true);
 });

 it('accepts partial assessment object', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 assessment: {
  hasIso27001: true
 }
 });
 expect(result.success).toBe(true);
 });

 it('accepts empty assessment object', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 assessment: {}
 });
 expect(result.success).toBe(true);
 });
 });

 describe('DORA fields validation', () => {
 it('accepts DORA contract clauses', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 doraContractClauses: {
  auditRights: true,
  slaDefined: true,
  dataLocation: true,
  subcontractingConditions: false,
  incidentNotification: true,
  exitStrategy: false
 }
 });
 expect(result.success).toBe(true);
 });

 it('accepts isICTProvider boolean', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 isICTProvider: true
 });
 expect(result.success).toBe(true);
 });

 it('accepts supportsCriticalFunction boolean', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 supportsCriticalFunction: true
 });
 expect(result.success).toBe(true);
 });

 it('validates DORA criticality enum', () => {
 const validResult = supplierSchema.safeParse({
 ...validSupplier,
 doraCriticality: 'Critique'
 });
 expect(validResult.success).toBe(true);

 const invalidResult = supplierSchema.safeParse({
 ...validSupplier,
 doraCriticality: 'Invalid'
 });
 expect(invalidResult.success).toBe(false);
 });

 it.each(['Aucun', 'Important', 'Critique'] as const)(
 'accepts valid DORA criticality: %s',
 (criticality) => {
 const result = supplierSchema.safeParse({
  ...validSupplier,
  doraCriticality: criticality
 });
 expect(result.success).toBe(true);
 }
 );

 it('validates service type enum', () => {
 const validResult = supplierSchema.safeParse({
 ...validSupplier,
 serviceType: 'Cloud'
 });
 expect(validResult.success).toBe(true);
 });

 it.each(['SaaS', 'Cloud', 'Software', 'Hardware', 'Consulting', 'Network', 'Security'] as const)(
 'accepts valid service type: %s',
 (type) => {
 const result = supplierSchema.safeParse({
  ...validSupplier,
  serviceType: type
 });
 expect(result.success).toBe(true);
 }
 );
 });

 describe('related IDs arrays with max limits', () => {
 it('accepts supported process IDs up to limit', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 supportedProcessIds: Array(50).fill('process-id')
 });
 expect(result.success).toBe(true);
 });

 it('rejects supported process IDs over limit', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 supportedProcessIds: Array(51).fill('process-id')
 });
 expect(result.success).toBe(false);
 });

 it('accepts related asset IDs up to limit', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 relatedAssetIds: Array(100).fill('asset-id')
 });
 expect(result.success).toBe(true);
 });

 it('rejects related asset IDs over limit', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 relatedAssetIds: Array(101).fill('asset-id')
 });
 expect(result.success).toBe(false);
 });

 it('accepts related risk IDs up to limit', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 relatedRiskIds: Array(100).fill('risk-id')
 });
 expect(result.success).toBe(true);
 });

 it('rejects related risk IDs over limit', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 relatedRiskIds: Array(101).fill('risk-id')
 });
 expect(result.success).toBe(false);
 });

 it('accepts related project IDs up to limit', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 relatedProjectIds: Array(50).fill('project-id')
 });
 expect(result.success).toBe(true);
 });

 it('rejects related project IDs over limit', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 relatedProjectIds: Array(51).fill('project-id')
 });
 expect(result.success).toBe(false);
 });
 });

 describe('optional fields', () => {
 it('accepts all optional fields', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 contactName: 'John Doe',
 contactEmail: 'john@supplier.com',
 vatNumber: 'FR12345678901',
 owner: 'IT Department',
 ownerId: 'user-123',
 description: 'Main cloud service provider',
 contractDocumentId: 'doc-456',
 contractEnd: '2025-12-31'
 });
 expect(result.success).toBe(true);
 });
 });

 describe('whitespace trimming', () => {
 it('trims whitespace from name', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 name: ' Supplier Name '
 });
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.name).toBe('Supplier Name');
 }
 });

 it('trims whitespace from contact name', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 contactName: ' Contact Name '
 });
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.contactName).toBe('Contact Name');
 }
 });

 it('trims whitespace from contact email', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 contactEmail: ' test@example.com '
 });
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.contactEmail).toBe('test@example.com');
 }
 });

 it('trims whitespace from description', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 description: ' Description '
 });
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.description).toBe('Description');
 }
 });

 it('trims whitespace from VAT number', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 vatNumber: ' FR123 '
 });
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.vatNumber).toBe('FR123');
 }
 });

 it('trims whitespace from owner', () => {
 const result = supplierSchema.safeParse({
 ...validSupplier,
 owner: ' Owner '
 });
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.owner).toBe('Owner');
 }
 });
 });
});
