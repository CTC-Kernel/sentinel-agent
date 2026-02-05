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

// ============================================================================
// Strategic Scenario Templates by Sector
// Story 17.6: Suggestions de Scénarios par Secteur
// ============================================================================

export interface ScenarioTemplate {
 id: string;
 name: { fr: string; en: string };
 description: { fr: string; en: string };
 typicalGravity: 1 | 2 | 3 | 4;
 sectors: string[]; // 'all' for universal templates
 typicalSRCategories: string[];
 typicalImpactTypes: ('confidentiality' | 'integrity' | 'availability')[];
}

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
 // Universal templates (apply to all sectors)
 {
 id: 'tmpl-001',
 name: {
 fr: 'Ransomware via supply chain',
 en: 'Ransomware via supply chain',
 },
 description: {
 fr: 'Un fournisseur de logiciels compromis déploie une mise à jour malveillante contenant un ransomware, chiffrant les systèmes de l\'organisation.',
 en: 'A compromised software vendor deploys a malicious update containing ransomware, encrypting the organization\'s systems.',
 },
 typicalGravity: 4,
 sectors: ['all'],
 typicalSRCategories: ['organized_crime'],
 typicalImpactTypes: ['availability', 'integrity'],
 },
 {
 id: 'tmpl-002',
 name: {
 fr: 'Phishing ciblé vers la direction',
 en: 'Spear phishing targeting executives',
 },
 description: {
 fr: 'Des attaquants envoient des emails de phishing ciblés aux dirigeants pour voler des credentials et accéder aux systèmes sensibles.',
 en: 'Attackers send targeted phishing emails to executives to steal credentials and access sensitive systems.',
 },
 typicalGravity: 3,
 sectors: ['all'],
 typicalSRCategories: ['organized_crime', 'competitor'],
 typicalImpactTypes: ['confidentiality'],
 },
 {
 id: 'tmpl-003',
 name: {
 fr: 'Compromission d\'un fournisseur cloud',
 en: 'Cloud provider compromise',
 },
 description: {
 fr: 'Un attaquant compromet le fournisseur cloud pour accéder aux données hébergées de multiples clients.',
 en: 'An attacker compromises the cloud provider to access hosted data from multiple customers.',
 },
 typicalGravity: 4,
 sectors: ['all'],
 typicalSRCategories: ['state_sponsored', 'organized_crime'],
 typicalImpactTypes: ['confidentiality', 'availability'],
 },
 {
 id: 'tmpl-004',
 name: {
 fr: 'Insider malveillant - Exfiltration',
 en: 'Malicious insider - Data exfiltration',
 },
 description: {
 fr: 'Un employé mécontent ou corrompu exfiltre des données sensibles vers un concurrent ou les revend.',
 en: 'A disgruntled or corrupted employee exfiltrates sensitive data to a competitor or sells it.',
 },
 typicalGravity: 3,
 sectors: ['all'],
 typicalSRCategories: ['insider', 'competitor'],
 typicalImpactTypes: ['confidentiality'],
 },

 // Finance sector templates
 {
 id: 'tmpl-fin-001',
 name: {
 fr: 'Fraude bancaire via BEC',
 en: 'Bank fraud via BEC',
 },
 description: {
 fr: 'Compromission d\'email professionnel (BEC) pour initier des virements frauduleux vers des comptes contrôlés par les attaquants.',
 en: 'Business Email Compromise (BEC) to initiate fraudulent wire transfers to attacker-controlled accounts.',
 },
 typicalGravity: 4,
 sectors: ['finance'],
 typicalSRCategories: ['organized_crime'],
 typicalImpactTypes: ['integrity', 'availability'],
 },
 {
 id: 'tmpl-fin-002',
 name: {
 fr: 'Vol de données de paiement',
 en: 'Payment data theft',
 },
 description: {
 fr: 'Compromission des systèmes de paiement pour voler des données de cartes bancaires à grande échelle.',
 en: 'Compromise of payment systems to steal credit card data at scale.',
 },
 typicalGravity: 4,
 sectors: ['finance', 'retail'],
 typicalSRCategories: ['organized_crime'],
 typicalImpactTypes: ['confidentiality'],
 },

 // Healthcare sector templates
 {
 id: 'tmpl-health-001',
 name: {
 fr: 'Ransomware sur systèmes médicaux',
 en: 'Ransomware on medical systems',
 },
 description: {
 fr: 'Ransomware ciblant les systèmes hospitaliers critiques, paralysant les soins aux patients.',
 en: 'Ransomware targeting critical hospital systems, paralyzing patient care.',
 },
 typicalGravity: 4,
 sectors: ['health'],
 typicalSRCategories: ['organized_crime'],
 typicalImpactTypes: ['availability', 'integrity'],
 },
 {
 id: 'tmpl-health-002',
 name: {
 fr: 'Vol de dossiers médicaux',
 en: 'Medical records theft',
 },
 description: {
 fr: 'Exfiltration massive de dossiers médicaux patients pour revente ou chantage.',
 en: 'Mass exfiltration of patient medical records for resale or blackmail.',
 },
 typicalGravity: 4,
 sectors: ['health'],
 typicalSRCategories: ['organized_crime', 'competitor'],
 typicalImpactTypes: ['confidentiality'],
 },

 // Energy sector templates
 {
 id: 'tmpl-energy-001',
 name: {
 fr: 'Sabotage d\'infrastructure SCADA',
 en: 'SCADA infrastructure sabotage',
 },
 description: {
 fr: 'Attaque étatique ciblant les systèmes SCADA/ICS pour perturber la production d\'énergie.',
 en: 'State-sponsored attack targeting SCADA/ICS systems to disrupt energy production.',
 },
 typicalGravity: 4,
 sectors: ['energy'],
 typicalSRCategories: ['state_sponsored', 'terrorist'],
 typicalImpactTypes: ['availability', 'integrity'],
 },
 {
 id: 'tmpl-energy-002',
 name: {
 fr: 'Espionnage industriel R&D',
 en: 'Industrial R&D espionage',
 },
 description: {
 fr: 'Espionnage ciblant les technologies de production d\'énergie propre ou nucléaire.',
 en: 'Espionage targeting clean energy or nuclear production technologies.',
 },
 typicalGravity: 3,
 sectors: ['energy', 'technology'],
 typicalSRCategories: ['state_sponsored', 'competitor'],
 typicalImpactTypes: ['confidentiality'],
 },

 // Defense sector templates
 {
 id: 'tmpl-def-001',
 name: {
 fr: 'Espionnage via APT',
 en: 'APT-based espionage',
 },
 description: {
 fr: 'Campagne d\'espionnage prolongée par un groupe APT étatique ciblant les secrets de défense.',
 en: 'Prolonged espionage campaign by a state-sponsored APT group targeting defense secrets.',
 },
 typicalGravity: 4,
 sectors: ['defense'],
 typicalSRCategories: ['state_sponsored'],
 typicalImpactTypes: ['confidentiality'],
 },
 {
 id: 'tmpl-def-002',
 name: {
 fr: 'Supply chain armement',
 en: 'Arms supply chain attack',
 },
 description: {
 fr: 'Compromission de la chaîne d\'approvisionnement des équipements militaires pour sabotage ou espionnage.',
 en: 'Compromise of the military equipment supply chain for sabotage or espionage.',
 },
 typicalGravity: 4,
 sectors: ['defense'],
 typicalSRCategories: ['state_sponsored'],
 typicalImpactTypes: ['integrity', 'confidentiality'],
 },

 // Retail sector templates
 {
 id: 'tmpl-retail-001',
 name: {
 fr: 'Compromission site e-commerce',
 en: 'E-commerce site compromise',
 },
 description: {
 fr: 'Injection de code malveillant sur le site e-commerce pour voler les données de paiement des clients.',
 en: 'Malicious code injection on e-commerce site to steal customer payment data.',
 },
 typicalGravity: 3,
 sectors: ['retail'],
 typicalSRCategories: ['organized_crime'],
 typicalImpactTypes: ['confidentiality', 'integrity'],
 },

 // Public sector templates
 {
 id: 'tmpl-public-001',
 name: {
 fr: 'Déstabilisation par désinformation',
 en: 'Destabilization through disinformation',
 },
 description: {
 fr: 'Campagne de désinformation coordonnée utilisant des comptes compromis pour diffuser de fausses informations.',
 en: 'Coordinated disinformation campaign using compromised accounts to spread false information.',
 },
 typicalGravity: 3,
 sectors: ['public_sector'],
 typicalSRCategories: ['state_sponsored', 'hacktivist'],
 typicalImpactTypes: ['integrity'],
 },

 // Technology sector templates
 {
 id: 'tmpl-tech-001',
 name: {
 fr: 'Vol de propriété intellectuelle',
 en: 'Intellectual property theft',
 },
 description: {
 fr: 'Espionnage ciblant le code source, brevets et secrets commerciaux de l\'entreprise technologique.',
 en: 'Espionage targeting source code, patents, and trade secrets of the technology company.',
 },
 typicalGravity: 4,
 sectors: ['technology'],
 typicalSRCategories: ['state_sponsored', 'competitor'],
 typicalImpactTypes: ['confidentiality'],
 },
];

