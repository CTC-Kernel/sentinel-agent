import { z } from 'zod';
import { Criticality } from '../types';

export const supplierSchema = z.object({
    name: z.string().min(1, "Le nom est requis"),
    category: z.enum(['SaaS', 'Hébergement', 'Matériel', 'Consulting', 'Autre']),
    criticality: z.nativeEnum(Criticality),
    contactName: z.string().optional(),
    contactEmail: z.string().email("Email invalide").optional().or(z.literal('')),
    vatNumber: z.string().optional(),
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
    doraContractClauses: z.object({
        auditRights: z.boolean().optional(),
        slaDefined: z.boolean().optional(),
        dataLocation: z.boolean().optional(),
        subcontractingConditions: z.boolean().optional(),
        incidentNotification: z.boolean().optional(),
        exitStrategy: z.boolean().optional(),
    }).optional(),
    isICTProvider: z.boolean().optional(),
    supportsCriticalFunction: z.boolean().optional(),
    doraCriticality: z.enum(['Critical', 'Important', 'None']).optional(),
    serviceType: z.enum(['SaaS', 'Cloud', 'Software', 'Hardware', 'Consulting', 'Network', 'Security']).optional(),
    supportedProcessIds: z.array(z.string()).optional(),
    relatedAssetIds: z.array(z.string()).optional(),
    relatedRiskIds: z.array(z.string()).optional(),
    relatedProjectIds: z.array(z.string()).optional(),
});

export type SupplierFormData = z.infer<typeof supplierSchema>;
