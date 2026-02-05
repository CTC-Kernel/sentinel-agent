import { z } from 'zod';
import { Criticality } from '../types';

export const incidentSchema = z.object({
 title: z.string().trim().min(1, "Le titre est requis").max(200, "Le titre est trop long (max 200)"),
 description: z.string().trim().min(1, "La description est requise").max(5000, "La description est trop longue (max 5000)"),
 severity: z.nativeEnum(Criticality),
 status: z.enum(['Nouveau', 'Analyse', 'Contenu', 'Résolu', 'Fermé']),
 category: z.enum(['Ransomware', 'Phishing', 'Vol Matériel', 'Indisponibilité', 'Fuite de Données', 'Autre']).optional(),
 playbookStepsCompleted: z.array(z.string()).optional(),
 affectedAssetId: z.string().optional(),
 relatedRiskId: z.string().optional(),
 financialImpact: z.number().optional(),
 reporter: z.string().trim().min(1, "Le déclarant est requis"),
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