/**
 * Get scenario templates for a given sector
 */
export function getScenarioTemplatesForSector(sectorId: string): ScenarioTemplate[] {
 return SCENARIO_TEMPLATES.filter(
 (template) => template.sectors.includes(sectorId) || template.sectors.includes('all')
 );
}

/**
 * Score a scenario template based on context
 */
export function scoreScenarioTemplate(
 template: ScenarioTemplate,
 sectorId: string,
 selectedSRCategory?: string,
 selectedImpactType?: string
): number {
 let score = 0;

 // Sector match (50 points)
 if (template.sectors.includes(sectorId)) {
 score += 50;
 } else if (template.sectors.includes('all')) {
 score += 30;
 }

 // SR category match (25 points)
 if (selectedSRCategory && template.typicalSRCategories.includes(selectedSRCategory)) {
 score += 25;
 }

 // Impact type match (25 points)
 if (selectedImpactType && template.typicalImpactTypes.includes(selectedImpactType as 'confidentiality' | 'integrity' | 'availability')) {
 score += 25;
 }

 return score;
}

// ============================================================================
// MITRE ATT&CK Framework Data
// Story 18.2 & 18.6: Attack Sequences and MITRE Suggestions
// ============================================================================

/**
 * MITRE ATT&CK Tactic (Kill Chain phase)
 */
export interface MitreTactic {
 id: string;
 name: { fr: string; en: string };
 description: { fr: string; en: string };
 order: number;
}

/**
 * MITRE ATT&CK Technique
 */
export interface MitreTechniqueData {
 id: string; // e.g., T1566
 tacticId: string;
 name: { fr: string; en: string };
 description: { fr: string; en: string };
 subtechniques?: MitreSubtechnique[];
}

export interface MitreSubtechnique {
 id: string; // e.g., T1566.001
 name: { fr: string; en: string };
 description: { fr: string; en: string };
}

/**
 * MITRE ATT&CK Tactics (Enterprise Matrix)
 * Order follows the typical kill chain progression
 */
