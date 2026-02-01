import { z } from 'zod';

export const processingActivitySchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
    purpose: z.string().trim().min(1, "Purpose is required").max(500, "Purpose is too long"),
    manager: z.string().trim().min(1, "Manager is required"),
    managerId: z.string().optional(),
    legalBasis: z.enum(['Consentement', 'Contrat', 'Obligation Légale', 'Intérêt Légitime', 'Sauvegarde Intérêts', 'Mission Publique']),
    dataCategories: z.array(z.string()).min(1, "At least one category is required"),
    dataSubjects: z.array(z.string()),
    retentionPeriod: z.string().trim().min(1, "Retention period is required"),
    hasDPIA: z.boolean(),
    status: z.enum(['Actif', 'En projet', 'Archivé']),
    relatedAssetIds: z.array(z.string()).optional(),
    relatedRiskIds: z.array(z.string()).optional(),
});

export type ProcessingActivityFormData = z.infer<typeof processingActivitySchema>;
