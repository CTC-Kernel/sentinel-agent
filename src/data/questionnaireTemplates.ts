/**
 * Story 37-1: Vendor Assessment Questionnaire Templates
 *
 * Pre-defined templates for vendor risk assessments:
 * - DORA (Digital Operational Resilience Act)
 * - ISO 27001 (Information Security)
 * - NIS2 (Network and Information Security Directive)
 * - HDS (Hébergeur de Données de Santé)
 * - General Security Best Practices
 */

import type { QuestionnaireSection, SupplierQuestionnaireQuestion } from '../types/business';

// ============================================================================
// Types
// ============================================================================

export interface TemplateMetadata {
  id: string;
  title: string;
  description: string;
  framework: string;
  version: string;
  sectionCount: number;
  questionCount: number;
  estimatedDuration: string; // e.g., "30 minutes"
  applicableTo: string[]; // e.g., ['SaaS', 'Cloud', 'All']
  regulatoryContext?: string;
}

export interface QuestionnaireTemplateData {
  metadata: TemplateMetadata;
  sections: QuestionnaireSection[];
}

// ============================================================================
// Helper Functions
// ============================================================================

const createQuestion = (
  id: string,
  text: string,
  type: 'yes_no' | 'multiple_choice' | 'text' | 'rating' = 'yes_no',
  weight: number = 1,
  required: boolean = true,
  options?: string[],
  helperText?: string
): SupplierQuestionnaireQuestion => ({
  id,
  text,
  type,
  weight,
  required,
  ...(options && { options }),
  ...(helperText && { helperText }),
});

// ============================================================================
// DORA Template
// ============================================================================

export const DORA_TEMPLATE: QuestionnaireTemplateData = {
  metadata: {
    id: 'tpl_dora_v1',
    title: 'Questionnaire de Conformité DORA',
    description: 'Évaluation des exigences du Digital Operational Resilience Act (DORA) pour les prestataires TIC.',
    framework: 'DORA',
    version: '1.0',
    sectionCount: 5,
    questionCount: 18,
    estimatedDuration: '45 minutes',
    applicableTo: ['SaaS', 'Cloud', 'Software', 'Network', 'Security'],
    regulatoryContext: 'Règlement (UE) 2022/2554 - Articles 28-30',
  },
  sections: [
    {
      id: 'dora_gov',
      title: 'Gouvernance TIC',
      description: 'Organisation et gouvernance de la sécurité informatique.',
      weight: 20,
      questions: [
        createQuestion('dora_q1', 'Disposez-vous d\'une politique de sécurité de l\'information (PSSI) documentée et approuvée par la direction ?'),
        createQuestion('dora_q2', 'Avez-vous désigné un responsable de la sécurité des systèmes d\'information (RSSI/CISO) ?'),
        createQuestion('dora_q3', 'Réalisez-vous une analyse de risques TIC au moins annuellement ?'),
        createQuestion('dora_q4', 'Vos employés reçoivent-ils une formation régulière à la sécurité ?'),
      ],
    },
    {
      id: 'dora_risk',
      title: 'Gestion des Risques TIC',
      description: 'Identification, évaluation et traitement des risques liés aux TIC.',
      weight: 20,
      questions: [
        createQuestion('dora_q5', 'Maintenez-vous un registre des actifs TIC critiques ?'),
        createQuestion('dora_q6', 'Avez-vous identifié les fonctions critiques supportées par vos services TIC ?'),
        createQuestion('dora_q7', 'Évaluez-vous les risques liés à vos propres sous-traitants TIC ?'),
      ],
    },
    {
      id: 'dora_incident',
      title: 'Gestion des Incidents',
      description: 'Détection, classification et notification des incidents TIC.',
      weight: 25,
      questions: [
        createQuestion('dora_q8', 'Disposez-vous d\'un processus formel de gestion des incidents TIC majeurs ?'),
        createQuestion('dora_q9', 'Êtes-vous en mesure de notifier vos clients d\'un incident majeur sous 24 heures ?'),
        createQuestion('dora_q10', 'Tenez-vous un registre des incidents TIC avec analyse des causes ?'),
        createQuestion('dora_q11', 'Réalisez-vous des analyses post-incident (post-mortem) ?'),
      ],
    },
    {
      id: 'dora_resilience',
      title: 'Résilience Opérationnelle',
      description: 'Continuité d\'activité et reprise après sinistre.',
      weight: 25,
      questions: [
        createQuestion('dora_q12', 'Disposez-vous d\'un Plan de Continuité d\'Activité (PCA) documenté ?'),
        createQuestion('dora_q13', 'Vos PCA sont-ils testés au moins annuellement ?'),
        createQuestion('dora_q14', 'Vos sauvegardes sont-elles chiffrées et testées régulièrement ?'),
        createQuestion('dora_q15', 'Pouvez-vous garantir un RTO (temps de reprise) inférieur à 4 heures pour les services critiques ?'),
      ],
    },
    {
      id: 'dora_contract',
      title: 'Clauses Contractuelles',
      description: 'Exigences contractuelles DORA.',
      weight: 10,
      questions: [
        createQuestion('dora_q16', 'Acceptez-vous des clauses d\'audit de sécurité par vos clients ?'),
        createQuestion('dora_q17', 'Pouvez-vous fournir des rapports SOC 2 ou équivalents ?'),
        createQuestion('dora_q18', 'Disposez-vous d\'une stratégie de sortie documentée (exit strategy) ?'),
      ],
    },
  ],
};