export const MITRE_TACTICS: MitreTactic[] = [
 {
 id: 'reconnaissance',
 name: { fr: 'Reconnaissance', en: 'Reconnaissance' },
 description: {
 fr: 'Collecte d\'informations sur la cible avant l\'attaque',
 en: 'Gathering information about the target before the attack',
 },
 order: 1,
 },
 {
 id: 'resource-development',
 name: { fr: 'Développement de ressources', en: 'Resource Development' },
 description: {
 fr: 'Préparation de l\'infrastructure et des outils d\'attaque',
 en: 'Preparing attack infrastructure and tools',
 },
 order: 2,
 },
 {
 id: 'initial-access',
 name: { fr: 'Accès initial', en: 'Initial Access' },
 description: {
 fr: 'Techniques pour pénétrer dans le réseau cible',
 en: 'Techniques for getting into the target network',
 },
 order: 3,
 },
 {
 id: 'execution',
 name: { fr: 'Exécution', en: 'Execution' },
 description: {
 fr: 'Exécution de code malveillant sur le système',
 en: 'Running malicious code on the system',
 },
 order: 4,
 },
 {
 id: 'persistence',
 name: { fr: 'Persistance', en: 'Persistence' },
 description: {
 fr: 'Maintien de l\'accès au système compromis',
 en: 'Maintaining access to the compromised system',
 },
 order: 5,
 },
 {
 id: 'privilege-escalation',
 name: { fr: 'Élévation de privilèges', en: 'Privilege Escalation' },
 description: {
 fr: 'Obtention de droits plus élevés sur le système',
 en: 'Gaining higher-level permissions on the system',
 },
 order: 6,
 },
 {
 id: 'defense-evasion',
 name: { fr: 'Évasion des défenses', en: 'Defense Evasion' },
 description: {
 fr: 'Techniques pour éviter la détection',
 en: 'Techniques to avoid detection',
 },
 order: 7,
 },
 {
 id: 'credential-access',
 name: { fr: 'Accès aux identifiants', en: 'Credential Access' },
 description: {
 fr: 'Vol de noms d\'utilisateur et mots de passe',
 en: 'Stealing account names and passwords',
 },
 order: 8,
 },
 {
 id: 'discovery',
 name: { fr: 'Découverte', en: 'Discovery' },
 description: {
 fr: 'Exploration de l\'environnement compromis',
 en: 'Exploring the compromised environment',
 },
 order: 9,
 },
 {
 id: 'lateral-movement',
 name: { fr: 'Mouvement latéral', en: 'Lateral Movement' },
 description: {
 fr: 'Déplacement à travers le réseau',
 en: 'Moving through the network',
 },
 order: 10,
 },
 {
 id: 'collection',
 name: { fr: 'Collecte', en: 'Collection' },
 description: {
 fr: 'Collecte des données ciblées',
 en: 'Gathering target data',
 },
 order: 11,
 },
 {
 id: 'command-and-control',
 name: { fr: 'Commandement et contrôle', en: 'Command and Control' },
 description: {
 fr: 'Communication avec les systèmes compromis',
 en: 'Communicating with compromised systems',
 },
 order: 12,
 },
 {
 id: 'exfiltration',
 name: { fr: 'Exfiltration', en: 'Exfiltration' },
 description: {
 fr: 'Vol et transfert des données hors du réseau',
 en: 'Stealing and transferring data out of the network',
 },
 order: 13,
 },
 {
 id: 'impact',
 name: { fr: 'Impact', en: 'Impact' },
 description: {
 fr: 'Perturbation, destruction ou manipulation des systèmes',
 en: 'Disrupting, destroying, or manipulating systems',
 },
 order: 14,
 },
];

/**
 * MITRE ATT&CK Techniques (Common/Important ones)
 * This is a curated subset of the most relevant techniques for EBIOS RM
 */
