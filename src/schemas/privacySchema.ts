import { z } from 'zod';

export const processingActivitySchema = z.object({
    name: z.string().trim().min(1, "Le nom est requis").max(100, "Le nom est trop long"),
    purpose: z.string().trim().min(1, "La finalité est requise").max(500, "La finalité est trop longue"),
    manager: z.string().trim().min(1, "Le responsable est requis"),
    managerId: z.string().optional(),
    legalBasis: z.enum(['Consentement', 'Contrat', 'Obligation Légale', 'Intérêt Légitime', 'Sauvegarde Intérêts', 'Mission Publique']),
    dataCategories: z.array(z.string()).min(1, "Au moins une catégorie est requise"),
    dataSubjects: z.array(z.string()),
    retentionPeriod: z.string().trim().min(1, "La durée de conservation est requise"),
    hasDPIA: z.boolean(),
    status: z.enum(['Actif', 'En projet', 'Archivé']),
    relatedAssetIds: z.array(z.string()).optional(),
    relatedRiskIds: z.array(z.string()).optional(),
});

export type ProcessingActivityFormData = z.infer<typeof processingActivitySchema>;
