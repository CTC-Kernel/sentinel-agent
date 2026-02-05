/**
 * Risk Draft Schema Utilities (Story 3.1)
 *
 * Creates a relaxed validation schema for risk draft mode.
 * Only 'threat' field is required to save as draft.
 *
 * @module riskDraftSchema
 */

import { z } from 'zod';
import { DRAFT_REQUIRED_FIELDS } from './draftSchema';
import { type SupportedLocale, getZodMessages } from '../config/localeConfig';

/**
 * Required fields for risk draft mode.
 * Only threat is required to save a risk as draft.
 */
export const RISK_DRAFT_REQUIRED_FIELDS = DRAFT_REQUIRED_FIELDS.risk;

/**
 * Draft status value for risks.
 */
export const RISK_DRAFT_STATUS = 'Brouillon' as const;

/**
 * Published status value for risks.
 */
export const RISK_PUBLISHED_STATUS = 'Ouvert' as const;

/**
 * Creates a draft schema for risks with relaxed validation.
 * Only 'threat' field is required; all other fields become optional.
 *
 * @param locale - Locale for error messages (default: 'fr')
 * @returns Relaxed Zod schema for risk draft validation
 *
 * @example
 * ```typescript
 * const draftSchema = createRiskDraftSchema('fr');
 * const result = draftSchema.safeParse({ threat: 'Phishing attack' });
 * // result.success === true (only threat required)
 * ```
 */
export function createRiskDraftSchema(locale: SupportedLocale = 'fr') {
 const messages = getZodMessages(locale);

 // Create a base schema without the refine() methods (which add cross-field validation)
 // For draft mode, we only need to validate individual fields
 const baseRiskShape = {
 assetId: z.string().optional(),
 threat: z.string().min(3, messages.tooShort(3)).max(500),
 scenario: z.string().max(5000).optional(),
 framework: z.enum(['ISO27001', 'ISO22301', 'ISO27005', 'NIS2', 'DORA', 'GDPR', 'SOC2', 'HDS', 'PCI_DSS', 'NIST_CSF', 'OWASP', 'EBIOS', 'COBIT', 'ITIL']).optional(),
 vulnerability: z.string().min(3).max(500).optional(),
 probability: z.number().min(1).max(5).optional(),
 impact: z.number().min(1).max(5).optional(),
 residualProbability: z.number().optional(),
 residualImpact: z.number().optional(),
 residualScore: z.number().optional(),
 mitreTechniques: z.array(z.object({
 id: z.string(),
 name: z.string(),
 description: z.string()
 })).optional(),
 strategy: z.enum(['Accepter', 'Atténuer', 'Transférer', 'Éviter']).optional(),
 status: z.enum(['Brouillon', 'Ouvert', 'En cours', 'Fermé', 'En attente de validation']).optional(),
 owner: z.string().optional(),
 ownerId: z.string().optional(),
 mitigationControlIds: z.array(z.string()).optional(),
 affectedProcessIds: z.array(z.string()).optional(),
 relatedSupplierIds: z.array(z.string()).optional(),
 relatedProjectIds: z.array(z.string()).optional(),
 treatmentDeadline: z.string().optional(),
 treatmentOwnerId: z.string().optional(),
 /** @deprecated Use treatment.status instead */
 treatmentStatus: z.enum(['Planifié', 'En cours', 'Terminé', 'Retard']).optional(),
 treatment: z.object({
 strategy: z.enum(['Accepter', 'Atténuer', 'Transférer', 'Éviter']).optional(),
 description: z.string().optional(),
 ownerId: z.string().optional(),
 dueDate: z.string().optional(),
 completedDate: z.string().optional(),
 status: z.enum(['Planifié', 'En cours', 'Terminé', 'Retard']).optional(),
 slaStatus: z.enum(['On Track', 'At Risk', 'Breached']).optional(),
 estimatedCost: z.number().optional()
 }).optional(),
 justification: z.string().optional(),
 isSecureStorage: z.boolean().optional(),
 aiAnalysis: z.object({
 type: z.string(),
 response: z.record(z.string(), z.unknown()),
 timestamp: z.string()
 }).optional().nullable(),
 };

 return z.object(baseRiskShape);
}

/**
 * Pre-created draft schema for French locale.
 * Use this for most cases to avoid recreating the schema.
 */
export const riskDraftSchemaFr = createRiskDraftSchema('fr');

/**
 * Pre-created draft schema for English locale.
 */
export const riskDraftSchemaEn = createRiskDraftSchema('en');

/**
 * Gets the appropriate draft schema based on locale.
 *
 * @param locale - Current locale
 * @returns The draft schema for that locale
 */
export function getRiskDraftSchema(locale: SupportedLocale = 'fr') {
 return locale === 'en' ? riskDraftSchemaEn : riskDraftSchemaFr;
}

/**
 * Validates risk data for draft saving.
 * Only checks if threat field is present and valid.
 *
 * @param data - Partial risk form data
 * @param locale - Locale for error messages
 * @returns Validation result with canSave flag and errors
 */
export function canSaveRiskAsDraft(
 data: Record<string, unknown>,
 locale: SupportedLocale = 'fr'
): {
 canSave: boolean;
 errors: Record<string, string>;
} {
 const messages = getZodMessages(locale);
 const errors: Record<string, string> = {};

 // Check threat field (the only required field for draft)
 const threat = data.threat;
 if (threat === undefined || threat === null || threat === '') {
 errors.threat = messages.required;
 } else if (typeof threat === 'string') {
 if (threat.trim().length === 0) {
 errors.threat = messages.required;
 } else if (threat.trim().length < 3) {
 errors.threat = messages.tooShort(3);
 }
 }

 return {
 canSave: Object.keys(errors).length === 0,
 errors,
 };
}

/**
 * Type for risk draft data.
 * All fields optional except threat.
 */
export type RiskDraftData = z.infer<ReturnType<typeof createRiskDraftSchema>>;

/**
 * Determines if a risk is a draft based on its status.
 *
 * @param status - The risk status
 * @returns True if the risk is a draft
 */
export function isRiskDraft(status: string | undefined): boolean {
 return status === RISK_DRAFT_STATUS;
}

/**
 * Gets the default status for a new risk.
 *
 * @param isDraft - Whether to create as draft
 * @returns The appropriate status value
 */
export function getDefaultRiskStatus(isDraft: boolean): string {
 return isDraft ? RISK_DRAFT_STATUS : RISK_PUBLISHED_STATUS;
}
