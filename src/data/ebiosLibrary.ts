/**
 * EBIOS RM Standard Library Data
 * Pre-defined Risk Sources and Targeted Objectives based on ANSSI methodology
 *
 * Reference: ANSSI EBIOS Risk Manager Guide (2018)
 */

import { RiskSource, TargetedObjective, RiskSourceCategory } from '../types/ebios';

// ============================================================================
// ANSSI Standard Risk Sources (Sources de Risque)
// ============================================================================

export const ANSSI_RISK_SOURCES: Omit<RiskSource, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>[] = [
  // State-Sponsored Actors
  {
    code: 'SR-01',
    category: 'state_sponsored',
    name: 'État hostile - Espionnage',
    description: 'Acteur étatique ou para-étatique menant des opérations d\'espionnage économique, politique ou militaire. Dispose de ressources importantes et de capacités cyber avancées (APT).',
    motivation: 'Acquisition d\'informations stratégiques, avantage géopolitique, suprématie technologique',
    resources: 'Très élevées : équipes dédiées, outils personnalisés, 0-days, infrastructure mondiale',
    isANSSIStandard: true,
  },
  {
    code: 'SR-02',
    category: 'state_sponsored',
    name: 'État hostile - Sabotage',
    description: 'Acteur étatique cherchant à déstabiliser ou détruire des infrastructures critiques. Capacité de mener des opérations de type Stuxnet.',
    motivation: 'Déstabilisation économique, pression géopolitique, dommages aux infrastructures critiques',
    resources: 'Très élevées : capacités offensives avancées, renseignement humain, persistence',
    isANSSIStandard: true,
  },
  {
    code: 'SR-03',
    category: 'state_sponsored',
    name: 'État hostile - Désinformation',
    description: 'Acteur étatique utilisant le cyberespace pour des opérations d\'influence et de désinformation. Peut compromettre des systèmes pour diffuser de fausses informations.',
    motivation: 'Manipulation de l\'opinion publique, déstabilisation politique, atteinte à la réputation',
    resources: 'Élevées : fermes de trolls, bots, capacités de compromission',
    isANSSIStandard: true,
  },

  // Organized Crime
  {
    code: 'SR-04',
    category: 'organized_crime',
    name: 'Crime organisé - Ransomware',
    description: 'Groupe criminel opérant des campagnes de rançongiciel à grande échelle. Utilise des tactiques de double extorsion (chiffrement + exfiltration).',
    motivation: 'Gain financier direct via rançons, revente de données volées',
    resources: 'Élevées : infrastructure RaaS, affiliés, blanchiment crypto',
    isANSSIStandard: true,
  },
  {
    code: 'SR-05',
    category: 'organized_crime',
    name: 'Crime organisé - Fraude financière',
    description: 'Groupe criminel spécialisé dans la fraude bancaire, le vol de données de paiement et les escroqueries BEC (Business Email Compromise).',
    motivation: 'Gain financier via fraude, vol d\'identité, détournement de fonds',
    resources: 'Moyennes à élevées : phishing, malware bancaire, mules',
    isANSSIStandard: true,
  },
  {
    code: 'SR-06',
    category: 'organized_crime',
    name: 'Crime organisé - Vol de données',
    description: 'Groupe criminel ciblant les bases de données clients, informations personnelles et secrets commerciaux pour revente sur le dark web.',
    motivation: 'Monétisation des données volées, chantage, revente à des tiers',
    resources: 'Moyennes : outils d\'intrusion, marketplaces dark web',
    isANSSIStandard: true,
  },

  // Terrorists
  {
    code: 'SR-07',
    category: 'terrorist',
    name: 'Groupe terroriste - Propagande',
    description: 'Organisation terroriste utilisant le cyberespace pour la propagande, le recrutement et la coordination d\'actions.',
    motivation: 'Diffusion idéologique, recrutement, intimidation, financement',
    resources: 'Variables : de faibles à moyennes selon les groupes',
    isANSSIStandard: true,
  },
  {
    code: 'SR-08',
    category: 'terrorist',
    name: 'Groupe terroriste - Sabotage',
    description: 'Organisation terroriste cherchant à mener des cyberattaques destructrices contre des infrastructures critiques.',
    motivation: 'Terreur, destruction, déstabilisation sociétale',
    resources: 'Faibles à moyennes : peut acquérir des capacités via le crime organisé',
    isANSSIStandard: true,
  },

  // Activists / Hacktivists
  {
    code: 'SR-09',
    category: 'activist',
    name: 'Hacktiviste - Idéologique',
    description: 'Individu ou collectif menant des actions cyber pour promouvoir une cause politique, sociale ou environnementale.',
    motivation: 'Dénonciation publique, sensibilisation, pression sur les organisations',
    resources: 'Faibles à moyennes : outils publics, coordination décentralisée',
    isANSSIStandard: true,
  },
  {
    code: 'SR-10',
    category: 'activist',
    name: 'Hacktiviste - Anti-entreprise',
    description: 'Collectif ciblant spécifiquement des entreprises perçues comme non-éthiques ou nuisibles à l\'environnement ou la société.',
    motivation: 'Atteinte à la réputation, divulgation de pratiques controversées',
    resources: 'Faibles à moyennes : DDoS, defacement, fuites de données',
    isANSSIStandard: true,
  },

  // Competitors
  {
    code: 'SR-11',
    category: 'competitor',
    name: 'Concurrent - Espionnage industriel',
    description: 'Entreprise concurrente cherchant à obtenir des secrets commerciaux, brevets, stratégies ou données clients par des moyens illicites.',
    motivation: 'Avantage concurrentiel, réduction des coûts R&D, débauchage',
    resources: 'Variables : peut employer des hackers ou des initiés corrompus',
    isANSSIStandard: true,
  },
  {
    code: 'SR-12',
    category: 'competitor',
    name: 'Concurrent - Déstabilisation',
    description: 'Entreprise concurrente cherchant à nuire à la réputation ou aux opérations d\'un rival commercial.',
    motivation: 'Gagner des parts de marché, éliminer la concurrence',
    resources: 'Moyennes : désinformation, attaques ciblées, manipulation',
    isANSSIStandard: true,
  },

  // Malicious Insiders
  {
    code: 'SR-13',
    category: 'insider_malicious',
    name: 'Initié malveillant - Vengeance',
    description: 'Employé ou ex-employé mécontent cherchant à nuire à l\'organisation suite à un licenciement, conflit ou sentiment d\'injustice.',
    motivation: 'Vengeance personnelle, sentiment d\'injustice, rancoeur',
    resources: 'Élevées : accès légitimes, connaissance des systèmes et processus',
    isANSSIStandard: true,
  },
  {
    code: 'SR-14',
    category: 'insider_malicious',
    name: 'Initié malveillant - Appât du gain',
    description: 'Employé corrompu vendant des informations sensibles ou accès à des tiers (concurrents, criminels, États).',
    motivation: 'Gain financier, enrichissement personnel',
    resources: 'Élevées : accès privilégiés, capacité d\'exfiltration discrète',
    isANSSIStandard: true,
  },
  {
    code: 'SR-15',
    category: 'insider_malicious',
    name: 'Initié malveillant - Idéologique',
    description: 'Employé divulguant des informations par conviction idéologique (lanceur d\'alerte malveillant, militant infiltré).',
    motivation: 'Convictions personnelles, dénonciation, militantisme',
    resources: 'Moyennes à élevées : accès légitimes, connaissance interne',
    isANSSIStandard: true,
  },

  // Negligent Insiders
  {
    code: 'SR-16',
    category: 'insider_negligent',
    name: 'Initié négligent - Erreur humaine',
    description: 'Employé commettant des erreurs de manipulation (mauvais destinataire, configuration erronée, perte de matériel).',
    motivation: 'Aucune intention malveillante - négligence, fatigue, stress',
    resources: 'N/A - actions non intentionnelles mais avec accès légitimes',
    isANSSIStandard: true,
  },
  {
    code: 'SR-17',
    category: 'insider_negligent',
    name: 'Initié négligent - Contournement sécurité',
    description: 'Employé contournant délibérément les politiques de sécurité par commodité (shadow IT, mots de passe faibles).',
    motivation: 'Facilité, productivité perçue, méconnaissance des risques',
    resources: 'N/A - actions non malveillantes mais augmentant l\'exposition',
    isANSSIStandard: true,
  },
  {
    code: 'SR-18',
    category: 'insider_negligent',
    name: 'Initié négligent - Victime de phishing',
    description: 'Employé tombant dans le piège d\'attaques d\'ingénierie sociale (phishing, vishing, pretexting).',
    motivation: 'Aucune - victime de manipulation',
    resources: 'N/A - fournit involontairement accès aux attaquants',
    isANSSIStandard: true,
  },

  // Opportunists
  {
    code: 'SR-19',
    category: 'opportunist',
    name: 'Opportuniste - Script kiddie',
    description: 'Individu peu qualifié utilisant des outils automatisés pour scanner et exploiter des vulnérabilités connues.',
    motivation: 'Curiosité, défi technique, reconnaissance par les pairs',
    resources: 'Faibles : outils publics, tutoriels, exploits packagés',
    isANSSIStandard: true,
  },
  {
    code: 'SR-20',
    category: 'opportunist',
    name: 'Opportuniste - Chercheur de bugs',
    description: 'Hacker éthique ou non cherchant des vulnérabilités pour les monnayer (bug bounty ou marché noir).',
    motivation: 'Gain financier, réputation dans la communauté',
    resources: 'Moyennes : compétences techniques, outils spécialisés',
    isANSSIStandard: true,
  },
];

