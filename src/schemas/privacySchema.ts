import { z } from 'zod';

export const processingActivitySchema = z.object({
    name: z.string().min(1, "Le nom est requis"),
    purpose: z.string().min(1, "La finalité est requise"),
    manager: z.string().min(1, "Le responsable est requis"),
    managerId: z.string().optional(),
    legalBasis: z.enum(['Consentement', 'Contrat', 'Obligation Légale', 'Intérêt Légitime', 'Sauvegarde Intérêts', 'Mission Publique']),
    dataCategories: z.array(z.string()),
    dataSubjects: z.array(z.string()),
    retentionPeriod: z.string().min(1, "La durée de conservation est requise"),
    hasDPIA: z.boolean(),
    status: z.enum(['Actif', 'En projet', 'Archivé']),
});

export type ProcessingActivityFormData = z.infer<typeof processingActivitySchema>;
