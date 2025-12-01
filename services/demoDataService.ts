import { db } from '../firebase';
import { writeBatch, doc } from 'firebase/firestore';
import {
    Asset, Risk, Control, Project, Audit, Supplier, Incident,
    Document, SystemLog, Criticality, BusinessProcess, ProcessingActivity,
    BcpDrill, RiskHistory, RiskTreatment
} from '../types';

export class DemoDataService {
    private static generateId(): string {
        return 'demo_' + Math.random().toString(36).substr(2, 9);
    }

    private static getRandomDate(start: Date, end: Date): string {
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
    }

    static async populateDemoData(organizationId: string, userId: string): Promise<void> {
        const batch = writeBatch(db);
        const now = new Date();
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

        // --- 1. Users (Mock IDs for linking) ---
        const userIds = {
            rssi: userId, // Current user as RSSI
            manager: 'demo_user_manager',
            auditor: 'demo_user_auditor',
            dpo: 'demo_user_dpo',
            ceo: 'demo_user_ceo'
        };

        // --- 2. Assets (Full Coverage) ---
        const assets: Asset[] = [
            {
                id: DemoDataService.generateId(),
                organizationId,
                name: 'Serveur CRM Principal',
                type: 'Matériel',
                owner: 'Bob Manager',
                ownerId: userIds.manager,
                confidentiality: Criticality.HIGH,
                integrity: Criticality.HIGH,
                availability: Criticality.CRITICAL,
                location: 'Data Center Paris',
                createdAt: oneYearAgo.toISOString(),
                updatedAt: now.toISOString(),
                purchaseDate: oneYearAgo.toISOString(),
                purchasePrice: 15000,
                currentValue: 12000,
                warrantyEnd: oneYearFromNow.toISOString(),
                nextMaintenance: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), // +30 days
                lifecycleStatus: 'En service',
                ipAddress: '192.168.1.10',
                role: 'Database Server',
                scope: ['ISO27001', 'GDPR' as any] // Cast as any if type definition is strict but data allows it
            },
            {
                id: DemoDataService.generateId(),
                organizationId,
                name: 'Application Portail Client',
                type: 'Logiciel',
                owner: 'Alice Security',
                ownerId: userIds.rssi,
                confidentiality: Criticality.CRITICAL,
                integrity: Criticality.HIGH,
                availability: Criticality.HIGH,
                location: 'Cloud AWS',
                createdAt: oneYearAgo.toISOString(),
                updatedAt: now.toISOString(),
                version: '2.4.0',
                licenseExpiry: oneYearFromNow.toISOString(),
                lifecycleStatus: 'En service',
                scope: ['SOC2', 'ISO27001']
            },
            {
                id: DemoDataService.generateId(),
                organizationId,
                name: 'Données Clients (PII)',
                type: 'Données',
                owner: 'DPO Office',
                ownerId: userIds.dpo,
                confidentiality: Criticality.CRITICAL,
                integrity: Criticality.HIGH,
                availability: Criticality.MEDIUM,
                location: 'Database CRM',
                createdAt: oneYearAgo.toISOString(),
                updatedAt: now.toISOString(),
                scope: ['ISO27001', 'GDPR' as any]
            },
            {
                id: DemoDataService.generateId(),
                organizationId,
                name: 'MacBook Pro - CEO',
                type: 'Matériel',
                owner: 'CEO',
                ownerId: userIds.ceo,
                confidentiality: Criticality.HIGH,
                integrity: Criticality.MEDIUM,
                availability: Criticality.MEDIUM,
                location: 'Bureau CEO',
                createdAt: DemoDataService.getRandomDate(oneYearAgo, now),
                purchaseDate: DemoDataService.getRandomDate(oneYearAgo, now),
                purchasePrice: 3500,
                currentValue: 2800,
                lifecycleStatus: 'En service'
            }
        ];

