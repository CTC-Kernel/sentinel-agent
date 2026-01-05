import { DocumentData } from 'firebase/firestore';

export const MockDataService = {
    getCollection: (collectionName: string): (DocumentData & { id: string })[] => {
        const now = new Date();
        const oneDay = 86400000;
        const oneWeek = 604800000;

        switch (collectionName) {
            case 'risks':
                return [
                    {
                        id: 'risk-1',
                        threat: 'Attaque par Phishing',
                        description: 'Compromission des identifiants via email frauduleux ciblant le service financier',
                        probability: 4,
                        impact: 4,
                        score: 16,
                        status: 'Ouvert',
                        owner: 'user-1',
                        organizationId: 'org_default',
                        createdAt: new Date(now.getTime() - oneWeek * 2).toISOString(),
                        updatedAt: new Date(now.getTime() - oneDay).toISOString(),
                        assetId: 'asset-1',
                        category: 'Cybercriminalité',
                        strategy: 'Atténuer'
                    },
                    {
                        id: 'risk-2',
                        threat: 'Panne Serveur Critique',
                        description: 'Interruption de service due à une défaillance matérielle sur les serveurs de production',
                        probability: 2,
                        impact: 5,
                        score: 10,
                        status: 'Traité',
                        owner: 'user-2',
                        organizationId: 'org_default',
                        createdAt: new Date(now.getTime() - oneWeek * 4).toISOString(),
                        updatedAt: new Date(now.getTime() - oneWeek).toISOString(),
                        assetId: 'asset-2',
                        category: 'Disponibilité',
                        strategy: 'Transférer'
                    },
                    {
                        id: 'risk-3',
                        threat: 'Fuite de données Clients',
                        description: 'Exposition non autorisée de la base de données clients sur internet',
                        probability: 3,
                        impact: 5,
                        score: 15,
                        status: 'Ouvert',
                        owner: 'user-1',
                        organizationId: 'org_default',
                        createdAt: new Date(now.getTime() - oneDay * 3).toISOString(),
                        updatedAt: new Date(now.getTime() - oneDay).toISOString(),
                        assetId: 'asset-2',
                        category: 'Confidentialité',
                        strategy: 'Éviter'
                    },
                    {
                        id: 'risk-4',
                        threat: 'Malware interne (Ransomware)',
                        description: 'Infection par ransomware via clé USB infectée',
                        probability: 2,
                        impact: 5,
                        score: 10,
                        status: 'Ouvert',
                        owner: 'user-3',
                        organizationId: 'org_default',
                        createdAt: new Date(now.getTime() - oneWeek).toISOString(),
                        updatedAt: new Date(now.getTime() - oneDay * 2).toISOString(),
                        assetId: 'asset-4',
                        category: 'Malware',
                        strategy: 'Atténuer'
                    },
                    {
                        id: 'risk-5',
                        threat: 'Perte de personnel clé',
                        description: 'Départ simultané de plusieurs administrateurs système',
                        probability: 2,
                        impact: 3,
                        score: 6,
                        status: 'Accepté',
                        owner: 'user-4',
                        organizationId: 'org_default',
                        createdAt: new Date(now.getTime() - oneWeek * 8).toISOString(),
                        updatedAt: new Date(now.getTime() - oneWeek * 4).toISOString(),
                        category: 'Organisationnel',
                        strategy: 'Accepter'
                    },
                    {
                        id: 'risk-6',
                        threat: 'Attaque DDoS',
                        description: 'Saturation de la bande passante rendant le site inaccessible',
                        probability: 3,
                        impact: 4,
                        score: 12,
                        status: 'En cours de traitement',
                        owner: 'user-2',
                        organizationId: 'org_default',
                        createdAt: new Date(now.getTime() - oneDay * 5).toISOString(),
                        updatedAt: new Date(now.getTime() - oneDay).toISOString(),
                        assetId: 'asset-3',
                        category: 'Disponibilité',
                        strategy: 'Atténuer'
                    },
                    {
                        id: 'risk-7',
                        threat: 'Vol de matériel',
                        description: 'Vol d\'ordinateurs portables contenant des données sensibles',
                        probability: 3,
                        impact: 3,
                        score: 9,
                        status: 'Ouvert',
                        owner: 'user-1',
                        organizationId: 'org_default',
                        createdAt: new Date(now.getTime() - oneWeek * 3).toISOString(),
                        updatedAt: new Date(now.getTime() - oneWeek).toISOString(),
                        assetId: 'asset-5',
                        category: 'Physique',
                        strategy: 'Atténuer'
                    }
                ];
            case 'assets':
                return [
                    {
                        id: 'asset-1',
                        name: 'Serveur Principal (Prod)',
                        type: 'Server',
                        confidentiality: 'High',
                        integrity: 'High',
                        availability: 'Critical',
                        owner: 'user-2',
                        lifecycleStatus: 'Active',
                        createdAt: new Date(now.getTime() - oneWeek * 50).toISOString(),
                        purchasePrice: 50000,
                        purchaseDate: '2024-01-15',
                        warrantyEnd: '2027-01-15',
                        location: 'Data Center Paris'
                    },
                    {
                        id: 'asset-2',
                        name: 'Base de Données Clients (SQL)',
                        type: 'Database',
                        confidentiality: 'Critical',
                        integrity: 'Critical',
                        availability: 'High',
                        owner: 'user-1',
                        lifecycleStatus: 'Active',
                        createdAt: new Date(now.getTime() - oneWeek * 40).toISOString(),
                        purchasePrice: 15000, // License cost maybe
                        purchaseDate: '2024-03-01',
                        warrantyEnd: '2027-03-01',
                        location: 'Cloud AWS'
                    },
                    {
                        id: 'asset-3',
                        name: 'Infrastructure Cloud (AWS)',
                        type: 'Cloud',
                        confidentiality: 'Critical',
                        integrity: 'High',
                        availability: 'Critical',
                        owner: 'user-2',
                        lifecycleStatus: 'Active',
                        createdAt: new Date(now.getTime() - oneWeek * 60).toISOString(),
                        purchasePrice: 120000, // Yearly cost projected
                        purchaseDate: '2023-01-01',
                        warrantyEnd: '2026-12-31',
                        location: 'Global'
                    },
                    {
                        id: 'asset-4',
                        name: 'Postes de Travail (Flotte)',
                        type: 'Hardware',
                        confidentiality: 'Medium',
                        integrity: 'Medium',
                        availability: 'Medium',
                        owner: 'user-3',
                        lifecycleStatus: 'Active',
                        createdAt: new Date(now.getTime() - oneWeek * 100).toISOString(),
                        purchasePrice: 200000,
                        purchaseDate: '2023-06-01',
                        warrantyEnd: '2026-06-01',
                        location: 'Paris HQ'
                    },
                    {
                        id: 'asset-5',
                        name: 'Site Web Corporatif',
                        type: 'Application',
                        confidentiality: 'Public',
                        integrity: 'High',
                        availability: 'High',
                        owner: 'user-4',
                        lifecycleStatus: 'Active',
                        createdAt: new Date(now.getTime() - oneWeek * 20).toISOString(),
                        purchasePrice: 25000,
                        purchaseDate: '2024-09-01',
                        location: 'Cloud AWS'
                    }
                ];
            case 'incidents':
                return [
                    {
                        id: 'incident-1',
                        title: 'Ransomware detected on HR',
                        description: 'Ransomware detected on HR server. Several files encrypted with .lock extension.',
                        severity: 'Critical',
                        status: 'En cours',
                        reporter: 'user-3',
                        dateReported: new Date(now.getTime() - oneDay * 0.5).toISOString(),
                        organizationId: 'org_default',
                        impact: 'Major',
                        isSignificant: true,
                        category: 'Ransomware',
                        affectedAssets: ['asset-4']
                    },
                    {
                        id: 'incident-2',
                        title: 'Tentative d\'intrusion FW',
                        description: 'Multiple failed login attempts detected on firewall external interface.',
                        severity: 'High',
                        status: 'Analyse',
                        reporter: 'System',
                        dateReported: new Date(now.getTime() - oneDay * 2).toISOString(),
                        organizationId: 'org_default',
                        impact: 'None',
                        isSignificant: false,
                        category: 'Network',
                        affectedAssets: ['asset-3']
                    },
                    {
                        id: 'incident-3',
                        title: 'Panne Disque Serveur Backup',
                        description: 'RAID Controller reported failure on Drive 2.',
                        severity: 'Medium',
                        status: 'Résolu',
                        reporter: 'user-2',
                        dateReported: new Date(now.getTime() - oneWeek).toISOString(),
                        dateResolved: new Date(now.getTime() - oneWeek + oneDay).toISOString(),
                        organizationId: 'org_default',
                        impact: 'Minor',
                        isSignificant: false,
                        category: 'Hardware',
                        affectedAssets: ['asset-1']
                    },
                    {
                        id: 'incident-4',
                        title: 'Perte PC Portable',
                        description: 'Un commercial a déclaré le vol de son ordinateur portable.',
                        severity: 'Medium',
                        status: 'Fermé',
                        reporter: 'user-4',
                        dateReported: new Date(now.getTime() - oneWeek * 3).toISOString(),
                        dateResolved: new Date(now.getTime() - oneWeek * 3 + oneDay * 2).toISOString(),
                        organizationId: 'org_default',
                        impact: 'Medium',
                        isSignificant: false,
                        category: 'Physique'
                    }
                ];
            case 'controls':
                return [
                    {
                        id: 'ctrl-1',
                        code: 'A.5.1',
                        name: 'Politiques de sécurité de l\'information',
                        status: 'Implémenté',
                        type: 'Préventif',
                        description: 'Un ensemble de politiques de sécurité de l\'information doit être défini, approuvé par la direction, publié et communiqué aux salariés et aux parties prenantes externes concernées.',
                        organizationId: 'org_default',
                        framework: 'ISO27001',
                        applicability: 'Applicable',
                        maturity: 4,
                        implementationRate: 100
                    },
                    {
                        id: 'ctrl-2',
                        code: 'A.9.1',
                        name: 'Contrôle d\'accès',
                        status: 'Partiel',
                        type: 'Préventif',
                        description: 'Les accès aux systèmes d\'information doivent être limités aux utilisateurs autorisés.',
                        organizationId: 'org_default',
                        framework: 'ISO27001',
                        applicability: 'Applicable',
                        maturity: 2,
                        implementationRate: 60
                    },
                    {
                        id: 'ctrl-3',
                        code: 'A.12.3',
                        name: 'Sauvegardes',
                        status: 'Implémenté',
                        type: 'Correctif',
                        description: 'Des copies de sauvegarde des informations, des logiciels et des images des systèmes doivent être prises et testées régulièrement.',
                        organizationId: 'org_default',
                        framework: 'ISO27001',
                        applicability: 'Applicable',
                        maturity: 5,
                        implementationRate: 100
                    },
                    {
                        id: 'ctrl-4',
                        code: 'A.7.2',
                        name: 'Sensibilisation, apprentissage et formation',
                        status: 'En retard',
                        type: 'Préventif',
                        description: 'Tous les salariés de l\'organisation et, le cas échéant, les prestataires doivent recevoir une formation sensibilisation appropriée.',
                        organizationId: 'org_default',
                        framework: 'ISO27001',
                        applicability: 'Applicable',
                        maturity: 1,
                        implementationRate: 20
                    }
                ];
            case 'documents':
                return [
                    {
                        id: 'doc-1',
                        name: 'Politique de Sécurité (PSSI).pdf',
                        type: 'policy',
                        status: 'Publié',
                        organizationId: 'org_default',
                        createdAt: new Date(now.getTime() - oneWeek * 10).toISOString(),
                        updatedAt: new Date(now.getTime() - oneWeek * 2).toISOString(),
                        version: '2.1',
                        size: 2048,
                        ownerId: 'user-1',
                        classification: 'Interne'
                    },
                    {
                        id: 'doc-2',
                        name: 'Plan de Continuité (PCA).pdf',
                        type: 'procedure',
                        status: 'En revue',
                        organizationId: 'org_default',
                        createdAt: new Date(now.getTime() - oneDay * 3).toISOString(),
                        updatedAt: new Date(now.getTime() - oneDay).toISOString(),
                        version: '1.0-draft',
                        size: 512,
                        ownerId: 'user-1',
                        classification: 'Confidentiel',
                        reviewers: ['user-2']
                    },
                    {
                        id: 'doc-3',
                        name: 'Charte Informatique.pdf',
                        type: 'policy',
                        status: 'Publié',
                        organizationId: 'org_default',
                        createdAt: new Date(now.getTime() - oneWeek * 12).toISOString(),
                        updatedAt: new Date(now.getTime() - oneWeek * 12).toISOString(),
                        version: '1.0',
                        size: 1024,
                        ownerId: 'user-4',
                        classification: 'Public'
                    }
                ];
            case 'projects':
                return [
                    {
                        id: 'proj-1',
                        name: 'Migration Cloud AWS',
                        description: 'Migration complète des serveurs on-premise vers AWS',
                        status: 'En cours',
                        organizationId: 'org_default',
                        progress: 65,
                        managerId: 'user-1',
                        manager: 'Demo User',
                        tasks: [],
                        startDate: '2024-01-01',
                        endDate: '2024-12-31',
                        dueDate: '2024-12-31',
                        budget: 50000
                    },
                    {
                        id: 'proj-2',
                        name: 'Certification ISO 27001',
                        description: 'Préparation et passage de la certification',
                        status: 'En cours',
                        organizationId: 'org_default',
                        progress: 30,
                        managerId: 'user-2',
                        manager: 'Sophie Martin',
                        tasks: [],
                        startDate: '2024-03-01',
                        endDate: '2025-03-01',
                        dueDate: '2025-03-01',
                        budget: 25000
                    }
                ];
            case 'suppliers':
                return [
                    {
                        id: 'sup-1',
                        name: 'Amazon Web Services (AWS)',
                        serviceType: 'Cloud Provider',
                        criticality: 'Critical',
                        status: 'Active',
                        organizationId: 'org_default',
                        contactName: 'Support AWS',
                        riskScore: 2
                    },
                    {
                        id: 'sup-2',
                        name: 'Microsoft (Office 365)',
                        serviceType: 'SaaS',
                        criticality: 'High',
                        status: 'Active',
                        organizationId: 'org_default',
                        contactName: 'Support Microsoft',
                        riskScore: 1
                    },
                    {
                        id: 'sup-3',
                        name: 'Securitas',
                        serviceType: 'Physical Security',
                        criticality: 'Medium',
                        status: 'Active',
                        organizationId: 'org_default',
                        contactName: 'Jean Agent',
                        riskScore: 1
                    }
                ];
            case 'business_processes':
                return [
                    {
                        id: 'proc-1',
                        name: 'Gestion de la Paie',
                        criticality: 'High',
                        owner: 'user-4',
                        organizationId: 'org_default',
                        status: 'Active',
                        description: 'Traitement mensuel des salaires'
                    },
                    {
                        id: 'proc-2',
                        name: 'Développement Logiciel',
                        criticality: 'Critical',
                        owner: 'user-2',
                        organizationId: 'org_default',
                        status: 'Active',
                        description: 'Cycle de vie du développement des applications'
                    }
                ];
            case 'audits':
                return [
                    {
                        id: 'audit-1',
                        name: 'Audit Interne ISO 27001 - Q1',
                        type: 'Interne',
                        status: 'Planifié',
                        dateScheduled: new Date(now.getTime() + oneWeek * 2).toISOString(),
                        auditor: 'Jean Dupont',
                        organizationId: 'org_default',
                        findingsCount: 0,
                        scope: 'Périmètre Sécurité Physique'
                    },
                    {
                        id: 'audit-2',
                        name: 'Audit Fournisseur AWS',
                        type: 'Externe',
                        status: 'En cours',
                        dateScheduled: new Date(now.getTime() - oneDay).toISOString(),
                        auditor: 'Alice Security',
                        organizationId: 'org_default',
                        findingsCount: 2,
                        scope: 'Conformité GDPR'
                    },
                    {
                        id: 'audit-3',
                        name: 'Audit de Code',
                        type: 'Technique',
                        status: 'Terminé',
                        dateScheduled: new Date(now.getTime() - oneWeek * 4).toISOString(),
                        auditor: 'SonarQube',
                        organizationId: 'org_default',
                        findingsCount: 15,
                        scope: 'Codebase v2.0'
                    }
                ];
            case 'system_logs':
                return [
                    { id: 'log-1', timestamp: new Date(now.getTime() - 1000 * 60 * 5).toISOString(), action: 'LOGIN_SUCCESS', user: 'Demo User', details: 'Connexion réussie', organizationId: 'org_default', severity: 'info' },
                    { id: 'log-2', timestamp: new Date(now.getTime() - 1000 * 60 * 60).toISOString(), action: 'DOCUMENT_UPLOAD', user: 'Demo User', details: 'Upload de "Plan.pdf"', organizationId: 'org_default', severity: 'info' },
                    { id: 'log-3', timestamp: new Date(now.getTime() - 1000 * 60 * 120).toISOString(), action: 'RISK_CREATED', user: 'Sophie Martin', details: 'Nouveau risque identifié', organizationId: 'org_default', severity: 'info' },
                    { id: 'log-4', timestamp: new Date(now.getTime() - 1000 * 60 * 200).toISOString(), action: 'LOGIN_FAILED', user: 'Unknown', details: 'Tentative échouée IP 192.168.1.1', organizationId: 'org_default', severity: 'warning' },
                    { id: 'log-5', timestamp: new Date(now.getTime() - 1000 * 60 * 300).toISOString(), action: 'SETTINGS_UPDATE', user: 'Admin', details: 'Mise à jour politique mot de passe', organizationId: 'org_default', severity: 'info' }
                ];
            case 'vulnerabilities':
                return [
                    {
                        id: 'vuln-1',
                        cveId: 'CVE-2024-1234',
                        severity: 'High',
                        description: 'Remote Code Execution in WebFrame 2.0',
                        status: 'Open',
                        affectedAssets: ['asset-5'],
                        remediation: 'Update to version 2.1',
                        publishedDate: new Date(now.getTime() - oneWeek).toISOString()
                    }
                ];
            case 'threat_library':
            case 'threats':
                return [
                    {
                        id: 'threat-1',
                        name: 'APT-29 (Cozy Bear)',
                        type: 'APT',
                        description: 'Advanced Persistent Threat group suspected of being attributed to the Russian Foreign Intelligence Service.',
                        severity: 'Critical',
                        source: 'CISA',
                        indicators: ['1.2.3.4', 'malicious-domain.com']
                    },
                    {
                        id: 'threat-2',
                        name: 'Lazarus Group',
                        type: 'APT',
                        description: 'State-sponsored cyber threat group.',
                        severity: 'High',
                        source: 'FBI',
                        indicators: ['5.6.7.8']
                    }
                ];
            case 'users':
                return [
                    {
                        id: 'user-1',
                        uid: 'demo-user-123',
                        email: 'demo@sentinel.com',
                        displayName: 'Demo User',
                        role: 'admin',
                        organizationId: 'org_default',
                        department: 'IT',
                        isPending: false,
                        photoURL: 'https://i.pravatar.cc/150?u=demo'
                    },
                    {
                        id: 'user-2',
                        uid: 'user-2',
                        email: 'sophie@sentinel.com',
                        displayName: 'Sophie Martin',
                        role: 'rssi',
                        organizationId: 'org_default',
                        department: 'Security',
                        isPending: false,
                        photoURL: 'https://i.pravatar.cc/150?u=sophie'
                    },
                    {
                        id: 'user-3',
                        uid: 'user-3',
                        email: 'thomas@sentinel.com',
                        displayName: 'Thomas Dubois',
                        role: 'user',
                        organizationId: 'org_default',
                        department: 'HR',
                        isPending: false,
                        photoURL: 'https://i.pravatar.cc/150?u=thomas'
                    },
                    {
                        id: 'user-4',
                        uid: 'user-4',
                        email: 'marie@sentinel.com',
                        displayName: 'Marie Leroy',
                        role: 'direction',
                        organizationId: 'org_default',
                        department: 'Management',
                        isPending: false,
                        photoURL: 'https://i.pravatar.cc/150?u=marie'
                    }
                ];
            case 'bcp_drills':
                return [
                    {
                        id: 'drill-1',
                        name: 'Simulation Panne Datacenter',
                        date: new Date(now.getTime() - oneWeek * 8).toISOString(),
                        type: 'Simulation',
                        status: 'Completed',
                        organizationId: 'org_default',
                        score: 85,
                        participants: ['user-1', 'user-2'],
                        findings: ['RTO respecté', 'Documentation à jour']
                    },
                    {
                        id: 'drill-2',
                        name: 'Test Restauration Backup',
                        date: new Date(now.getTime() - oneWeek * 2).toISOString(),
                        type: 'Test Technique',
                        status: 'Completed',
                        organizationId: 'org_default',
                        score: 100,
                        participants: ['user-2'],
                        findings: ['Restauration OK']
                    }
                ];
            case 'threat_intelligence':
                return [
                    {
                        id: 'ti-1',
                        title: 'Nouveau Ransomware "DarkCrypt"',
                        description: 'Une nouvelle variante de ransomware cible les PME européennes.',
                        severity: 'Critical',
                        source: 'CERT-FR',
                        publishedDate: new Date(now.getTime() - oneDay).toISOString(),
                        indicators: ['hash123', 'ip1.2.3.4'],
                        organizationId: 'org_default',
                        tags: ['Ransomware', 'Europe']
                    },
                    {
                        id: 'ti-2',
                        title: 'Vulnérabilité Zero-Day Exchange',
                        description: 'Exploitation active de CVE-2024-XXXX.',
                        severity: 'High',
                        source: 'Microsoft',
                        publishedDate: new Date(now.getTime() - oneWeek).toISOString(),
                        indicators: [],
                        organizationId: 'org_default',
                        tags: ['Zero-Day', 'Microsoft']
                    }
                ];
            default:
                return [];
        }
    },

    getDocument: (collectionName: string, id: string): (DocumentData & { id: string }) | null => {
        const list = MockDataService.getCollection(collectionName);
        return list.find(d => d.id === id) || null;
    }
};