export const MITRE_TECHNIQUES: MitreTechniqueData[] = [
 // Reconnaissance
 {
 id: 'T1595',
 tacticId: 'reconnaissance',
 name: { fr: 'Scan actif', en: 'Active Scanning' },
 description: {
 fr: 'Scanner l\'infrastructure de la cible pour identifier les vulnérabilités',
 en: 'Scanning target infrastructure to identify vulnerabilities',
 },
 subtechniques: [
 { id: 'T1595.001', name: { fr: 'Scan d\'IPs', en: 'Scanning IP Blocks' }, description: { fr: 'Scanner des plages d\'adresses IP', en: 'Scanning IP address ranges' } },
 { id: 'T1595.002', name: { fr: 'Scan de vulnérabilités', en: 'Vulnerability Scanning' }, description: { fr: 'Scanner pour identifier les vulnérabilités', en: 'Scanning to identify vulnerabilities' } },
 ],
 },
 {
 id: 'T1589',
 tacticId: 'reconnaissance',
 name: { fr: 'Collecte d\'identités', en: 'Gather Victim Identity Information' },
 description: {
 fr: 'Collecter des informations sur les identités de la cible',
 en: 'Gathering information about target identities',
 },
 subtechniques: [
 { id: 'T1589.001', name: { fr: 'Credentials', en: 'Credentials' }, description: { fr: 'Collecter des identifiants', en: 'Gathering credentials' } },
 { id: 'T1589.002', name: { fr: 'Adresses email', en: 'Email Addresses' }, description: { fr: 'Collecter des adresses email', en: 'Gathering email addresses' } },
 ],
 },

 // Initial Access
 {
 id: 'T1566',
 tacticId: 'initial-access',
 name: { fr: 'Phishing', en: 'Phishing' },
 description: {
 fr: 'Envoyer des messages d\'hameçonnage pour obtenir un accès',
 en: 'Sending phishing messages to gain access',
 },
 subtechniques: [
 { id: 'T1566.001', name: { fr: 'Pièce jointe', en: 'Spearphishing Attachment' }, description: { fr: 'Phishing avec pièce jointe malveillante', en: 'Phishing with malicious attachment' } },
 { id: 'T1566.002', name: { fr: 'Lien', en: 'Spearphishing Link' }, description: { fr: 'Phishing avec lien malveillant', en: 'Phishing with malicious link' } },
 { id: 'T1566.003', name: { fr: 'Via service', en: 'Spearphishing via Service' }, description: { fr: 'Phishing via un service tiers', en: 'Phishing via a third-party service' } },
 ],
 },
 {
 id: 'T1190',
 tacticId: 'initial-access',
 name: { fr: 'Exploitation d\'application publique', en: 'Exploit Public-Facing Application' },
 description: {
 fr: 'Exploiter une vulnérabilité dans une application exposée sur Internet',
 en: 'Exploiting a vulnerability in an Internet-facing application',
 },
 },
 {
 id: 'T1133',
 tacticId: 'initial-access',
 name: { fr: 'Services distants externes', en: 'External Remote Services' },
 description: {
 fr: 'Utiliser des services distants légitimes (VPN, RDP) pour accéder',
 en: 'Using legitimate remote services (VPN, RDP) for access',
 },
 },
 {
 id: 'T1078',
 tacticId: 'initial-access',
 name: { fr: 'Comptes valides', en: 'Valid Accounts' },
 description: {
 fr: 'Utiliser des identifiants légitimes compromis',
 en: 'Using compromised legitimate credentials',
 },
 subtechniques: [
 { id: 'T1078.001', name: { fr: 'Comptes par défaut', en: 'Default Accounts' }, description: { fr: 'Utiliser des comptes par défaut', en: 'Using default accounts' } },
 { id: 'T1078.002', name: { fr: 'Comptes domaine', en: 'Domain Accounts' }, description: { fr: 'Utiliser des comptes de domaine', en: 'Using domain accounts' } },
 { id: 'T1078.004', name: { fr: 'Comptes cloud', en: 'Cloud Accounts' }, description: { fr: 'Utiliser des comptes cloud', en: 'Using cloud accounts' } },
 ],
 },
 {
 id: 'T1195',
 tacticId: 'initial-access',
 name: { fr: 'Compromission supply chain', en: 'Supply Chain Compromise' },
 description: {
 fr: 'Compromettre un fournisseur pour atteindre la cible',
 en: 'Compromising a supplier to reach the target',
 },
 subtechniques: [
 { id: 'T1195.001', name: { fr: 'Dépendances logicielles', en: 'Compromise Software Dependencies' }, description: { fr: 'Compromettre les dépendances', en: 'Compromising software dependencies' } },
 { id: 'T1195.002', name: { fr: 'Supply chain logicielle', en: 'Compromise Software Supply Chain' }, description: { fr: 'Compromettre la chaîne logicielle', en: 'Compromising software supply chain' } },
 ],
 },
 {
 id: 'T1199',
 tacticId: 'initial-access',
 name: { fr: 'Relation de confiance', en: 'Trusted Relationship' },
 description: {
 fr: 'Abuser d\'une relation de confiance avec un partenaire',
 en: 'Abusing a trusted relationship with a partner',
 },
 },

 // Execution
 {
 id: 'T1059',
 tacticId: 'execution',
 name: { fr: 'Interpréteur de commandes', en: 'Command and Scripting Interpreter' },
 description: {
 fr: 'Utiliser des interpréteurs de commandes pour exécuter du code',
 en: 'Using command interpreters to execute code',
 },
 subtechniques: [
 { id: 'T1059.001', name: { fr: 'PowerShell', en: 'PowerShell' }, description: { fr: 'Exécution via PowerShell', en: 'Execution via PowerShell' } },
 { id: 'T1059.003', name: { fr: 'Cmd Windows', en: 'Windows Command Shell' }, description: { fr: 'Exécution via cmd.exe', en: 'Execution via cmd.exe' } },
 { id: 'T1059.004', name: { fr: 'Shell Unix', en: 'Unix Shell' }, description: { fr: 'Exécution via bash/sh', en: 'Execution via bash/sh' } },
 ],
 },
 {
 id: 'T1204',
 tacticId: 'execution',
 name: { fr: 'Exécution utilisateur', en: 'User Execution' },
 description: {
 fr: 'Inciter l\'utilisateur à exécuter du code malveillant',
 en: 'Tricking user into executing malicious code',
 },
 subtechniques: [
 { id: 'T1204.001', name: { fr: 'Lien malveillant', en: 'Malicious Link' }, description: { fr: 'Clic sur lien malveillant', en: 'Clicking malicious link' } },
 { id: 'T1204.002', name: { fr: 'Fichier malveillant', en: 'Malicious File' }, description: { fr: 'Ouverture fichier malveillant', en: 'Opening malicious file' } },
 ],
 },

 // Persistence
 {
 id: 'T1098',
 tacticId: 'persistence',
 name: { fr: 'Manipulation de compte', en: 'Account Manipulation' },
 description: {
 fr: 'Modifier les comptes pour maintenir l\'accès',
 en: 'Modifying accounts to maintain access',
 },
 },
 {
 id: 'T1136',
 tacticId: 'persistence',
 name: { fr: 'Création de compte', en: 'Create Account' },
 description: {
 fr: 'Créer un nouveau compte pour la persistance',
 en: 'Creating a new account for persistence',
 },
 },
 {
 id: 'T1053',
 tacticId: 'persistence',
 name: { fr: 'Tâche planifiée', en: 'Scheduled Task/Job' },
 description: {
 fr: 'Utiliser des tâches planifiées pour la persistance',
 en: 'Using scheduled tasks for persistence',
 },
 },

 // Privilege Escalation
 {
 id: 'T1548',
 tacticId: 'privilege-escalation',
 name: { fr: 'Abus mécanisme élévation', en: 'Abuse Elevation Control Mechanism' },
 description: {
 fr: 'Abuser des mécanismes d\'élévation de privilèges',
 en: 'Abusing privilege elevation mechanisms',
 },
 subtechniques: [
 { id: 'T1548.002', name: { fr: 'Bypass UAC', en: 'Bypass UAC' }, description: { fr: 'Contourner le contrôle UAC', en: 'Bypassing User Account Control' } },
 ],
 },
 {
 id: 'T1068',
 tacticId: 'privilege-escalation',
 name: { fr: 'Exploitation pour élévation', en: 'Exploitation for Privilege Escalation' },
 description: {
 fr: 'Exploiter une vulnérabilité pour élever les privilèges',
 en: 'Exploiting a vulnerability to elevate privileges',
 },
 },

 // Defense Evasion
 {
 id: 'T1070',
 tacticId: 'defense-evasion',
 name: { fr: 'Suppression d\'indicateurs', en: 'Indicator Removal' },
 description: {
 fr: 'Supprimer les traces de l\'attaque',
 en: 'Removing traces of the attack',
 },
 subtechniques: [
 { id: 'T1070.001', name: { fr: 'Effacement logs Windows', en: 'Clear Windows Event Logs' }, description: { fr: 'Effacer les journaux Windows', en: 'Clearing Windows event logs' } },
 { id: 'T1070.004', name: { fr: 'Suppression fichiers', en: 'File Deletion' }, description: { fr: 'Supprimer des fichiers', en: 'Deleting files' } },
 ],
 },
 {
 id: 'T1027',
 tacticId: 'defense-evasion',
 name: { fr: 'Fichiers/infos obfusqués', en: 'Obfuscated Files or Information' },
 description: {
 fr: 'Obfusquer le code malveillant pour éviter la détection',
 en: 'Obfuscating malicious code to avoid detection',
 },
 },
 {
 id: 'T1562',
 tacticId: 'defense-evasion',
 name: { fr: 'Altération des défenses', en: 'Impair Defenses' },
 description: {
 fr: 'Désactiver ou modifier les outils de sécurité',
 en: 'Disabling or modifying security tools',
 },
 subtechniques: [
 { id: 'T1562.001', name: { fr: 'Désactiver outils', en: 'Disable or Modify Tools' }, description: { fr: 'Désactiver les outils de sécurité', en: 'Disabling security tools' } },
 ],
 },

 // Credential Access
 {
 id: 'T1110',
 tacticId: 'credential-access',
 name: { fr: 'Brute force', en: 'Brute Force' },
 description: {
 fr: 'Deviner les mots de passe par force brute',
 en: 'Guessing passwords through brute force',
 },
 subtechniques: [
 { id: 'T1110.001', name: { fr: 'Password guessing', en: 'Password Guessing' }, description: { fr: 'Deviner les mots de passe', en: 'Guessing passwords' } },
 { id: 'T1110.003', name: { fr: 'Password spraying', en: 'Password Spraying' }, description: { fr: 'Tester un mot de passe sur plusieurs comptes', en: 'Testing one password across many accounts' } },
 ],
 },
 {
 id: 'T1003',
 tacticId: 'credential-access',
 name: { fr: 'Dump de credentials', en: 'OS Credential Dumping' },
 description: {
 fr: 'Extraire les identifiants du système d\'exploitation',
 en: 'Extracting credentials from the operating system',
 },
 subtechniques: [
 { id: 'T1003.001', name: { fr: 'LSASS Memory', en: 'LSASS Memory' }, description: { fr: 'Extraire de la mémoire LSASS', en: 'Extracting from LSASS memory' } },
 { id: 'T1003.003', name: { fr: 'NTDS', en: 'NTDS' }, description: { fr: 'Extraire du fichier NTDS', en: 'Extracting from NTDS file' } },
 ],
 },
 {
 id: 'T1555',
 tacticId: 'credential-access',
 name: { fr: 'Credentials des password stores', en: 'Credentials from Password Stores' },
 description: {
 fr: 'Extraire les mots de passe des gestionnaires',
 en: 'Extracting passwords from password managers',
 },
 },

 // Discovery
 {
 id: 'T1087',
 tacticId: 'discovery',
 name: { fr: 'Découverte de comptes', en: 'Account Discovery' },
 description: {
 fr: 'Lister les comptes du système ou domaine',
 en: 'Listing accounts on the system or domain',
 },
 },
 {
 id: 'T1083',
 tacticId: 'discovery',
 name: { fr: 'Découverte fichiers/dossiers', en: 'File and Directory Discovery' },
 description: {
 fr: 'Lister les fichiers et dossiers',
 en: 'Listing files and directories',
 },
 },
 {
 id: 'T1046',
 tacticId: 'discovery',
 name: { fr: 'Scan des services réseau', en: 'Network Service Discovery' },
 description: {
 fr: 'Scanner les services du réseau interne',
 en: 'Scanning internal network services',
 },
 },

 // Lateral Movement
 {
 id: 'T1021',
 tacticId: 'lateral-movement',
 name: { fr: 'Services distants', en: 'Remote Services' },
 description: {
 fr: 'Utiliser les services distants pour se déplacer',
 en: 'Using remote services for lateral movement',
 },
 subtechniques: [
 { id: 'T1021.001', name: { fr: 'RDP', en: 'Remote Desktop Protocol' }, description: { fr: 'Mouvement via RDP', en: 'Movement via RDP' } },
 { id: 'T1021.002', name: { fr: 'SMB/Admin Shares', en: 'SMB/Windows Admin Shares' }, description: { fr: 'Mouvement via partages admin', en: 'Movement via admin shares' } },
 { id: 'T1021.004', name: { fr: 'SSH', en: 'SSH' }, description: { fr: 'Mouvement via SSH', en: 'Movement via SSH' } },
 ],
 },
 {
 id: 'T1570',
 tacticId: 'lateral-movement',
 name: { fr: 'Transfert d\'outil latéral', en: 'Lateral Tool Transfer' },
 description: {
 fr: 'Transférer des outils entre systèmes compromis',
 en: 'Transferring tools between compromised systems',
 },
 },

 // Collection
 {
 id: 'T1560',
 tacticId: 'collection',
 name: { fr: 'Archivage de données', en: 'Archive Collected Data' },
 description: {
 fr: 'Compresser/archiver les données collectées',
 en: 'Compressing/archiving collected data',
 },
 },
 {
 id: 'T1005',
 tacticId: 'collection',
 name: { fr: 'Données système local', en: 'Data from Local System' },
 description: {
 fr: 'Collecter des données du système local',
 en: 'Collecting data from local system',
 },
 },
 {
 id: 'T1114',
 tacticId: 'collection',
 name: { fr: 'Collecte d\'emails', en: 'Email Collection' },
 description: {
 fr: 'Collecter les emails de la cible',
 en: 'Collecting target emails',
 },
 subtechniques: [
 { id: 'T1114.002', name: { fr: 'Email à distance', en: 'Remote Email Collection' }, description: { fr: 'Collecter emails via accès distant', en: 'Collecting emails via remote access' } },
 ],
 },

 // Command and Control
 {
 id: 'T1071',
 tacticId: 'command-and-control',
 name: { fr: 'Protocole application', en: 'Application Layer Protocol' },
 description: {
 fr: 'Utiliser des protocoles applicatifs pour C2',
 en: 'Using application protocols for C2',
 },
 subtechniques: [
 { id: 'T1071.001', name: { fr: 'Web Protocols', en: 'Web Protocols' }, description: { fr: 'C2 via HTTP/HTTPS', en: 'C2 via HTTP/HTTPS' } },
 { id: 'T1071.004', name: { fr: 'DNS', en: 'DNS' }, description: { fr: 'C2 via DNS', en: 'C2 via DNS' } },
 ],
 },
 {
 id: 'T1105',
 tacticId: 'command-and-control',
 name: { fr: 'Transfert d\'outils', en: 'Ingress Tool Transfer' },
 description: {
 fr: 'Transférer des outils depuis l\'extérieur',
 en: 'Transferring tools from outside',
 },
 },

 // Exfiltration
 {
 id: 'T1048',
 tacticId: 'exfiltration',
 name: { fr: 'Exfiltration protocole alternatif', en: 'Exfiltration Over Alternative Protocol' },
 description: {
 fr: 'Exfiltrer via un protocole non-C2',
 en: 'Exfiltrating via non-C2 protocol',
 },
 },
 {
 id: 'T1041',
 tacticId: 'exfiltration',
 name: { fr: 'Exfiltration via C2', en: 'Exfiltration Over C2 Channel' },
 description: {
 fr: 'Exfiltrer via le canal de commande',
 en: 'Exfiltrating via command channel',
 },
 },
 {
 id: 'T1567',
 tacticId: 'exfiltration',
 name: { fr: 'Exfiltration via web service', en: 'Exfiltration Over Web Service' },
 description: {
 fr: 'Exfiltrer via un service web légitime',
 en: 'Exfiltrating via legitimate web service',
 },
 subtechniques: [
 { id: 'T1567.002', name: { fr: 'Cloud Storage', en: 'Exfiltration to Cloud Storage' }, description: { fr: 'Exfiltrer vers stockage cloud', en: 'Exfiltrating to cloud storage' } },
 ],
 },

 // Impact
 {
 id: 'T1486',
 tacticId: 'impact',
 name: { fr: 'Chiffrement pour impact', en: 'Data Encrypted for Impact' },
 description: {
 fr: 'Chiffrer les données pour demander une rançon',
 en: 'Encrypting data to demand ransom',
 },
 },
 {
 id: 'T1485',
 tacticId: 'impact',
 name: { fr: 'Destruction de données', en: 'Data Destruction' },
 description: {
 fr: 'Détruire définitivement les données',
 en: 'Permanently destroying data',
 },
 },
 {
 id: 'T1489',
 tacticId: 'impact',
 name: { fr: 'Arrêt de services', en: 'Service Stop' },
 description: {
 fr: 'Arrêter des services critiques',
 en: 'Stopping critical services',
 },
 },
 {
 id: 'T1491',
 tacticId: 'impact',
 name: { fr: 'Défiguration', en: 'Defacement' },
 description: {
 fr: 'Modifier le contenu pour nuire à l\'image',
 en: 'Modifying content to damage reputation',
 },
 },
 {
 id: 'T1499',
 tacticId: 'impact',
 name: { fr: 'Déni de service endpoint', en: 'Endpoint Denial of Service' },
 description: {
 fr: 'Rendre un service indisponible',
 en: 'Making a service unavailable',
 },
 },
];

