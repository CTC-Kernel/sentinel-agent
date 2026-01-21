/**
 * ANSSI Homologation Level Determination Questions
 *
 * These questions help determine the appropriate homologation level
 * according to ANSSI guidelines. Based on:
 * - Guide d'homologation de sécurité en 9 étapes simples (ANSSI)
 * - RGS (Référentiel Général de Sécurité)
 */

import type { LevelDeterminationQuestion, HomologationLevel } from '../types/homologation';

/**
 * Level determination questions organized by category
 */
export const LEVEL_DETERMINATION_QUESTIONS: LevelDeterminationQuestion[] = [
  // ============================================================================
  // CLASSIFICATION CATEGORY
  // ============================================================================
  {
    id: 'classification_level',
    category: 'classification',
    question: 'Quel est le niveau de classification du système ?',
    questionEn: 'What is the classification level of the system?',
    helpText:
      'La classification détermine le niveau de protection requis selon les règles de sécurité nationale.',
    helpTextEn:
      'Classification determines the required protection level according to national security rules.',
    answerType: 'single',
    options: [
      { value: 'public', label: 'Non protégé (public)', labelEn: 'Unprotected (public)', score: 0 },
      {
        value: 'interne',
        label: 'Usage interne uniquement',
        labelEn: 'Internal use only',
        score: 15
      },
      {
        value: 'diffusion_restreinte',
        label: 'Diffusion Restreinte',
        labelEn: 'Restricted Distribution',
        score: 60,
        escalatesTo: 'standard'
      },
      {
        value: 'secret',
        label: 'Confidentiel Défense / Secret',
        labelEn: 'Defense Confidential / Secret',
        score: 100,
        escalatesTo: 'renforce'
      }
    ],
    weight: 3,
    required: true
  },
  {
    id: 'critical_infrastructure',
    category: 'classification',
    question: "Le système fait-il partie d'une infrastructure critique (OIV/OSE) ?",
    questionEn: 'Is the system part of a critical infrastructure (OIV/OSE)?',
    helpText:
      "Les Opérateurs d'Importance Vitale (OIV) et Opérateurs de Services Essentiels (OSE) ont des exigences renforcées.",
    answerType: 'single',
    options: [
      { value: 'no', label: 'Non', labelEn: 'No', score: 0 },
      { value: 'ose', label: 'OSE (NIS2)', labelEn: 'OSE (NIS2)', score: 50, escalatesTo: 'standard' },
      { value: 'oiv', label: 'OIV (LPM)', labelEn: 'OIV (LPM)', score: 80, escalatesTo: 'renforce' }
    ],
    weight: 3,
    required: true
  },

  // ============================================================================
  // DATA CATEGORY
  // ============================================================================
  {
    id: 'personal_data',
    category: 'data',
    question: 'Le système traite-t-il des données à caractère personnel ?',
    questionEn: 'Does the system process personal data?',
    helpText: 'Données permettant d\'identifier directement ou indirectement une personne (RGPD).',
    answerType: 'single',
    options: [
      { value: 'none', label: 'Aucune donnée personnelle', labelEn: 'No personal data', score: 0 },
      {
        value: 'basic',
        label: 'Données personnelles basiques (nom, email)',
        labelEn: 'Basic personal data (name, email)',
        score: 20
      },
      {
        value: 'sensitive',
        label: 'Données sensibles (santé, opinions, biométrie)',
        labelEn: 'Sensitive data (health, opinions, biometrics)',
        score: 50,
        escalatesTo: 'standard'
      },
      {
        value: 'large_scale',
        label: 'Traitement à grande échelle (>100k personnes)',
        labelEn: 'Large-scale processing (>100k people)',
        score: 40
      }
    ],
    weight: 2,
    required: true
  },
  {
    id: 'financial_data',
    category: 'data',
    question: 'Le système traite-t-il des données financières ?',
    questionEn: 'Does the system process financial data?',
    helpText: 'Données bancaires, fiscales, budgétaires, ou comptables.',
    answerType: 'single',
    options: [
      { value: 'none', label: 'Aucune', labelEn: 'None', score: 0 },
      {
        value: 'internal_budget',
        label: 'Budget interne uniquement',
        labelEn: 'Internal budget only',
        score: 15
      },
      {
        value: 'public_funds',
        label: 'Gestion de fonds publics',
        labelEn: 'Public funds management',
        score: 35
      },
      {
        value: 'payment',
        label: 'Traitement de paiements',
        labelEn: 'Payment processing',
        score: 50
      }
    ],
    weight: 2,
    required: true
  },
  {
    id: 'data_volume',
    category: 'data',
    question: 'Quel est le volume de données traitées ?',
    questionEn: 'What is the volume of data processed?',
    answerType: 'single',
    options: [
      { value: 'minimal', label: 'Minimal (<1 Go)', labelEn: 'Minimal (<1 GB)', score: 0 },
      { value: 'moderate', label: 'Modéré (1-100 Go)', labelEn: 'Moderate (1-100 GB)', score: 10 },
      {
        value: 'significant',
        label: 'Significatif (100 Go - 1 To)',
        labelEn: 'Significant (100 GB - 1 TB)',
        score: 25
      },
      { value: 'large', label: 'Important (>1 To)', labelEn: 'Large (>1 TB)', score: 40 }
    ],
    weight: 1,
    required: true
  },

  // ============================================================================
  // USERS CATEGORY
  // ============================================================================
  {
    id: 'user_count',
    category: 'users',
    question: "Combien d'utilisateurs accèdent au système ?",
    questionEn: 'How many users access the system?',
    answerType: 'single',
    options: [
      { value: 'small', label: 'Moins de 50', labelEn: 'Less than 50', score: 0 },
      { value: 'medium', label: '50 - 500', labelEn: '50 - 500', score: 15 },
      { value: 'large', label: '500 - 5000', labelEn: '500 - 5000', score: 30 },
      { value: 'very_large', label: 'Plus de 5000', labelEn: 'More than 5000', score: 45 }
    ],
    weight: 1,
    required: true
  },
  {
    id: 'external_users',
    category: 'users',
    question: 'Le système est-il accessible à des utilisateurs externes ?',
    questionEn: 'Is the system accessible to external users?',
    helpText: 'Citoyens, partenaires, prestataires, autres administrations.',
    answerType: 'single',
    options: [
      { value: 'internal_only', label: 'Agents internes uniquement', labelEn: 'Internal staff only', score: 0 },
      {
        value: 'partners',
        label: 'Partenaires identifiés',
        labelEn: 'Identified partners',
        score: 20
      },
      { value: 'citizens', label: 'Citoyens (téléservices)', labelEn: 'Citizens (e-services)', score: 35 },
      { value: 'public', label: 'Accès public anonyme', labelEn: 'Anonymous public access', score: 25 }
    ],
    weight: 2,
    required: true
  },
  {
    id: 'privileged_access',
    category: 'users',
    question: "Combien d'utilisateurs ont des droits d'administration ?",
    questionEn: 'How many users have administrative rights?',
    answerType: 'single',
    options: [
      { value: 'few', label: '1-5 administrateurs', labelEn: '1-5 administrators', score: 0 },
      { value: 'moderate', label: '5-20 administrateurs', labelEn: '5-20 administrators', score: 15 },
      { value: 'many', label: 'Plus de 20 administrateurs', labelEn: 'More than 20 administrators', score: 30 }
    ],
    weight: 1,
    required: true
  },

  // ============================================================================
  // INTERCONNECTION CATEGORY
  // ============================================================================
  {
    id: 'internet_exposure',
    category: 'interconnection',
    question: 'Le système est-il exposé sur Internet ?',
    questionEn: 'Is the system exposed to the Internet?',
    answerType: 'single',
    options: [
      { value: 'isolated', label: 'Réseau isolé (air-gap)', labelEn: 'Isolated network (air-gap)', score: 0 },
      { value: 'internal', label: 'Réseau interne uniquement', labelEn: 'Internal network only', score: 10 },
      { value: 'vpn', label: 'Accessible via VPN', labelEn: 'Accessible via VPN', score: 25 },
      { value: 'internet', label: 'Exposé directement sur Internet', labelEn: 'Directly exposed to Internet', score: 45 }
    ],
    weight: 2,
    required: true
  },
  {
    id: 'system_interconnections',
    category: 'interconnection',
    question: "Combien d'autres systèmes sont interconnectés ?",
    questionEn: 'How many other systems are interconnected?',
    helpText: 'Échanges de données avec d\'autres applications, bases de données, services.',
    answerType: 'single',
    options: [
      { value: 'standalone', label: 'Système autonome', labelEn: 'Standalone system', score: 0 },
      { value: 'few', label: '1-5 systèmes', labelEn: '1-5 systems', score: 15 },
      { value: 'moderate', label: '5-15 systèmes', labelEn: '5-15 systems', score: 30 },
      { value: 'many', label: 'Plus de 15 systèmes', labelEn: 'More than 15 systems', score: 45 }
    ],
    weight: 2,
    required: true
  },
  {
    id: 'external_dependencies',
    category: 'interconnection',
    question: 'Le système dépend-il de services cloud ou externes ?',
    questionEn: 'Does the system depend on cloud or external services?',
    answerType: 'single',
    options: [
      { value: 'none', label: 'Aucune dépendance externe', labelEn: 'No external dependencies', score: 0 },
      {
        value: 'saas',
        label: 'Services SaaS non critiques',
        labelEn: 'Non-critical SaaS services',
        score: 15
      },
      {
        value: 'cloud_hosting',
        label: 'Hébergement cloud (IaaS/PaaS)',
        labelEn: 'Cloud hosting (IaaS/PaaS)',
        score: 30
      },
      {
        value: 'critical_external',
        label: 'Services externes critiques',
        labelEn: 'Critical external services',
        score: 45
      }
    ],
    weight: 2,
    required: true
  },

  // ============================================================================
  // INCIDENTS CATEGORY
  // ============================================================================
  {
    id: 'incident_history',
    category: 'incidents',
    question: 'Le système a-t-il connu des incidents de sécurité ?',
    questionEn: 'Has the system experienced security incidents?',
    helpText: 'Incidents significatifs sur les 3 dernières années.',
    answerType: 'single',
    options: [
      { value: 'none', label: 'Aucun incident', labelEn: 'No incidents', score: 0 },
      { value: 'minor', label: 'Incidents mineurs uniquement', labelEn: 'Minor incidents only', score: 15 },
      { value: 'moderate', label: 'Incidents modérés', labelEn: 'Moderate incidents', score: 35 },
      {
        value: 'major',
        label: 'Incidents majeurs avec impact',
        labelEn: 'Major incidents with impact',
        score: 55
      }
    ],
    weight: 2,
    required: true
  },
  {
    id: 'availability_requirement',
    category: 'incidents',
    question: "Quel est le besoin de disponibilité du système ?",
    questionEn: 'What is the availability requirement?',
    answerType: 'single',
    options: [
      { value: 'low', label: 'Faible (tolérance >1 jour)', labelEn: 'Low (tolerance >1 day)', score: 0 },
      {
        value: 'medium',
        label: 'Moyen (tolérance quelques heures)',
        labelEn: 'Medium (tolerance few hours)',
        score: 20
      },
      {
        value: 'high',
        label: 'Élevé (tolérance <1 heure)',
        labelEn: 'High (tolerance <1 hour)',
        score: 40
      },
      {
        value: 'critical',
        label: 'Critique (24/7, pas d\'interruption)',
        labelEn: 'Critical (24/7, no interruption)',
        score: 60
      }
    ],
    weight: 2,
    required: true
  },
  {
    id: 'business_impact',
    category: 'incidents',
    question: "Quel serait l'impact d'une compromission ?",
    questionEn: 'What would be the impact of a compromise?',
    helpText: 'Impact sur les missions, la réputation, les finances.',
    answerType: 'single',
    options: [
      { value: 'negligible', label: 'Négligeable', labelEn: 'Negligible', score: 0 },
      { value: 'limited', label: 'Limité et réversible', labelEn: 'Limited and reversible', score: 20 },
      { value: 'significant', label: 'Significatif', labelEn: 'Significant', score: 45 },
      {
        value: 'critical',
        label: 'Critique / Irréversible',
        labelEn: 'Critical / Irreversible',
        score: 70,
        escalatesTo: 'standard'
      }
    ],
    weight: 3,
    required: true
  },

  // ============================================================================
  // REGULATORY CATEGORY
  // ============================================================================
  {
    id: 'rgpd_applicable',
    category: 'regulatory',
    question: 'Le RGPD s\'applique-t-il au système ?',
    questionEn: 'Does GDPR apply to the system?',
    answerType: 'single',
    options: [
      { value: 'no', label: 'Non applicable', labelEn: 'Not applicable', score: 0 },
      {
        value: 'basic',
        label: 'Oui, traitement basique',
        labelEn: 'Yes, basic processing',
        score: 15
      },
      {
        value: 'pia_required',
        label: 'Oui, AIPD requise',
        labelEn: 'Yes, DPIA required',
        score: 35
      }
    ],
    weight: 1,
    required: true
  },
  {
    id: 'sectoral_regulations',
    category: 'regulatory',
    question: 'Le système est-il soumis à des réglementations sectorielles ?',
    questionEn: 'Is the system subject to sectoral regulations?',
    helpText: 'Santé (HDS), Finance (DORA), Énergie (NIS2), etc.',
    answerType: 'multiple',
    options: [
      { value: 'none', label: 'Aucune', labelEn: 'None', score: 0 },
      { value: 'hds', label: 'HDS (Hébergement Données Santé)', labelEn: 'HDS (Health Data Hosting)', score: 30 },
      { value: 'dora', label: 'DORA (Finance)', labelEn: 'DORA (Finance)', score: 25 },
      { value: 'nis2', label: 'NIS2 (Services Essentiels)', labelEn: 'NIS2 (Essential Services)', score: 25, escalatesTo: 'standard' },
      { value: 'lpm', label: 'LPM (Défense)', labelEn: 'LPM (Defense)', score: 50, escalatesTo: 'renforce' }
    ],
    weight: 2,
    required: true
  },
  {
    id: 'audit_requirements',
    category: 'regulatory',
    question: "Le système est-il soumis à des audits externes obligatoires ?",
    questionEn: 'Is the system subject to mandatory external audits?',
    answerType: 'single',
    options: [
      { value: 'none', label: 'Aucun audit obligatoire', labelEn: 'No mandatory audit', score: 0 },
      { value: 'internal', label: 'Audit interne uniquement', labelEn: 'Internal audit only', score: 10 },
      { value: 'external_periodic', label: 'Audit externe périodique', labelEn: 'Periodic external audit', score: 25 },
      {
        value: 'certification',
        label: 'Certification requise (ISO, SecNumCloud)',
        labelEn: 'Certification required (ISO, SecNumCloud)',
        score: 45
      }
    ],
    weight: 2,
    required: true
  }
];

