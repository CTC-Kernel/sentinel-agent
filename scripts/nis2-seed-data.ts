/**
 * NIS2 Framework Seed Data
 *
 * Source: Directive (EU) 2022/2555 (NIS2 Directive)
 * Official Journal of the European Union, 27 December 2022
 *
 * This file contains the complete NIS2 requirements structure
 * with bilingual support (FR/EN) and control mapping templates.
 *
 * @see Story EU-1.6: Seed NIS2 Framework Data
 */

import type {
  RegulatoryFramework,
  Requirement,
  RequirementCategory,
  RequirementCriticality,
} from '../src/types/framework';

// ============================================================================
// Framework Definition
// ============================================================================

export const NIS2_FRAMEWORK: Omit<RegulatoryFramework, 'id' | 'createdAt' | 'updatedAt'> = {
  code: 'NIS2',
  name: {
    en: 'NIS2 Directive',
    fr: 'Directive NIS2',
  },
  fullName: {
    en: 'Directive (EU) 2022/2555 on measures for a high common level of cybersecurity across the Union',
    fr: 'Directive (UE) 2022/2555 concernant des mesures destinées à assurer un niveau élevé commun de cybersécurité dans l\'Union',
  },
  description: {
    en: 'The NIS2 Directive establishes cybersecurity risk management and reporting obligations for essential and important entities across the EU. It replaces the original NIS Directive with expanded scope and stricter requirements.',
    fr: 'La directive NIS2 établit des obligations en matière de gestion des risques de cybersécurité et de notification pour les entités essentielles et importantes dans l\'UE. Elle remplace la directive NIS originale avec un champ d\'application élargi et des exigences plus strictes.',
  },
  version: '2022/2555',
  effectiveDate: new Date('2023-01-16'),
  complianceDeadline: new Date('2024-10-17'),
  jurisdiction: ['EU'],
  sectors: [
    'energy',
    'transport',
    'banking',
    'financial_market',
    'health',
    'drinking_water',
    'wastewater',
    'digital_infrastructure',
    'ict_service_management',
    'public_administration',
    'space',
    'postal_services',
    'waste_management',
    'chemicals',
    'food',
    'manufacturing',
    'digital_providers',
    'research',
  ],
  officialUrl: 'https://eur-lex.europa.eu/eli/dir/2022/2555',
  isActive: true,
  requirementCount: 0, // Will be calculated
};

// ============================================================================
// Requirement Categories
// ============================================================================

export const NIS2_CATEGORIES: RequirementCategory[] = [
  'governance',
  'risk_management',
  'incident_response',
  'supply_chain',
  'security_measures',
  'continuity',
  'cryptography',
  'access_control',
  'reporting',
  'training',
  'asset_management',
];

// ============================================================================
// NIS2 Requirements
// ============================================================================

export interface NIS2Requirement {
  articleRef: string;
  category: RequirementCategory;
  criticality: RequirementCriticality;
  title: {
    en: string;
    fr: string;
  };
  description: {
    en: string;
    fr: string;
  };
  keywords: string[];
  isMandatory: boolean;
  suggestedControls: string[]; // ISO 27001 control references
}