// ============================================================================
// ANSSI Standard Targeted Objectives (Objectifs Visés)
// ============================================================================

export const ANSSI_TARGETED_OBJECTIVES: Omit<TargetedObjective, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>[] = [
  // Confidentiality Objectives
  {
    code: 'OV-C01',
    name: 'Espionnage des données stratégiques',
    description: 'Accéder aux informations stratégiques de l\'organisation (plans, stratégie, R&D, brevets) pour obtenir un avantage compétitif ou géopolitique.',
    impactType: 'confidentiality',
    isANSSIStandard: true,
  },
  {
    code: 'OV-C02',
    name: 'Vol de données personnelles',
    description: 'Exfiltrer des données personnelles (clients, employés, partenaires) pour usurpation d\'identité, fraude ou revente.',
    impactType: 'confidentiality',
    isANSSIStandard: true,
  },
  {
    code: 'OV-C03',
    name: 'Vol de secrets commerciaux',
    description: 'Dérober des secrets d\'affaires, formules, procédés de fabrication ou informations commerciales confidentielles.',
    impactType: 'confidentiality',
    isANSSIStandard: true,
  },
  {
    code: 'OV-C04',
    name: 'Accès aux communications sensibles',
    description: 'Intercepter ou accéder aux communications internes sensibles (emails direction, négociations, décisions stratégiques).',
    impactType: 'confidentiality',
    isANSSIStandard: true,
  },
  {
    code: 'OV-C05',
    name: 'Vol de données financières',
    description: 'Accéder aux informations financières confidentielles (résultats, prévisions, M&A, données de paiement).',
    impactType: 'confidentiality',
    isANSSIStandard: true,
  },
  {
    code: 'OV-C06',
    name: 'Espionnage des systèmes de sécurité',
    description: 'Obtenir des informations sur l\'architecture de sécurité, les vulnérabilités et les mécanismes de protection.',
    impactType: 'confidentiality',
    isANSSIStandard: true,
  },

  // Integrity Objectives
  {
    code: 'OV-I01',
    name: 'Manipulation de données financières',
    description: 'Modifier des données comptables, financières ou de reporting pour fraude, détournement ou manipulation boursière.',
    impactType: 'integrity',
    isANSSIStandard: true,
  },
  {
    code: 'OV-I02',
    name: 'Altération de données de production',
    description: 'Modifier les paramètres de production, recettes ou processus industriels pour causer des défauts ou accidents.',
    impactType: 'integrity',
    isANSSIStandard: true,
  },
  {
    code: 'OV-I03',
    name: 'Compromission de la supply chain',
    description: 'Injecter du code malveillant dans les logiciels ou composants de la chaîne d\'approvisionnement.',
    impactType: 'integrity',
    isANSSIStandard: true,
  },
  {
    code: 'OV-I04',
    name: 'Falsification de documents officiels',
    description: 'Modifier des contrats, certifications, rapports d\'audit ou autres documents officiels de l\'organisation.',
    impactType: 'integrity',
    isANSSIStandard: true,
  },
  {
    code: 'OV-I05',
    name: 'Manipulation de données clients',
    description: 'Altérer les données des comptes clients (soldes, commandes, historique) pour fraude ou préjudice.',
    impactType: 'integrity',
    isANSSIStandard: true,
  },
  {
    code: 'OV-I06',
    name: 'Défiguration et atteinte à l\'image',
    description: 'Modifier le contenu public de l\'organisation (site web, réseaux sociaux) pour porter atteinte à sa réputation.',
    impactType: 'integrity',
    isANSSIStandard: true,
  },

  // Availability Objectives
  {
    code: 'OV-A01',
    name: 'Paralysie des opérations',
    description: 'Rendre indisponibles les systèmes critiques pour bloquer l\'activité opérationnelle de l\'organisation.',
    impactType: 'availability',
    isANSSIStandard: true,
  },
  {
    code: 'OV-A02',
    name: 'Chiffrement par ransomware',
    description: 'Chiffrer les données et systèmes pour exiger une rançon et/ou exfiltrer les données (double extorsion).',
    impactType: 'availability',
    isANSSIStandard: true,
  },
  {
    code: 'OV-A03',
    name: 'Sabotage des infrastructures',
    description: 'Détruire ou endommager physiquement ou logiquement les infrastructures IT/OT de l\'organisation.',
    impactType: 'availability',
    isANSSIStandard: true,
  },
  {
    code: 'OV-A04',
    name: 'Déni de service',
    description: 'Saturer les services en ligne pour les rendre inaccessibles aux utilisateurs légitimes.',
    impactType: 'availability',
    isANSSIStandard: true,
  },
  {
    code: 'OV-A05',
    name: 'Destruction de données',
    description: 'Effacer définitivement des données critiques pour causer un préjudice maximal (wiper).',
    impactType: 'availability',
    isANSSIStandard: true,
  },
  {
    code: 'OV-A06',
    name: 'Perturbation de la chaîne logistique',
    description: 'Interrompre les systèmes de gestion logistique pour bloquer la production ou la distribution.',
    impactType: 'availability',
    isANSSIStandard: true,
  },
];