// ============================================================================
// ISO 27001 Template
// ============================================================================

export const ISO27001_TEMPLATE: QuestionnaireTemplateData = {
  metadata: {
    id: 'tpl_iso27001_v1',
    title: 'Questionnaire ISO 27001',
    description: 'Évaluation de la conformité aux exigences de la norme ISO/IEC 27001:2022.',
    framework: 'ISO 27001:2022',
    version: '1.0',
    sectionCount: 5,
    questionCount: 20,
    estimatedDuration: '60 minutes',
    applicableTo: ['All'],
    regulatoryContext: 'ISO/IEC 27001:2022 - Système de Management de la Sécurité de l\'Information',
  },
  sections: [
    {
      id: 'iso_context',
      title: 'Contexte & Leadership',
      description: 'Compréhension de l\'organisation et engagement de la direction.',
      weight: 15,
      questions: [
        createQuestion('iso_q1', 'Êtes-vous certifié ISO 27001 ?', 'yes_no', 2, true, undefined, 'Une certification valide dispense de nombreuses questions.'),
        createQuestion('iso_q2', 'La direction a-t-elle défini une politique de sécurité de l\'information ?'),
        createQuestion('iso_q3', 'Les rôles et responsabilités en matière de sécurité sont-ils clairement définis ?'),
        createQuestion('iso_q4', 'Des ressources adéquates sont-elles allouées à la sécurité de l\'information ?'),
      ],
    },
    {
      id: 'iso_risk',
      title: 'Gestion des Risques',
      description: 'Processus d\'appréciation et de traitement des risques.',
      weight: 20,
      questions: [
        createQuestion('iso_q5', 'Disposez-vous d\'un processus formel d\'appréciation des risques ?'),
        createQuestion('iso_q6', 'Les risques sont-ils évalués en termes d\'impact et de vraisemblance ?'),
        createQuestion('iso_q7', 'Un plan de traitement des risques est-il documenté et suivi ?'),
        createQuestion('iso_q8', 'Les risques résiduels sont-ils formellement acceptés par la direction ?'),
      ],
    },
    {
      id: 'iso_controls',
      title: 'Mesures de Sécurité',
      description: 'Mise en œuvre des contrôles de sécurité.',
      weight: 30,
      questions: [
        createQuestion('iso_q9', 'Avez-vous défini une Déclaration d\'Applicabilité (SoA) ?'),
        createQuestion('iso_q10', 'Les accès aux systèmes sont-ils gérés selon le principe du moindre privilège ?'),
        createQuestion('iso_q11', 'Les données sensibles sont-elles chiffrées au repos et en transit ?'),
        createQuestion('iso_q12', 'Disposez-vous d\'une solution de détection des intrusions (IDS/IPS) ?'),
        createQuestion('iso_q13', 'Les vulnérabilités sont-elles régulièrement identifiées et corrigées ?'),
        createQuestion('iso_q14', 'Les journaux de sécurité sont-ils collectés et analysés ?'),
      ],
    },
    {
      id: 'iso_ops',
      title: 'Opérations & Continuité',
      description: 'Gestion opérationnelle et continuité d\'activité.',
      weight: 20,
      questions: [
        createQuestion('iso_q15', 'Les changements sont-ils gérés via un processus formel ?'),
        createQuestion('iso_q16', 'Des sauvegardes régulières sont-elles effectuées et testées ?'),
        createQuestion('iso_q17', 'Un plan de continuité d\'activité est-il en place et testé ?'),
        createQuestion('iso_q18', 'Les fournisseurs critiques sont-ils évalués régulièrement ?'),
      ],
    },
    {
      id: 'iso_improve',
      title: 'Amélioration Continue',
      description: 'Surveillance, audit et amélioration du SMSI.',
      weight: 15,
      questions: [
        createQuestion('iso_q19', 'Des audits internes du SMSI sont-ils réalisés régulièrement ?'),
        createQuestion('iso_q20', 'Les non-conformités sont-elles traitées avec des actions correctives ?'),
      ],
    },
  ],
};

