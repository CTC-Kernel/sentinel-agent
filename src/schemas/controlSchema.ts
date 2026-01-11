import { z } from 'zod';
import { CONTROL_STATUSES } from '../types/controls';

export const controlSchema = z.object({
    code: z.string().min(1, "Le code est requis"),
    name: z.string().min(1, "Le nom est requis"),
    framework: z.enum(['ISO27001', 'NIS2', 'DORA', 'GDPR', 'SOC2', 'HDS', 'PCI_DSS', 'NIST_CSF']).optional(),
    description: z.string().optional(),
    status: z.enum(CONTROL_STATUSES),
    applicability: z.enum(['Applicable', 'Non applicable']).optional(),
    justification: z.string().max(2000, "La justification ne peut pas dépasser 2000 caractères").optional(),
    evidenceIds: z.array(z.string()).optional(),
    evidenceStrength: z.enum(['Faible', 'Forte']).optional(),
    assigneeId: z.string().optional(),
    relatedAssetIds: z.array(z.string()).optional(),
    relatedSupplierIds: z.array(z.string()).optional(),
});

export type ControlFormData = z.infer<typeof controlSchema>;