        // --- 3. Suppliers (Full Coverage) ---
        const suppliers: Supplier[] = [
            {
                id: DemoDataService.generateId(),
                organizationId,
                name: 'AWS',
                category: 'Hébergement',
                criticality: Criticality.CRITICAL,
                status: 'Actif',
                description: 'Fournisseur Cloud Principal',
                owner: 'Alice Security',
                ownerId: userIds.rssi,
                contactName: 'Support AWS Enterprise',
                contactEmail: 'support@aws.amazon.com',
                riskLevel: 'Low',
                riskAssessment: { overallScore: 15 },
                contract: { endDate: oneYearFromNow.toISOString() },
                createdAt: oneYearAgo.toISOString(),
                updatedAt: now.toISOString(),
                reviewDates: {
                    contractReview: oneYearFromNow.toISOString(),
                    securityReview: oneYearFromNow.toISOString(),
                    complianceReview: oneYearFromNow.toISOString()
                },
                isICTProvider: true,
                supportsCriticalFunction: true,
                doraCriticality: 'Critical',
                serviceType: 'Cloud',
                relatedAssetIds: [assets[1].id], // Link to App Portal
                assessment: {
                    hasIso27001: true,
                    hasGdprPolicy: true,
                    hasEncryption: true,
                    hasBcp: true,
                    hasIncidentProcess: true,
                    lastAssessmentDate: DemoDataService.getRandomDate(oneYearAgo, now)
                }
            },
            {
                id: DemoDataService.generateId(),
                organizationId,
                name: 'Salesforce',
                category: 'SaaS',
                criticality: Criticality.HIGH,
                status: 'Actif',
                description: 'CRM',
                owner: 'Bob Manager',
                ownerId: userIds.manager,
                riskLevel: 'Medium',
                riskAssessment: { overallScore: 45 },
                contract: { endDate: oneYearFromNow.toISOString() },
                createdAt: oneYearAgo.toISOString(),
                updatedAt: now.toISOString(),
                reviewDates: {
                    contractReview: oneYearFromNow.toISOString(),
                    securityReview: oneYearFromNow.toISOString(),
                    complianceReview: oneYearFromNow.toISOString()
                },
                relatedAssetIds: [assets[0].id, assets[2].id], // Link to Server and Data
                assessment: {
                    hasIso27001: true,
                    hasGdprPolicy: true,
                    hasEncryption: true,
                    lastAssessmentDate: DemoDataService.getRandomDate(oneYearAgo, now)
                }
            }
        ];

        // Update Assets with Supplier IDs
        assets[1].supplierId = suppliers[0].id;
        assets[0].supplierId = suppliers[1].id;

        // --- 4. Business Processes (New Entity) ---
        const processes: BusinessProcess[] = [
            {
                id: DemoDataService.generateId(),
                organizationId,
                name: 'Gestion de la Relation Client',
                description: 'Processus de vente et de support client via le CRM.',
                owner: 'Bob Manager',
                priority: 'Critique',
                rto: '4h',
                rpo: '1h',
                supportingAssetIds: [assets[0].id, assets[2].id],
                supplierIds: [suppliers[1].id],
                recoveryTasks: [
                    { id: DemoDataService.generateId(), title: 'Restaurer la base de données', owner: 'DBA', duration: '30m', order: 1 },
                    { id: DemoDataService.generateId(), title: 'Vérifier la connectivité', owner: 'Network Admin', duration: '15m', order: 2 }
                ]
            },
            {
                id: DemoDataService.generateId(),
                organizationId,
                name: 'Développement Logiciel',
                description: 'Cycle de vie du développement de l\'application portail.',
                owner: 'Alice Security',
                priority: 'Élevée',
                rto: '24h',
                rpo: '4h',
                supportingAssetIds: [assets[1].id],
                supplierIds: [suppliers[0].id]
            }
        ];

