
import { db } from '../firebase';
import { doc, writeBatch } from 'firebase/firestore';
import {
    Asset, Risk, Project, Audit, Document, Incident, Supplier,
    BusinessProcess, Criticality, UserProfile
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export const DemoDataService = {
    async generateDemoData(organizationId: string, currentUser: UserProfile) {
        if (import.meta.env.DEV) console.log('Starting Demo Data Generation...');
        const batch = writeBatch(db);
        const now = new Date();
        const userId = currentUser.uid;

        // --- 1. CLEANUP (Optional - removing for safety, handled by user choice usually, 
        // unlike clean slate we will just append or maybe we should clean? 
        // User asked for "all modules completed", let's assume valid state not mixed.
        // For this implementation, I will APPEND to avoid destructive actions without explicit delete permissions,
        // but realistic demo usually requires a clean slate or smart merging.
        // I will implement smart creation (idempotent-ish via random IDs)

        // --- 2. ASSETS ---
        const assets: Asset[] = [
            {
                id: uuidv4(),
                organizationId,
                name: 'Serveur Principal - CRM Database',
                type: 'Matériel',
                owner: 'DSI',
                confidentiality: Criticality.HIGH,
                integrity: Criticality.HIGH,
                availability: Criticality.CRITICAL,
                location: 'Paris Datacenter',
                createdAt: now.toISOString(),
                status: 'En service',
                purchaseDate: '2023-01-15',
                purchasePrice: 15000,
                currentValue: 12000,
                lifecycleStatus: 'En service',
                ipAddress: '192.168.1.10',
                scope: ['ISO27001', 'GDPR']
            } as Asset,
            {
                id: uuidv4(),
                organizationId,
                name: 'MacBook Pro - CEO',
                type: 'Matériel',
                owner: 'CEO',
                confidentiality: Criticality.CRITICAL,
                integrity: Criticality.MEDIUM,
                availability: Criticality.HIGH,
                location: 'Lyon Office',
                createdAt: now.toISOString(),
                status: 'En service',
                lifecycleStatus: 'En service'
            } as Asset,
            {
                id: uuidv4(),
                organizationId,
                name: 'Salesforce CRM',
                type: 'Service',
                owner: 'Sales Director',
                confidentiality: Criticality.HIGH,
                integrity: Criticality.HIGH,
                availability: Criticality.HIGH,
                location: 'Cloud',
                createdAt: now.toISOString(),
                status: 'En service',
                lifecycleStatus: 'En service',
                supplierId: 'temp_supplier_id' // Will link later if possible or create supplier first
            } as Asset,
            {
                id: uuidv4(),
                organizationId,
                name: 'Données Clients (PII)',
                type: 'Données',
                owner: 'DPO',
                confidentiality: Criticality.CRITICAL,
                integrity: Criticality.HIGH,
                availability: Criticality.MEDIUM,
                location: 'CRM',
                createdAt: now.toISOString(),
                scope: ['GDPR', 'ISO27001']
            } as Asset
        ];

        // --- 3. SUPPLIERS ---
        const suppliers: Supplier[] = [
            {
                id: uuidv4(),
                organizationId,
                name: 'Salesforce',
                category: 'SaaS',
                criticality: Criticality.HIGH,
                status: 'Actif',
                contactName: 'Support Enterprise',
                description: 'CRM Provider',
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
                riskLevel: 'Low',
                riskAssessment: { overallScore: 85 },
                contract: { endDate: '2026-12-31' },
                reviewDates: {
                    contractReview: '2025-11-01',
                    securityReview: '2025-06-01',
                    complianceReview: '2025-06-01'
                }
            } as Supplier,
            {
                id: uuidv4(),
                organizationId,
                name: 'AWS EMEA',
                category: 'Hébergement',
                criticality: Criticality.CRITICAL,
                status: 'Actif',
                description: 'Cloud Infrastructure Provider',
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
                riskLevel: 'Low',
                riskAssessment: { overallScore: 95 },
                contract: { endDate: '2027-01-01' },
                reviewDates: {
                    contractReview: '2026-01-01',
                    securityReview: '2025-08-01',
                    complianceReview: '2025-08-01'
                }
            } as Supplier
        ];

        // Link Salesforce
        const salesforceAsset = assets.find(a => a.name === 'Salesforce CRM');
        const salesforceSupplier = suppliers.find(s => s.name === 'Salesforce');
        if (salesforceAsset && salesforceSupplier) {
            salesforceAsset.supplierId = salesforceSupplier.id;
            salesforceSupplier.relatedAssetIds = [salesforceAsset.id];
        }

        // --- 4. RISKS ---
        // Need asset IDs for risks
        const risks: Risk[] = [
            {
                id: uuidv4(),
                organizationId,
                assetId: assets[0].id, // Database Server
                threat: 'Ransomware Infection',
                vulnerability: 'Unpatched OS vulnerability',
                probability: 3,
                impact: 5,
                score: 15,
                strategy: 'Atténuer',
                status: 'En cours',
                owner: 'CISO',
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
                residualProbability: 2,
                residualImpact: 4,
                residualScore: 8,
                treatment: {
                    strategy: 'Atténuer',
                    description: 'Deploy EDR and regular patching',
                    status: 'En cours',
                    estimatedCost: 5000
                }
            } as Risk,
            {
                id: uuidv4(),
                organizationId,
                assetId: assets[2].id, // Salesforce
                threat: 'Data Leakage via API',
                vulnerability: 'Misconfigured permissions',
                probability: 2,
                impact: 4,
                score: 8,
                strategy: 'Accepter',
                status: 'Ouvert',
                owner: 'App Owner',
                createdAt: now.toISOString(),
                updatedAt: now.toISOString()
            } as Risk
        ];

        // --- 5. PROJECTS ---
        const projects: Project[] = [
            {
                id: uuidv4(),
                organizationId,
                name: 'Mise en conformité ISO 27001',
                description: 'Projet global pour obtention certification Q4 2025',
                manager: 'RSSI',
                status: 'En cours',
                dueDate: '2025-12-31',
                progress: 45,
                createdAt: now.toISOString(),
                relatedRiskIds: [risks[0].id],
                tasks: [
                    { id: uuidv4(), title: 'Gap Analysis', status: 'Terminé', progress: 100 },
                    { id: uuidv4(), title: 'Rédaction Politique PSSI', status: 'En cours', progress: 60, assignee: 'CISO' },
                    { id: uuidv4(), title: 'Audit à blanc', status: 'A faire', startDate: '2025-10-01', dueDate: '2025-10-15' }
                ]
            } as Project,
            {
                id: uuidv4(),
                organizationId,
                name: 'Déploiement EDR',
                description: 'Installation SentinelOne sur tous les postes',
                manager: 'Ops Lead',
                status: 'Terminé',
                dueDate: '2024-12-01',
                progress: 100,
                createdAt: now.toISOString(),
                relatedRiskIds: [risks[0].id], // Linked to Ransomware risk
                tasks: []
            } as Project
        ];

        // --- 6. AUDITS ---
        const audits: Audit[] = [
            {
                id: uuidv4(),
                organizationId,
                name: 'Audit Interne Q1 2025',
                type: 'Interne',
                auditor: 'Internal Audit Team',
                dateScheduled: '2025-03-15',
                status: 'En cours',
                findingsCount: 2,
                createdAt: now.toISOString(),
                findings: [
                    {
                        id: uuidv4(),
                        organizationId,
                        auditId: 'temp',
                        description: 'Access rights not reviewed quarterly',
                        type: 'Majeure',
                        status: 'Ouvert',
                        createdAt: now.toISOString()
                    }
                ]
            } as Audit
        ];
        // Fix finding auditId
        if (audits[0].findings && audits[0].findings.length > 0) {
            audits[0].findings[0].auditId = audits[0].id;
        }

        // --- 7. DOCUMENTS ---
        const documents: Document[] = [
            {
                id: uuidv4(),
                organizationId,
                title: 'Politique de Sécurité des Systèmes d\'Information (PSSI)',
                type: 'Politique',
                version: '1.2',
                status: 'Publié',
                owner: 'CISO',
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
                isSecure: false,
                reviewers: [userId],
                url: 'https://example.com/pssi.pdf' // Fake URL
            } as Document
        ];

        // --- 8. INCIDENTS ---
        const incidents: Incident[] = [
            {
                id: uuidv4(),
                organizationId,
                title: 'Suspicious Login Attempt',
                description: 'Multiple failed login attempts from unknown IP on CEO account.',
                severity: Criticality.MEDIUM,
                status: 'Résolu',
                category: 'Phishing',
                reporter: 'SOC',
                dateReported: new Date(Date.now() - 86400000).toISOString(), // Yesterday
                dateResolved: new Date().toISOString(),
                isSignificant: false
            } as Incident
        ];

        // --- 9. BCP / CONTINUITY ---
        const bcp: BusinessProcess[] = [
            {
                id: uuidv4(),
                organizationId,
                name: 'Traitement des Commandes Clients',
                description: 'Processus critique de prise de commande et facturation',
                owner: 'Sales Ops',
                rto: '4h',
                rpo: '1h',
                priority: 'Critique',
                supportingAssetIds: [assets[0].id, assets[2].id], // DB + CRM
                createdAt: now.toISOString()
            } as unknown as BusinessProcess
        ];

        // --- WRITE TO FIRESTORE ---

        // Helper to batch writes
        const saveBatch = async (collectionName: string, items: any[]) => {
            items.forEach(item => {
                const ref = doc(db, collectionName, item.id);
                batch.set(ref, item);
            });
        };

        try {
            saveBatch('assets', assets);
            saveBatch('suppliers', suppliers);
            saveBatch('risks', risks);
            saveBatch('projects', projects);
            saveBatch('audits', audits);
            saveBatch('documents', documents);
            saveBatch('incidents', incidents);
            saveBatch('business_processes', bcp);

            // Also add a system log
            const logId = uuidv4();
            batch.set(doc(db, 'system_logs', logId), {
                id: logId,
                organizationId,
                userId,
                userEmail: currentUser.email,
                action: 'Generate Demo Data',
                resource: 'Settings',
                details: 'Full demo environment generated',
                timestamp: now.toISOString()
            });

            await batch.commit();
            if (import.meta.env.DEV) console.log('Demo data generated successfully!');
            return { success: true, count: assets.length + risks.length + projects.length };
        } catch (error) {
            console.error('Error generating demo data:', error);
            throw error;
        }
    }
};
