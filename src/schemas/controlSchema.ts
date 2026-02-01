import { z } from 'zod';
import { CONTROL_STATUSES } from '../types/controls';
import { FRAMEWORKS } from '../types/common';

/**
 * Control validation schema
 * Validates control forms for create/update operations
 */
export const controlSchema = z.object({
    code: z.string().trim()
        .min(1, "Code is required")
        .max(50, "Code must not exceed 50 characters")
        .regex(/^[A-Za-z0-9._-]+$/, "Code must only contain letters, digits, dots, dashes and underscores"),
    name: z.string().trim()
        .min(1, "Name is required")
        .max(200, "Name must not exceed 200 characters"),
    framework: z.enum(FRAMEWORKS).optional(),
    mappedFrameworks: z.array(z.enum(FRAMEWORKS)).optional(),
    description: z.string().trim()
        .max(5000, "Description must not exceed 5000 characters")
        .optional(),
    type: z.enum(['Préventif', 'Détectif', 'Correctif']).optional(),
    status: z.enum(CONTROL_STATUSES),
    applicability: z.enum(['Applicable', 'Non applicable']).optional(),
    justification: z.string().trim()
        .max(2000, "Justification must not exceed 2000 characters")
        .optional(),
    evidenceIds: z.array(z.string()).max(100, "Maximum 100 evidence items").optional(),
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
