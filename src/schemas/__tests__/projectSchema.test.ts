/**
 * Unit tests for projectSchema.ts
 * Tests validation of project and task forms
 */

import { describe, it, expect, vi } from 'vitest';
import { projectSchema, projectTaskSchema, templateFormSchema } from '../projectSchema';

// Mock i18n
vi.mock('../../i18n', () => ({
 default: {
 t: (key: string, params?: Record<string, unknown>) => {
 const translations: Record<string, string> = {
 'validation.required': 'Ce champ est requis',
 'validation.maxLength': `Maximum ${params?.max} caractères`,
 'validation.positive': 'Doit être positif'
 };
 return translations[key] || key;
 }
 }
}));

describe('projectSchema', () => {
 const validProject = {
 name: 'Security Implementation Project',
 description: 'A comprehensive security improvement initiative',
 manager: 'John Doe',
 managerId: 'user-123'
 };

 describe('required fields', () => {
 it('accepts valid project data', () => {
 const result = projectSchema.safeParse(validProject);
 expect(result.success).toBe(true);
 });

 it('rejects missing name', () => {
 const { name: _name, ...data } = validProject;
 const result = projectSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty name', () => {
 const result = projectSchema.safeParse({ ...validProject, name: '' });
 expect(result.success).toBe(false);
 });

 it('rejects missing description', () => {
 const { description: _description, ...data } = validProject;
 const result = projectSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty description', () => {
 const result = projectSchema.safeParse({ ...validProject, description: '' });
 expect(result.success).toBe(false);
 });

 it('rejects missing manager', () => {
 const { manager: _manager, ...data } = validProject;
 const result = projectSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty manager', () => {
 const result = projectSchema.safeParse({ ...validProject, manager: '' });
 expect(result.success).toBe(false);
 });

 it('rejects missing managerId', () => {
 const { managerId: _managerId, ...data } = validProject;
 const result = projectSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty managerId', () => {
 const result = projectSchema.safeParse({ ...validProject, managerId: '' });
 expect(result.success).toBe(false);
 });
 });

 describe('field length constraints', () => {
 it('rejects name longer than 200 characters', () => {
 const result = projectSchema.safeParse({ ...validProject, name: 'a'.repeat(201) });
 expect(result.success).toBe(false);
 });

 it('accepts name at max length (200)', () => {
 const result = projectSchema.safeParse({ ...validProject, name: 'a'.repeat(200) });
 expect(result.success).toBe(true);
 });

 it('rejects description longer than 5000 characters', () => {
 const result = projectSchema.safeParse({
 ...validProject,
 description: 'a'.repeat(5001)
 });
 expect(result.success).toBe(false);
 });
 });

 describe('status validation', () => {
 it.each(['Planifié', 'En cours', 'Terminé', 'Suspendu'] as const)(
 'accepts valid status: %s',
 (status) => {
 const result = projectSchema.safeParse({ ...validProject, status });
 expect(result.success).toBe(true);
 }
 );

 it('defaults to Planifié', () => {
 const result = projectSchema.safeParse(validProject);
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.status).toBe('Planifié');
 }
 });

 it('rejects invalid status', () => {
 const result = projectSchema.safeParse({ ...validProject, status: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('framework validation', () => {
 it.each(['ISO27001', 'ISO27005', 'ISO22301', 'NIS2', 'DORA', 'GDPR', 'SOC2', 'HDS'] as const)(
 'accepts valid framework: %s',
 (framework) => {
 const result = projectSchema.safeParse({ ...validProject, framework });
 expect(result.success).toBe(true);
 }
 );

 it('accepts undefined framework', () => {
 const result = projectSchema.safeParse(validProject);
 expect(result.success).toBe(true);
 });

 it('rejects invalid framework', () => {
 const result = projectSchema.safeParse({ ...validProject, framework: 'INVALID' });
 expect(result.success).toBe(false);
 });
 });

 describe('date validation', () => {
 it('accepts valid date format (YYYY-MM-DD)', () => {
 const result = projectSchema.safeParse({
 ...validProject,
 dueDate: '2024-12-31'
 });
 expect(result.success).toBe(true);
 });

 it('accepts undefined dueDate', () => {
 const result = projectSchema.safeParse(validProject);
 expect(result.success).toBe(true);
 });

 it('rejects invalid date format', () => {
 const result = projectSchema.safeParse({
 ...validProject,
 dueDate: '31/12/2024'
 });
 expect(result.success).toBe(false);
 });

 it('rejects malformed date', () => {
 const result = projectSchema.safeParse({
 ...validProject,
 dueDate: '2024-1-1'
 });
 expect(result.success).toBe(false);
 });
 });

 describe('related IDs arrays', () => {
 it('accepts related risk IDs', () => {
 const result = projectSchema.safeParse({
 ...validProject,
 relatedRiskIds: ['risk-1', 'risk-2']
 });
 expect(result.success).toBe(true);
 });

 it('accepts related control IDs', () => {
 const result = projectSchema.safeParse({
 ...validProject,
 relatedControlIds: ['ctrl-1', 'ctrl-2']
 });
 expect(result.success).toBe(true);
 });

 it('accepts related asset IDs', () => {
 const result = projectSchema.safeParse({
 ...validProject,
 relatedAssetIds: ['asset-1', 'asset-2']
 });
 expect(result.success).toBe(true);
 });

 it('accepts related audit IDs', () => {
 const result = projectSchema.safeParse({
 ...validProject,
 relatedAuditIds: ['audit-1']
 });
 expect(result.success).toBe(true);
 });

 it('accepts members array', () => {
 const result = projectSchema.safeParse({
 ...validProject,
 members: ['user-1', 'user-2', 'user-3']
 });
 expect(result.success).toBe(true);
 });

 it('defaults arrays to empty', () => {
 const result = projectSchema.safeParse(validProject);
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.relatedRiskIds).toEqual([]);
 expect(result.data.relatedControlIds).toEqual([]);
 expect(result.data.relatedAssetIds).toEqual([]);
 expect(result.data.relatedAuditIds).toEqual([]);
 expect(result.data.members).toEqual([]);
 }
 });
 });

 describe('whitespace trimming', () => {
 it('trims whitespace from name', () => {
 const result = projectSchema.safeParse({
 ...validProject,
 name: ' Project Name '
 });
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.name).toBe('Project Name');
 }
 });

 it('trims whitespace from description', () => {
 const result = projectSchema.safeParse({
 ...validProject,
 description: ' Description '
 });
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.description).toBe('Description');
 }
 });

 it('trims whitespace from manager', () => {
 const result = projectSchema.safeParse({
 ...validProject,
 manager: ' Manager Name '
 });
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.manager).toBe('Manager Name');
 }
 });
 });
});

