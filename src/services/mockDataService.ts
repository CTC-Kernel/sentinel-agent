import { DocumentData } from 'firebase/firestore';

export const MockDataService = {
    getCollection: (collectionName: string): (DocumentData & { id: string })[] => {
        switch (collectionName) {
            case 'risks':
                return [
                    {
                        id: 'risk-1',
                        threat: 'Attaque par Phishing',
                        description: 'Compromission des identifiants via email frauduleux',
                        probability: 3,
                        impact: 3,
                        score: 9,
                        status: 'Ouvert',
                        owner: 'user-1',
                        organizationId: 'org_default',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    },
                    {
                        id: 'risk-2',
                        threat: 'Panne Serveur',
                        description: 'Interruption de service due à une défaillance matérielle',
                        probability: 2,
                        impact: 4,
                        score: 8,
                        status: 'Traité',
                        owner: 'user-1',
                        organizationId: 'org_default',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                ];
            case 'assets':
                return [
                    {
                        id: 'asset-1',
                        name: 'Serveur Principal',
                        type: 'Server',
                        confidentiality: 'High',
                        owner: 'user-1',
                        lifecycleStatus: 'Active',
                        createdAt: new Date().toISOString(),
                        purchasePrice: 1500,
                        purchaseDate: '2023-01-01',
                        warrantyEnd: '2026-01-01'
                    },
                    {
                        id: 'asset-2',
                        name: 'Base de Données Clients',
                        type: 'Database',
                        confidentiality: 'Critical',
                        owner: 'user-1',
                        lifecycleStatus: 'Active',
                        createdAt: new Date().toISOString(),
                        purchasePrice: 0,
                        purchaseDate: new Date().toISOString(),
                        warrantyEnd: ''
                    }
                ];
            case 'incidents':
                return [
                    {
                        id: 'incident-1',
                        title: 'Ransomware detected',
                        description: 'Ransomware detected on HR server',
                        severity: 'Critical',
                        status: 'Nouveau',
                        reporter: 'user-1',
                        dateReported: new Date().toISOString(),
                        organizationId: 'org_default',
                        impact: 'Major',
                        isSignificant: true,
                        category: 'Ransomware'
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
                        description: 'Un ensemble de politiques de sécurité de l\'information doit être défini.',
                        organizationId: 'org_default',
                        framework: 'ISO27001',
                        applicability: 'Applicable',
                        maturity: 3
                    },
                    {
                        id: 'ctrl-2',
                        code: 'A.9.1',
                        name: 'Contrôle d\'accès',
                        status: 'En cours',
                        type: 'Préventif',
                        description: 'Les accès aux systèmes d\'information doivent être limités.',
                        organizationId: 'org_default',
                        framework: 'ISO27001',
                        applicability: 'Applicable',
                        maturity: 2
                    }
                ];
            case 'documents':
                return [
                    {
                        id: 'doc-1',
                        name: 'Politique de Sécurité.pdf',
                        type: 'policy',
                        status: 'validated',
                        organizationId: 'org_default',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        version: '1.0',
                        size: 1024,
                        ownerId: 'user-1'
                    }
                ];
            case 'projects':
                return [
                    {
                        id: 'proj-1',
                        name: 'Migration Cloud',
                        description: 'Migration des serveurs vers AWS',
                        status: 'En cours',
                        organizationId: 'org_default',
                        progress: 45,
                        managerId: 'user-1',
                        manager: 'E2E Sentinel',
                        tasks: [],
                        startDate: '2023-01-01',
                        endDate: '2023-12-31',
                        dueDate: '2023-12-31'
                    }
                ];
            case 'strategies': // Continuity
                return [
                    {
                        id: 'strat-1',
                        name: 'Plan de Continuité',
                        description: 'Stratégie globale',
                        status: 'Draft',
                        organizationId: 'org_default',
                        type: 'BCP',
                        owner: 'user-1'
                    }
                ];
            case 'suppliers':
                return [
                    {
                        id: 'sup-1',
                        name: 'AWS',
                        serviceType: 'Cloud Provider',
                        criticality: 'Critical',
                        status: 'Active',
                        organizationId: 'org_default',
                        contactName: 'Support AWS'
                    }
                ];
            case 'business_processes':
                return [
                    {
                        id: 'proc-1',
                        name: 'Gestion RH',
                        criticality: 'High',
                        owner: 'user-1',
                        organizationId: 'org_default',
                        status: 'Active'
                    }
                ];
            case 'audits':
                return [
                    {
                        id: 'audit-1',
                        name: 'Audit Interne ISO 27001',
                        type: 'Interne',
                        status: 'En cours',
                        dateScheduled: new Date().toISOString(),
                        auditor: 'Jean Dupont',
                        organizationId: 'org_default',
                        findingsCount: 5
                    },
                    {
                        id: 'audit-2',
                        name: 'Audit Fournisseur AWS',
                        type: 'Externe',
                        status: 'Planifié',
                        dateScheduled: new Date(Date.now() + 86400000).toISOString(),
                        auditor: 'Alice Security',
                        organizationId: 'org_default',
                        findingsCount: 0
                    }
                ];
            case 'vulnerabilities':
                return [
                    {
                        id: 'vuln-1',
                        cveId: 'CVE-2023-1234',
                        severity: 'High',
                        description: 'Remote Code Execution vulnerability',
                        status: 'Open',
                        affectedAssets: ['asset-1'],
                        remediation: 'Patch immediately',
                        publishedDate: new Date().toISOString()
                    }
                ];
            case 'threats':
                return [
                    {
                        id: 'threat-1',
                        name: 'APT-29',
                        type: 'APT',
                        description: 'Advanced Persistent Threat group',
                        severity: 'Critical',
                        source: 'CISA',
                        indicators: ['1.2.3.4']
                    }
                ];
            case 'activities':
                return [
                    {
                        id: 'act-1',
                        name: 'Gestion Paie',
                        purpose: 'Paiement des salaires',
                        manager: 'DRH',
                        managerId: 'user-1',
                        status: 'Validated',
                        legalBasis: 'Contract',
                        dataCategories: ['Financial', 'Identity'],
                        dataSubjects: ['Employees'],
                        retentionPeriod: '5 years',
                        hasDPIA: false,
                        organizationId: 'org_default',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                ];
            case 'custom_roles':
                return [
                    {
                        id: 'role-1',
                        name: 'Assistant RH',
                        permissions: { User: ['read'] },
                        organizationId: 'org_default',
                        isCustom: true
                    }
                ];
            case 'invitations':
                return [];
            case 'join_requests':
                return [];
            case 'users':
                return [
                    {
                        uid: 'e2e-user-123',
                        email: 'e2e@sentinel.com',
                        displayName: 'E2E Sentinel',
                        role: 'admin',
                        organizationId: 'org_default',
                        department: 'IT',
                        isPending: false
                    }
                ] as any;
            default:
                return [];
        }
    },

    getDocument: (collectionName: string, id: string): (DocumentData & { id: string }) | null => {
        const list = MockDataService.getCollection(collectionName);
        return list.find(d => d.id === id) || null;
    }
};