export const NIS2_REQUIREMENTS: NIS2Requirement[] = [
  // ============================================================================
  // Article 20: Governance
  // ============================================================================
  {
    articleRef: 'Art. 20(1)',
    category: 'governance',
    criticality: 'high',
    title: {
      en: 'Management body accountability',
      fr: 'Responsabilité des organes de direction',
    },
    description: {
      en: 'Member States shall ensure that the management bodies of essential and important entities approve the cybersecurity risk-management measures taken by those entities and oversee their implementation.',
      fr: 'Les États membres veillent à ce que les organes de direction des entités essentielles et importantes approuvent les mesures de gestion des risques en matière de cybersécurité prises par ces entités et supervisent leur mise en œuvre.',
    },
    keywords: ['governance', 'management', 'accountability', 'oversight', 'board'],
    isMandatory: true,
    suggestedControls: ['A.5.1', 'A.5.2', 'A.5.3', 'A.5.4'],
  },
  {
    articleRef: 'Art. 20(2)',
    category: 'governance',
    criticality: 'high',
    title: {
      en: 'Management liability',
      fr: 'Responsabilité de la direction',
    },
    description: {
      en: 'Member States shall ensure that management bodies can be held liable for infringements of this Directive by the entities they manage.',
      fr: 'Les États membres veillent à ce que les organes de direction puissent être tenus pour responsables des infractions à la présente directive commises par les entités qu\'ils dirigent.',
    },
    keywords: ['liability', 'infringement', 'accountability', 'compliance'],
    isMandatory: true,
    suggestedControls: ['A.5.1', 'A.5.31'],
  },
  {
    articleRef: 'Art. 20(3)',
    category: 'training',
    criticality: 'high',
    title: {
      en: 'Management cybersecurity training',
      fr: 'Formation cybersécurité de la direction',
    },
    description: {
      en: 'Member States shall ensure that members of management bodies are required to follow training and encourage essential and important entities to offer similar training to their employees on a regular basis.',
      fr: 'Les États membres veillent à ce que les membres des organes de direction soient tenus de suivre une formation et encouragent les entités essentielles et importantes à proposer régulièrement une formation similaire à leurs employés.',
    },
    keywords: ['training', 'awareness', 'education', 'skills', 'management'],
    isMandatory: true,
    suggestedControls: ['A.6.3', 'A.7.2', 'A.7.3'],
  },

  // ============================================================================
  // Article 21: Cybersecurity Risk-Management Measures
  // ============================================================================
  {
    articleRef: 'Art. 21(1)',
    category: 'risk_management',
    criticality: 'high',
    title: {
      en: 'Risk-based cybersecurity measures',
      fr: 'Mesures de cybersécurité fondées sur les risques',
    },
    description: {
      en: 'Member States shall ensure that essential and important entities take appropriate and proportionate technical, operational and organisational measures to manage the risks posed to the security of network and information systems.',
      fr: 'Les États membres veillent à ce que les entités essentielles et importantes prennent des mesures techniques, opérationnelles et organisationnelles appropriées et proportionnées pour gérer les risques pesant sur la sécurité des réseaux et des systèmes d\'information.',
    },
    keywords: ['risk management', 'proportionate', 'technical measures', 'organizational measures'],
    isMandatory: true,
    suggestedControls: ['A.5.1', 'A.5.8', 'A.8.1', 'A.8.2'],
  },
  {
    articleRef: 'Art. 21(2)(a)',
    category: 'risk_management',
    criticality: 'high',
    title: {
      en: 'Risk analysis and security policies',
      fr: 'Analyse des risques et politiques de sécurité',
    },
    description: {
      en: 'Policies on risk analysis and information system security, including risk assessment methodologies and security policy documentation.',
      fr: 'Politiques relatives à l\'analyse des risques et à la sécurité des systèmes d\'information, y compris les méthodologies d\'évaluation des risques et la documentation des politiques de sécurité.',
    },
    keywords: ['risk analysis', 'security policy', 'risk assessment', 'documentation'],
    isMandatory: true,
    suggestedControls: ['A.5.1', 'A.5.8', 'A.5.9', 'A.5.10'],
  },
  {
    articleRef: 'Art. 21(2)(b)',
    category: 'incident_response',
    criticality: 'high',
    title: {
      en: 'Incident handling',
      fr: 'Gestion des incidents',
    },
    description: {
      en: 'Procedures for incident handling, including detection, analysis, containment, eradication, recovery and post-incident activities.',
      fr: 'Procédures de gestion des incidents, y compris la détection, l\'analyse, le confinement, l\'éradication, la reprise et les activités post-incident.',
    },
    keywords: ['incident', 'detection', 'response', 'recovery', 'CSIRT'],
    isMandatory: true,
    suggestedControls: ['A.5.24', 'A.5.25', 'A.5.26', 'A.5.27', 'A.5.28'],
  },
  {
    articleRef: 'Art. 21(2)(c)',
    category: 'continuity',
    criticality: 'high',
    title: {
      en: 'Business continuity and crisis management',
      fr: 'Continuité des activités et gestion de crise',
    },
    description: {
      en: 'Business continuity, such as backup management and disaster recovery, and crisis management including business impact analysis and continuity planning.',
      fr: 'Continuité des activités, comme la gestion des sauvegardes et la reprise après sinistre, et gestion de crise, y compris l\'analyse d\'impact sur les activités et la planification de la continuité.',
    },
    keywords: ['business continuity', 'disaster recovery', 'backup', 'crisis management', 'BCP'],
    isMandatory: true,
    suggestedControls: ['A.5.29', 'A.5.30', 'A.8.13', 'A.8.14'],
  },
  {
    articleRef: 'Art. 21(2)(d)',
    category: 'supply_chain',
    criticality: 'high',
    title: {
      en: 'Supply chain security',
      fr: 'Sécurité de la chaîne d\'approvisionnement',
    },
    description: {
      en: 'Supply chain security, including security-related aspects concerning the relationships between each entity and its direct suppliers or service providers.',
      fr: 'Sécurité de la chaîne d\'approvisionnement, y compris les aspects liés à la sécurité concernant les relations entre chaque entité et ses fournisseurs directs ou prestataires de services.',
    },
    keywords: ['supply chain', 'suppliers', 'third party', 'vendor', 'service provider'],
    isMandatory: true,
    suggestedControls: ['A.5.19', 'A.5.20', 'A.5.21', 'A.5.22', 'A.5.23'],
  },
  {
    articleRef: 'Art. 21(2)(e)',
    category: 'security_measures',
    criticality: 'high',
    title: {
      en: 'Network and system acquisition security',
      fr: 'Sécurité de l\'acquisition des réseaux et systèmes',
    },
    description: {
      en: 'Security in network and information systems acquisition, development and maintenance, including vulnerability handling and disclosure.',
      fr: 'Sécurité de l\'acquisition, du développement et de la maintenance des réseaux et systèmes d\'information, y compris le traitement et la divulgation des vulnérabilités.',
    },
    keywords: ['acquisition', 'development', 'maintenance', 'vulnerability', 'secure development'],
    isMandatory: true,
    suggestedControls: ['A.5.8', 'A.8.25', 'A.8.26', 'A.8.27', 'A.8.28', 'A.8.29', 'A.8.30', 'A.8.31'],
  },
  {
    articleRef: 'Art. 21(2)(f)',
    category: 'risk_management',
    criticality: 'medium',
    title: {
      en: 'Effectiveness assessment policies',
      fr: 'Politiques d\'évaluation de l\'efficacité',
    },
    description: {
      en: 'Policies and procedures to assess the effectiveness of cybersecurity risk-management measures.',
      fr: 'Politiques et procédures pour évaluer l\'efficacité des mesures de gestion des risques en matière de cybersécurité.',
    },
    keywords: ['assessment', 'effectiveness', 'audit', 'review', 'metrics', 'KPI'],
    isMandatory: true,
    suggestedControls: ['A.5.35', 'A.5.36', 'A.8.34'],
  },
  {
    articleRef: 'Art. 21(2)(g)',
    category: 'training',
    criticality: 'medium',
    title: {
      en: 'Cyber hygiene and training',
      fr: 'Cyberhygiène et formation',
    },
    description: {
      en: 'Basic cyber hygiene practices and cybersecurity training for all employees.',
      fr: 'Pratiques de cyberhygiène de base et formation à la cybersécurité pour tous les employés.',
    },
    keywords: ['cyber hygiene', 'training', 'awareness', 'phishing', 'password'],
    isMandatory: true,
    suggestedControls: ['A.6.3', 'A.7.2', 'A.7.3'],
  },
  {
    articleRef: 'Art. 21(2)(h)',
    category: 'cryptography',
    criticality: 'high',
    title: {
      en: 'Cryptography policies',
      fr: 'Politiques de cryptographie',
    },
    description: {
      en: 'Policies and procedures regarding the use of cryptography and, where appropriate, encryption.',
      fr: 'Politiques et procédures relatives à l\'utilisation de la cryptographie et, le cas échéant, du chiffrement.',
    },
    keywords: ['cryptography', 'encryption', 'key management', 'TLS', 'PKI'],
    isMandatory: true,
    suggestedControls: ['A.8.24'],
  },
  {
    articleRef: 'Art. 21(2)(i)',
    category: 'access_control',
    criticality: 'high',
    title: {
      en: 'HR security and access control',
      fr: 'Sécurité RH et contrôle d\'accès',
    },
    description: {
      en: 'Human resources security, access control policies and asset management.',
      fr: 'Sécurité des ressources humaines, politiques de contrôle d\'accès et gestion des actifs.',
    },
    keywords: ['HR security', 'access control', 'asset management', 'identity', 'IAM'],
    isMandatory: true,
    suggestedControls: ['A.5.9', 'A.5.10', 'A.5.11', 'A.5.15', 'A.5.16', 'A.5.17', 'A.5.18', 'A.6.1', 'A.6.2', 'A.6.4', 'A.6.5', 'A.6.6'],
  },
  {
    articleRef: 'Art. 21(2)(j)',
    category: 'access_control',
    criticality: 'high',
    title: {
      en: 'Multi-factor authentication',
      fr: 'Authentification multifacteur',
    },
    description: {
      en: 'The use of multi-factor authentication or continuous authentication solutions, secured voice, video and text communications and secured emergency communication systems.',
      fr: 'L\'utilisation de solutions d\'authentification multifacteur ou d\'authentification continue, de communications vocales, vidéo et textuelles sécurisées et de systèmes de communication d\'urgence sécurisés.',
    },
    keywords: ['MFA', 'multi-factor', 'authentication', 'secure communications', '2FA'],
    isMandatory: true,
    suggestedControls: ['A.5.14', 'A.5.16', 'A.5.17', 'A.8.5'],
  },
  {
    articleRef: 'Art. 21(3)',
    category: 'risk_management',
    criticality: 'medium',
    title: {
      en: 'European standards consideration',
      fr: 'Prise en compte des normes européennes',
    },
    description: {
      en: 'When assessing proportionality, entities shall take into account their degree of exposure to risks, size, incident likelihood, severity, societal and economic impact.',
      fr: 'Lors de l\'évaluation de la proportionnalité, les entités tiennent compte de leur degré d\'exposition aux risques, de leur taille, de la probabilité d\'incidents, de leur gravité et de l\'impact sociétal et économique.',
    },
    keywords: ['proportionality', 'standards', 'exposure', 'impact assessment'],
    isMandatory: true,
    suggestedControls: ['A.5.8', 'A.5.1'],
  },
  {
    articleRef: 'Art. 21(4)',
    category: 'governance',
    criticality: 'medium',
    title: {
      en: 'Implementing acts compliance',
      fr: 'Conformité aux actes d\'exécution',
    },
    description: {
      en: 'Compliance with technical and methodological specifications of implementing acts adopted by the Commission.',
      fr: 'Conformité aux spécifications techniques et méthodologiques des actes d\'exécution adoptés par la Commission.',
    },
    keywords: ['implementing acts', 'Commission', 'technical specifications', 'compliance'],
    isMandatory: true,
    suggestedControls: ['A.5.31', 'A.5.36'],
  },

  // ============================================================================
  // Article 22: Supply Chain
  // ============================================================================
  {
    articleRef: 'Art. 22(1)',
    category: 'supply_chain',
    criticality: 'high',
    title: {
      en: 'Critical supply chain risk assessment',
      fr: 'Évaluation des risques de la chaîne d\'approvisionnement critique',
    },
    description: {
      en: 'Participation in coordinated security risk assessments of critical supply chains at Union level.',
      fr: 'Participation aux évaluations coordonnées des risques de sécurité des chaînes d\'approvisionnement critiques au niveau de l\'Union.',
    },
    keywords: ['supply chain', 'risk assessment', 'coordination', 'Union level', 'critical'],
    isMandatory: true,
    suggestedControls: ['A.5.19', 'A.5.20', 'A.5.21'],
  },

  // ============================================================================
  // Article 23: Reporting Obligations
  // ============================================================================
  {
    articleRef: 'Art. 23(1)',
    category: 'reporting',
    criticality: 'high',
    title: {
      en: 'Significant incident notification',
      fr: 'Notification des incidents significatifs',
    },
    description: {
      en: 'Essential and important entities shall notify, without undue delay, the competent authority or CSIRT of any significant incident.',
      fr: 'Les entités essentielles et importantes notifient, sans retard injustifié, à l\'autorité compétente ou au CSIRT tout incident significatif.',
    },
    keywords: ['notification', 'incident', 'CSIRT', 'competent authority', 'reporting'],
    isMandatory: true,
    suggestedControls: ['A.5.24', 'A.5.26', 'A.6.8'],
  },
  {
    articleRef: 'Art. 23(2)',
    category: 'reporting',
    criticality: 'high',
    title: {
      en: 'Incident report recipients',
      fr: 'Destinataires des rapports d\'incidents',
    },
    description: {
      en: 'Notification to recipients of services potentially affected by a significant cyber threat.',
      fr: 'Notification aux destinataires des services potentiellement affectés par une cybermenace importante.',
    },
    keywords: ['notification', 'recipients', 'cyber threat', 'communication', 'stakeholders'],
    isMandatory: true,
    suggestedControls: ['A.5.24', 'A.5.5', 'A.5.6'],
  },
  {
    articleRef: 'Art. 23(3)',
    category: 'reporting',
    criticality: 'high',
    title: {
      en: 'Significant incident criteria',
      fr: 'Critères d\'incident significatif',
    },
    description: {
      en: 'An incident shall be considered significant if it has caused or is capable of causing severe operational disruption or financial loss, or has affected or is capable of affecting natural or legal persons.',
      fr: 'Un incident est considéré comme significatif s\'il a causé ou est susceptible de causer une perturbation opérationnelle grave ou une perte financière, ou a affecté ou est susceptible d\'affecter des personnes physiques ou morales.',
    },
    keywords: ['significant incident', 'criteria', 'operational disruption', 'financial loss', 'impact'],
    isMandatory: true,
    suggestedControls: ['A.5.24', 'A.5.25'],
  },
  {
    articleRef: 'Art. 23(4)(a)',
    category: 'reporting',
    criticality: 'high',
    title: {
      en: 'Early warning (24 hours)',
      fr: 'Alerte précoce (24 heures)',
    },
    description: {
      en: 'An early warning within 24 hours of becoming aware of the significant incident, indicating whether it is suspected of being caused by unlawful or malicious acts.',
      fr: 'Une alerte précoce dans les 24 heures suivant la prise de connaissance de l\'incident significatif, indiquant s\'il est suspecté d\'être causé par des actes illicites ou malveillants.',
    },
    keywords: ['early warning', '24 hours', 'notification', 'timeline', 'initial report'],
    isMandatory: true,
    suggestedControls: ['A.5.24', 'A.5.26'],
  },
  {
    articleRef: 'Art. 23(4)(b)',
    category: 'reporting',
    criticality: 'high',
    title: {
      en: 'Incident notification (72 hours)',
      fr: 'Notification d\'incident (72 heures)',
    },
    description: {
      en: 'An incident notification within 72 hours of becoming aware, updating the early warning with initial assessment including severity, impact and indicators of compromise.',
      fr: 'Une notification d\'incident dans les 72 heures suivant la prise de connaissance, mettant à jour l\'alerte précoce avec une évaluation initiale incluant la gravité, l\'impact et les indicateurs de compromission.',
    },
    keywords: ['incident notification', '72 hours', 'assessment', 'severity', 'IOC'],
    isMandatory: true,
    suggestedControls: ['A.5.24', 'A.5.26', 'A.5.27'],
  },
  {
    articleRef: 'Art. 23(4)(c)',
    category: 'reporting',
    criticality: 'high',
    title: {
      en: 'Intermediate report',
      fr: 'Rapport intermédiaire',
    },
    description: {
      en: 'Upon request of the competent authority or CSIRT, an intermediate report on relevant status updates.',
      fr: 'À la demande de l\'autorité compétente ou du CSIRT, un rapport intermédiaire sur les mises à jour de statut pertinentes.',
    },
    keywords: ['intermediate report', 'status update', 'CSIRT', 'authority', 'progress'],
    isMandatory: true,
    suggestedControls: ['A.5.24', 'A.5.26'],
  },
  {
    articleRef: 'Art. 23(4)(d)',
    category: 'reporting',
    criticality: 'high',
    title: {
      en: 'Final report (1 month)',
      fr: 'Rapport final (1 mois)',
    },
    description: {
      en: 'A final report no later than one month after the incident notification, including detailed description, root cause, mitigation measures, and cross-border impact.',
      fr: 'Un rapport final au plus tard un mois après la notification de l\'incident, comprenant une description détaillée, la cause profonde, les mesures d\'atténuation et l\'impact transfrontalier.',
    },
    keywords: ['final report', 'one month', 'root cause', 'mitigation', 'post-incident'],
    isMandatory: true,
    suggestedControls: ['A.5.24', 'A.5.27', 'A.5.28'],
  },

  // ============================================================================
  // Article 24: Certification
  // ============================================================================
  {
    articleRef: 'Art. 24(1)',
    category: 'governance',
    criticality: 'medium',
    title: {
      en: 'European certification schemes',
      fr: 'Schémas de certification européens',
    },
    description: {
      en: 'Use of European cybersecurity certification schemes adopted pursuant to the Cybersecurity Act to demonstrate compliance.',
      fr: 'Utilisation des schémas de certification de cybersécurité européens adoptés en vertu du règlement sur la cybersécurité pour démontrer la conformité.',
    },
    keywords: ['certification', 'ENISA', 'Cybersecurity Act', 'compliance', 'attestation'],
    isMandatory: false,
    suggestedControls: ['A.5.31', 'A.5.36'],
  },

  // ============================================================================
  // Article 25: Standardisation
  // ============================================================================
  {
    articleRef: 'Art. 25',
    category: 'governance',
    criticality: 'low',
    title: {
      en: 'Use of European and international standards',
      fr: 'Utilisation des normes européennes et internationales',
    },
    description: {
      en: 'Encourage the use of European and international standards and technical specifications relevant to network and information systems security.',
      fr: 'Encourager l\'utilisation des normes et spécifications techniques européennes et internationales pertinentes pour la sécurité des réseaux et des systèmes d\'information.',
    },
    keywords: ['standards', 'ISO', 'ETSI', 'CEN', 'international', 'technical specifications'],
    isMandatory: false,
    suggestedControls: ['A.5.31', 'A.5.36', 'A.5.1'],
  },

  // ============================================================================
  // Article 26-27: Peer Reviews and Jurisdiction
  // ============================================================================
  {
    articleRef: 'Art. 26',
    category: 'governance',
    criticality: 'low',
    title: {
      en: 'Peer reviews participation',
      fr: 'Participation aux examens par les pairs',
    },
    description: {
      en: 'Voluntary participation in peer reviews of cybersecurity policies and technical capabilities.',
      fr: 'Participation volontaire aux examens par les pairs des politiques de cybersécurité et des capacités techniques.',
    },
    keywords: ['peer review', 'voluntary', 'assessment', 'cooperation', 'exchange'],
    isMandatory: false,
    suggestedControls: ['A.5.35', 'A.5.36'],
  },

  // ============================================================================
  // Article 28-29: Database and Registration
  // ============================================================================
  {
    articleRef: 'Art. 28',
    category: 'asset_management',
    criticality: 'medium',
    title: {
      en: 'Entity registration',
      fr: 'Enregistrement des entités',
    },
    description: {
      en: 'Essential and important entities shall register with the competent authority providing specified information about their operations and cybersecurity contacts.',
      fr: 'Les entités essentielles et importantes s\'enregistrent auprès de l\'autorité compétente en fournissant des informations spécifiques sur leurs opérations et contacts cybersécurité.',
    },
    keywords: ['registration', 'database', 'authority', 'contact', 'inventory'],
    isMandatory: true,
    suggestedControls: ['A.5.1', 'A.5.5'],
  },

  // ============================================================================
  // Additional Security Measures
  // ============================================================================
  {
    articleRef: 'Art. 21-Phys',
    category: 'security_measures',
    criticality: 'medium',
    title: {
      en: 'Physical and environmental security',
      fr: 'Sécurité physique et environnementale',
    },
    description: {
      en: 'Measures to protect network and information systems from physical and environmental threats.',
      fr: 'Mesures de protection des réseaux et systèmes d\'information contre les menaces physiques et environnementales.',
    },
    keywords: ['physical security', 'environmental', 'data center', 'access', 'perimeter'],
    isMandatory: true,
    suggestedControls: ['A.7.1', 'A.7.2', 'A.7.3', 'A.7.4', 'A.7.5', 'A.7.6', 'A.7.7', 'A.7.8', 'A.7.9', 'A.7.10', 'A.7.11', 'A.7.12', 'A.7.13', 'A.7.14'],
  },
  {
    articleRef: 'Art. 21-Net',
    category: 'security_measures',
    criticality: 'high',
    title: {
      en: 'Network security',
      fr: 'Sécurité réseau',
    },
    description: {
      en: 'Implementation of network security controls including segmentation, monitoring, and intrusion detection.',
      fr: 'Mise en œuvre de contrôles de sécurité réseau incluant la segmentation, la surveillance et la détection d\'intrusion.',
    },
    keywords: ['network', 'firewall', 'segmentation', 'IDS', 'IPS', 'monitoring'],
    isMandatory: true,
    suggestedControls: ['A.8.20', 'A.8.21', 'A.8.22', 'A.8.23'],
  },
  {
    articleRef: 'Art. 21-Log',
    category: 'security_measures',
    criticality: 'medium',
    title: {
      en: 'Logging and monitoring',
      fr: 'Journalisation et surveillance',
    },
    description: {
      en: 'Implementation of logging, monitoring and anomaly detection capabilities.',
      fr: 'Mise en œuvre de capacités de journalisation, de surveillance et de détection d\'anomalies.',
    },
    keywords: ['logging', 'monitoring', 'SIEM', 'anomaly', 'audit trail'],
    isMandatory: true,
    suggestedControls: ['A.8.15', 'A.8.16', 'A.8.17'],
  },
  {
    articleRef: 'Art. 21-Mal',
    category: 'security_measures',
    criticality: 'high',
    title: {
      en: 'Malware protection',
      fr: 'Protection contre les logiciels malveillants',
    },
    description: {
      en: 'Implementation of anti-malware controls and protection mechanisms.',
      fr: 'Mise en œuvre de contrôles anti-malware et de mécanismes de protection.',
    },
    keywords: ['malware', 'antivirus', 'EDR', 'endpoint', 'protection'],
    isMandatory: true,
    suggestedControls: ['A.8.7'],
  },
  {
    articleRef: 'Art. 21-Vuln',
    category: 'security_measures',
    criticality: 'high',
    title: {
      en: 'Vulnerability management',
      fr: 'Gestion des vulnérabilités',
    },
    description: {
      en: 'Implementation of vulnerability management including scanning, patching and remediation processes.',
      fr: 'Mise en œuvre de la gestion des vulnérabilités incluant l\'analyse, les correctifs et les processus de remédiation.',
    },
    keywords: ['vulnerability', 'patching', 'scanning', 'CVE', 'remediation'],
    isMandatory: true,
    suggestedControls: ['A.8.8', 'A.8.9', 'A.8.19'],
  },
];