// ============================================================================
// NIS2 Template
// ============================================================================

export const NIS2_TEMPLATE: QuestionnaireTemplateData = {
  metadata: {
    id: 'tpl_nis2_v1',
    title: 'Questionnaire NIS2',
    description: 'Évaluation de la conformité à la directive NIS2 (Network and Information Security).',
    framework: 'NIS2',
    version: '1.0',
    sectionCount: 4,
    questionCount: 15,
    estimatedDuration: '40 minutes',
    applicableTo: ['All'],
    regulatoryContext: 'Directive (UE) 2022/2555 - NIS2',
  },
  sections: [
    {
      id: 'nis2_gov',
      title: 'Gouvernance Cyber',
      description: 'Responsabilité de la direction et organisation de la cybersécurité.',
      weight: 25,
      questions: [
        createQuestion('nis2_q1', 'La direction valide-t-elle les mesures de gestion des risques cyber ?'),
        createQuestion('nis2_q2', 'Les dirigeants suivent-ils une formation en cybersécurité ?'),
        createQuestion('nis2_q3', 'Disposez-vous d\'une stratégie de cybersécurité documentée ?'),
        createQuestion('nis2_q4', 'Les responsabilités cyber sont-elles clairement attribuées ?'),
      ],
    },
    {
      id: 'nis2_risk',
      title: 'Gestion des Risques Cyber',
      description: 'Mesures techniques et organisationnelles de gestion des risques.',
      weight: 30,
      questions: [
        createQuestion('nis2_q5', 'Réalisez-vous des analyses de risques cyber régulières ?'),
        createQuestion('nis2_q6', 'Vos systèmes critiques sont-ils segmentés du réseau général ?'),
        createQuestion('nis2_q7', 'Utilisez-vous l\'authentification multi-facteurs (MFA) ?'),
        createQuestion('nis2_q8', 'Vos communications sensibles sont-elles chiffrées ?'),
      ],
    },
    {
      id: 'nis2_incident',
      title: 'Gestion des Incidents',
      description: 'Détection, réponse et notification des incidents cyber.',
      weight: 25,
      questions: [
        createQuestion('nis2_q9', 'Disposez-vous d\'un processus de gestion des incidents cyber ?'),
        createQuestion('nis2_q10', 'Pouvez-vous notifier un incident significatif sous 24 heures ?'),
        createQuestion('nis2_q11', 'Tenez-vous un registre des incidents de sécurité ?'),
      ],
    },
    {
      id: 'nis2_supply',
      title: 'Sécurité de la Chaîne d\'Approvisionnement',
      description: 'Gestion des risques liés aux fournisseurs.',
      weight: 20,
      questions: [
        createQuestion('nis2_q12', 'Évaluez-vous la sécurité de vos fournisseurs critiques ?'),
        createQuestion('nis2_q13', 'Des exigences de sécurité sont-elles incluses dans vos contrats ?'),
        createQuestion('nis2_q14', 'Surveillez-vous les vulnérabilités de vos composants tiers ?'),
        createQuestion('nis2_q15', 'Disposez-vous d\'un inventaire de vos dépendances logicielles (SBOM) ?'),
      ],
    },
  ],
};

// ============================================================================
// HDS Template
// ============================================================================

