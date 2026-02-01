import { z } from 'zod';

export const documentSchema = z.object({
    title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
    type: z.enum(['Politique', 'Procédure', 'Preuve', 'Rapport', 'Autre']),
    description: z.string().trim().max(2000, "Description is too long").optional(),
    version: z.string().trim().min(1, "Version is required"),
    status: z.enum(['Brouillon', 'En revue', 'Approuvé', 'Rejeté', 'Publié', 'Obsolète', 'Archivé']),
    workflowStatus: z.enum(['Draft', 'Review', 'Approved', 'Rejected', 'Archived']).optional(),
    owner: z.string().trim().min(1, "Owner is required"),
    ownerId: z.string().optional(),
    nextReviewDate: z.string().optional(),
    expirationDate: z.string().optional(),
    readBy: z.array(z.string()).optional(),
    reviewers: z.array(z.string()).optional(),
    approvers: z.array(z.string()).optional(),
    signatures: z.array(z.object({ userId: z.string(), date: z.string(), role: z.string(), signatureImage: z.string().optional() })).optional(),
    relatedControlIds: z.array(z.string()).optional(),
    relatedAssetIds: z.array(z.string()).optional(),
    relatedAuditIds: z.array(z.string()).optional(),
    relatedRiskIds: z.array(z.string()).optional(),
    url: z.string().optional(),
    storageProvider: z.enum(['firebase', 'google_drive', 'onedrive', 'sharepoint']).default('firebase'),
    externalUrl: z.string().trim().url("Invalid URL").optional().or(z.literal('')),
    externalId: z.string().trim().optional(),
    folderId: z.string().optional(),
    content: z.string().trim().optional(), // HTML Content
    isSecure: z.boolean().optional(),
    hash: z.string().optional(),
    watermarkEnabled: z.boolean().optional()
});

export type DocumentFormData = z.infer<typeof documentSchema>;
