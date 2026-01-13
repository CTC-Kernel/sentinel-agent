import { z } from 'zod';

export const backupConfigSchema = z.object({
    includeDocuments: z.boolean(),
    includeAssets: z.boolean(),
    includeRisks: z.boolean(),
    includeControls: z.boolean(),
    includeAudits: z.boolean(),
    includeProjects: z.boolean(),
    includeSuppliers: z.boolean(),
    includeIncidents: z.boolean(),
    includeUsers: z.boolean(),
    includeComments: z.boolean()
});

export const restoreConfigSchema = z.object({
    backupId: z.string().trim().min(1, 'Veuillez sélectionner une sauvegarde'),
    collections: z.array(z.string().trim()).min(1, 'Veuillez sélectionner au moins une collection'),
    overwriteExisting: z.boolean(),
    dryRun: z.boolean()
});

export type BackupConfigFormData = z.infer<typeof backupConfigSchema>;
export type RestoreConfigFormData = z.infer<typeof restoreConfigSchema>;