export const HDS_TEMPLATE: QuestionnaireTemplateData = {
  metadata: {
    id: 'tpl_hds_v1',
    title: 'Questionnaire HDS',
    description: 'Évaluation pour les hébergeurs de données de santé à caractère personnel.',
    framework: 'HDS',
    version: '1.0',
    sectionCount: 6,
    questionCount: 22,
    estimatedDuration: '75 minutes',
    applicableTo: ['Cloud', 'SaaS', 'Hébergement'],
    regulatoryContext: 'Certification HDS - Décret n° 2018-137',
  },
  sections: [
    {
      id: 'hds_cert',
      title: 'Certification & Conformité',
      description: 'Statut de certification et conformité réglementaire.',
      weight: 20,
      questions: [
        createQuestion('hds_q1', 'Êtes-vous certifié HDS (Hébergeur de Données de Santé) ?', 'yes_no', 3),
        createQuestion('hds_q2', 'Si oui, sur quelles activités portent votre certification ?', 'text', 1, false),
        createQuestion('hds_q3', 'Disposez-vous d\'une certification ISO 27001 ?'),
        createQuestion('hds_q4', 'Êtes-vous conforme au RGPD pour le traitement des données de santé ?'),
      ],
    },
    {
      id: 'hds_physical',
      title: 'Sécurité Physique',
      description: 'Protection physique des infrastructures.',
      weight: 15,
      questions: [
        createQuestion('hds_q5', 'Vos datacenters sont-ils certifiés Tier III ou supérieur ?'),
        createQuestion('hds_q6', 'L\'accès physique aux salles serveurs est-il contrôlé et tracé ?'),
        createQuestion('hds_q7', 'Disposez-vous de systèmes de détection d\'intrusion physique ?'),
      ],
    },
    {
      id: 'hds_logical',
      title: 'Sécurité Logique',
      description: 'Protection des systèmes et des données.',
      weight: 25,
      questions: [
        createQuestion('hds_q8', 'Les données de santé sont-elles chiffrées au repos (AES-256 ou équivalent) ?'),
        createQuestion('hds_q9', 'Les communications sont-elles chiffrées en transit (TLS 1.2+) ?'),
        createQuestion('hds_q10', 'Utilisez-vous une authentification forte pour l\'accès aux données de santé ?'),
        createQuestion('hds_q11', 'Les accès aux données sont-ils tracés et conservés 12 mois minimum ?'),
        createQuestion('hds_q12', 'Disposez-vous d\'un SOC ou SIEM pour la détection des incidents ?'),
      ],
    },
    {
      id: 'hds_data',
      title: 'Gestion des Données',
      description: 'Localisation, conservation et portabilité des données.',
      weight: 15,
      questions: [
        createQuestion('hds_q13', 'Les données de santé sont-elles hébergées exclusivement en France ou UE ?'),
        createQuestion('hds_q14', 'Pouvez-vous garantir la portabilité des données sur demande ?'),
        createQuestion('hds_q15', 'Disposez-vous de procédures de destruction sécurisée des données ?'),
      ],
    },
    {
      id: 'hds_continuity',
      title: 'Continuité & Résilience',
      description: 'Plans de continuité et de reprise d\'activité.',
      weight: 15,
      questions: [
        createQuestion('hds_q16', 'Disposez-vous d\'un PCA spécifique aux données de santé ?'),
        createQuestion('hds_q17', 'Vos sauvegardes sont-elles répliquées sur un site distant ?'),
        createQuestion('hds_q18', 'Testez-vous vos procédures de restauration régulièrement ?'),
        createQuestion('hds_q19', 'Pouvez-vous garantir un RTO inférieur à 4 heures ?'),
      ],
    },
    {
      id: 'hds_contract',
      title: 'Aspects Contractuels',
      description: 'Engagements contractuels spécifiques HDS.',
      weight: 10,
      questions: [
        createQuestion('hds_q20', 'Proposez-vous un contrat conforme aux exigences HDS ?'),
        createQuestion('hds_q21', 'Acceptez-vous des audits de conformité par vos clients ?'),
        createQuestion('hds_q22', 'Disposez-vous d\'une assurance cyber couvrant les données de santé ?'),
      ],
    },
  ],
};

// ============================================================================
// General Security Template
// ============================================================================

