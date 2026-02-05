/**
 * DORA Module Zod Validation Schemas
 * ADR-008: ICT Provider Management for DORA Art. 28 compliance
 */

import { z } from 'zod';
import i18n from '../i18n';
import {
 ICT_CRITICALITY_LEVELS,
 ICT_SERVICE_TYPES,
 SUBSTITUTABILITY_LEVELS
} from '../types/dora';

/**
 * ICT Service schema
 */
export const ictServiceSchema = z.object({
 id: z.string(),
 name: z.string().trim()
 .min(1, i18n.t('dora.validation.service_name_required'))
 .max(200, i18n.t('validation.maxLength', { max: 200 })),
 type: z.enum(ICT_SERVICE_TYPES),
 criticality: z.enum(ICT_CRITICALITY_LEVELS),
 description: z.string().trim().max(1000).optional(),
 businessFunctions: z.array(z.string()).max(50).default([]),
 dataProcessed: z.boolean().optional(),
});

/**
 * Contract info schema
 */
export const ictContractInfoSchema = z.object({
 startDate: z.string().min(1, i18n.t('dora.validation.contract_start_required')),
 endDate: z.string().min(1, i18n.t('dora.validation.contract_end_required')),
 exitStrategy: z.string().trim().max(5000).optional(),
 auditRights: z.boolean().default(false),
 contractValue: z.number().min(0).optional(),
 currency: z.string().max(3).optional(),
 renewalType: z.enum(['auto', 'manual', 'fixed']).optional(),
 noticePeriodDays: z.number().min(0).max(365).optional(),
});

/**
 * Risk assessment schema
 */
export const ictRiskAssessmentSchema = z.object({
 concentration: z.number().min(0).max(100).default(0),
 substitutability: z.enum(SUBSTITUTABILITY_LEVELS).default('medium'),
 lastAssessment: z.string().optional(),
 assessedBy: z.string().optional(),
 notes: z.string().trim().max(2000).optional(),
});

/**
 * Subcontractor schema
 */
export const ictSubcontractorSchema = z.object({
 id: z.string(),
 name: z.string().trim().min(1).max(200),
 service: z.string().trim().max(200),
 locationEU: z.boolean().default(true),
});

/**
 * Compliance info schema
 */
export const ictComplianceInfoSchema = z.object({
 doraCompliant: z.boolean().default(false),
 certifications: z.array(z.string()).max(20).default([]),
 locationEU: z.boolean().default(true),
 headquartersCountry: z.string().max(100).optional(),
 dataProcessingLocations: z.array(z.string()).max(20).optional(),
 subcontractors: z.array(ictSubcontractorSchema).max(50).optional(),
});

/**
 * Main ICT Provider schema for form validation
 */
export const ictProviderSchema = z.object({
 // Basic Information
 name: z.string().trim()
 .min(1, i18n.t('dora.validation.name_required'))
 .max(200, i18n.t('validation.maxLength', { max: 200 })),
 category: z.enum(ICT_CRITICALITY_LEVELS, {
 message: i18n.t('dora.validation.category_required')
 }),
 description: z.string().trim().max(5000).optional(),

 // Services
 services: z.array(ictServiceSchema).min(1, i18n.t('dora.validation.services_required')).max(100),

 // Contract
 contractInfo: ictContractInfoSchema,

 // Risk Assessment
 riskAssessment: ictRiskAssessmentSchema.optional(),

 // Compliance
 compliance: ictComplianceInfoSchema,

 // Contact Information
 contactName: z.string().trim().max(200).optional(),
 contactEmail: z.string().trim()
 .max(254)
 .refine(
 (val) => !val || val === '' || z.string().email().safeParse(val).success,
 { message: i18n.t('validation.email_invalid') }
 )
 .optional(),
 contactPhone: z.string().trim().max(50).optional(),
 website: z.string().trim()
 .max(500)
 .refine(
 (val) => !val || val === '' || z.string().url().safeParse(val).success,
 { message: i18n.t('validation.url_invalid') }
 )
 .optional(),

 // Relationships
 linkedAssetIds: z.array(z.string()).max(100).optional(),
 linkedRiskIds: z.array(z.string()).max(100).optional(),
 linkedControlIds: z.array(z.string()).max(100).optional(),

 // Status
 status: z.enum(['active', 'inactive', 'pending', 'terminated']).default('active'),
}).refine((data) => {
 // Critical providers must have exit strategy
 if (data.category === 'critical' && (!data.contractInfo.exitStrategy || data.contractInfo.exitStrategy.trim().length < 10)) {
 return false;
 }
 return true;
}, {
 message: i18n.t('dora.validation.exit_strategy_required_critical'),
 path: ['contractInfo', 'exitStrategy']
}).refine((data) => {
 // Contract end date must be after start date
 if (data.contractInfo.startDate && data.contractInfo.endDate) {
 return new Date(data.contractInfo.endDate) > new Date(data.contractInfo.startDate);
 }
 return true;
}, {
 message: i18n.t('dora.validation.end_date_after_start'),
 path: ['contractInfo', 'endDate']
});

