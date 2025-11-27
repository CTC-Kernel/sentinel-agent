import {
    Asset, Risk, Control, Project, Audit, Incident, Supplier,
    ProcessingActivity, BusinessProcess, BcpDrill, UserProfile,
    Criticality, SystemLog, Document
} from '../types';

const DEMO_ORG_ID = 'demo-org-123';
const DEMO_USER_ID = 'demo-user-123';

export const demoAssets: Asset[] = [
    {
        id: 'asset-1',
        organizationId: DEMO_ORG_ID,
        name: 'Serveur Principal ERP',
        type: 'Matériel',
        owner: 'DSI',
        confidentiality: Criticality.HIGH,
        integrity: Criticality.HIGH,
        availability: Criticality.CRITICAL,
        location: 'Data Center Paris',
        createdAt: new Date().toISOString(),
        lifecycleStatus: 'En service',
        currentValue: 15000
    },
    {
        id: 'asset-2',
        organizationId: DEMO_ORG_ID,
        name: 'Base de données Clients',
        type: 'Données',
        owner: 'Marketing',
        confidentiality: Criticality.CRITICAL,
        integrity: Criticality.HIGH,
        availability: Criticality.HIGH,
        location: 'Cloud Privé',
        createdAt: new Date().toISOString(),
        lifecycleStatus: 'En service'
    },
    {
        id: 'asset-3',
        organizationId: DEMO_ORG_ID,
        name: 'PC Portable PDG',
        type: 'Matériel',
        owner: 'Direction',
        confidentiality: Criticality.CRITICAL,
        integrity: Criticality.MEDIUM,
        availability: Criticality.HIGH,
        location: 'Siège',
        createdAt: new Date().toISOString(),
        lifecycleStatus: 'En service'
    },
    {
        id: 'asset-4',
        organizationId: DEMO_ORG_ID,
        name: 'Site Web Corporatif',
        type: 'Service',
        owner: 'Comms',
        confidentiality: Criticality.LOW,
        integrity: Criticality.HIGH,
        availability: Criticality.MEDIUM,
        location: 'Hébergeur Externe',
        createdAt: new Date().toISOString(),
        lifecycleStatus: 'En service'
    }
];

export const demoRisks: Risk[] = [
    {
        id: 'risk-1',
        organizationId: DEMO_ORG_ID,
        assetId: 'asset-2',
        threat: 'Vol de données clients',
        vulnerability: 'Authentification faible',
        probability: 4,
        impact: 5,
        score: 20,
        residualProbability: 2,
        residualImpact: 5,
        residualScore: 10,
        strategy: 'Atténuer',
        status: 'En cours',
        owner: 'RSSI',
        createdAt: new Date().toISOString()
    },
    {
        id: 'risk-2',
        organizationId: DEMO_ORG_ID,
        assetId: 'asset-1',
        threat: 'Panne matérielle critique',
        vulnerability: 'Absence de redondance',
        probability: 3,
        impact: 4,
        score: 12,
        residualProbability: 1,
        residualImpact: 4,
        residualScore: 4,
        strategy: 'Atténuer',
        status: 'Ouvert',
        owner: 'DSI',
        createdAt: new Date().toISOString()
    },
    {
        id: 'risk-3',
        organizationId: DEMO_ORG_ID,
        assetId: 'asset-4',
        threat: 'Défiguration du site web',
        vulnerability: 'CMS non mis à jour',
        probability: 5,
        impact: 2,
        score: 10,
        strategy: 'Accepter',
        status: 'Fermé',
        owner: 'Webmaster',
        createdAt: new Date().toISOString()
    }
];

