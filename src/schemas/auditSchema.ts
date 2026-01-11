import { z } from 'zod';
import { AUDIT_STATUSES } from '../types/audits';

export const auditSchema = z.object({
    name: z.string().min(1, "Le nom de l'audit est requis").max(200, "Le nom est trop long (max 200)"),
    type: z.enum(['Interne', 'Externe', 'Certification', 'Fournisseur']),
    auditor: z.string().min(1, "L'auditeur est requis").max(100, "Nom trop long"),
    dateScheduled: z.string().min(1, "La date est requise"),
    status: z.enum(AUDIT_STATUSES),
    description: z.string().max(5000, "La description est trop longue").optional(),
    scope: z.string().max(5000, "Le périmètre est trop long").optional(),
    framework: z.enum(['ISO27001', 'ISO27005', 'NIS2', 'DORA', 'GDPR', 'SOC2', 'HDS', 'PCI_DSS', 'NIST_CSF', 'OWASP', 'EBIOS', 'COBIT', 'ITIL', 'ISO22301']).optional(),
    relatedAssetIds: z.array(z.string()).optional(),
    relatedRiskIds: z.array(z.string()).optional(),
    relatedControlIds: z.array(z.string()).optional(),
    relatedProjectIds: z.array(z.string()).optional()
});

export type AuditFormData = z.infer<typeof auditSchema>;

// Re-export finding schema for backward compatibility
export { findingSchema, type FindingFormData } from './findingSchema';