/**
 * Kill chain flow - valid tactic transitions
 */
export const KILL_CHAIN_FLOW: Record<string, string[]> = {
 'reconnaissance': ['resource-development', 'initial-access'],
 'resource-development': ['initial-access'],
 'initial-access': ['execution', 'persistence'],
 'execution': ['persistence', 'privilege-escalation', 'defense-evasion'],
 'persistence': ['privilege-escalation', 'defense-evasion', 'credential-access'],
 'privilege-escalation': ['defense-evasion', 'credential-access', 'discovery'],
 'defense-evasion': ['credential-access', 'discovery', 'lateral-movement'],
 'credential-access': ['discovery', 'lateral-movement'],
 'discovery': ['lateral-movement', 'collection'],
 'lateral-movement': ['collection', 'discovery', 'credential-access'],
 'collection': ['command-and-control', 'exfiltration'],
 'command-and-control': ['exfiltration', 'impact'],
 'exfiltration': ['impact'],
 'impact': [],
};

/**
 * Search MITRE techniques by query
 */
export function searchMitreTechniques(query: string, locale: 'fr' | 'en' = 'fr'): MitreTechniqueData[] {
 const lowerQuery = query.toLowerCase();

 return MITRE_TECHNIQUES.filter((technique) => {
 // Search in ID
 if (technique.id.toLowerCase().includes(lowerQuery)) return true;

 // Search in name
 if (technique.name[locale].toLowerCase().includes(lowerQuery)) return true;

 // Search in description
 if (technique.description[locale].toLowerCase().includes(lowerQuery)) return true;

 // Search in subtechniques
 if (technique.subtechniques?.some(sub =>
 sub.id.toLowerCase().includes(lowerQuery) ||
 sub.name[locale].toLowerCase().includes(lowerQuery)
 )) return true;

 return false;
 });
}