export const demoControls: Control[] = [
    {
        id: 'ctrl-1',
        organizationId: DEMO_ORG_ID,
        code: 'A.5.15',
        name: 'Contrôle d\'accès',
        framework: 'ISO27001',
        description: 'Règles de contrôle d\'accès aux informations et aux moyens de traitement.',
        status: 'Implémenté',
        evidenceStrength: 'Forte',
        lastUpdated: new Date().toISOString()
    },
    {
        id: 'ctrl-2',
        organizationId: DEMO_ORG_ID,
        code: 'A.8.2',
        name: 'Classification des informations',
        framework: 'ISO27001',
        description: 'Les informations doivent être classifiées en fonction des exigences légales, de leur valeur, de leur criticité et de leur sensibilité.',
        status: 'Partiel',
        evidenceStrength: 'Faible',
        lastUpdated: new Date().toISOString()
    },
    {
        id: 'ctrl-3',
        organizationId: DEMO_ORG_ID,
        code: 'A.12.3',
        name: 'Sauvegarde',
        framework: 'ISO27001',
        description: 'Des copies de sauvegarde des informations, des logiciels et des images systèmes doivent être prises et testées régulièrement.',
        status: 'Non commencé',
        lastUpdated: new Date().toISOString()
    }
];

export const demoProjects: Project[] = [
    {
        id: 'proj-1',
        organizationId: DEMO_ORG_ID,
        name: 'Mise en conformité ISO 27001',
        description: 'Projet global pour l\'obtention de la certification ISO 27001.',
        manager: 'Jean Dupont',
        status: 'En cours',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        progress: 45,
        tasks: [],
        createdAt: new Date().toISOString()
    },
    {
        id: 'proj-2',
        organizationId: DEMO_ORG_ID,
        name: 'Déploiement MFA',
        description: 'Activation de l\'authentification multi-facteurs pour tous les employés.',
        manager: 'Alice Martin',
        status: 'Terminé',
        startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        progress: 100,
        tasks: [],
        createdAt: new Date().toISOString()
    }
];

export const demoAudits: Audit[] = [
    {
        id: 'audit-1',
        organizationId: DEMO_ORG_ID,
        name: 'Audit Interne Q3 2024',
        type: 'Interne',
        auditor: 'Cabinet AuditSecure',
        dateScheduled: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'Planifié',
        findingsCount: 0
    },
    {
        id: 'audit-2',
        organizationId: DEMO_ORG_ID,
        name: 'Audit de Certification Initiale',
        type: 'Certification',
        auditor: 'CertifOrg',
        dateScheduled: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'Terminé',
        findingsCount: 3
    }
];

export const demoIncidents: Incident[] = [
    {
        id: 'inc-1',
        organizationId: DEMO_ORG_ID,
        title: 'Tentative de Phishing Ciblée',
        description: 'Plusieurs employés ont reçu un email frauduleux demandant leurs identifiants.',
        severity: Criticality.HIGH,
        status: 'Résolu',
        category: 'Phishing',
        reporter: 'Système de détection',
        dateReported: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        dateResolved: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        id: 'inc-2',
        organizationId: DEMO_ORG_ID,
        title: 'Perte d\'un ordinateur portable',
        description: 'Ordinateur oublié dans un train par un commercial.',
        severity: Criticality.MEDIUM,
        status: 'Analyse',
        category: 'Vol Matériel',
        reporter: 'Commercial Sud',
        dateReported: new Date().toISOString()
    }
];

