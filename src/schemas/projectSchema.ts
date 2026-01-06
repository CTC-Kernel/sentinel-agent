import { z } from 'zod';
import i18n from '../i18n';

export const projectTaskSchema = z.object({
    title: z.string().min(1, i18n.t('validation.required')),
    description: z.string().optional(),
    status: z.enum(['A faire', 'En cours', 'Terminé', 'Bloqué']).default('A faire'),
    assignee: z.string().optional(),
    assigneeId: z.string().optional(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
    estimatedHours: z.number().min(0, i18n.t('validation.positive')).optional(),
    actualHours: z.number().min(0, i18n.t('validation.positive')).optional(),
    dependencies: z.array(z.string()).optional().default([]),
    progress: z.number().min(0).max(100).optional().default(0),
});

export type ProjectTaskFormData = z.infer<typeof projectTaskSchema>;

export const projectSchema = z.object({
    name: z.string().min(1, i18n.t('validation.required')).max(200, i18n.t('validation.maxLength', { max: 200 })),
    description: z.string().min(1, i18n.t('validation.required')).max(5000, i18n.t('validation.maxLength', { max: 5000 })),
    manager: z.string().min(1, i18n.t('validation.required')),
    managerId: z.string().min(1, i18n.t('validation.required')),
    framework: z.enum(['ISO27001', 'ISO27005', 'NIS2', 'DORA', 'GDPR', 'SOC2', 'HDS', 'PCI_DSS', 'NIST_CSF', 'OWASP', 'EBIOS', 'COBIT', 'ITIL', 'ISO22301']).optional(),
    status: z.enum(['Planifié', 'En cours', 'Terminé', 'Suspendu']).default('Planifié'),
    startDate: z.string().optional(),
    dueDate: z.string().optional().refine((val) => {
        if (!val) return true; // Optionnel
        // Validation basique de format date si fourni
        return /^\d{4}-\d{2}-\d{2}$/.test(val);
    }, { message: "Format de date invalide (AAAA-MM-JJ)" }),
    relatedRiskIds: z.array(z.string()).optional().default([]),
    relatedControlIds: z.array(z.string()).optional().default([]),
    relatedAssetIds: z.array(z.string()).optional().default([]),
    relatedAuditIds: z.array(z.string()).optional().default([]),
    members: z.array(z.string()).optional().default([]),
});

export type ProjectFormData = z.infer<typeof projectSchema>;

export const templateFormSchema = z.object({
    projectName: z.string().min(1, i18n.t('validation.required')),
    startDate: z.string().min(1, i18n.t('validation.required')),
    managerId: z.string().min(1, i18n.t('validation.required')),
});

export type TemplateFormData = z.infer<typeof templateFormSchema>;