/**
 * Get techniques for a specific tactic
 */
export function getTechniquesForTactic(tacticId: string): MitreTechniqueData[] {
 return MITRE_TECHNIQUES.filter((technique) => technique.tacticId === tacticId);
}

/**
 * Get suggested next tactics based on current tactic
 */
export function getNextTactics(currentTacticId: string): MitreTactic[] {
 const nextTacticIds = KILL_CHAIN_FLOW[currentTacticId] || [];
 return MITRE_TACTICS.filter((tactic) => nextTacticIds.includes(tactic.id));
}

/**
 * Get technique suggestions based on context
 */
export function getMitreSuggestions(
 previousTacticId: string | null,
 targetAssetType?: 'information_system' | 'personnel' | 'premises' | 'organization'
): MitreTechniqueData[] {
 let suggestions: MitreTechniqueData[] = [];

 // If no previous tactic, suggest initial access techniques
 if (!previousTacticId) {
 suggestions = getTechniquesForTactic('initial-access');
 } else {
 // Get techniques for next tactics in kill chain
 const nextTactics = KILL_CHAIN_FLOW[previousTacticId] || [];
 suggestions = MITRE_TECHNIQUES.filter((t) => nextTactics.includes(t.tacticId));
 }

 // Prioritize by asset type
 if (targetAssetType) {
 const assetTypePriority: Record<string, string[]> = {
 'information_system': ['T1190', 'T1133', 'T1078', 'T1059'],
 'personnel': ['T1566', 'T1204', 'T1589'],
 'premises': ['T1200', 'T1091'],
 'organization': ['T1195', 'T1199'],
 };

 const priorityIds = assetTypePriority[targetAssetType] || [];
 suggestions = [
 ...suggestions.filter((t) => priorityIds.includes(t.id)),
 ...suggestions.filter((t) => !priorityIds.includes(t.id)),
 ];
 }

 return suggestions.slice(0, 10); // Return top 10 suggestions
}

