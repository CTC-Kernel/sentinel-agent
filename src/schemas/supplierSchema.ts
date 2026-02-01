import { z } from 'zod';
import { Criticality } from '../types';
import { SUPPLIER_CATEGORIES, SUPPLIER_STATUSES, DORA_CRITICALITIES, DORA_SERVICE_TYPES } from '../data/supplierConstants';

export const SERVICE_TYPES = [
    'SaaS', 'Cloud', 'Software', 'Hardware', 'Consulting', 'Network', 'Security'
] as const;

export const supplierSchema = z.object({
    name: z.string().trim()
        .min(1, "Name is required")
        .max(200, "Name must not exceed 200 characters"),
    category: z.enum(SUPPLIER_CATEGORIES),
    criticality: z.nativeEnum(Criticality),
    contactName: z.string().trim().max(100).optional(),
    contactEmail: z.string().trim()
        .max(254)
        .refine(
            (val) => !val || val === '' || z.string().email().safeParse(val).success,
            { message: "Invalid email" }
        )
        .optional(),
    vatNumber: z.string().trim().max(50).optional(),
    status: z.enum(SUPPLIER_STATUSES),
    owner: z.string().trim().max(100).optional(),
    ownerId: z.string().optional(),
    description: z.string().trim().max(5000, "Description must not exceed 5000 characters").optional(),
    contractDocumentId: z.string().optional(),
    contractEnd: z.string().optional(),
    securityScore: z.number().min(0).max(100).optional(),
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
    doraCriticality: z.enum(DORA_CRITICALITIES).optional(),
    serviceType: z.enum(DORA_SERVICE_TYPES).optional(),
    supportedProcessIds: z.array(z.string()).max(50).optional(),
    relatedAssetIds: z.array(z.string()).max(100).optional(),
    relatedRiskIds: z.array(z.string()).max(100).optional(),
    relatedProjectIds: z.array(z.string()).max(50).optional(),
});

export type SupplierFormData = z.infer<typeof supplierSchema>;
