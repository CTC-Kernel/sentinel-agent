import { z } from 'zod';

export const projectTaskSchema = z.object({
    title: z.string().min(1, "Le titre est requis"),
    description: z.string().optional(),
    status: z.enum(['A faire', 'En cours', 'Terminé', 'Bloqué']).default('A faire'),
    assignee: z.string().optional(),
    assigneeId: z.string().optional(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
    estimatedHours: z.number().min(0, "Les heures doivent être positives").optional(),
    actualHours: z.number().min(0, "Les heures doivent être positives").optional(),
    dependencies: z.array(z.string()).optional().default([]),
    progress: z.number().min(0).max(100).optional().default(0),
});

export type ProjectTaskFormData = z.infer<typeof projectTaskSchema>;

export const projectSchema = z.object({
    name: z.string().min(1, "Le nom du projet est requis"),
    description: z.string().min(1, "La description est requise"),
    manager: z.string().min(1, "Le manager est requis"),
    framework: z.enum(['ISO27001', 'ISO27005', 'NIS2', 'DORA', 'GDPR', 'SOC2', 'HDS', 'PCI_DSS', 'NIST_CSF', 'OWASP', 'EBIOS', 'COBIT', 'ITIL']).optional(),
    status: z.enum(['Planifié', 'En cours', 'Terminé', 'Suspendu']).default('Planifié'),
    startDate: z.string().optional(),
    dueDate: z.string().min(1, "La date d'échéance est requise"),
    relatedRiskIds: z.array(z.string()).optional().default([]),
    relatedControlIds: z.array(z.string()).optional().default([]),
    relatedAssetIds: z.array(z.string()).optional().default([]),
});

export type ProjectFormData = z.infer<typeof projectSchema>;

export const templateFormSchema = z.object({
    projectName: z.string().min(1, "Le nom du projet est requis"),
    startDate: z.string().min(1, "La date de début est requise"),
    manager: z.string().min(1, "Le chef de projet est requis"),
});

export type TemplateFormData = z.infer<typeof templateFormSchema>;
