import { z } from 'zod';
import { AUDIT_STATUSES } from '../types/audits';
import { FRAMEWORKS } from '../constants/frameworks';

export const auditSchema = z.object({
    name: z.string().trim().min(1, "Audit name is required").max(200, "Name is too long (max 200)"),
    type: z.enum(['Interne', 'Externe', 'Certification', 'Fournisseur']),
    auditor: z.string().trim().min(1, "Auditor is required").max(100, "Name is too long"),
    dateScheduled: z.string().min(1, "Date is required"),
    status: z.enum(AUDIT_STATUSES),
    description: z.string().trim().max(5000, "Description is too long").optional(),
    scope: z.string().trim().max(5000, "Scope is too long").optional(),
    framework: z.enum(FRAMEWORKS).optional(),
    relatedAssetIds: z.array(z.string()).optional(),
    relatedRiskIds: z.array(z.string()).optional(),
    relatedControlIds: z.array(z.string()).optional(),
    relatedProjectIds: z.array(z.string()).optional()
});

export type AuditFormData = z.infer<typeof auditSchema>;

// Re-export finding schema for backward compatibility
export { findingSchema, type FindingFormData } from './findingSchema';
