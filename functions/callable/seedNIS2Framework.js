/**
 * NIS2 Framework Seed Cloud Function
 *
 * Seeds the Firestore database with NIS2 directive requirements.
 * Only callable by organization admins.
 *
 * @see Story EU-1.6: Seed NIS2 Framework Data
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

// ============================================================================
// NIS2 Framework Data
// ============================================================================

const NIS2_FRAMEWORK = {
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
    en: 'The NIS2 Directive establishes cybersecurity risk management and reporting obligations for essential and important entities across the EU.',
    fr: 'La directive NIS2 établit des obligations en matière de gestion des risques de cybersécurité et de notification pour les entités essentielles et importantes dans l\'UE.',
  },
  version: '2022/2555',
  effectiveDate: admin.firestore.Timestamp.fromDate(new Date('2023-01-16')),
  complianceDeadline: admin.firestore.Timestamp.fromDate(new Date('2024-10-17')),
  jurisdiction: ['EU'],
  sectors: [
    'energy', 'transport', 'banking', 'financial_market', 'health',
    'drinking_water', 'wastewater', 'digital_infrastructure', 'ict_service_management',
    'public_administration', 'space', 'postal_services', 'waste_management',
    'chemicals', 'food', 'manufacturing', 'digital_providers', 'research',
  ],
  officialUrl: 'https://eur-lex.europa.eu/eli/dir/2022/2555',
  isActive: true,
};

const NIS2_REQUIREMENTS = [
  // Article 20: Governance
  {
    articleRef: 'Art. 20(1)',
    category: 'governance',
    criticality: 'high',
    title: { en: 'Management body accountability', fr: 'Responsabilité des organes de direction' },
    description: {
      en: 'Member States shall ensure that the management bodies of essential and important entities approve the cybersecurity risk-management measures taken by those entities and oversee their implementation.',
      fr: 'Les États membres veillent à ce que les organes de direction des entités essentielles et importantes approuvent les mesures de gestion des risques en matière de cybersécurité prises par ces entités et supervisent leur mise en œuvre.',
    },
    keywords: ['governance', 'management', 'accountability', 'oversight', 'board'],
    isMandatory: true,
    suggestedControlCodes: ['A.5.1', 'A.5.2', 'A.5.3', 'A.5.4'],
  },
  {
    articleRef: 'Art. 20(2)',
    category: 'governance',
    criticality: 'high',
    title: { en: 'Management liability', fr: 'Responsabilité de la direction' },
    description: {
      en: 'Member States shall ensure that management bodies can be held liable for infringements of this Directive by the entities they manage.',
      fr: 'Les États membres veillent à ce que les organes de direction puissent être tenus pour responsables des infractions à la présente directive commises par les entités qu\'ils dirigent.',
    },
    keywords: ['liability', 'infringement', 'accountability', 'compliance'],
    isMandatory: true,
    suggestedControlCodes: ['A.5.1', 'A.5.31'],
  },
  {
    articleRef: 'Art. 20(3)',
    category: 'training',
    criticality: 'high',
    title: { en: 'Management cybersecurity training', fr: 'Formation cybersécurité de la direction' },
    description: {
      en: 'Member States shall ensure that members of management bodies are required to follow training and encourage essential and important entities to offer similar training to their employees on a regular basis.',
      fr: 'Les États membres veillent à ce que les membres des organes de direction soient tenus de suivre une formation et encouragent les entités essentielles et importantes à proposer régulièrement une formation similaire à leurs employés.',
    },
    keywords: ['training', 'awareness', 'education', 'skills', 'management'],
    isMandatory: true,
    suggestedControlCodes: ['A.6.3', 'A.7.2', 'A.7.3'],
  },

  // Article 21: Risk Management Measures
  {
    articleRef: 'Art. 21(1)',
    category: 'risk_management',
    criticality: 'high',
    title: { en: 'Risk-based cybersecurity measures', fr: 'Mesures de cybersécurité fondées sur les risques' },
    description: {
      en: 'Member States shall ensure that essential and important entities take appropriate and proportionate technical, operational and organisational measures to manage the risks posed to the security of network and information systems.',
      fr: 'Les États membres veillent à ce que les entités essentielles et importantes prennent des mesures techniques, opérationnelles et organisationnelles appropriées et proportionnées pour gérer les risques pesant sur la sécurité des réseaux et des systèmes d\'information.',
    },
    keywords: ['risk management', 'proportionate', 'technical measures', 'organizational measures'],
    isMandatory: true,
    suggestedControlCodes: ['A.5.1', 'A.5.8', 'A.8.1', 'A.8.2'],
  },
  {
    articleRef: 'Art. 21(2)(a)',
    category: 'risk_management',
    criticality: 'high',
    title: { en: 'Risk analysis and security policies', fr: 'Analyse des risques et politiques de sécurité' },
    description: {
      en: 'Policies on risk analysis and information system security, including risk assessment methodologies and security policy documentation.',
      fr: 'Politiques relatives à l\'analyse des risques et à la sécurité des systèmes d\'information, y compris les méthodologies d\'évaluation des risques et la documentation des politiques de sécurité.',
    },
    keywords: ['risk analysis', 'security policy', 'risk assessment', 'documentation'],
    isMandatory: true,
    suggestedControlCodes: ['A.5.1', 'A.5.8', 'A.5.9', 'A.5.10'],
  },
  {
    articleRef: 'Art. 21(2)(b)',
    category: 'incident_response',
    criticality: 'high',
    title: { en: 'Incident handling', fr: 'Gestion des incidents' },
    description: {
      en: 'Procedures for incident handling, including detection, analysis, containment, eradication, recovery and post-incident activities.',
      fr: 'Procédures de gestion des incidents, y compris la détection, l\'analyse, le confinement, l\'éradication, la reprise et les activités post-incident.',
    },
    keywords: ['incident', 'detection', 'response', 'recovery', 'CSIRT'],
    isMandatory: true,
    suggestedControlCodes: ['A.5.24', 'A.5.25', 'A.5.26', 'A.5.27', 'A.5.28'],
  },
  {
    articleRef: 'Art. 21(2)(c)',
    category: 'continuity',
    criticality: 'high',
    title: { en: 'Business continuity and crisis management', fr: 'Continuité des activités et gestion de crise' },
    description: {
      en: 'Business continuity, such as backup management and disaster recovery, and crisis management including business impact analysis and continuity planning.',
      fr: 'Continuité des activités, comme la gestion des sauvegardes et la reprise après sinistre, et gestion de crise, y compris l\'analyse d\'impact sur les activités et la planification de la continuité.',
    },
    keywords: ['business continuity', 'disaster recovery', 'backup', 'crisis management', 'BCP'],
    isMandatory: true,
    suggestedControlCodes: ['A.5.29', 'A.5.30', 'A.8.13', 'A.8.14'],
  },
  {
    articleRef: 'Art. 21(2)(d)',
    category: 'supply_chain',
    criticality: 'high',
    title: { en: 'Supply chain security', fr: 'Sécurité de la chaîne d\'approvisionnement' },
    description: {
      en: 'Supply chain security, including security-related aspects concerning the relationships between each entity and its direct suppliers or service providers.',
      fr: 'Sécurité de la chaîne d\'approvisionnement, y compris les aspects liés à la sécurité concernant les relations entre chaque entité et ses fournisseurs directs ou prestataires de services.',
    },
    keywords: ['supply chain', 'suppliers', 'third party', 'vendor', 'service provider'],
    isMandatory: true,
    suggestedControlCodes: ['A.5.19', 'A.5.20', 'A.5.21', 'A.5.22', 'A.5.23'],
  },
  {
    articleRef: 'Art. 21(2)(e)',
    category: 'security_measures',
    criticality: 'high',
    title: { en: 'Network and system acquisition security', fr: 'Sécurité de l\'acquisition des réseaux et systèmes' },
    description: {
      en: 'Security in network and information systems acquisition, development and maintenance, including vulnerability handling and disclosure.',
      fr: 'Sécurité de l\'acquisition, du développement et de la maintenance des réseaux et systèmes d\'information, y compris le traitement et la divulgation des vulnérabilités.',
    },
    keywords: ['acquisition', 'development', 'maintenance', 'vulnerability', 'secure development'],
    isMandatory: true,
    suggestedControlCodes: ['A.5.8', 'A.8.25', 'A.8.26', 'A.8.27', 'A.8.28', 'A.8.29', 'A.8.30', 'A.8.31'],
  },
  {
    articleRef: 'Art. 21(2)(f)',
    category: 'risk_management',
    criticality: 'medium',
    title: { en: 'Effectiveness assessment policies', fr: 'Politiques d\'évaluation de l\'efficacité' },
    description: {
      en: 'Policies and procedures to assess the effectiveness of cybersecurity risk-management measures.',
      fr: 'Politiques et procédures pour évaluer l\'efficacité des mesures de gestion des risques en matière de cybersécurité.',
    },
    keywords: ['assessment', 'effectiveness', 'audit', 'review', 'metrics', 'KPI'],
    isMandatory: true,
    suggestedControlCodes: ['A.5.35', 'A.5.36', 'A.8.34'],
  },
  {
    articleRef: 'Art. 21(2)(g)',
    category: 'training',
    criticality: 'medium',
    title: { en: 'Cyber hygiene and training', fr: 'Cyberhygiène et formation' },
    description: {
      en: 'Basic cyber hygiene practices and cybersecurity training for all employees.',
      fr: 'Pratiques de cyberhygiène de base et formation à la cybersécurité pour tous les employés.',
    },
    keywords: ['cyber hygiene', 'training', 'awareness', 'phishing', 'password'],
    isMandatory: true,
    suggestedControlCodes: ['A.6.3', 'A.7.2', 'A.7.3'],
  },
  {
    articleRef: 'Art. 21(2)(h)',
    category: 'cryptography',
    criticality: 'high',
    title: { en: 'Cryptography policies', fr: 'Politiques de cryptographie' },
    description: {
      en: 'Policies and procedures regarding the use of cryptography and, where appropriate, encryption.',
      fr: 'Politiques et procédures relatives à l\'utilisation de la cryptographie et, le cas échéant, du chiffrement.',
    },
    keywords: ['cryptography', 'encryption', 'key management', 'TLS', 'PKI'],
    isMandatory: true,
    suggestedControlCodes: ['A.8.24'],
  },
  {
    articleRef: 'Art. 21(2)(i)',
    category: 'access_control',
    criticality: 'high',
    title: { en: 'HR security and access control', fr: 'Sécurité RH et contrôle d\'accès' },
    description: {
      en: 'Human resources security, access control policies and asset management.',
      fr: 'Sécurité des ressources humaines, politiques de contrôle d\'accès et gestion des actifs.',
    },
    keywords: ['HR security', 'access control', 'asset management', 'identity', 'IAM'],
    isMandatory: true,
    suggestedControlCodes: ['A.5.9', 'A.5.10', 'A.5.11', 'A.5.15', 'A.5.16', 'A.5.17', 'A.5.18', 'A.6.1', 'A.6.2', 'A.6.4', 'A.6.5', 'A.6.6'],
  },
  {
    articleRef: 'Art. 21(2)(j)',
    category: 'access_control',
    criticality: 'high',
    title: { en: 'Multi-factor authentication', fr: 'Authentification multifacteur' },
    description: {
      en: 'The use of multi-factor authentication or continuous authentication solutions, secured voice, video and text communications and secured emergency communication systems.',
      fr: 'L\'utilisation de solutions d\'authentification multifacteur ou d\'authentification continue, de communications vocales, vidéo et textuelles sécurisées et de systèmes de communication d\'urgence sécurisés.',
    },
    keywords: ['MFA', 'multi-factor', 'authentication', 'secure communications', '2FA'],
    isMandatory: true,
    suggestedControlCodes: ['A.5.14', 'A.5.16', 'A.5.17', 'A.8.5'],
  },

  // Article 23: Reporting
  {
    articleRef: 'Art. 23(1)',
    category: 'reporting',
    criticality: 'high',
    title: { en: 'Significant incident notification', fr: 'Notification des incidents significatifs' },
    description: {
      en: 'Essential and important entities shall notify, without undue delay, the competent authority or CSIRT of any significant incident.',
      fr: 'Les entités essentielles et importantes notifient, sans retard injustifié, à l\'autorité compétente ou au CSIRT tout incident significatif.',
    },
    keywords: ['notification', 'incident', 'CSIRT', 'competent authority', 'reporting'],
    isMandatory: true,
    suggestedControlCodes: ['A.5.24', 'A.5.26', 'A.6.8'],
  },
  {
    articleRef: 'Art. 23(4)(a)',
    category: 'reporting',
    criticality: 'high',
    title: { en: 'Early warning (24 hours)', fr: 'Alerte précoce (24 heures)' },
    description: {
      en: 'An early warning within 24 hours of becoming aware of the significant incident, indicating whether it is suspected of being caused by unlawful or malicious acts.',
      fr: 'Une alerte précoce dans les 24 heures suivant la prise de connaissance de l\'incident significatif, indiquant s\'il est suspecté d\'être causé par des actes illicites ou malveillants.',
    },
    keywords: ['early warning', '24 hours', 'notification', 'timeline', 'initial report'],
    isMandatory: true,
    suggestedControlCodes: ['A.5.24', 'A.5.26'],
  },
  {
    articleRef: 'Art. 23(4)(b)',
    category: 'reporting',
    criticality: 'high',
    title: { en: 'Incident notification (72 hours)', fr: 'Notification d\'incident (72 heures)' },
    description: {
      en: 'An incident notification within 72 hours of becoming aware, updating the early warning with initial assessment including severity, impact and indicators of compromise.',
      fr: 'Une notification d\'incident dans les 72 heures suivant la prise de connaissance, mettant à jour l\'alerte précoce avec une évaluation initiale incluant la gravité, l\'impact et les indicateurs de compromission.',
    },
    keywords: ['incident notification', '72 hours', 'assessment', 'severity', 'IOC'],
    isMandatory: true,
    suggestedControlCodes: ['A.5.24', 'A.5.26', 'A.5.27'],
  },
  {
    articleRef: 'Art. 23(4)(d)',
    category: 'reporting',
    criticality: 'high',
    title: { en: 'Final report (1 month)', fr: 'Rapport final (1 mois)' },
    description: {
      en: 'A final report no later than one month after the incident notification, including detailed description, root cause, mitigation measures, and cross-border impact.',
      fr: 'Un rapport final au plus tard un mois après la notification de l\'incident, comprenant une description détaillée, la cause profonde, les mesures d\'atténuation et l\'impact transfrontalier.',
    },
    keywords: ['final report', 'one month', 'root cause', 'mitigation', 'post-incident'],
    isMandatory: true,
    suggestedControlCodes: ['A.5.24', 'A.5.27', 'A.5.28'],
  },

  // Additional Security Measures
  {
    articleRef: 'Art. 21-Net',
    category: 'security_measures',
    criticality: 'high',
    title: { en: 'Network security', fr: 'Sécurité réseau' },
    description: {
      en: 'Implementation of network security controls including segmentation, monitoring, and intrusion detection.',
      fr: 'Mise en œuvre de contrôles de sécurité réseau incluant la segmentation, la surveillance et la détection d\'intrusion.',
    },
    keywords: ['network', 'firewall', 'segmentation', 'IDS', 'IPS', 'monitoring'],
    isMandatory: true,
    suggestedControlCodes: ['A.8.20', 'A.8.21', 'A.8.22', 'A.8.23'],
  },
  {
    articleRef: 'Art. 21-Vuln',
    category: 'security_measures',
    criticality: 'high',
    title: { en: 'Vulnerability management', fr: 'Gestion des vulnérabilités' },
    description: {
      en: 'Implementation of vulnerability management including scanning, patching and remediation processes.',
      fr: 'Mise en œuvre de la gestion des vulnérabilités incluant l\'analyse, les correctifs et les processus de remédiation.',
    },
    keywords: ['vulnerability', 'patching', 'scanning', 'CVE', 'remediation'],
    isMandatory: true,
    suggestedControlCodes: ['A.8.8', 'A.8.9', 'A.8.19'],
  },
];

// ============================================================================
// Cloud Function
// ============================================================================

/**
 * Seeds the NIS2 framework data into Firestore.
 * Only admins can run this function.
 */
