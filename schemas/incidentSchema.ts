import { z } from 'zod';
import { Criticality } from '../types';

export const incidentSchema = z.object({
    title: z.string().min(1, "Le titre est requis"),
    description: z.string().min(1, "La description est requise"),
    severity: z.nativeEnum(Criticality),
    status: z.enum(['Nouveau', 'Analyse', 'Contenu', 'Résolu', 'Fermé']),
    category: z.enum(['Ransomware', 'Phishing', 'Vol Matériel', 'Indisponibilité', 'Fuite de Données', 'Autre']).optional(),
    playbookStepsCompleted: z.array(z.string()).optional(),
    affectedAssetId: z.string().optional(),
    relatedRiskId: z.string().optional(),
    financialImpact: z.number().optional(),
    reporter: z.string().min(1, "Le déclarant est requis"),
    dateReported: z.string().optional(),
    dateAnalysis: z.string().optional(),
    dateContained: z.string().optional(),
    dateResolved: z.string().optional(),
    lessonsLearned: z.string().optional(),
    // NIS 2 Fields
    isSignificant: z.boolean().optional(),
    notificationStatus: z.enum(['Not Required', 'Pending', 'Reported']).optional(),
    relevantAuthorities: z.array(z.string()).optional(),
    affectedProcessId: z.string().optional(),
});

export type IncidentFormData = z.infer<typeof incidentSchema>;
