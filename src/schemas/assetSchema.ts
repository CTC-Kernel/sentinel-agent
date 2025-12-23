import { z } from 'zod';
import i18n from '../i18n';
import { Criticality } from '../types';

export const assetSchema = z.object({
    name: z.string().min(1, i18n.t('validation.required')),
    type: z.enum(['Matériel', 'Logiciel', 'Données', 'Service', 'Humain'], {
        error: i18n.t('validation.required'),
    }),
    owner: z.string().min(1, i18n.t('validation.required')),
    confidentiality: z.nativeEnum(Criticality),
    integrity: z.nativeEnum(Criticality),
    availability: z.nativeEnum(Criticality),
    location: z.string().min(1, i18n.t('validation.required')),
    purchaseDate: z.string().optional(),
    purchasePrice: z.coerce.number().min(0).optional(),
    currentValue: z.coerce.number().min(0).optional(),
    warrantyEnd: z.string().optional(),
    nextMaintenance: z.string().optional(),
    lifecycleStatus: z.enum(['Neuf', 'En service', 'En réparation', 'Fin de vie', 'Rebut']).optional(),
    ownerId: z.string().optional(),
    relatedProjectIds: z.array(z.string()).optional(),
    scope: z.array(z.enum(['NIS2', 'DORA', 'PCI_DSS', 'HDS', 'ISO27001', 'SOC2'])).optional(),
    supplierId: z.string().optional(),
    ipAddress: z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, i18n.t('validation.ip')).or(z.literal('')).optional(),
    // Software specific
    version: z.string().optional(),
    licenseExpiry: z.string().optional(),
    // People specific
    email: z.string().email(i18n.t('validation.email')).or(z.literal('')).optional(),
    role: z.string().optional(),
    department: z.string().optional(),
    aiAnalysis: z.object({
        type: z.string(),
        response: z.record(z.string(), z.any()),
        timestamp: z.string()
    }).optional().nullable(),
    // Specialized details
    dataDetails: z.object({
        format: z.enum(['Numérique', 'Physique', 'Hybride']),
        retentionPeriod: z.string().optional(),
        hasWorm: z.boolean().optional(),
        isEncrypted: z.boolean().optional(),
        dataCategory: z.enum(['Client', 'Employé', 'Financier', 'Propriété Intellectuelle', 'Autre']).optional(),
    }).optional(),
    serviceDetails: z.object({
        providerUrl: z.string().url(i18n.t('validation.url')).optional().or(z.literal('')),
        sla: z.string().optional(),
        supportContact: z.string().optional(),
        hostingLocation: z.string().optional(),
    }).optional(),
});

export type AssetFormData = z.infer<typeof assetSchema>;