// ============================================================================
// MITRE ATT&CK → ISO 27002 Control Mapping (Story 19.3)
// Maps MITRE techniques to recommended ISO 27002:2022 controls
// ============================================================================

/**
 * Mapping of MITRE ATT&CK techniques to ISO 27002:2022 controls
 * Based on NIST, MITRE, and security best practices
 */
export const MITRE_TO_ISO27002_MAPPING: Record<string, string[]> = {
 // Initial Access
 'T1566': ['A.6.3', 'A.8.7', 'A.8.23', 'A.5.7'], // Phishing → Awareness, Malware, Web filtering, Threat intel
 'T1566.001': ['A.6.3', 'A.8.7', 'A.8.23'], // Spear phishing attachment
 'T1566.002': ['A.6.3', 'A.8.23', 'A.8.21'], // Spear phishing link
 'T1566.003': ['A.6.3', 'A.8.21'], // Spear phishing via service
 'T1190': ['A.8.8', 'A.8.9', 'A.8.26', 'A.8.29'], // Exploit public-facing → Vuln mgmt, Config, AppSec, Testing
 'T1133': ['A.8.20', 'A.5.15', 'A.8.5', 'A.8.22'], // External remote services → Network sec, Access ctrl, Auth, Segmentation
 'T1078': ['A.5.16', 'A.5.17', 'A.5.18', 'A.8.2'], // Valid accounts → Identity, Auth info, Access rights, Privileged access
 'T1199': ['A.5.19', 'A.5.20', 'A.5.21', 'A.5.22'], // Trusted relationship → Supplier security
 'T1195': ['A.5.21', 'A.8.30', 'A.5.19'], // Supply chain compromise → Supply chain, Outsourced dev
 'T1200': ['A.7.1', 'A.7.2', 'A.7.4', 'A.7.8'], // Hardware additions → Physical security
 'T1091': ['A.8.19', 'A.7.10', 'A.8.12'], // Replication through removable media → Software install, Storage, DLP

 // Execution
 'T1059': ['A.8.19', 'A.8.2', 'A.8.9'], // Command and scripting → Software install, Privileged, Config
 'T1059.001': ['A.8.19', 'A.8.2'], // PowerShell
 'T1059.003': ['A.8.19', 'A.8.2'], // Windows Command Shell
 'T1059.005': ['A.8.19'], // Visual Basic
 'T1059.006': ['A.8.19'], // Python
 'T1059.007': ['A.8.19', 'A.8.23'], // JavaScript
 'T1204': ['A.6.3', 'A.8.7'], // User execution → Awareness, Malware protection
 'T1204.001': ['A.6.3', 'A.8.23'], // Malicious link
 'T1204.002': ['A.6.3', 'A.8.7'], // Malicious file

 // Persistence
 'T1547': ['A.8.9', 'A.8.19', 'A.8.32'], // Boot or logon autostart → Config, Software, Change mgmt
 'T1547.001': ['A.8.9', 'A.8.19'], // Registry run keys
 'T1053': ['A.8.9', 'A.8.2'], // Scheduled task/job → Config, Privileged access
 'T1053.005': ['A.8.9', 'A.8.2'], // Scheduled task
 'T1136': ['A.5.16', 'A.5.18', 'A.8.15'], // Create account → Identity, Access rights, Logging
 'T1136.001': ['A.5.16', 'A.5.18'], // Local account
 'T1136.002': ['A.5.16', 'A.5.18'], // Domain account

 // Privilege Escalation
 'T1548': ['A.8.2', 'A.8.18', 'A.8.9'], // Abuse elevation control → Privileged, Utilities, Config
 'T1548.002': ['A.8.2', 'A.8.18'], // Bypass UAC
 'T1068': ['A.8.8', 'A.8.26', 'A.8.29'], // Exploitation for privilege escalation → Vuln, AppSec, Testing

 // Defense Evasion
 'T1070': ['A.8.15', 'A.8.16', 'A.5.28'], // Indicator removal → Logging, Monitoring, Evidence collection
 'T1070.001': ['A.8.15', 'A.5.28'], // Clear Windows event logs
 'T1562': ['A.8.16', 'A.8.7', 'A.8.9'], // Impair defenses → Monitoring, Malware, Config
 'T1562.001': ['A.8.7', 'A.8.9'], // Disable or modify tools
 'T1027': ['A.8.7', 'A.8.29'], // Obfuscated files → Malware, Security testing
 'T1036': ['A.8.7', 'A.8.19'], // Masquerading → Malware, Software install

 // Credential Access
 'T1003': ['A.5.17', 'A.8.5', 'A.8.24'], // OS credential dumping → Auth info, Secure auth, Crypto
 'T1003.001': ['A.5.17', 'A.8.24'], // LSASS memory
 'T1003.002': ['A.5.17', 'A.8.24'], // Security account manager
 'T1110': ['A.5.17', 'A.8.5'], // Brute force → Auth info, Secure auth
 'T1110.001': ['A.5.17', 'A.8.5'], // Password guessing
 'T1110.003': ['A.5.17', 'A.8.5'], // Password spraying
 'T1555': ['A.5.17', 'A.8.24', 'A.8.11'], // Credentials from password stores → Auth, Crypto, Data masking
 'T1552': ['A.5.17', 'A.8.9', 'A.8.4'], // Unsecured credentials → Auth, Config, Source code access

 // Discovery
 'T1083': ['A.5.15', 'A.8.3'], // File and directory discovery → Access control, Info restriction
 'T1087': ['A.5.16', 'A.8.15'], // Account discovery → Identity, Logging
 'T1087.002': ['A.5.16', 'A.8.15'], // Domain account discovery
 'T1046': ['A.8.20', 'A.8.22', 'A.8.16'], // Network service discovery → Network sec, Segmentation, Monitoring
 'T1135': ['A.5.15', 'A.8.22'], // Network share discovery → Access ctrl, Segmentation

 // Lateral Movement
 'T1021': ['A.8.20', 'A.5.15', 'A.8.5'], // Remote services → Network, Access, Auth
 'T1021.001': ['A.8.20', 'A.5.15'], // Remote desktop protocol
 'T1021.002': ['A.8.20', 'A.5.15'], // SMB/Windows admin shares
 'T1021.004': ['A.8.20', 'A.5.15'], // SSH
 'T1570': ['A.8.22', 'A.8.12'], // Lateral tool transfer → Segmentation, DLP
 'T1550': ['A.5.17', 'A.8.5'], // Use alternate authentication material → Auth
 'T1550.002': ['A.5.17', 'A.8.5'], // Pass the hash

 // Collection
 'T1560': ['A.8.12', 'A.8.24'], // Archive collected data → DLP, Crypto
 'T1560.001': ['A.8.12', 'A.8.24'], // Archive via utility
 'T1005': ['A.5.15', 'A.8.3', 'A.8.12'], // Data from local system → Access, Restriction, DLP
 'T1039': ['A.5.15', 'A.8.22', 'A.8.12'], // Data from network shared drive → Access, Segmentation, DLP
 'T1114': ['A.5.15', 'A.8.24', 'A.8.12'], // Email collection → Access, Crypto, DLP
 'T1114.002': ['A.5.15', 'A.8.24'], // Remote email collection
 'T1113': ['A.8.1', 'A.5.15'], // Screen capture → Endpoint, Access

 // Command and Control
 'T1071': ['A.8.20', 'A.8.23', 'A.8.16'], // Application layer protocol → Network, Web filter, Monitoring
 'T1071.001': ['A.8.23', 'A.8.20'], // Web protocols
 'T1071.004': ['A.8.20', 'A.8.16'], // DNS
 'T1105': ['A.8.20', 'A.8.23', 'A.8.7'], // Ingress tool transfer → Network, Web, Malware
 'T1573': ['A.8.24', 'A.8.16'], // Encrypted channel → Crypto, Monitoring
 'T1573.001': ['A.8.24', 'A.8.16'], // Symmetric cryptography
 'T1573.002': ['A.8.24', 'A.8.16'], // Asymmetric cryptography
 'T1090': ['A.8.20', 'A.8.22', 'A.8.16'], // Proxy → Network, Segmentation, Monitoring

 // Exfiltration
 'T1041': ['A.8.12', 'A.8.20', 'A.8.16'], // Exfiltration over C2 channel → DLP, Network, Monitoring
 'T1048': ['A.8.12', 'A.8.20', 'A.8.22'], // Exfiltration over alternative protocol → DLP, Network, Segmentation
 'T1567': ['A.8.12', 'A.8.23', 'A.5.14'], // Exfiltration over web service → DLP, Web, Info transfer
 'T1567.002': ['A.8.12', 'A.8.23'], // Exfiltration to cloud storage

 // Impact
 'T1486': ['A.8.13', 'A.5.29', 'A.5.30', 'A.8.7'], // Data encrypted for impact (ransomware) → Backup, Continuity, Malware
 'T1485': ['A.8.13', 'A.5.29', 'A.5.30'], // Data destruction → Backup, Continuity
 'T1490': ['A.8.13', 'A.5.29'], // Inhibit system recovery → Backup, Continuity
 'T1489': ['A.5.30', 'A.8.14'], // Service stop → ICT continuity, Redundancy
 'T1498': ['A.8.20', 'A.8.6', 'A.8.14'], // Network denial of service → Network, Capacity, Redundancy
 'T1499': ['A.8.20', 'A.8.6', 'A.8.14'], // Endpoint denial of service → Network, Capacity, Redundancy
 'T1491': ['A.8.26', 'A.8.9', 'A.8.32'], // Defacement → AppSec, Config, Change mgmt
 'T1491.002': ['A.8.26', 'A.8.9'], // External defacement
};