        // --- 5. Risks (Full Coverage) ---
        const risks: Risk[] = [
            {
                id: DemoDataService.generateId(),
                organizationId,
                assetId: assets[0].id,
                threat: 'Panne matérielle critique',
                vulnerability: 'Absence de redondance à chaud',
                probability: 3,
                impact: 5,
                score: 15,
                strategy: 'Atténuer',
                status: 'En cours',
                owner: 'Bob Manager',
                ownerId: userIds.manager,
                createdAt: DemoDataService.getRandomDate(oneYearAgo, now),
                updatedAt: now.toISOString(),
                affectedProcessIds: [processes[0].id],
                relatedSupplierIds: [suppliers[1].id],
                treatment: {
                    strategy: 'Atténuer',
                    description: 'Mise en place d\'un cluster HA',
                    status: 'En cours',
                    dueDate: oneYearFromNow.toISOString(),
                    estimatedCost: 5000,
                    ownerId: userIds.manager,
                    slaStatus: 'On Track'
                },
                residualProbability: 1,
                residualImpact: 5,
                residualScore: 5,
                history: [
                    {
                        date: oneYearAgo.toISOString(),
                        previousScore: 20,
                        newScore: 15,
                        changedBy: 'Alice Security',
                        reason: 'Mise en place partielle de la redondance'
                    }
                ]
            },
            {
                id: DemoDataService.generateId(),
                organizationId,
                assetId: assets[1].id,
                threat: 'Injection SQL',
                vulnerability: 'Validation des entrées insuffisante',
                probability: 4,
                impact: 5,
                score: 20,
                strategy: 'Atténuer',
                status: 'Ouvert',
                owner: 'Alice Security',
                ownerId: userIds.rssi,
                createdAt: DemoDataService.getRandomDate(oneYearAgo, now),
                updatedAt: now.toISOString(),
                affectedProcessIds: [processes[1].id],
                mitreTechniques: [
                    { id: 'T1190', name: 'Exploit Public-Facing Application', description: 'Adversaries may attempt to take advantage of a weakness in an Internet-facing computer or program using software, data, or commands in order to cause unintended or unanticipated behavior.' }
                ]
            },
            {
                id: DemoDataService.generateId(),
                organizationId,
                assetId: assets[2].id,
                threat: 'Vol de données',
                vulnerability: 'Accès non restreint',
                probability: 2,
                impact: 5,
                score: 10,
                strategy: 'Transférer',
                status: 'En cours',
                owner: 'DPO',
                ownerId: userIds.dpo,
                createdAt: DemoDataService.getRandomDate(oneYearAgo, now),
                updatedAt: now.toISOString(),
                affectedProcessIds: [processes[0].id],
                isSecureStorage: true
            }
        ];

        // --- 6. Controls (Full Coverage) ---
        const controls: Control[] = [
            {
                id: DemoDataService.generateId(),
                organizationId,
                code: 'A.5.15',
                name: 'Contrôle d\'accès',
                framework: 'ISO27001',
                description: 'Les règles de contrôle d\'accès, les droits et les restrictions d\'accès doivent être configurés.',
                status: 'Implémenté',
                evidenceStrength: 'Forte',
                relatedAssetIds: [assets[0].id, assets[1].id],
                lastUpdated: now.toISOString(),
                assigneeId: userIds.rssi,
                relatedSupplierIds: [suppliers[0].id]
            },
            {
                id: DemoDataService.generateId(),
                organizationId,
                code: 'A.8.12',
                name: 'Prévention des fuites de données',
                framework: 'ISO27001',
                description: 'Des mesures doivent être prises pour empêcher la divulgation non autorisée de données.',
                status: 'Partiel',
                evidenceStrength: 'Faible',
                relatedAssetIds: [assets[2].id],
                lastUpdated: now.toISOString(),
                assigneeId: userIds.dpo
            }
        ];

        // Update Risks with Control IDs
        risks[0].mitigationControlIds = [controls[0].id];
        risks[2].mitigationControlIds = [controls[1].id];

        // --- 7. Projects (Full Coverage) ---
        const projects: Project[] = [
            {
                id: DemoDataService.generateId(),
                organizationId,
                name: 'Mise en conformité ISO 27001',
                description: 'Projet global pour l\'obtention de la certification ISO 27001 d\'ici fin d\'année.',
                manager: 'Alice Security',
                status: 'En cours',
                startDate: oneYearAgo.toISOString(),
                dueDate: oneYearFromNow.toISOString(),
                progress: 65,
                createdAt: oneYearAgo.toISOString(),
                updatedAt: now.toISOString(),
                relatedRiskIds: [risks[0].id, risks[1].id],
                relatedControlIds: [controls[0].id, controls[1].id],
                relatedAssetIds: [assets[0].id, assets[1].id, assets[2].id],
                tasks: [
                    {
                        id: DemoDataService.generateId(),
                        title: 'Analyse des risques initiale',
                        status: 'Terminé',
                        startDate: oneYearAgo.toISOString(),
                        dueDate: DemoDataService.getRandomDate(oneYearAgo, now),
                        progress: 100,
                        assigneeId: userIds.rssi,
                        priority: 'high'
                    },
                    {
                        id: DemoDataService.generateId(),
                        title: 'Rédaction des politiques de sécurité',
                        status: 'En cours',
                        startDate: DemoDataService.getRandomDate(oneYearAgo, now),
                        dueDate: oneYearFromNow.toISOString(),
                        progress: 40,
                        assigneeId: userIds.dpo,
                        priority: 'medium'
                    }
                ],
                milestones: [
                    {
                        id: DemoDataService.generateId(),
                        projectId: '', // Will be set implicitly by structure, but good to have unique ID
                        title: 'Audit à blanc',
                        targetDate: oneYearFromNow.toISOString(),
                        status: 'pending',
                        linkedTaskIds: [],
                        createdAt: now.toISOString()
                    }
                ]
            }
        ];