// ============================================================================
// Control Mapping Templates
// ============================================================================

export const ISO27001_CONTROL_TEMPLATES = [
  // A.5 - Organizational controls
  { code: 'A.5.1', name: { en: 'Policies for information security', fr: 'Politiques de sécurité de l\'information' } },
  { code: 'A.5.2', name: { en: 'Information security roles and responsibilities', fr: 'Rôles et responsabilités en sécurité de l\'information' } },
  { code: 'A.5.3', name: { en: 'Segregation of duties', fr: 'Séparation des tâches' } },
  { code: 'A.5.4', name: { en: 'Management responsibilities', fr: 'Responsabilités de la direction' } },
  { code: 'A.5.5', name: { en: 'Contact with authorities', fr: 'Relations avec les autorités' } },
  { code: 'A.5.6', name: { en: 'Contact with special interest groups', fr: 'Relations avec des groupes de travail spécialisés' } },
  { code: 'A.5.8', name: { en: 'Information security in project management', fr: 'Sécurité de l\'information dans la gestion de projet' } },
  { code: 'A.5.9', name: { en: 'Inventory of information and other associated assets', fr: 'Inventaire des informations et autres actifs associés' } },
  { code: 'A.5.10', name: { en: 'Acceptable use of information and other associated assets', fr: 'Utilisation correcte des informations et autres actifs associés' } },
  { code: 'A.5.11', name: { en: 'Return of assets', fr: 'Restitution des actifs' } },
  { code: 'A.5.14', name: { en: 'Information transfer', fr: 'Transfert des informations' } },
  { code: 'A.5.15', name: { en: 'Access control', fr: 'Contrôle d\'accès' } },
  { code: 'A.5.16', name: { en: 'Identity management', fr: 'Gestion des identités' } },
  { code: 'A.5.17', name: { en: 'Authentication information', fr: 'Informations d\'authentification' } },
  { code: 'A.5.18', name: { en: 'Access rights', fr: 'Droits d\'accès' } },
  { code: 'A.5.19', name: { en: 'Information security in supplier relationships', fr: 'Sécurité de l\'information dans les relations avec les fournisseurs' } },
  { code: 'A.5.20', name: { en: 'Addressing information security within supplier agreements', fr: 'Traitement de la sécurité dans les accords avec les fournisseurs' } },
  { code: 'A.5.21', name: { en: 'Managing information security in the ICT supply chain', fr: 'Gestion de la sécurité dans la chaîne d\'approvisionnement ICT' } },
  { code: 'A.5.22', name: { en: 'Monitoring, review and change management of supplier services', fr: 'Surveillance, revue et gestion des changements des services fournisseurs' } },
  { code: 'A.5.23', name: { en: 'Information security for use of cloud services', fr: 'Sécurité de l\'information pour les services cloud' } },
  { code: 'A.5.24', name: { en: 'Information security incident management planning and preparation', fr: 'Planification et préparation de la gestion des incidents' } },
  { code: 'A.5.25', name: { en: 'Assessment and decision on information security events', fr: 'Évaluation et décision sur les événements de sécurité' } },
  { code: 'A.5.26', name: { en: 'Response to information security incidents', fr: 'Réponse aux incidents de sécurité de l\'information' } },
  { code: 'A.5.27', name: { en: 'Learning from information security incidents', fr: 'Apprentissage des incidents de sécurité' } },
  { code: 'A.5.28', name: { en: 'Collection of evidence', fr: 'Collecte de preuves' } },
  { code: 'A.5.29', name: { en: 'Information security during disruption', fr: 'Sécurité de l\'information en cas de perturbation' } },
  { code: 'A.5.30', name: { en: 'ICT readiness for business continuity', fr: 'Préparation ICT pour la continuité d\'activité' } },
  { code: 'A.5.31', name: { en: 'Legal, statutory, regulatory and contractual requirements', fr: 'Exigences légales, statutaires, réglementaires et contractuelles' } },
  { code: 'A.5.35', name: { en: 'Independent review of information security', fr: 'Revue indépendante de la sécurité de l\'information' } },
  { code: 'A.5.36', name: { en: 'Compliance with policies, rules and standards for information security', fr: 'Conformité aux politiques, règles et normes' } },
  // A.6 - People controls
  { code: 'A.6.1', name: { en: 'Screening', fr: 'Sélection' } },
  { code: 'A.6.2', name: { en: 'Terms and conditions of employment', fr: 'Termes et conditions d\'emploi' } },
  { code: 'A.6.3', name: { en: 'Information security awareness, education and training', fr: 'Sensibilisation, éducation et formation' } },
  { code: 'A.6.4', name: { en: 'Disciplinary process', fr: 'Processus disciplinaire' } },
  { code: 'A.6.5', name: { en: 'Responsibilities after termination or change of employment', fr: 'Responsabilités après fin ou changement d\'emploi' } },
  { code: 'A.6.6', name: { en: 'Confidentiality or non-disclosure agreements', fr: 'Accords de confidentialité' } },
  { code: 'A.6.8', name: { en: 'Information security event reporting', fr: 'Signalement des événements de sécurité' } },
  // A.7 - Physical controls
  { code: 'A.7.1', name: { en: 'Physical security perimeters', fr: 'Périmètres de sécurité physique' } },
  { code: 'A.7.2', name: { en: 'Physical entry', fr: 'Contrôles d\'entrée physique' } },
  { code: 'A.7.3', name: { en: 'Securing offices, rooms and facilities', fr: 'Sécurisation des bureaux et installations' } },
  { code: 'A.7.4', name: { en: 'Physical security monitoring', fr: 'Surveillance de la sécurité physique' } },
  // A.8 - Technological controls
  { code: 'A.8.1', name: { en: 'User endpoint devices', fr: 'Équipements terminaux des utilisateurs' } },
  { code: 'A.8.2', name: { en: 'Privileged access rights', fr: 'Droits d\'accès privilégiés' } },
  { code: 'A.8.5', name: { en: 'Secure authentication', fr: 'Authentification sécurisée' } },
  { code: 'A.8.7', name: { en: 'Protection against malware', fr: 'Protection contre les logiciels malveillants' } },
  { code: 'A.8.8', name: { en: 'Management of technical vulnerabilities', fr: 'Gestion des vulnérabilités techniques' } },
  { code: 'A.8.9', name: { en: 'Configuration management', fr: 'Gestion de la configuration' } },
  { code: 'A.8.13', name: { en: 'Information backup', fr: 'Sauvegarde des informations' } },
  { code: 'A.8.14', name: { en: 'Redundancy of information processing facilities', fr: 'Redondance des installations de traitement' } },
  { code: 'A.8.15', name: { en: 'Logging', fr: 'Journalisation' } },
  { code: 'A.8.16', name: { en: 'Monitoring activities', fr: 'Activités de surveillance' } },
  { code: 'A.8.17', name: { en: 'Clock synchronization', fr: 'Synchronisation des horloges' } },
  { code: 'A.8.19', name: { en: 'Installation of software on operational systems', fr: 'Installation de logiciels sur les systèmes opérationnels' } },
  { code: 'A.8.20', name: { en: 'Networks security', fr: 'Sécurité des réseaux' } },
  { code: 'A.8.21', name: { en: 'Security of network services', fr: 'Sécurité des services réseau' } },
  { code: 'A.8.22', name: { en: 'Segregation of networks', fr: 'Cloisonnement des réseaux' } },
  { code: 'A.8.23', name: { en: 'Web filtering', fr: 'Filtrage web' } },
  { code: 'A.8.24', name: { en: 'Use of cryptography', fr: 'Utilisation de la cryptographie' } },
  { code: 'A.8.25', name: { en: 'Secure development lifecycle', fr: 'Cycle de vie de développement sécurisé' } },
  { code: 'A.8.26', name: { en: 'Application security requirements', fr: 'Exigences de sécurité des applications' } },
  { code: 'A.8.27', name: { en: 'Secure system architecture and engineering principles', fr: 'Architecture système sécurisée et principes d\'ingénierie' } },
  { code: 'A.8.28', name: { en: 'Secure coding', fr: 'Codage sécurisé' } },
  { code: 'A.8.29', name: { en: 'Security testing in development and acceptance', fr: 'Tests de sécurité en développement et acceptation' } },
  { code: 'A.8.30', name: { en: 'Outsourced development', fr: 'Développement externalisé' } },
  { code: 'A.8.31', name: { en: 'Separation of development, test and production environments', fr: 'Séparation des environnements' } },
  { code: 'A.8.34', name: { en: 'Protection of information systems during audit testing', fr: 'Protection des SI pendant les tests d\'audit' } },
];

// ============================================================================
// Export Helper
// ============================================================================

export function getNIS2RequirementCount(): number {
  return NIS2_REQUIREMENTS.length;
}

export function getNIS2RequirementsByCategory(category: RequirementCategory): NIS2Requirement[] {
  return NIS2_REQUIREMENTS.filter(r => r.category === category);
}

export function getNIS2HighCriticalityRequirements(): NIS2Requirement[] {
  return NIS2_REQUIREMENTS.filter(r => r.criticality === 'high');
}