export const demoSuppliers: Supplier[] = [
    {
        id: 'sup-1',
        organizationId: DEMO_ORG_ID,
        name: 'CloudMaster SAS',
        category: 'Hébergement',
        criticality: Criticality.CRITICAL,
        status: 'Actif',
        riskLevel: 'Low',
        riskAssessment: { overallScore: 15 },
        contract: { endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reviewDates: {
            contractReview: new Date().toISOString(),
            securityReview: new Date().toISOString(),
            complianceReview: new Date().toISOString()
        }
    },
    {
        id: 'sup-2',
        organizationId: DEMO_ORG_ID,
        name: 'DevAgency',
        category: 'Consulting',
        criticality: Criticality.MEDIUM,
        status: 'Actif',
        riskLevel: 'Medium',
        riskAssessment: { overallScore: 45 },
        contract: { endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString() },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reviewDates: {
            contractReview: new Date().toISOString(),
            securityReview: new Date().toISOString(),
            complianceReview: new Date().toISOString()
        }
    }
];

export const demoProcessingActivities: ProcessingActivity[] = [
    {
        id: 'proc-1',
        organizationId: DEMO_ORG_ID,
        name: 'Gestion de la Paie',
        purpose: 'Paiement des salaires et déclarations sociales',
        manager: 'DRH',
        legalBasis: 'Obligation Légale',
        dataCategories: ['Identité', 'Financier', 'Social'],
        dataSubjects: ['Employés'],
        retentionPeriod: '5 ans',
        hasDPIA: false,
        status: 'Actif'
    },
    {
        id: 'proc-2',
        organizationId: DEMO_ORG_ID,
        name: 'CRM Clients',
        purpose: 'Suivi commercial et fidélisation',
        manager: 'Directeur Commercial',
        legalBasis: 'Intérêt Légitime',
        dataCategories: ['Identité', 'Coordonnées', 'Historique d\'achats'],
        dataSubjects: ['Clients', 'Prospects'],
        retentionPeriod: '3 ans après dernier contact',
        hasDPIA: true,
        status: 'Actif'
    }
];

export const demoBusinessProcesses: BusinessProcess[] = [
    {
        id: 'bp-1',
        organizationId: DEMO_ORG_ID,
        name: 'Prise de commande en ligne',
        description: 'Processus critique de vente via le site e-commerce.',
        owner: 'Responsable E-commerce',
        rto: '4 heures',
        rpo: '1 heure',
        priority: 'Critique',
        supportingAssetIds: ['asset-1', 'asset-2', 'asset-4']
    }
];

export const demoBcpDrills: BcpDrill[] = [
    {
        id: 'drill-1',
        organizationId: DEMO_ORG_ID,
        processId: 'bp-1',
        date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Simulation',
        result: 'Succès',
        notes: 'Basculement vers le site de secours effectué en 3h.',
        createdAt: new Date().toISOString()
    }
];

export const demoDocuments: Document[] = [
    {
        id: 'doc-1',
        organizationId: DEMO_ORG_ID,
        title: 'Politique de Sécurité des SI (PSSI)',
        type: 'Politique',
        version: '2.1',
        status: 'Publié',
        owner: 'RSSI',
        createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        id: 'doc-2',
        organizationId: DEMO_ORG_ID,
        title: 'Charte Informatique',
        type: 'Politique',
        version: '1.0',
        status: 'Approuvé',
        owner: 'DRH',
        createdAt: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString()
    }
];

export const demoUsers: UserProfile[] = [
    {
        uid: DEMO_USER_ID,
        organizationId: DEMO_ORG_ID,
        email: 'demo@sentinel-grc.com',
        role: 'admin',
        displayName: 'Utilisateur Démo',
        department: 'Direction',
        onboardingCompleted: true,
        createdAt: new Date().toISOString()
    },
    {
        uid: 'user-2',
        organizationId: DEMO_ORG_ID,
        email: 'alice@sentinel-grc.com',
        role: 'rssi',
        displayName: 'Alice Martin',
        department: 'Sécurité',
        onboardingCompleted: true,
        createdAt: new Date().toISOString()
    },
    {
        uid: 'user-3',
        organizationId: DEMO_ORG_ID,
        email: 'bob@sentinel-grc.com',
        role: 'user',
        displayName: 'Bob Dupont',
        department: 'IT',
        onboardingCompleted: true,
        createdAt: new Date().toISOString()
    }
];

export const demoLogs: SystemLog[] = [
    {
        id: 'log-1',
        organizationId: DEMO_ORG_ID,
        userId: DEMO_USER_ID,
        userEmail: 'demo@sentinel-grc.com',
        action: 'Connexion',
        resource: 'Auth',
        details: 'Connexion réussie',
        timestamp: new Date().toISOString()
    },
    {
        id: 'log-2',
        organizationId: DEMO_ORG_ID,
        userId: 'user-2',
        userEmail: 'alice@sentinel-grc.com',
        action: 'Modification Risque',
        resource: 'Risk',
        details: 'Mise à jour du score de risque #risk-1',
        timestamp: new Date(Date.now() - 3600000).toISOString()
    }
];