const seedNIS2Framework = onCall(
  {
    region: "europe-west1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const db = admin.firestore();
    const now = admin.firestore.FieldValue.serverTimestamp();

    // Check if user is admin
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    const userData = userDoc.data();

    if (!userData || !['admin', 'superAdmin'].includes(userData.role)) {
      throw new HttpsError("permission-denied", "Only admins can seed framework data");
    }

    try {
      // Check if NIS2 already exists
      const existingQuery = await db.collection('frameworks')
        .where('code', '==', 'NIS2')
        .limit(1)
        .get();

      let frameworkId;

      if (!existingQuery.empty) {
        // Update existing
        frameworkId = existingQuery.docs[0].id;
        await db.collection('frameworks').doc(frameworkId).update({
          ...NIS2_FRAMEWORK,
          requirementCount: NIS2_REQUIREMENTS.length,
          updatedAt: now,
        });
      } else {
        // Create new
        const frameworkRef = await db.collection('frameworks').add({
          ...NIS2_FRAMEWORK,
          requirementCount: NIS2_REQUIREMENTS.length,
          createdAt: now,
          updatedAt: now,
        });
        frameworkId = frameworkRef.id;
      }

      // Delete existing requirements for this framework
      const existingReqs = await db.collection('requirements')
        .where('frameworkId', '==', frameworkId)
        .get();

      const batch = db.batch();
      existingReqs.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      // Create requirements in batches
      const batchSize = 20;
      for (let i = 0; i < NIS2_REQUIREMENTS.length; i += batchSize) {
        const reqBatch = db.batch();
        const slice = NIS2_REQUIREMENTS.slice(i, i + batchSize);

        slice.forEach((req, index) => {
          const reqRef = db.collection('requirements').doc();
          reqBatch.set(reqRef, {
            ...req,
            frameworkId,
            frameworkCode: 'NIS2',
            orderIndex: i + index,
            createdAt: now,
            updatedAt: now,
          });
        });

        await reqBatch.commit();
      }

      return {
        success: true,
        frameworkId,
        requirementCount: NIS2_REQUIREMENTS.length,
        message: `NIS2 framework seeded with ${NIS2_REQUIREMENTS.length} requirements`,
      };
    } catch (error) {
      console.error('Error seeding NIS2 framework:', error);
      throw new HttpsError("internal", `Failed to seed NIS2 framework: ${error.message}`);
    }
  }
);

module.exports = { seedNIS2Framework };