// ============================================================================
// Risk Source Category Labels (for UI)
// ============================================================================

export const RISK_SOURCE_CATEGORY_LABELS: Record<RiskSourceCategory, { fr: string; en: string }> = {
  state_sponsored: {
    fr: 'Acteur étatique',
    en: 'State-sponsored',
  },
  organized_crime: {
    fr: 'Crime organisé',
    en: 'Organized crime',
  },
  terrorist: {
    fr: 'Terroriste',
    en: 'Terrorist',
  },
  activist: {
    fr: 'Hacktiviste',
    en: 'Activist/Hacktivist',
  },
  competitor: {
    fr: 'Concurrent',
    en: 'Competitor',
  },
  insider_malicious: {
    fr: 'Initié malveillant',
    en: 'Malicious insider',
  },
  insider_negligent: {
    fr: 'Initié négligent',
    en: 'Negligent insider',
  },
  opportunist: {
    fr: 'Opportuniste',
    en: 'Opportunist',
  },
};

// ============================================================================
// Impact Type Labels (for UI)
// ============================================================================

export const IMPACT_TYPE_LABELS = {
  confidentiality: {
    fr: 'Confidentialité',
    en: 'Confidentiality',
    icon: 'shield-lock',
    color: 'blue',
  },
  integrity: {
    fr: 'Intégrité',
    en: 'Integrity',
    icon: 'shield-check',
    color: 'green',
  },
  availability: {
    fr: 'Disponibilité',
    en: 'Availability',
    icon: 'shield-exclamation',
    color: 'orange',
  },
};

