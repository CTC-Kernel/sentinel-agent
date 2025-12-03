import { z } from 'zod';

export const documentSchema = z.object({
    title: z.string().min(1, "Le titre est requis"),
    type: z.enum(['Politique', 'Procédure', 'Preuve', 'Rapport', 'Autre']),
    version: z.string().min(1, "La version est requise"),
    status: z.enum(['Brouillon', 'En revue', 'Approuvé', 'Rejeté', 'Publié', 'Obsolète']),
    workflowStatus: z.enum(['Draft', 'Review', 'Approved', 'Rejected']).optional(),
    owner: z.string().min(1, "Le propriétaire est requis"),
    ownerId: z.string().optional(),
    nextReviewDate: z.string().optional(),
    readBy: z.array(z.string()).optional(),
    reviewers: z.array(z.string()).optional(),
    approvers: z.array(z.string()).optional(),
    signatures: z.array(z.object({ userId: z.string(), date: z.string(), role: z.string(), signatureImage: z.string().optional() })).optional(),
    relatedControlIds: z.array(z.string()).optional(),
    relatedAssetIds: z.array(z.string()).optional(),
    relatedAuditIds: z.array(z.string()).optional(),
    url: z.string().optional(),
    storageProvider: z.enum(['firebase', 'google_drive', 'onedrive', 'sharepoint']).default('firebase'),
    externalUrl: z.string().url("L'URL doit être valide").optional().or(z.literal('')),
    externalId: z.string().optional(),
    folderId: z.string().optional(),
    isSecure: z.boolean().optional(),
    hash: z.string().optional(),
    watermarkEnabled: z.boolean().optional()
});

export type DocumentFormData = z.infer<typeof documentSchema>;
