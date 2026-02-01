import { z } from 'zod';
import { CONTROL_STATUSES } from '../types/controls';
import { FRAMEWORKS } from '../types/common';

/**
 * Control validation schema
 * Validates control forms for create/update operations
 */
export const controlSchema = z.object({
    code: z.string().trim()
        .min(1, "Le code est requis")
        .max(50, "Le code ne doit pas dépasser 50 caractères")
        .regex(/^[A-Za-z0-9._-]+$/, "Le code ne doit contenir que des lettres, chiffres, points, tirets et underscores"),
    name: z.string().trim()
        .min(1, "Le nom est requis")
        .max(200, "Le nom ne doit pas dépasser 200 caractères"),
    framework: z.enum(FRAMEWORKS).optional(),
    mappedFrameworks: z.array(z.enum(FRAMEWORKS)).optional(),
    description: z.string().trim()
        .max(5000, "La description ne doit pas dépasser 5000 caractères")
        .optional(),
    type: z.enum(['Préventif', 'Détectif', 'Correctif']).optional(),
    status: z.enum(CONTROL_STATUSES),
    applicability: z.enum(['Applicable', 'Non applicable']).optional(),
    justification: z.string().trim()
        .max(2000, "La justification ne doit pas dépasser 2000 caractères")
        .optional(),
    evidenceIds: z.array(z.string()).max(100, "Maximum 100 éléments de preuve").optional(),
    evidenceStrength: z.enum(['Faible', 'Forte']).optional(),
    owner: z.string().optional(),
    assigneeId: z.string().optional(),
    maturity: z.number().min(0).max(5).optional(),
    relatedAssetIds: z.array(z.string()).max(100).optional(),
    relatedRiskIds: z.array(z.string()).max(100).optional(),
    relatedSupplierIds: z.array(z.string()).max(100).optional(),
    relatedProjectIds: z.array(z.string()).max(50).optional(),
});

export type ControlFormData = z.infer<typeof controlSchema>;
