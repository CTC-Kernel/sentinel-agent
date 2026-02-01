import { z } from 'zod';
import { Criticality } from '../types';

export const incidentSchema = z.object({
    title: z.string().trim().min(1, "Title is required").max(200, "Title is too long (max 200)"),
    description: z.string().trim().min(1, "Description is required").max(5000, "Description is too long (max 5000)"),
    severity: z.nativeEnum(Criticality),
    status: z.enum(['Nouveau', 'Analyse', 'Contenu', 'Résolu', 'Fermé']),
    category: z.enum(['Ransomware', 'Phishing', 'Vol Matériel', 'Indisponibilité', 'Fuite de Données', 'Autre']).optional(),
    playbookStepsCompleted: z.array(z.string()).optional(),
    affectedAssetId: z.string().optional(),
    relatedRiskId: z.string().optional(),
    financialImpact: z.number().optional(),
    reporter: z.string().trim().min(1, "Reporter is required"),
    dateReported: z.string().optional(),
    dateAnalysis: z.string().optional(),
    dateContained: z.string().optional(),
    dateResolved: z.string().optional(),
    lessonsLearned: z.string().trim().optional(),
    // NIS 2 Fields
    isSignificant: z.boolean().optional(),
    notificationStatus: z.enum(['Not Required', 'Pending', 'Reported']).optional(),
    relevantAuthorities: z.array(z.string()).optional(),
    affectedProcessId: z.string().optional(),
});

export type IncidentFormData = z.infer<typeof incidentSchema>;