// ============================================================================
// Gravity/Likelihood Scale Labels
// ============================================================================

export const GRAVITY_SCALE = [
  {
    level: 1,
    fr: 'Négligeable',
    en: 'Negligible',
    description: {
      fr: 'Impact mineur, facilement récupérable',
      en: 'Minor impact, easily recoverable',
    },
    color: 'green',
  },
  {
    level: 2,
    fr: 'Limité',
    en: 'Limited',
    description: {
      fr: 'Impact significatif mais gérable',
      en: 'Significant but manageable impact',
    },
    color: 'yellow',
  },
  {
    level: 3,
    fr: 'Important',
    en: 'Important',
    description: {
      fr: 'Impact grave nécessitant des mesures importantes',
      en: 'Serious impact requiring significant measures',
    },
    color: 'orange',
  },
  {
    level: 4,
    fr: 'Critique',
    en: 'Critical',
    description: {
      fr: 'Impact catastrophique menaçant la survie',
      en: 'Catastrophic impact threatening survival',
    },
    color: 'red',
  },
];

export const LIKELIHOOD_SCALE = [
  {
    level: 1,
    fr: 'Minime',
    en: 'Minimal',
    description: {
      fr: 'Très peu probable (< 10%)',
      en: 'Very unlikely (< 10%)',
    },
    color: 'green',
  },
  {
    level: 2,
    fr: 'Significative',
    en: 'Significant',
    description: {
      fr: 'Peu probable (10-30%)',
      en: 'Unlikely (10-30%)',
    },
    color: 'yellow',
  },
  {
    level: 3,
    fr: 'Forte',
    en: 'High',
    description: {
      fr: 'Probable (30-60%)',
      en: 'Likely (30-60%)',
    },
    color: 'orange',
  },
  {
    level: 4,
    fr: 'Maximale',
    en: 'Maximum',
    description: {
      fr: 'Très probable (> 60%)',
      en: 'Very likely (> 60%)',
    },
    color: 'red',
  },
];

