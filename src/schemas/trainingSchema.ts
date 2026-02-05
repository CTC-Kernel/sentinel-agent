import { z } from 'zod';
import i18n from '../i18n';

// ============================================================================
// Training Schema - NIS2 Article 21.2(g)
// ============================================================================

/**
 * Training category enum
 */
export const trainingCategorySchema = z.enum(['security', 'compliance', 'awareness', 'technical'], {
 message: i18n.t('validation.required'),
});

/**
 * Training source enum
 */
export const trainingSourceSchema = z.enum(['anssi', 'cnil', 'internal', 'external'], {
 message: i18n.t('validation.required'),
});

/**
 * Training content type enum
 */
export const trainingContentTypeSchema = z.enum(['video', 'document', 'quiz', 'external_link'], {
 message: i18n.t('validation.required'),
});

/**
 * Assignment status enum
 */
export const assignmentStatusSchema = z.enum(['assigned', 'in_progress', 'completed', 'overdue']);

/**
 * Campaign status enum
 */
export const campaignStatusSchema = z.enum(['draft', 'active', 'completed', 'cancelled']);

/**
 * Campaign scope enum
 */
export const campaignScopeSchema = z.enum(['all', 'department', 'role']);

/**
 * Recurrence frequency enum
 */
export const recurrenceFrequencySchema = z.enum(['monthly', 'quarterly', 'yearly']);

// ============================================================================
// Training Content Schema
// ============================================================================

export const trainingContentSchema = z.object({
 type: trainingContentTypeSchema,
 url: z.string().url(i18n.t('validation.url')).optional().or(z.literal('')),
 quizId: z.string().optional(),
}).refine(
 (data) => {
 // URL required for video, document, external_link
 if (['video', 'document', 'external_link'].includes(data.type)) {
 return !!data.url && data.url.length > 0;
 }
 // quizId required for quiz
 if (data.type === 'quiz') {
 return !!data.quizId && data.quizId.length > 0;
 }
 return true;
 },
 { message: i18n.t('training.validation.contentRequired') }
);

// ============================================================================
// Framework Mapping Schema
// ============================================================================

export const frameworkMappingSchema = z.object({
 nis2: z.array(z.string()).optional(),
 iso27001: z.array(z.string()).optional(),
 dora: z.array(z.string()).optional(),
 rgpd: z.array(z.string()).optional(),
}).optional();

// ============================================================================
// Training Course Schema
// ============================================================================

export const trainingCourseSchema = z.object({
 title: z
 .string()
 .trim()
 .min(3, i18n.t('validation.minLength', { min: 3 }))
 .max(100, i18n.t('validation.maxLength', { max: 100 })),
 description: z
 .string()
 .trim()
 .min(10, i18n.t('validation.minLength', { min: 10 }))
 .max(5000, i18n.t('validation.maxLength', { max: 5000 })),
 category: trainingCategorySchema,
 source: trainingSourceSchema,
 duration: z
 .coerce
 .number()
 .int()
 .min(1, i18n.t('validation.min', { min: 1 }))
 .max(480, i18n.t('validation.max', { max: 480 })), // Max 8 hours
 isRequired: z.boolean().default(false),
 targetRoles: z.array(z.string()).default([]),
 content: trainingContentSchema,
 frameworkMappings: frameworkMappingSchema,
});

export type TrainingCourseFormData = z.infer<typeof trainingCourseSchema>;

// ============================================================================
// Training Assignment Schema
// ============================================================================

export const trainingAssignmentSchema = z.object({
 userId: z.string().min(1, i18n.t('validation.required')),
 courseId: z.string().min(1, i18n.t('validation.required')),
 dueDate: z.coerce.date().refine(
 (date) => date > new Date(),
 { message: i18n.t('training.validation.dueDateFuture') }
 ),
 campaignId: z.string().optional(),
});

export type TrainingAssignmentFormData = z.infer<typeof trainingAssignmentSchema>;

// ============================================================================
// Batch Assignment Schema
// ============================================================================

export const batchAssignmentSchema = z.object({
 userIds: z.array(z.string()).min(1, i18n.t('training.validation.selectUsers')),
 courseId: z.string().min(1, i18n.t('validation.required')),
 dueDate: z.coerce.date().refine(
 (date) => date > new Date(),
 { message: i18n.t('training.validation.dueDateFuture') }
 ),
});

export type BatchAssignmentFormData = z.infer<typeof batchAssignmentSchema>;

// ============================================================================
// Campaign Recurrence Schema
// ============================================================================

export const campaignRecurrenceSchema = z.object({
 enabled: z.boolean(),
 frequency: recurrenceFrequencySchema,
}).optional();

// ============================================================================
// Training Campaign Schema
// ============================================================================

export const trainingCampaignSchema = z.object({
 name: z
 .string()
 .trim()
 .min(3, i18n.t('validation.minLength', { min: 3 }))
 .max(100, i18n.t('validation.maxLength', { max: 100 })),
 description: z
 .string()
 .trim()
 .max(1000, i18n.t('validation.maxLength', { max: 1000 }))
 .optional(),
 startDate: z.date(),
 endDate: z.date(),
 scope: campaignScopeSchema,
 scopeFilter: z.array(z.string()).optional(),
 courseIds: z.array(z.string()).min(1, i18n.t('training.validation.selectCourses')),
 recurrence: campaignRecurrenceSchema,
}).refine(
 (data) => data.endDate > data.startDate,
 { message: i18n.t('training.validation.endDateAfterStart'), path: ['endDate'] }
).refine(
 (data) => {
 // scopeFilter required if scope is not 'all'
 if (data.scope !== 'all') {
 return data.scopeFilter && data.scopeFilter.length > 0;
 }
 return true;
 },
 { message: i18n.t('training.validation.scopeFilterRequired'), path: ['scopeFilter'] }
);

export type TrainingCampaignFormData = z.infer<typeof trainingCampaignSchema>;

// ============================================================================
// Assignment Completion Schema
// ============================================================================

export const assignmentCompletionSchema = z.object({
 assignmentId: z.string().min(1),
 score: z.coerce.number().min(0).max(100).optional(),
 timeSpent: z.coerce.number().min(0).optional(),
});

export type AssignmentCompletionData = z.infer<typeof assignmentCompletionSchema>;
