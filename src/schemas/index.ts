/**
 * Schemas de validation Zod pour toutes les entités
 * Garantit l'intégrité des données avant envoi à Firestore
 */

import { z } from 'zod';

// ============================================================================
// RISK SCHEMA
// ============================================================================

export const RiskSchema = z.object({
  threat: z.string()
    .min(3, "Threat must be at least 3 characters")
    .max(200, "Threat must not exceed 200 characters"),

  vulnerability: z.string()
    .min(3, "Vulnerability must be at least 3 characters")
    .max(500, "Vulnerability must not exceed 500 characters"),

  assetId: z.string()
    .min(1, "Asset is required"),

  probability: z.number()
    .int("Probability must be an integer")
    .min(1, "Probability must be between 1 and 5")
    .max(5, "Probability must be between 1 and 5"),

  impact: z.number()
    .int("Impact must be an integer")
    .min(1, "Impact must be between 1 and 5")
    .max(5, "Impact must be between 1 and 5"),

  residualProbability: z.number().int().min(1).max(5),
  residualImpact: z.number().int().min(1).max(5),

  strategy: z.enum(['Atténuer', 'Accepter', 'Transférer', 'Éviter']),
  status: z.enum(['Ouvert', 'En cours', 'Fermé']),

  owner: z.string().min(2, "Owner is required"),

  mitigationControlIds: z.array(z.string()).optional(),
  description: z.string().optional(),
  treatmentPlan: z.string().optional(),
  lastReviewDate: z.string().optional()
});

export type RiskFormData = z.infer<typeof RiskSchema>;

// ============================================================================
// ASSET SCHEMA
// ============================================================================

export const AssetSchema = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters"),

  type: z.enum([
    'Serveur', 'Poste de travail', 'Application', 'Base de données',
    'Réseau', 'Sauvegarde', 'Personnel', 'Locaux', 'Données', 'Service', 'Autre'
  ]),

  owner: z.string().min(2, "Owner is required"),
  location: z.string().min(2, "Location is required"),

  confidentiality: z.enum(['Publique', 'Interne', 'Confidentielle', 'Strictement confidentielle']),
  integrity: z.enum(['Faible', 'Moyenne', 'Élevée', 'Critique']),
  availability: z.enum(['Faible', 'Moyenne', 'Élevée', 'Critique']),

  description: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: z.number().nonnegative("Price cannot be negative").optional(),
  lifecycleStatus: z.enum(['Neuf', 'Production', 'Maintenance', 'Obsolète', 'Retiré']).optional(),
  currentValue: z.number().nonnegative().optional()
});

export type AssetFormData = z.infer<typeof AssetSchema>;

// ============================================================================
// PROJECT SCHEMA
// ============================================================================

export const ProjectSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  description: z.string().min(10, "Description must be at least 10 characters").max(1000),
  manager: z.string().min(2, "Manager is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  status: z.enum(['Planifié', 'En cours', 'Terminé', 'Annulé']),
  budget: z.number().nonnegative("Budget cannot be negative").optional(),
  progress: z.number().min(0).max(100).optional(),
  relatedRiskIds: z.array(z.string()).optional(),
  relatedControlIds: z.array(z.string()).optional(),
  relatedAssetIds: z.array(z.string()).optional()
});

export type ProjectFormData = z.infer<typeof ProjectSchema>;

// ============================================================================
// DOCUMENT SCHEMA
// ============================================================================

export const DocumentSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  type: z.enum(['Politique', 'Procédure', 'Preuve', 'Rapport', 'Guide', 'Formulaire', 'Autre']),
  version: z.string().regex(/^\d+\.\d+$/, "Version must be in X.Y format").optional().default("1.0"),
  status: z.enum(['Brouillon', 'Revue', 'Approuvé', 'Publié', 'Archivé']),
  owner: z.string().min(2, "Owner is required"),
  url: z.string().url("Invalid URL").optional(),
  nextReviewDate: z.string().optional(),
  relatedControlIds: z.array(z.string()).optional(),
  relatedAssetIds: z.array(z.string()).optional(),
  relatedAuditIds: z.array(z.string()).optional()
});

export type DocumentFormData = z.infer<typeof DocumentSchema>;

// ============================================================================
// AUDIT SCHEMA
// ============================================================================

export const AuditSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(150),
  type: z.enum(['Interne', 'Externe', 'Certification']),
  auditor: z.string().min(2, "Auditor is required"),
  dateScheduled: z.string().min(1, "Scheduled date is required"),
  status: z.enum(['Planifié', 'En cours', 'Terminé', 'Annulé']),
  scope: z.string().optional(),
  relatedAssetIds: z.array(z.string()).optional(),
  relatedRiskIds: z.array(z.string()).optional()
});

export type AuditFormData = z.infer<typeof AuditSchema>;

// ============================================================================
// FINDING SCHEMA
// ============================================================================

export const FindingSchema = z.object({
  description: z.string().min(10, "Description must be at least 10 characters").max(1000),
  type: z.enum(['Majeure', 'Mineure', 'Observation']),
  status: z.enum(['Ouvert', 'En cours', 'Résolu', 'Fermé']),
  relatedControlId: z.string().optional(),
  recommendation: z.string().optional(),
  evidenceIds: z.array(z.string()).optional()
});

export type FindingFormData = z.infer<typeof FindingSchema>;

// ============================================================================
// INCIDENT SCHEMA
// ============================================================================

export const IncidentSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(150),
  category: z.enum([
    'Cyberattaque', 'Fuite de données', 'Panne système',
    'Erreur humaine', 'Accès non autorisé', 'Perte/Vol', 'Autre'
  ]),
  severity: z.enum(['Faible', 'Moyenne', 'Élevée', 'Critique']),
  status: z.enum(['Nouveau', 'Investigation', 'Résolu', 'Fermé']),
  description: z.string().min(20, "Description must be at least 20 characters").max(2000),
  dateReported: z.string().min(1, "Report date is required"),
  reportedBy: z.string().min(2, "Reporter is required"),
  affectedAssetIds: z.array(z.string()).optional()
});

export type IncidentFormData = z.infer<typeof IncidentSchema>;

// ============================================================================
// SUPPLIER SCHEMA
// ============================================================================

export const SupplierSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  type: z.enum(['Fournisseur', 'Sous-traitant', 'Partenaire', 'Prestataire']),
  criticality: z.enum(['Faible', 'Moyenne', 'Élevée', 'Critique']),
  contact: z.string().min(2, "Contact is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  contractStartDate: z.string().optional(),
  contractEndDate: z.string().optional(),
  services: z.string().min(5, "Service description must be at least 5 characters").max(500)
});

export type SupplierFormData = z.infer<typeof SupplierSchema>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Valide des données avec un schema Zod et retourne les erreurs formatées
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    // ErrorLogger not required for validation (handled by caller)
    if (error instanceof z.ZodError) {
      const errors = error.issues.map(err =>
        `${err.path.join('.')}: ${err.message}`
      );
      return { success: false, errors };
    }
    return { success: false, errors: ["Unknown validation error"] };
  }
}

/**
 * Valide et retourne un message d'erreur user-friendly
 */
export function getValidationError<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): string | null {
  try {
    schema.parse(data);
    return null;
  } catch (error) {
    // ErrorLogger not required for validation (handled by caller)
    if (error instanceof z.ZodError) {
      return error.issues[0]?.message || "Invalid data";
    }
    return "Validation error";
  }
}