// ============================================================================
// Trust Level Scale (for Ecosystem Parties)
// ============================================================================

export const TRUST_LEVEL_SCALE = [
  {
    level: 1,
    fr: 'Très faible',
    en: 'Very low',
    description: {
      fr: 'Aucune confiance, surveillance maximale requise',
      en: 'No trust, maximum surveillance required',
    },
  },
  {
    level: 2,
    fr: 'Faible',
    en: 'Low',
    description: {
      fr: 'Confiance limitée, contrôles stricts',
      en: 'Limited trust, strict controls',
    },
  },
  {
    level: 3,
    fr: 'Modéré',
    en: 'Moderate',
    description: {
      fr: 'Confiance modérée, contrôles standards',
      en: 'Moderate trust, standard controls',
    },
  },
  {
    level: 4,
    fr: 'Élevé',
    en: 'High',
    description: {
      fr: 'Confiance élevée, contrôles allégés',
      en: 'High trust, reduced controls',
    },
  },
  {
    level: 5,
    fr: 'Très élevé',
    en: 'Very high',
    description: {
      fr: 'Confiance totale, partenaire stratégique',
      en: 'Full trust, strategic partner',
    },
  },
];

// ============================================================================
// Workshop Status Labels
// ============================================================================

export const WORKSHOP_STATUS_LABELS = {
  not_started: {
    fr: 'Non démarré',
    en: 'Not started',
    color: 'gray',
  },
  in_progress: {
    fr: 'En cours',
    en: 'In progress',
    color: 'blue',
  },
  completed: {
    fr: 'Terminé',
    en: 'Completed',
    color: 'green',
  },
  validated: {
    fr: 'Validé',
    en: 'Validated',
    color: 'purple',
  },
};