describe('projectTaskSchema', () => {
 const validTask = {
 title: 'Implementation Task'
 };

 describe('required fields', () => {
 it('accepts valid task with title only', () => {
 const result = projectTaskSchema.safeParse(validTask);
 expect(result.success).toBe(true);
 });

 it('rejects missing title', () => {
 const result = projectTaskSchema.safeParse({});
 expect(result.success).toBe(false);
 });

 it('rejects empty title', () => {
 const result = projectTaskSchema.safeParse({ title: '' });
 expect(result.success).toBe(false);
 });
 });

 describe('status validation', () => {
 it.each(['À faire', 'En cours', 'Terminé', 'Bloqué'] as const)(
 'accepts valid status: %s',
 (status) => {
 const result = projectTaskSchema.safeParse({ ...validTask, status });
 expect(result.success).toBe(true);
 }
 );

 it('defaults to À faire', () => {
 const result = projectTaskSchema.safeParse(validTask);
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.status).toBe('À faire');
 }
 });

 it('rejects invalid status', () => {
 const result = projectTaskSchema.safeParse({ ...validTask, status: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('priority validation', () => {
 it.each(['low', 'medium', 'high'] as const)(
 'accepts valid priority: %s',
 (priority) => {
 const result = projectTaskSchema.safeParse({ ...validTask, priority });
 expect(result.success).toBe(true);
 }
 );

 it('defaults to medium', () => {
 const result = projectTaskSchema.safeParse(validTask);
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.priority).toBe('medium');
 }
 });
 });

 describe('numeric fields', () => {
 it('accepts valid estimated hours', () => {
 const result = projectTaskSchema.safeParse({ ...validTask, estimatedHours: 8 });
 expect(result.success).toBe(true);
 });

 it('rejects negative estimated hours', () => {
 const result = projectTaskSchema.safeParse({ ...validTask, estimatedHours: -1 });
 expect(result.success).toBe(false);
 });

 it('accepts zero estimated hours', () => {
 const result = projectTaskSchema.safeParse({ ...validTask, estimatedHours: 0 });
 expect(result.success).toBe(true);
 });

 it('accepts valid actual hours', () => {
 const result = projectTaskSchema.safeParse({ ...validTask, actualHours: 10 });
 expect(result.success).toBe(true);
 });

 it('rejects negative actual hours', () => {
 const result = projectTaskSchema.safeParse({ ...validTask, actualHours: -5 });
 expect(result.success).toBe(false);
 });

 it('validates progress between 0 and 100', () => {
 const validResult = projectTaskSchema.safeParse({ ...validTask, progress: 50 });
 expect(validResult.success).toBe(true);

 const tooLow = projectTaskSchema.safeParse({ ...validTask, progress: -1 });
 expect(tooLow.success).toBe(false);

 const tooHigh = projectTaskSchema.safeParse({ ...validTask, progress: 101 });
 expect(tooHigh.success).toBe(false);
 });

 it('defaults progress to 0', () => {
 const result = projectTaskSchema.safeParse(validTask);
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.progress).toBe(0);
 }
 });
 });

 describe('dependencies array', () => {
 it('accepts dependencies array', () => {
 const result = projectTaskSchema.safeParse({
 ...validTask,
 dependencies: ['task-1', 'task-2']
 });
 expect(result.success).toBe(true);
 });

 it('defaults dependencies to empty array', () => {
 const result = projectTaskSchema.safeParse(validTask);
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.dependencies).toEqual([]);
 }
 });
 });

 describe('optional fields', () => {
 it('accepts all optional fields', () => {
 const result = projectTaskSchema.safeParse({
 ...validTask,
 description: 'Task description',
 assignee: 'John Doe',
 assigneeId: 'user-123',
 startDate: '2024-01-01',
 dueDate: '2024-01-15'
 });
 expect(result.success).toBe(true);
 });
 });
});

describe('templateFormSchema', () => {
 const validTemplate = {
 projectName: 'New Project',
 startDate: '2024-01-01',
 managerId: 'user-123'
 };

 describe('required fields', () => {
 it('accepts valid template data', () => {
 const result = templateFormSchema.safeParse(validTemplate);
 expect(result.success).toBe(true);
 });

 it('rejects missing projectName', () => {
 const { projectName: _projectName, ...data } = validTemplate;
 const result = templateFormSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty projectName', () => {
 const result = templateFormSchema.safeParse({ ...validTemplate, projectName: '' });
 expect(result.success).toBe(false);
 });

 it('rejects missing startDate', () => {
 const { startDate: _startDate, ...data } = validTemplate;
 const result = templateFormSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty startDate', () => {
 const result = templateFormSchema.safeParse({ ...validTemplate, startDate: '' });
 expect(result.success).toBe(false);
 });

 it('rejects missing managerId', () => {
 const { managerId: _managerId, ...data } = validTemplate;
 const result = templateFormSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty managerId', () => {
 const result = templateFormSchema.safeParse({ ...validTemplate, managerId: '' });
 expect(result.success).toBe(false);
 });
 });
});
