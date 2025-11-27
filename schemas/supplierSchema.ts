import { z } from 'zod';

export const supplierSchema = z.object({
    name: z.string().min(1, "Le nom est requis"),
    category: z.enum(['SaaS', 'Hébergement', 'Matériel', 'Consulting', 'Autre']),
    criticality: z.enum(['Faible', 'Moyenne', 'Élevée', 'Critique']),
    contactName: z.string().optional(),
    contactEmail: z.string().email("Email invalide").optional().or(z.literal('')),
    status: z.enum(['Actif', 'En cours', 'Terminé']),
    owner: z.string().optional(),
    ownerId: z.string().optional(),
    description: z.string().optional(),
    contractDocumentId: z.string().optional(),
    contractEnd: z.string().optional(),
    securityScore: z.number().optional(),
    assessment: z.object({
        hasIso27001: z.boolean().optional(),
        hasGdprPolicy: z.boolean().optional(),
        hasEncryption: z.boolean().optional(),
        hasBcp: z.boolean().optional(),
        hasIncidentProcess: z.boolean().optional(),
        lastAssessmentDate: z.string().optional()
    }).optional(),
    // DORA Fields
    isICTProvider: z.boolean().optional(),
    supportsCriticalFunction: z.boolean().optional(),
    doraCriticality: z.enum(['Critical', 'Important', 'None']).optional(),
    serviceType: z.enum(['SaaS', 'Cloud', 'Software', 'Hardware', 'Consulting', 'Network', 'Security']).optional()
});

export type SupplierFormData = z.infer<typeof supplierSchema>;