// ============================================================================
// Workshop Names and Descriptions
// ============================================================================

export const WORKSHOP_INFO = {
  1: {
    name: {
      fr: 'Cadrage et socle de sécurité',
      en: 'Scope and security baseline',
    },
    shortName: {
      fr: 'Cadrage',
      en: 'Scope',
    },
    description: {
      fr: 'Définir le périmètre de l\'étude, identifier les missions, biens essentiels et événements redoutés, évaluer le socle de sécurité.',
      en: 'Define the study scope, identify missions, essential assets and feared events, assess security baseline.',
    },
    objectives: {
      fr: [
        'Identifier les missions et valeurs métier',
        'Cartographier les biens essentiels et supports',
        'Identifier les événements redoutés',
        'Évaluer le socle de sécurité existant',
      ],
      en: [
        'Identify business missions and values',
        'Map essential and supporting assets',
        'Identify feared events',
        'Assess existing security baseline',
      ],
    },
  },
  2: {
    name: {
      fr: 'Sources de risque',
      en: 'Risk sources',
    },
    shortName: {
      fr: 'Sources',
      en: 'Sources',
    },
    description: {
      fr: 'Identifier et caractériser les sources de risque pertinentes et leurs objectifs visés pour l\'organisation.',
      en: 'Identify and characterize relevant risk sources and their targeted objectives for the organization.',
    },
    objectives: {
      fr: [
        'Sélectionner les sources de risque pertinentes',
        'Définir les objectifs visés',
        'Établir les couples SR/OV',
        'Prioriser pour l\'analyse',
      ],
      en: [
        'Select relevant risk sources',
        'Define targeted objectives',
        'Establish SR/TO pairs',
        'Prioritize for analysis',
      ],
    },
  },
  3: {
    name: {
      fr: 'Scénarios stratégiques',
      en: 'Strategic scenarios',
    },
    shortName: {
      fr: 'Stratégique',
      en: 'Strategic',
    },
    description: {
      fr: 'Construire une cartographie de l\'écosystème et élaborer les scénarios de menace de haut niveau.',
      en: 'Build an ecosystem map and develop high-level threat scenarios.',
    },
    objectives: {
      fr: [
        'Cartographier l\'écosystème',
        'Identifier les chemins d\'attaque',
        'Construire les scénarios stratégiques',
        'Évaluer la gravité',
      ],
      en: [
        'Map the ecosystem',
        'Identify attack paths',
        'Build strategic scenarios',
        'Assess gravity',
      ],
    },
  },
  4: {
    name: {
      fr: 'Scénarios opérationnels',
      en: 'Operational scenarios',
    },
    shortName: {
      fr: 'Opérationnel',
      en: 'Operational',
    },
    description: {
      fr: 'Détailler les scénarios stratégiques en séquences d\'attaque techniques et évaluer la vraisemblance.',
      en: 'Detail strategic scenarios into technical attack sequences and assess likelihood.',
    },
    objectives: {
      fr: [
        'Détailler les modes opératoires',
        'Référencer les techniques MITRE ATT&CK',
        'Évaluer la vraisemblance',
        'Calculer les niveaux de risque',
      ],
      en: [
        'Detail attack modes',
        'Reference MITRE ATT&CK techniques',
        'Assess likelihood',
        'Calculate risk levels',
      ],
    },
  },
  5: {
    name: {
      fr: 'Traitement du risque',
      en: 'Risk treatment',
    },
    shortName: {
      fr: 'Traitement',
      en: 'Treatment',
    },
    description: {
      fr: 'Définir la stratégie de traitement pour chaque risque et évaluer le risque résiduel.',
      en: 'Define treatment strategy for each risk and assess residual risk.',
    },
    objectives: {
      fr: [
        'Choisir la stratégie de traitement',
        'Sélectionner les mesures de sécurité',
        'Planifier la mise en œuvre',
        'Évaluer le risque résiduel',
      ],
      en: [
        'Choose treatment strategy',
        'Select security measures',
        'Plan implementation',
        'Assess residual risk',
      ],
    },
  },
};

