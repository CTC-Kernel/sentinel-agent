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
    .min(3, "La menace doit contenir au moins 3 caractères")
    .max(200, "La menace ne doit pas dépasser 200 caractères"),

  vulnerability: z.string()
    .min(3, "La vulnérabilité doit contenir au moins 3 caractères")
    .max(500, "La vulnérabilité ne doit pas dépasser 500 caractères"),

  assetId: z.string()
    .min(1, "L'actif est requis"),

  probability: z.number()
    .int("La probabilité doit être un entier")
    .min(1, "La probabilité doit être entre 1 et 5")
    .max(5, "La probabilité doit être entre 1 et 5"),

  impact: z.number()
    .int("L'impact doit être un entier")
    .min(1, "L'impact doit être entre 1 et 5")
    .max(5, "L'impact doit être entre 1 et 5"),

  residualProbability: z.number().int().min(1).max(5),
  residualImpact: z.number().int().min(1).max(5),

  strategy: z.enum(['Atténuer', 'Accepter', 'Transférer', 'Éviter']),
  status: z.enum(['Ouvert', 'En cours', 'Fermé']),

  owner: z.string().min(2, "Le propriétaire est requis"),

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
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom ne doit pas dépasser 100 caractères"),

  type: z.enum([
    'Serveur', 'Poste de travail', 'Application', 'Base de données',
    'Réseau', 'Sauvegarde', 'Personnel', 'Locaux', 'Données', 'Service', 'Autre'
  ]),

  owner: z.string().min(2, "Le propriétaire est requis"),
  location: z.string().min(2, "La localisation est requise"),

  confidentiality: z.enum(['Publique', 'Interne', 'Confidentielle', 'Strictement confidentielle']),
  integrity: z.enum(['Faible', 'Moyenne', 'Élevée', 'Critique']),
  availability: z.enum(['Faible', 'Moyenne', 'Élevée', 'Critique']),

  description: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: z.number().nonnegative("Le prix ne peut pas être négatif").optional(),
  lifecycleStatus: z.enum(['Neuf', 'Production', 'Maintenance', 'Obsolète', 'Retiré']).optional(),
  currentValue: z.number().nonnegative().optional()
});

export type AssetFormData = z.infer<typeof AssetSchema>;

// ============================================================================
// PROJECT SCHEMA
// ============================================================================

export const ProjectSchema = z.object({
  name: z.string().min(3, "Le nom doit contenir au moins 3 caractères").max(100),
  description: z.string().min(10, "La description doit contenir au moins 10 caractères").max(1000),
  manager: z.string().min(2, "Le responsable est requis"),
  startDate: z.string().min(1, "La date de début est requise"),
  endDate: z.string().min(1, "La date de fin est requise"),
  status: z.enum(['Planifié', 'En cours', 'Terminé', 'Annulé']),
  budget: z.number().nonnegative("Le budget ne peut pas être négatif").optional(),
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
  title: z.string().min(3, "Le titre doit contenir au moins 3 caractères").max(200),
  type: z.enum(['Politique', 'Procédure', 'Preuve', 'Rapport', 'Guide', 'Formulaire', 'Autre']),
  version: z.string().regex(/^\d+\.\d+$/, "La version doit être au format X.Y").optional().default("1.0"),
  status: z.enum(['Brouillon', 'Revue', 'Approuvé', 'Publié', 'Archivé']),
  owner: z.string().min(2, "Le propriétaire est requis"),
  url: z.string().url("URL invalide").optional(),
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
  name: z.string().min(3, "Le nom doit contenir au moins 3 caractères").max(150),
  type: z.enum(['Interne', 'Externe', 'Certification']),
  auditor: z.string().min(2, "L'auditeur est requis"),
  dateScheduled: z.string().min(1, "La date planifiée est requise"),
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
  description: z.string().min(10, "La description doit contenir au moins 10 caractères").max(1000),
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
  title: z.string().min(5, "Le titre doit contenir au moins 5 caractères").max(150),
  category: z.enum([
    'Cyberattaque', 'Fuite de données', 'Panne système',
    'Erreur humaine', 'Accès non autorisé', 'Perte/Vol', 'Autre'
  ]),
  severity: z.enum(['Faible', 'Moyenne', 'Élevée', 'Critique']),
  status: z.enum(['Nouveau', 'Investigation', 'Résolu', 'Fermé']),
  description: z.string().min(20, "La description doit contenir au moins 20 caractères").max(2000),
  dateReported: z.string().min(1, "La date de signalement est requise"),
  reportedBy: z.string().min(2, "Le déclarant est requis"),
  affectedAssetIds: z.array(z.string()).optional()
});

export type IncidentFormData = z.infer<typeof IncidentSchema>;

// ============================================================================
// SUPPLIER SCHEMA
// ============================================================================

export const SupplierSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères").max(100),
  type: z.enum(['Fournisseur', 'Sous-traitant', 'Partenaire', 'Prestataire']),
  criticality: z.enum(['Faible', 'Moyenne', 'Élevée', 'Critique']),
  contact: z.string().min(2, "Le contact est requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().optional(),
  contractStartDate: z.string().optional(),
  contractEndDate: z.string().optional(),
  services: z.string().min(5, "La description du service doit contenir au moins 5 caractères").max(500)
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
    return { success: false, errors: ["Erreur de validation inconnue"] };
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
      return error.issues[0]?.message || "Données invalides";
    }
    return "Erreur de validation";
  }
}