        // --- 8. Audits (Full Coverage) ---
        const audits: Audit[] = [
            {
                id: DemoDataService.generateId(),
                organizationId,
                name: 'Audit Interne Q3 2024',
                type: 'Interne',
                auditor: 'Charlie Auditor',
                dateScheduled: DemoDataService.getRandomDate(oneYearAgo, now),
                status: 'Terminé',
                findingsCount: 2,
                scope: 'Département IT',
                relatedAssetIds: [assets[0].id],
                relatedRiskIds: [risks[0].id],
                relatedControlIds: [controls[0].id],
                collaborators: [userIds.rssi],
                updatedAt: now.toISOString(),
                findings: [
                    {
                        id: DemoDataService.generateId(),
                        organizationId,
                        auditId: '',
                        description: 'Absence de revue des accès trimestrielle',
                        type: 'Majeure',
                        status: 'Ouvert',
                        createdAt: now.toISOString(),
                        relatedControlId: controls[0].id
                    },
                    {
                        id: DemoDataService.generateId(),
                        organizationId,
                        auditId: '',
                        description: 'Politique de mots de passe non appliquée sur le serveur legacy',
                        type: 'Mineure',
                        status: 'Fermé',
                        createdAt: now.toISOString(),
                        relatedControlId: controls[0].id
                    }
                ]
            }
        ];

        // --- 9. Incidents (Full Coverage) ---
        const incidents: Incident[] = [
            {
                id: DemoDataService.generateId(),
                organizationId,
                title: 'Tentative de Phishing Ciblée',
                description: 'Plusieurs employés ont reçu un email frauduleux demandant leurs identifiants.',
                severity: Criticality.MEDIUM,
                status: 'Résolu',
                category: 'Phishing',
                reporter: 'Alice Security',
                dateReported: DemoDataService.getRandomDate(oneYearAgo, now),
                dateResolved: now.toISOString(),
                isSignificant: false,
                notificationStatus: 'Not Required',
                affectedAssetId: assets[3].id, // CEO Laptop
                relatedRiskId: risks[2].id,
                financialImpact: 0,
                lessonsLearned: 'Renforcer la sensibilisation au phishing.',
                playbookStepsCompleted: ['Identification', 'Analyse', 'Endiguement']
            },
            {
                id: DemoDataService.generateId(),
                organizationId,
                title: 'Indisponibilité Portail Client',
                description: 'Panne du load balancer entraînant une indisponibilité de 30 minutes.',
                severity: Criticality.HIGH,
                status: 'Fermé',
                category: 'Indisponibilité',
                reporter: 'Bob Manager',
                dateReported: DemoDataService.getRandomDate(oneYearAgo, now),
                dateResolved: now.toISOString(),
                isSignificant: true,
                notificationStatus: 'Reported',
                affectedAssetId: assets[1].id,
                affectedProcessId: processes[1].id,
                relatedRiskId: risks[0].id,
                financialImpact: 15000,
                lessonsLearned: 'Améliorer le monitoring du load balancer.'
            }
        ];

        // --- 10. Documents (Full Coverage) ---
        const documents: Document[] = [
            {
                id: DemoDataService.generateId(),
                organizationId,
                title: 'PSSI - Politique de Sécurité des Systèmes d\'Information',
                type: 'Politique',
                version: '1.2',
                status: 'Publié',
                owner: 'Alice Security',
                ownerId: userIds.rssi,
                createdAt: oneYearAgo.toISOString(),
                updatedAt: now.toISOString(),
                isSecure: true,
                storageProvider: 'firebase',
                relatedControlIds: [controls[0].id, controls[1].id],
                workflowStatus: 'Approved',
                approvers: [userIds.ceo],
                signatures: [
                    { userId: userIds.ceo, date: now.toISOString(), role: 'CEO' }
                ]
            },
            {
                id: DemoDataService.generateId(),
                organizationId,
                title: 'Procédure de Gestion des Incidents',
                type: 'Procédure',
                version: '2.0',
                status: 'Approuvé',
                owner: 'Bob Manager',
                ownerId: userIds.manager,
                createdAt: DemoDataService.getRandomDate(oneYearAgo, now),
                updatedAt: now.toISOString(),
                storageProvider: 'firebase',
                relatedControlIds: [controls[0].id]
            }
        ];