// ============================================================================
// Risk Matrix Configuration
// ============================================================================

export const RISK_MATRIX_CONFIG = {
  levels: {
    low: { max: 4, color: 'green', label: { fr: 'Faible', en: 'Low' } },
    medium: { max: 8, color: 'yellow', label: { fr: 'Moyen', en: 'Medium' } },
    high: { max: 12, color: 'orange', label: { fr: 'Élevé', en: 'High' } },
    critical: { max: 16, color: 'red', label: { fr: 'Critique', en: 'Critical' } },
  },
  getRiskLevel: (gravity: number, likelihood: number) => {
    const score = gravity * likelihood;
    if (score <= 4) return 'low';
    if (score <= 8) return 'medium';
    if (score <= 12) return 'high';
    return 'critical';
  },
};

// ============================================================================
// Sector-Based Risk Source Recommendations (ANSSI)
// ============================================================================

export interface SectorProfile {
  id: string;
  name: { fr: string; en: string };
  description: { fr: string; en: string };
  recommendedSourceCodes: string[];
  recommendedObjectiveCodes: string[];
}

export const SECTOR_PROFILES: Record<string, SectorProfile> = {
  finance: {
    id: 'finance',
    name: { fr: 'Services financiers', en: 'Financial services' },
    description: {
      fr: 'Banques, assurances, fintech, marchés financiers',
      en: 'Banks, insurance, fintech, financial markets',
    },
    recommendedSourceCodes: ['SR-01', 'SR-02', 'SR-04', 'SR-05', 'SR-06', 'SR-11', 'SR-13', 'SR-14'],
    recommendedObjectiveCodes: ['OV-C01', 'OV-C02', 'OV-C05', 'OV-I01', 'OV-I05', 'OV-A01', 'OV-A02'],
  },
  health: {
    id: 'health',
    name: { fr: 'Santé', en: 'Healthcare' },
    description: {
      fr: 'Hôpitaux, cliniques, laboratoires, pharma',
      en: 'Hospitals, clinics, laboratories, pharma',
    },
    recommendedSourceCodes: ['SR-01', 'SR-04', 'SR-06', 'SR-09', 'SR-13', 'SR-16', 'SR-18'],
    recommendedObjectiveCodes: ['OV-C02', 'OV-C03', 'OV-I02', 'OV-A01', 'OV-A02', 'OV-A03'],
  },
  energy: {
    id: 'energy',
    name: { fr: 'Énergie', en: 'Energy' },
    description: {
      fr: 'Électricité, gaz, pétrole, nucléaire, renouvelables',
      en: 'Electricity, gas, oil, nuclear, renewables',
    },
    recommendedSourceCodes: ['SR-01', 'SR-02', 'SR-07', 'SR-08', 'SR-09', 'SR-10'],
    recommendedObjectiveCodes: ['OV-C01', 'OV-I02', 'OV-A01', 'OV-A03', 'OV-A05'],
  },
  telecom: {
    id: 'telecom',
    name: { fr: 'Télécommunications', en: 'Telecommunications' },
    description: {
      fr: 'Opérateurs télécom, FAI, datacenters',
      en: 'Telecom operators, ISPs, datacenters',
    },
    recommendedSourceCodes: ['SR-01', 'SR-02', 'SR-04', 'SR-06', 'SR-07'],
    recommendedObjectiveCodes: ['OV-C01', 'OV-C04', 'OV-A01', 'OV-A03', 'OV-A04'],
  },
  defense: {
    id: 'defense',
    name: { fr: 'Défense', en: 'Defense' },
    description: {
      fr: 'Industries de défense, armement, sécurité nationale',
      en: 'Defense industries, armament, national security',
    },
    recommendedSourceCodes: ['SR-01', 'SR-02', 'SR-03', 'SR-07', 'SR-08', 'SR-13', 'SR-15'],
    recommendedObjectiveCodes: ['OV-C01', 'OV-C03', 'OV-C06', 'OV-I02', 'OV-I03', 'OV-A03', 'OV-A05'],
  },
  retail: {
    id: 'retail',
    name: { fr: 'Commerce de détail', en: 'Retail' },
    description: {
      fr: 'Grande distribution, e-commerce, luxe',
      en: 'Retail chains, e-commerce, luxury',
    },
    recommendedSourceCodes: ['SR-04', 'SR-05', 'SR-11', 'SR-14', 'SR-16', 'SR-19'],
    recommendedObjectiveCodes: ['OV-C02', 'OV-C05', 'OV-I05', 'OV-I06', 'OV-A01', 'OV-A02'],
  },
  public_sector: {
    id: 'public_sector',
    name: { fr: 'Secteur public', en: 'Public sector' },
    description: {
      fr: 'Administrations, collectivités, services publics',
      en: 'Government agencies, local authorities, public services',
    },
    recommendedSourceCodes: ['SR-01', 'SR-03', 'SR-07', 'SR-09', 'SR-10', 'SR-13', 'SR-16'],
    recommendedObjectiveCodes: ['OV-C01', 'OV-C02', 'OV-C04', 'OV-I04', 'OV-I06', 'OV-A01', 'OV-A04'],
  },
  technology: {
    id: 'technology',
    name: { fr: 'Technologie', en: 'Technology' },
    description: {
      fr: 'Éditeurs logiciels, ESN, startups tech',
      en: 'Software vendors, IT services, tech startups',
    },
    recommendedSourceCodes: ['SR-01', 'SR-04', 'SR-06', 'SR-11', 'SR-12', 'SR-14', 'SR-19', 'SR-20'],
    recommendedObjectiveCodes: ['OV-C01', 'OV-C03', 'OV-C06', 'OV-I03', 'OV-A01', 'OV-A02'],
  },
  manufacturing: {
    id: 'manufacturing',
    name: { fr: 'Industrie manufacturière', en: 'Manufacturing' },
    description: {
      fr: 'Automobile, aéronautique, industrie lourde',
      en: 'Automotive, aerospace, heavy industry',
    },
    recommendedSourceCodes: ['SR-01', 'SR-02', 'SR-04', 'SR-11', 'SR-13', 'SR-16'],
    recommendedObjectiveCodes: ['OV-C01', 'OV-C03', 'OV-I02', 'OV-I03', 'OV-A01', 'OV-A03', 'OV-A06'],
  },
  transport: {
    id: 'transport',
    name: { fr: 'Transport', en: 'Transportation' },
    description: {
      fr: 'Aviation, ferroviaire, maritime, logistique',
      en: 'Aviation, rail, maritime, logistics',
    },
    recommendedSourceCodes: ['SR-01', 'SR-02', 'SR-07', 'SR-08', 'SR-09'],
    recommendedObjectiveCodes: ['OV-I02', 'OV-A01', 'OV-A03', 'OV-A06'],
  },
};

/**
 * Get recommended risk sources for a given sector
 */
export function getRecommendedSourcesForSector(sectorId: string): typeof ANSSI_RISK_SOURCES {
  const profile = SECTOR_PROFILES[sectorId];
  if (!profile) return [];

  return ANSSI_RISK_SOURCES.filter((source) =>
    profile.recommendedSourceCodes.includes(source.code)
  );
}

/**
 * Get recommended targeted objectives for a given sector
 */
export function getRecommendedObjectivesForSector(sectorId: string): typeof ANSSI_TARGETED_OBJECTIVES {
  const profile = SECTOR_PROFILES[sectorId];
  if (!profile) return [];

  return ANSSI_TARGETED_OBJECTIVES.filter((objective) =>
    profile.recommendedObjectiveCodes.includes(objective.code)
  );
}