export const GENERAL_TEMPLATE: QuestionnaireTemplateData = {
  metadata: {
    id: 'tpl_general_v1',
    title: 'Questionnaire Sécurité Générale',
    description: 'Évaluation générale des bonnes pratiques de sécurité pour tout type de fournisseur.',
    framework: 'Best Practices',
    version: '1.0',
    sectionCount: 4,
    questionCount: 12,
    estimatedDuration: '25 minutes',
    applicableTo: ['All'],
    regulatoryContext: 'Bonnes pratiques de sécurité (OWASP, CIS, NIST)',
  },
  sections: [
    {
      id: 'gen_org',
      title: 'Organisation & Gouvernance',
      description: 'Structure organisationnelle de la sécurité.',
      weight: 25,
      questions: [
        createQuestion('gen_q1', 'Disposez-vous d\'une politique de sécurité documentée ?'),
        createQuestion('gen_q2', 'Un responsable sécurité est-il désigné ?'),
        createQuestion('gen_q3', 'Vos employés reçoivent-ils une sensibilisation à la sécurité ?'),
      ],
    },
    {
      id: 'gen_tech',
      title: 'Sécurité Technique',
      description: 'Mesures techniques de protection.',
      weight: 35,
      questions: [
        createQuestion('gen_q4', 'Les données sensibles sont-elles chiffrées ?'),
        createQuestion('gen_q5', 'Utilisez-vous l\'authentification multi-facteurs ?'),
        createQuestion('gen_q6', 'Réalisez-vous des tests de sécurité (pentest, scan vulnérabilités) ?'),
        createQuestion('gen_q7', 'Les correctifs de sécurité sont-ils appliqués dans un délai raisonnable ?'),
      ],
    },
    {
      id: 'gen_incident',
      title: 'Gestion des Incidents',
      description: 'Capacité de réponse aux incidents.',
      weight: 25,
      questions: [
        createQuestion('gen_q8', 'Disposez-vous d\'un processus de gestion des incidents ?'),
        createQuestion('gen_q9', 'Pouvez-vous notifier vos clients en cas d\'incident les concernant ?'),
      ],
    },
    {
      id: 'gen_continuity',
      title: 'Continuité d\'Activité',
      description: 'Résilience et reprise après sinistre.',
      weight: 15,
      questions: [
        createQuestion('gen_q10', 'Réalisez-vous des sauvegardes régulières ?'),
        createQuestion('gen_q11', 'Disposez-vous d\'un plan de continuité d\'activité ?'),
        createQuestion('gen_q12', 'Vos sauvegardes sont-elles testées périodiquement ?'),
      ],
    },
  ],
};

// ============================================================================
// Template Registry
// ============================================================================

export const QUESTIONNAIRE_TEMPLATES: QuestionnaireTemplateData[] = [
  DORA_TEMPLATE,
  ISO27001_TEMPLATE,
  NIS2_TEMPLATE,
  HDS_TEMPLATE,
  GENERAL_TEMPLATE,
];

export const TEMPLATE_METADATA: TemplateMetadata[] = QUESTIONNAIRE_TEMPLATES.map((t) => t.metadata);

/**
 * Get template by ID
 */
export function getTemplateById(id: string): QuestionnaireTemplateData | undefined {
  return QUESTIONNAIRE_TEMPLATES.find((t) => t.metadata.id === id);
}

/**
 * Get templates applicable to a service type
 */
export function getTemplatesForServiceType(serviceType: string): QuestionnaireTemplateData[] {
  return QUESTIONNAIRE_TEMPLATES.filter(
    (t) => t.metadata.applicableTo.includes('All') || t.metadata.applicableTo.includes(serviceType)
  );
}

/**
 * Calculate estimated total questions from all sections
 */
export function calculateTemplateQuestionCount(sections: QuestionnaireSection[]): number {
  return sections.reduce((total, section) => total + section.questions.length, 0);
}

/**
 * Get framework badge color
 */
export function getFrameworkColor(framework: string): { bg: string; text: string; border: string } {
  switch (framework) {
    case 'DORA':
      return { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30' };
    case 'ISO 27001:2022':
      return { bg: 'bg-green-500/10', text: 'text-green-500', border: 'border-green-500/30' };
    case 'NIS2':
      return { bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/30' };
    case 'HDS':
      return { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/30' };
    default:
      return { bg: 'bg-slate-500/10', text: 'text-slate-500', border: 'border-slate-500/30' };
  }
}

export default QUESTIONNAIRE_TEMPLATES;