/**
 * Draft ICT Provider schema (relaxed validation for drafts)
 */
export const ictProviderDraftSchema = z.object({
 name: z.string().trim().min(1, i18n.t('dora.validation.name_required')).max(200),
 category: z.enum(ICT_CRITICALITY_LEVELS).optional(),
 description: z.string().trim().max(5000).optional(),
 services: z.array(ictServiceSchema).max(100).optional(),
 contractInfo: ictContractInfoSchema.partial().optional(),
 riskAssessment: ictRiskAssessmentSchema.optional(),
 compliance: ictComplianceInfoSchema.partial().optional(),
 contactName: z.string().trim().max(200).optional(),
 contactEmail: z.string().trim().max(254).optional(),
 contactPhone: z.string().trim().max(50).optional(),
 website: z.string().trim().max(500).optional(),
 linkedAssetIds: z.array(z.string()).max(100).optional(),
 linkedRiskIds: z.array(z.string()).max(100).optional(),
 linkedControlIds: z.array(z.string()).max(100).optional(),
 status: z.enum(['active', 'inactive', 'pending', 'terminated']).optional(),
});

/**
 * ICT Provider import row schema (for CSV validation)
 */
export const ictProviderImportSchema = z.object({
 name: z.string().trim().min(1).max(200),
 category: z.string().trim().transform((val) => {
 const lower = val.toLowerCase();
 if (['critical', 'critique', 'kritisch'].includes(lower)) return 'critical';
 if (['important', 'importante', 'wichtig'].includes(lower)) return 'important';
 return 'standard';
 }),
 services: z.string().optional(),
 contractStartDate: z.string().optional(),
 contractEndDate: z.string().optional(),
 exitStrategy: z.string().optional(),
 auditRights: z.string().optional().transform((val) => {
 if (!val) return false;
 return ['true', 'yes', 'oui', '1'].includes(val.toLowerCase());
 }),
 doraCompliant: z.string().optional().transform((val) => {
 if (!val) return false;
 return ['true', 'yes', 'oui', '1'].includes(val.toLowerCase());
 }),
 certifications: z.string().optional(),
 locationEU: z.string().optional().transform((val) => {
 if (!val) return true;
 return ['true', 'yes', 'oui', '1', 'eu', 'europe'].includes(val.toLowerCase());
 }),
 contactName: z.string().optional(),
 contactEmail: z.string().optional(),
});

/**
 * Form-specific type with string dates (not Firestore timestamps)
 * This ensures compatibility with react-hook-form and Zod validation
 */
export type ICTProviderFormData = z.infer<typeof ictProviderSchema>;

export type ICTProviderDraftData = z.infer<typeof ictProviderDraftSchema>;
export type ICTProviderImportData = z.infer<typeof ictProviderImportSchema>;