        // --- 11. Processing Activities (New Entity) ---
        const activities: ProcessingActivity[] = [
            {
                id: DemoDataService.generateId(),
                organizationId,
                name: 'Traitement des commandes clients',
                purpose: 'Gérer les commandes et la facturation.',
                manager: 'Bob Manager',
                managerId: userIds.manager,
                legalBasis: 'Contrat',
                dataCategories: ['Identité', 'Coordonnées', 'Bancaire'],
                dataSubjects: ['Clients'],
                retentionPeriod: '10 ans (Légal)',
                hasDPIA: false,
                status: 'Actif',
                createdAt: now.toISOString(),
                updatedAt: now.toISOString()
            },
            {
                id: DemoDataService.generateId(),
                organizationId,
                name: 'Gestion des employés',
                purpose: 'Paie et RH.',
                manager: 'DRH',
                legalBasis: 'Obligation Légale',
                dataCategories: ['Identité', 'NIR', 'Salaire'],
                dataSubjects: ['Employés'],
                retentionPeriod: '5 ans après départ',
                hasDPIA: true,
                status: 'Actif',
                createdAt: now.toISOString(),
                updatedAt: now.toISOString()
            }
        ];

        // --- 12. BCP Drills (New Entity) ---
        const drills: BcpDrill[] = [
            {
                id: DemoDataService.generateId(),
                organizationId,
                processId: processes[0].id,
                date: DemoDataService.getRandomDate(oneYearAgo, now),
                type: 'Simulation',
                result: 'Succès',
                notes: 'Restauration de la base de données effectuée en 25 minutes (Objectif 30m).',
                createdAt: now.toISOString()
            }
        ];

        // --- 13. System Logs ---
        const logs: SystemLog[] = [
            {
                id: DemoDataService.generateId(),
                organizationId,
                userId,
                userEmail: 'demo@user.com',
                action: 'LOGIN',
                resource: 'Auth',
                details: 'Connexion réussie',
                timestamp: now.toISOString()
            },
            {
                id: DemoDataService.generateId(),
                organizationId,
                userId,
                userEmail: 'demo@user.com',
                action: 'CREATE_ASSET',
                resource: 'Assets',
                details: 'Création de l\'actif "Serveur CRM"',
                timestamp: DemoDataService.getRandomDate(oneYearAgo, now)
            }
        ];

        // --- Batch Writes ---

        // Helper to chunk batch writes (Firestore limit is 500)
        const commitBatch = async (items: any[], collectionName: string) => {
            items.forEach(item => {
                batch.set(doc(db, collectionName, item.id), item);
            });
        };

        commitBatch(assets, 'assets');
        commitBatch(suppliers, 'suppliers');
        commitBatch(processes, 'business_processes');
        commitBatch(risks, 'risks');
        commitBatch(controls, 'controls');
        commitBatch(projects, 'projects');
        commitBatch(audits, 'audits');
        commitBatch(incidents, 'incidents');
        commitBatch(documents, 'documents');
        commitBatch(activities, 'processing_activities');
        commitBatch(drills, 'bcp_drills');
        commitBatch(logs, 'system_logs');

        // Fix Audit Findings (nested in Audit but also likely needed as separate logic if stored separately, 
        // but types.ts implies they are nested in Audit object or fetched via ID. 
        // If they are subcollections, we need to handle that. 
        // Based on types.ts, 'findings' is an array on Audit, so it's stored in the document.
        // However, if there is a 'findings' top-level collection, we should populate it too.
        // Checking types.ts again... Finding has organizationId, so it might be top-level.
        // Let's assume top-level for safety if the app uses it.
        // But wait, the Audit object has 'findings: Finding[]'.
        // I will write them to the Audit object. If the app uses a separate collection, I should write there too.
        // Given the previous code didn't use a separate collection, I'll stick to the Audit object for now.

        await batch.commit();
    }
}
