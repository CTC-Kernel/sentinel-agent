import { IncidentPlaybook } from '../services/incidentPlaybookService';

export const PLAYBOOK_TEMPLATES: Omit<IncidentPlaybook, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>[] = [
    {
        category: 'Ransomware',
        title: 'Ransomware Response Playbook',
        description: 'Procédure de réponse à une attaque ransomware',
        severity: 'Critical',
        estimatedDuration: '4-8 hours',
        requiredResources: ['Security Team', 'IT Team', 'Legal', 'Communications'],
        steps: [
            {
                id: 'detect',
                order: 1,
                title: 'Detection and Assessment',
                description: 'Confirmer l\'attaque et évaluer l\'étendue',
                type: 'detection',
                estimatedTime: '30-60 minutes',
                requiredRole: 'Security Analyst',
                evidenceRequired: ['ransom_note', 'encrypted_files_list', 'network_logs']
            },
            {
                id: 'contain',
                order: 2,
                title: 'Containment',
                description: 'Isoler les systèmes affectés',
                type: 'containment',
                estimatedTime: '1-2 hours',
                requiredRole: 'IT Administrator',
                dependencies: ['detect']
            },
            {
                id: 'communicate',
                order: 3,
                title: 'Communication',
                description: 'Notifier les parties prenantes',
                type: 'communication',
                estimatedTime: '30 minutes',
                requiredRole: 'Crisis Manager'
            }
        ],
        communicationTemplate: {
            internal: 'Incident ransomware en cours - Équipe de sécurité mobilisée',
            external: 'Nous investiguons un incident de sécurité - Mesures prises',
            management: 'ATTENTION: Incident ransomware confirmé - Impact potentiel élevé'
        },
        checklist: [
            {
                id: 'backup_check',
                title: 'Vérifier la disponibilité des backups',
                description: 'Confirmer que les backups sont accessibles et non infectés',
                required: true,
                category: 'preparation'
            }
        ],
        postIncidentActions: [
            {
                id: 'forensic_analysis',
                title: 'Analyse forensique complète',
                description: 'Analyser les vecteurs d\'attaque et les compromissions',
                priority: 'High',
                dueDate: '+3 days'
            }
        ],
        escalationCriteria: [
            {
                id: 'critical_systems',
                condition: 'Systèmes critiques affectés',
                action: 'Escalade vers C-level',
                threshold: 1,
                timeframe: 'immediate'
            }
        ]
    },
    {
        category: 'Phishing',
        title: 'Phishing Response Playbook',
        description: 'Procédure de réponse à une campagne de phishing',
        severity: 'Medium',
        estimatedDuration: '2-4 hours',
        requiredResources: ['Security Team', 'Communications'],
        steps: [
            {
                id: 'identify',
                order: 1,
                title: 'Identification',
                description: 'Analyser l\'email de phishing',
                type: 'detection',
                estimatedTime: '15-30 minutes',
                requiredRole: 'Security Analyst'
            },
            {
                id: 'block',
                order: 2,
                title: 'Blocking',
                description: 'Bloquer l\'expéditeur et les URLs malveillantes',
                type: 'containment',
                estimatedTime: '30 minutes',
                requiredRole: 'Security Engineer'
            }
        ],
        communicationTemplate: {
            internal: 'Campagne de phishing détectée - Mesures de protection en place',
            management: 'Campaigne phishing identifiée - Impact limité'
        },
        checklist: [
            {
                id: 'user_awareness',
                title: 'Sensibilisation des utilisateurs',
                description: 'Informer les utilisateurs de la campagne',
                required: true,
                category: 'communication'
            }
        ],
        postIncidentActions: [
            {
                id: 'training_update',
                title: 'Mise à jour de la formation',
                description: 'Ajouter des exemples récents à la formation',
                priority: 'Medium',
                dueDate: '+7 days'
            }
        ],
        escalationCriteria: []
    },
    {
        category: 'Indisponibilité',
        title: 'Service Unavailability Response',
        description: 'Procédure de réponse à une indisponibilité majeure de service',
        severity: 'High',
        estimatedDuration: '2-6 hours',
        requiredResources: ['IT Ops', 'DevOps', 'Communications'],
        steps: [
            {
                id: 'diagnose',
                order: 1,
                title: 'Diagnosis',
                description: 'Identifier la cause racine de la panne',
                type: 'detection',
                estimatedTime: '30-45 minutes',
                requiredRole: 'SRE / Sysadmin',
                evidenceRequired: ['server_logs', 'error_rates']
            },
            {
                id: 'restore',
                order: 2,
                title: 'Service Restoration',
                description: 'Rétablir le service (failover, restart, rollback)',
                type: 'recovery',
                estimatedTime: '1-2 hours',
                requiredRole: 'SRE / Sysadmin',
                dependencies: ['diagnose']
            },
            {
                id: 'verify',
                order: 3,
                title: 'Verification',
                description: 'Valider la stabilité du service',
                type: 'recovery',
                estimatedTime: '30 minutes',
                requiredRole: 'QA / Tester'
            },
            {
                id: 'communicate',
                order: 4,
                title: 'Status Update',
                description: 'Informer les utilisateurs du rétablissement',
                type: 'communication',
                estimatedTime: '15 minutes',
                requiredRole: 'Incident Manager'
            }
        ],
        communicationTemplate: {
            internal: 'Panne majeure en cours d\'investigation - War room ouverte',
            external: 'Nous rencontrons actuellement des difficultés techniques - Nos équipes sont mobilisées',
            management: 'Impact business critique - SLA à risque'
        },
        checklist: [
            {
                id: 'status_page',
                title: 'Mettre à jour la Status Page',
                description: 'Publier l\'incident sur la page de statut publique',
                required: true,
                category: 'communication'
            }
        ],
        postIncidentActions: [
            {
                id: 'post_mortem',
                title: 'Rédiger le Post-Mortem',
                description: 'Analyser les causes et définir les actions correctives',
                priority: 'High',
                dueDate: '+2 days'
            }
        ],
        escalationCriteria: [
            {
                id: 'sla_breach',
                condition: 'Interruption > 1h',
                action: 'Notifier le CTO',
                threshold: 60,
                timeframe: 'minutes'
            }
        ]
    },
    {
        category: 'Fuite de Données',
        title: 'Data Leak Response',
        description: 'Procédure de réponse à une fuite de données confidentielles',
        severity: 'Critical',
        estimatedDuration: '24-48 hours',
        requiredResources: ['Security', 'Legal', 'DPO', 'Communications'],
        steps: [
            {
                id: 'assess_scope',
                order: 1,
                title: 'Scope Assessment',
                description: 'Identifier les données compromises et les personnes affectées',
                type: 'detection',
                estimatedTime: '2-4 hours',
                requiredRole: 'DPO / Security Analyst',
                evidenceRequired: ['access_logs', 'exfiltrated_data_sample']
            },
            {
                id: 'contain_leak',
                order: 2,
                title: 'Contain Leak',
                description: 'Fermer la faille ou l\'accès compromis',
                type: 'containment',
                estimatedTime: '1 hour',
                requiredRole: 'Security Engineer'
            },
            {
                id: 'legal_review',
                order: 3,
                title: 'Legal Review',
                description: 'Déterminer les obligations de notification (CNIL, Clients)',
                type: 'detection',
                estimatedTime: '2 hours',
                requiredRole: 'Legal Counsel'
            },
            {
                id: 'notify_authorities',
                order: 4,
                title: 'Notify Authorities',
                description: 'Notifier la CNIL (si requis, sous 72h)',
                type: 'communication',
                estimatedTime: '1 hour',
                requiredRole: 'DPO',
                dependencies: ['legal_review']
            }
        ],
        communicationTemplate: {
            internal: 'Investigation fuite de données - Protocol confidentiel',
            external: 'Notification de violation de données',
            management: 'Risque légal et réputationnel majeur'
        },
        checklist: [
            {
                id: 'cnil_notification',
                title: 'Vérifier délai 72h RGPD',
                description: 'S\'assurer que la notification part dans les temps',
                required: true,
                category: 'communication'
            }
        ],
        postIncidentActions: [
            {
                id: 'gdpr_audit',
                title: 'Audit de conformité ciblé',
                description: 'Revoir les processus liés aux données touchées',
                priority: 'High',
                dueDate: '+14 days'
            }
        ],
        escalationCriteria: []
    },
    {
        category: 'Vol Matériel',
        title: 'Lost/Stolen Device Response',
        description: 'Procédure en cas de perte ou vol d\'équipement',
        severity: 'Medium',
        estimatedDuration: '1-2 hours',
        requiredResources: ['IT Support', 'Security'],
        steps: [
            {
                id: 'remote_wipe',
                order: 1,
                title: 'Remote Wipe',
                description: 'Lancer l\'effacement à distance du terminal (MDM)',
                type: 'containment',
                estimatedTime: '15 minutes',
                requiredRole: 'IT Administrator',
                evidenceRequired: ['mdm_logs']
            },
            {
                id: 'revoke_access',
                order: 2,
                title: 'Revoke Access',
                description: 'Révoquer les sessions et changer les mots de passe',
                type: 'containment',
                estimatedTime: '30 minutes',
                requiredRole: 'IT Support'
            },
            {
                id: 'police_report',
                order: 3,
                title: 'File Police Report',
                description: 'Déposer plainte (si vol confirmé)',
                type: 'recovery',
                estimatedTime: '1 day',
                requiredRole: 'Office Manager / HR'
            }
        ],
        communicationTemplate: {
            internal: 'Signalement vol matériel',
            management: 'Perte d\'actif - Mesures conservatoires prises'
        },
        checklist: [
            {
                id: 'inventory_update',
                title: 'Mise à jour inventaire',
                description: 'Marquer l\'actif comme volé/perdu',
                required: true,
                category: 'recovery'
            }
        ],
        postIncidentActions: [],
        escalationCriteria: []
    },
    {
        category: 'Autre',
        title: 'General Incident Response',
        description: 'Procédure générique pour incident non classifié',
        severity: 'Medium',
        estimatedDuration: 'Variable',
        requiredResources: ['Security Team'],
        steps: [
            {
                id: 'triage',
                order: 1,
                title: 'Triage & Classification',
                description: 'Déterminer la nature et l\'impact de l\'incident',
                type: 'detection',
                estimatedTime: '30 minutes',
                requiredRole: 'Security Analyst'
            },
            {
                id: 'containment_plan',
                order: 2,
                title: 'Define Containment Plan',
                description: 'Établir un plan d\'endiguement ad-hoc',
                type: 'containment',
                estimatedTime: '30 minutes',
                requiredRole: 'Incident Manager'
            }
        ],
        communicationTemplate: {
            internal: 'Incident en cours de qualification',
            management: 'Incident détecté - Analyse en cours'
        },
        checklist: [],
        postIncidentActions: [],
        escalationCriteria: []
    }
];