/**
 * Get questions by category
 */
export function getQuestionsByCategory(
  category: LevelDeterminationQuestion['category']
): LevelDeterminationQuestion[] {
  return LEVEL_DETERMINATION_QUESTIONS.filter((q) => q.category === category);
}

/**
 * Get question by ID
 */
export function getQuestionById(id: string): LevelDeterminationQuestion | undefined {
  return LEVEL_DETERMINATION_QUESTIONS.find((q) => q.id === id);
}

/**
 * Category display order
 */
export const CATEGORY_ORDER: LevelDeterminationQuestion['category'][] = [
  'classification',
  'data',
  'users',
  'interconnection',
  'incidents',
  'regulatory'
];

/**
 * Category display info
 */
export const CATEGORY_INFO: Record<
  LevelDeterminationQuestion['category'],
  { label: string; labelEn: string; description: string; descriptionEn: string }
> = {
  classification: {
    label: 'Classification',
    labelEn: 'Classification',
    description: 'Niveau de sensibilité et classification du système',
    descriptionEn: 'Sensitivity level and system classification'
  },
  data: {
    label: 'Données',
    labelEn: 'Data',
    description: 'Types et volumes de données traitées',
    descriptionEn: 'Types and volumes of data processed'
  },
  users: {
    label: 'Utilisateurs',
    labelEn: 'Users',
    description: "Profil et nombre d'utilisateurs",
    descriptionEn: 'User profile and count'
  },
  interconnection: {
    label: 'Interconnexions',
    labelEn: 'Interconnections',
    description: 'Exposition réseau et dépendances',
    descriptionEn: 'Network exposure and dependencies'
  },
  incidents: {
    label: 'Incidents & Impact',
    labelEn: 'Incidents & Impact',
    description: 'Historique et impact potentiel',
    descriptionEn: 'History and potential impact'
  },
  regulatory: {
    label: 'Réglementaire',
    labelEn: 'Regulatory',
    description: 'Exigences légales et conformité',
    descriptionEn: 'Legal requirements and compliance'
  }
};

/**
 * Level escalation order (for comparison)
 */
export const LEVEL_ORDER: Record<HomologationLevel, number> = {
  etoile: 0,
  simple: 1,
  standard: 2,
  renforce: 3
};

/**
 * Compare two levels, returns true if level1 >= level2
 */
export function isLevelHigherOrEqual(level1: HomologationLevel, level2: HomologationLevel): boolean {
  return LEVEL_ORDER[level1] >= LEVEL_ORDER[level2];
}

/**
 * Get the higher of two levels
 */
export function getHigherLevel(level1: HomologationLevel, level2: HomologationLevel): HomologationLevel {
  return LEVEL_ORDER[level1] >= LEVEL_ORDER[level2] ? level1 : level2;
}