/**
 * Get suggested ISO 27002 controls based on MITRE techniques
 * @param mitreTechniqueIds - Array of MITRE technique IDs (e.g., ['T1566', 'T1078'])
 * @returns Array of unique ISO 27002 control codes
 */
export function getSuggestedControlsForMitre(mitreTechniqueIds: string[]): string[] {
 const controlSet = new Set<string>();

 mitreTechniqueIds.forEach((techniqueId) => {
 // Check exact match
 const controls = MITRE_TO_ISO27002_MAPPING[techniqueId];
 if (controls) {
 controls.forEach((c) => controlSet.add(c));
 }

 // Check parent technique if this is a subtechnique
 if (techniqueId.includes('.')) {
 const parentId = techniqueId.split('.')[0];
 const parentControls = MITRE_TO_ISO27002_MAPPING[parentId];
 if (parentControls) {
 parentControls.forEach((c) => controlSet.add(c));
 }
 }
 });

 return Array.from(controlSet).sort();
}

/**
 * Get control suggestions based on operational scenario
 * Combines MITRE-based suggestions with attack sequence analysis
 */
export function getControlSuggestionsForScenario(
 attackSequence: Array<{ mitreReference?: { techniqueId: string } }>
): string[] {
 const mitreTechniqueIds = attackSequence
 .filter((step) => step.mitreReference)
 .map((step) => step.mitreReference!.techniqueId);

 return getSuggestedControlsForMitre(mitreTechniqueIds);
}

/**
 * Control effectiveness presets based on control type
 */
export const CONTROL_EFFECTIVENESS_PRESETS = {
 preventive: {
 label: { fr: 'Préventif', en: 'Preventive' },
 baseEffectiveness: 70,
 description: { fr: 'Empêche l\'occurrence', en: 'Prevents occurrence' },
 },
 detective: {
 label: { fr: 'Détectif', en: 'Detective' },
 baseEffectiveness: 50,
 description: { fr: 'Détecte l\'occurrence', en: 'Detects occurrence' },
 },
 corrective: {
 label: { fr: 'Correctif', en: 'Corrective' },
 baseEffectiveness: 40,
 description: { fr: 'Corrige après occurrence', en: 'Corrects after occurrence' },
 },
} as const;
