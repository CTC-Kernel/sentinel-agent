import { ProjectTemplate } from '../types';

/**
 * Templates de projet prédéfinis pour accélérer la création
 */
export const PROJECT_TEMPLATES: ProjectTemplate[] = [
    {
        id: 'iso27001-implementation',
        name: 'Mise en conformité ISO 27001',
        description: 'Plan complet pour obtenir la certification ISO 27001',
        category: 'ISO27001',
        icon: '🏆',
        estimatedDuration: 180, // 6 mois
        defaultMilestones: [
            {
                title: 'Analyse de gap terminée',
                description: 'Évaluation complète de l\'écart avec ISO 27001',
                targetDate: '', // Will be calculated
                status: 'pending',
                linkedTaskIds: [],
                createdAt: ''
            },
            {
                title: 'Contrôles implémentés',
                description: 'Tous les contrôles applicables sont en place',
                targetDate: '',
                status: 'pending',
                linkedTaskIds: [],
                createdAt: ''
            },
            {
                title: 'Documentation complète',
                description: 'SMSI documenté et approuvé',
                targetDate: '',
                status: 'pending',
                linkedTaskIds: [],
                createdAt: ''
            },
            {
                title: 'Audit blanc réussi',
                description: 'Audit interne sans non-conformité majeure',
                targetDate: '',
                status: 'pending',
                linkedTaskIds: [],
                createdAt: ''
            },
            {
                title: 'Certification obtenue',
                description: 'Audit de certification réussi',
                targetDate: '',
                status: 'pending',
                linkedTaskIds: [],
                createdAt: ''
            }
        ],
        defaultTasks: [
            {
                title: 'Analyse de gap ISO 27001',
                description: 'Évaluer l\'écart entre l\'état actuel et les exigences ISO 27001',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 40
            },
            {
                title: 'Définir le périmètre du SMSI',
                description: 'Identifier les actifs, processus et parties prenantes',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 16
            },
            {
                title: 'Analyse de risques',
                description: 'Identifier et évaluer les risques de sécurité',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 60
            },
            {
                title: 'Sélection des contrôles applicables',
                description: 'Créer le Statement of Applicability (SoA)',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 24
            },
            {
                title: 'Rédaction de la politique de sécurité',
                description: 'Documenter la politique générale de sécurité',
                status: 'A faire',
                priority: 'medium',
                estimatedHours: 20
            },
            {
                title: 'Mise en place des contrôles techniques',
                description: 'Implémenter les contrôles de sécurité technique',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 120
            },
            {
                title: 'Mise en place des contrôles organisationnels',
                description: 'Implémenter les processus et procédures',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 80
            },
            {
                title: 'Formation et sensibilisation',
                description: 'Former le personnel aux politiques de sécurité',
                status: 'A faire',
                priority: 'medium',
                estimatedHours: 40
            },
            {
                title: 'Audit interne (audit blanc)',
                description: 'Réaliser un audit interne complet',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 40
            },
            {
                title: 'Correction des non-conformités',
                description: 'Traiter les écarts identifiés lors de l\'audit blanc',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 60
            },
            {
                title: 'Audit de certification',
                description: 'Audit par organisme certificateur',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 24
            }
        ]
    },
    {
        id: 'security-audit',
        name: 'Audit de Sécurité',
        description: 'Audit complet de la sécurité des systèmes d\'information',
        category: 'Audit',
        icon: '🔍',
        estimatedDuration: 45, // 1.5 mois
        defaultMilestones: [
            {
                title: 'Planification terminée',
                description: 'Périmètre et méthodologie définis',
                targetDate: '',
                status: 'pending',
                linkedTaskIds: [],
                createdAt: ''
            },
            {
                title: 'Collecte de preuves complète',
                description: 'Toutes les preuves nécessaires collectées',
                targetDate: '',
                status: 'pending',
                linkedTaskIds: [],
                createdAt: ''
            },
            {
                title: 'Tests terminés',
                description: 'Tests de sécurité et vulnérabilités effectués',
                targetDate: '',
                status: 'pending',
                linkedTaskIds: [],
                createdAt: ''
            },
            {
                title: 'Rapport finalisé',
                description: 'Rapport d\'audit complet et validé',
                targetDate: '',
                status: 'pending',
                linkedTaskIds: [],
                createdAt: ''
            }
        ],
        defaultTasks: [
            {
                title: 'Définir le périmètre de l\'audit',
                description: 'Identifier les systèmes et processus à auditer',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 8
            },
            {
                title: 'Préparer le plan d\'audit',
                description: 'Définir la méthodologie et le planning',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 12
            },
            {
                title: 'Collecter la documentation',
                description: 'Rassembler politiques, procédures et configurations',
                status: 'A faire',
                priority: 'medium',
                estimatedHours: 16
            },
            {
                title: 'Interviews des parties prenantes',
                description: 'Rencontrer les responsables IT et sécurité',
                status: 'A faire',
                priority: 'medium',
                estimatedHours: 20
            },
            {
                title: 'Tests de vulnérabilités',
                description: 'Scan de sécurité et tests d\'intrusion',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 40
            },
            {
                title: 'Revue des contrôles d\'accès',
                description: 'Vérifier la gestion des identités et accès',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 16
            },
            {
                title: 'Analyse des logs',
                description: 'Examiner les journaux de sécurité',
                status: 'A faire',
                priority: 'medium',
                estimatedHours: 12
            },
            {
                title: 'Rédaction du rapport',
                description: 'Compiler les constats et recommandations',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 24
            },
            {
                title: 'Présentation des résultats',
                description: 'Présenter le rapport à la direction',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 4
            },
            {
                title: 'Plan de remédiation',
                description: 'Définir les actions correctives prioritaires',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 12
            }
        ]
    },
    {
        id: 'incident-response',
        name: 'Gestion d\'Incident Majeur',
        description: 'Réponse structurée à un incident de sécurité critique',
        category: 'Incident',
        icon: '🚨',
        estimatedDuration: 14, // 2 semaines
        defaultMilestones: [
            {
                title: 'Containment réussi',
                description: 'Incident contenu, propagation stoppée',
                targetDate: '',
                status: 'pending',
                linkedTaskIds: [],
                createdAt: ''
            },
            {
                title: 'Cause racine identifiée',
                description: 'Investigation complète, origine déterminée',
                targetDate: '',
                status: 'pending',
                linkedTaskIds: [],
                createdAt: ''
            },
            {
                title: 'Remédiation appliquée',
                description: 'Correctifs déployés, systèmes sécurisés',
                targetDate: '',
                status: 'pending',
                linkedTaskIds: [],
                createdAt: ''
            },
            {
                title: 'Post-mortem terminé',
                description: 'Leçons apprises documentées',
                targetDate: '',
                status: 'pending',
                linkedTaskIds: [],
                createdAt: ''
            }
        ],
        defaultTasks: [
            {
                title: 'Activation de la cellule de crise',
                description: 'Mobiliser l\'équipe de réponse à incident',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 2
            },
            {
                title: 'Évaluation initiale',
                description: 'Déterminer la nature et l\'ampleur de l\'incident',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 4
            },
            {
                title: 'Containment immédiat',
                description: 'Isoler les systèmes affectés',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 8
            },
            {
                title: 'Collecte de preuves',
                description: 'Préserver les logs et artefacts forensiques',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 12
            },
            {
                title: 'Investigation forensique',
                description: 'Analyser les preuves pour identifier la cause',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 40
            },
            {
                title: 'Communication interne',
                description: 'Informer les parties prenantes internes',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 4
            },
            {
                title: 'Communication externe (si nécessaire)',
                description: 'Notifier clients, autorités, partenaires',
                status: 'A faire',
                priority: 'medium',
                estimatedHours: 8
            },
            {
                title: 'Éradication de la menace',
                description: 'Supprimer la cause racine de l\'incident',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 16
            },
            {
                title: 'Restauration des services',
                description: 'Remettre les systèmes en production',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 12
            },
            {
                title: 'Surveillance renforcée',
                description: 'Monitoring intensif post-incident',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 20
            },
            {
                title: 'Post-mortem',
                description: 'Analyser la réponse et identifier les améliorations',
                status: 'A faire',
                priority: 'medium',
                estimatedHours: 8
            },
            {
                title: 'Mise à jour du plan de réponse',
                description: 'Intégrer les leçons apprises',
                status: 'A faire',
                priority: 'medium',
                estimatedHours: 6
            }
        ]
    },
    {
        id: 'security-training',
        name: 'Programme de Sensibilisation',
        description: 'Formation et sensibilisation à la sécurité pour tous les employés',
        category: 'Training',
        icon: '🎓',
        estimatedDuration: 60, // 2 mois
        defaultMilestones: [
            {
                title: 'Contenu développé',
                description: 'Modules de formation créés',
                targetDate: '',
                status: 'pending',
                linkedTaskIds: [],
                createdAt: ''
            },
            {
                title: '50% des employés formés',
                description: 'Première moitié du personnel sensibilisée',
                targetDate: '',
                status: 'pending',
                linkedTaskIds: [],
                createdAt: ''
            },
            {
                title: '100% des employés formés',
                description: 'Tous les employés ont suivi la formation',
                targetDate: '',
                status: 'pending',
                linkedTaskIds: [],
                createdAt: ''
            }
        ],
        defaultTasks: [
            {
                title: 'Analyse des besoins de formation',
                description: 'Identifier les lacunes de connaissances',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 12
            },
            {
                title: 'Développement du contenu',
                description: 'Créer les modules de formation',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 60
            },
            {
                title: 'Création de quiz d\'évaluation',
                description: 'Préparer les tests de connaissances',
                status: 'A faire',
                priority: 'medium',
                estimatedHours: 16
            },
            {
                title: 'Sessions de formation en présentiel',
                description: 'Organiser des sessions pour les managers',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 40
            },
            {
                title: 'Déploiement e-learning',
                description: 'Mettre en ligne les modules pour tous',
                status: 'A faire',
                priority: 'high',
                estimatedHours: 20
            },
            {
                title: 'Campagne de phishing simulé',
                description: 'Tester la vigilance des employés',
                status: 'A faire',
                priority: 'medium',
                estimatedHours: 12
            },
            {
                title: 'Suivi des complétions',
                description: 'Tracker qui a terminé la formation',
                status: 'A faire',
                priority: 'medium',
                estimatedHours: 8
            },
            {
                title: 'Évaluation de l\'efficacité',
                description: 'Mesurer l\'impact de la formation',
                status: 'A faire',
                priority: 'medium',
                estimatedHours: 12
            },
            {
                title: 'Mise à jour annuelle',
                description: 'Rafraîchir le contenu pour l\'année suivante',
                status: 'A faire',
                priority: 'low',
                estimatedHours: 20
            }
        ]
    },
    {
        id: 'iso27001-maintenance',
        name: 'ISO 27001 : Cycle Annuel (Maintenance)',
        description: 'Activités récurrentes pour le maintien de la certification ISO 27001',
        category: 'ISO27001',
        icon: '🔄',
        estimatedDuration: 365,
        defaultMilestones: [
            { title: 'Revue de direction effectuée', description: 'Comité de direction annuel tenu', targetDate: '', status: 'pending', linkedTaskIds: [], createdAt: '' },
            { title: 'Audit interne réalisé', description: 'Programme d\'audit annuel complété', targetDate: '', status: 'pending', linkedTaskIds: [], createdAt: '' },
            { title: 'Audit de surveillance réussi', description: 'Audit externe passé avec succès', targetDate: '', status: 'pending', linkedTaskIds: [], createdAt: '' }
        ],
        defaultTasks: [
            { title: 'Revue des politiques de sécurité', description: 'Vérifier la pertinence des politiques', status: 'A faire', priority: 'medium', estimatedHours: 16 },
            { title: 'Mise à jour de l\'analyse de risques', description: 'Réévaluer les risques (ISO 27005)', status: 'A faire', priority: 'high', estimatedHours: 40 },
            { title: 'Campagne de sensibilisation annuelle', description: 'Relancer les formations', status: 'A faire', priority: 'medium', estimatedHours: 20 },
            { title: 'Revue des accès utilisateurs', description: 'Contrôle des droits d\'accès', status: 'A faire', priority: 'high', estimatedHours: 24 },
            { title: 'Test du plan de continuité (PCA)', description: 'Exercice de crise annuel', status: 'A faire', priority: 'high', estimatedHours: 16 },
            { title: 'Audit interne : Planification', description: 'Définir le périmètre et le planning', status: 'A faire', priority: 'medium', estimatedHours: 8 },
            { title: 'Audit interne : Exécution', description: 'Réaliser les entretiens et tests', status: 'A faire', priority: 'high', estimatedHours: 40 },
            { title: 'Revue de direction (Préparation)', description: 'Collecter les indicateurs et KPIs', status: 'A faire', priority: 'medium', estimatedHours: 16 },
            { title: 'Revue de direction (Réunion)', description: 'Tenir la réunion et rédiger le CR', status: 'A faire', priority: 'high', estimatedHours: 4 }
        ]
    },
    {
        id: 'iso27005-risk-campaign',
        name: 'ISO 27005 : Campagne de Risques',
        description: 'Cycle complet d\'appréciation et de traitement des risques',
        category: 'ISO27001',
        icon: '⚖️',
        estimatedDuration: 60,
        defaultMilestones: [
            { title: 'Contexte établi', description: 'Critères de risque validés', targetDate: '', status: 'pending', linkedTaskIds: [], createdAt: '' },
            { title: 'Appréciation terminée', description: 'Risques identifiés et évalués', targetDate: '', status: 'pending', linkedTaskIds: [], createdAt: '' },
            { title: 'Plan de traitement validé', description: 'RTP approuvé par la direction', targetDate: '', status: 'pending', linkedTaskIds: [], createdAt: '' }
        ],
        defaultTasks: [
            { title: 'Établissement du contexte', description: 'Définir les critères d\'impact et d\'acceptation', status: 'A faire', priority: 'high', estimatedHours: 8 },
            { title: 'Identification des actifs (Mise à jour)', description: 'Revoir l\'inventaire des actifs', status: 'A faire', priority: 'medium', estimatedHours: 16 },
            { title: 'Identification des menaces', description: 'Lister les menaces potentielles', status: 'A faire', priority: 'high', estimatedHours: 12 },
            { title: 'Évaluation des risques', description: 'Estimer vraisemblance et impact', status: 'A faire', priority: 'high', estimatedHours: 24 },
            { title: 'Identification des contrôles existants', description: 'Évaluer l\'efficacité des mesures en place', status: 'A faire', priority: 'medium', estimatedHours: 16 },
            { title: 'Appréciation du risque résiduel', description: 'Calculer le niveau de risque net', status: 'A faire', priority: 'high', estimatedHours: 8 },
            { title: 'Définition du plan de traitement (RTP)', description: 'Choisir les options de traitement', status: 'A faire', priority: 'high', estimatedHours: 20 },
            { title: 'Acceptation des risques résiduels', description: 'Signature formelle par la direction', status: 'A faire', priority: 'high', estimatedHours: 4 }
        ]
    },
    {
        id: 'nis2-compliance',
        name: 'Mise en conformité NIS 2',
        description: 'Projet de mise à niveau pour la directive NIS 2',
        category: 'Deployment',
        icon: '🇪🇺',
        estimatedDuration: 120,
        defaultMilestones: [
            { title: 'Entité enregistrée', description: 'Signalement auprès de l\'ANSSI', targetDate: '', status: 'pending', linkedTaskIds: [], createdAt: '' },
            { title: 'Mesures socles en place', description: 'Hygiène informatique de base assurée', targetDate: '', status: 'pending', linkedTaskIds: [], createdAt: '' },
            { title: 'Conformité auditée', description: 'Audit de conformité NIS 2 réalisé', targetDate: '', status: 'pending', linkedTaskIds: [], createdAt: '' }
        ],
        defaultTasks: [
            { title: 'Identification des services essentiels', description: 'Cartographier les activités critiques', status: 'A faire', priority: 'high', estimatedHours: 16 },
            { title: 'Déclaration auprès de l\'autorité', description: 'S\'enregistrer auprès de l\'ANSSI', status: 'A faire', priority: 'high', estimatedHours: 4 },
            { title: 'Gouvernance de la sécurité', description: 'Validation des politiques par la direction', status: 'A faire', priority: 'high', estimatedHours: 12 },
            { title: 'Sécurité de la chaîne d\'approvisionnement', description: 'Auditer les fournisseurs critiques', status: 'A faire', priority: 'high', estimatedHours: 40 },
            { title: 'Gestion des incidents', description: 'Mettre en place la procédure de signalement', status: 'A faire', priority: 'high', estimatedHours: 24 },
            { title: 'Hygiène informatique', description: 'MFA, Patch management, Sauvegardes', status: 'A faire', priority: 'high', estimatedHours: 32 },
            { title: 'Gestion de crise', description: 'Définir et tester le plan de crise', status: 'A faire', priority: 'medium', estimatedHours: 20 }
        ]
    },
    {
        id: 'dora-compliance',
        name: 'Mise en conformité DORA',
        description: 'Résilience opérationnelle numérique pour le secteur financier',
        category: 'Deployment',
        icon: '🏦',
        estimatedDuration: 150,
        defaultMilestones: [
            { title: 'Cadre de gestion validé', description: 'Politiques DORA approuvées', targetDate: '', status: 'pending', linkedTaskIds: [], createdAt: '' },
            { title: 'Registre des tiers complet', description: 'Inventaire des prestataires TIC', targetDate: '', status: 'pending', linkedTaskIds: [], createdAt: '' },
            { title: 'Tests de résilience effectués', description: 'Campagne de tests validée', targetDate: '', status: 'pending', linkedTaskIds: [], createdAt: '' }
        ],
        defaultTasks: [
            { title: 'Analyse d\'écart DORA', description: 'Gap analysis par rapport au règlement', status: 'A faire', priority: 'high', estimatedHours: 40 },
            { title: 'Gouvernance des risques TIC', description: 'Définir le cadre de gestion des risques', status: 'A faire', priority: 'high', estimatedHours: 24 },
            { title: 'Classification des incidents', description: 'Mettre à jour la procédure d\'incident', status: 'A faire', priority: 'high', estimatedHours: 16 },
            { title: 'Tests de résilience opérationnelle', description: 'Planifier les tests (vulnérabilité, intrusion)', status: 'A faire', priority: 'medium', estimatedHours: 32 },
            { title: 'Gestion des risques tiers', description: 'Recenser et évaluer les prestataires TIC', status: 'A faire', priority: 'high', estimatedHours: 48 },
            { title: 'Partage d\'information', description: 'Adhérer à des dispositifs de partage (CSIRT)', status: 'A faire', priority: 'low', estimatedHours: 8 }
        ]
    },
    {
        id: 'gdpr-compliance',
        name: 'Mise en conformité RGPD',
        description: 'Projet de protection des données personnelles',
        category: 'Deployment',
        icon: '⚖️',
        estimatedDuration: 90,
        defaultMilestones: [
            { title: 'Registre validé', description: 'Registre des traitements complet', targetDate: '', status: 'pending', linkedTaskIds: [], createdAt: '' },
            { title: 'Site web conforme', description: 'Cookies, Mentions légales, Formulaires', targetDate: '', status: 'pending', linkedTaskIds: [], createdAt: '' },
            { title: 'Processus DSR opérationnel', description: 'Gestion des demandes droits des personnes', targetDate: '', status: 'pending', linkedTaskIds: [], createdAt: '' }
        ],
        defaultTasks: [
            { title: 'Cartographie des données', description: 'Identifier les données personnelles traitées', status: 'A faire', priority: 'high', estimatedHours: 24 },
            { title: 'Registre des traitements', description: 'Rédiger les fiches de registre', status: 'A faire', priority: 'high', estimatedHours: 32 },
            { title: 'Information des personnes', description: 'Mettre à jour les politiques de confidentialité', status: 'A faire', priority: 'medium', estimatedHours: 12 },
            { title: 'Gestion des sous-traitants', description: 'Vérifier les clauses RGPD des contrats', status: 'A faire', priority: 'medium', estimatedHours: 20 },
            { title: 'Sécurité des données', description: 'Vérifier les mesures techniques (chiffrement...)', status: 'A faire', priority: 'high', estimatedHours: 16 },
            { title: 'Procédure de violation', description: 'Définir le processus de notification CNIL', status: 'A faire', priority: 'high', estimatedHours: 8 }
        ]
    }
];

/**
 * Crée un projet à partir d'un template
 */
interface TemplateManagerPayload {
    id: string;
    label: string;
}

export function createProjectFromTemplate(
    template: ProjectTemplate,
    projectName: string,
    startDate: Date,
    manager: TemplateManagerPayload,
    organizationId: string
) {
    const project = {
        name: projectName,
        description: template.description,
        manager: manager.label,
        managerId: manager.id,
        status: 'Planifié' as const,
        startDate: startDate.toISOString(),
        dueDate: new Date(startDate.getTime() + template.estimatedDuration * 24 * 60 * 60 * 1000).toISOString(),
        progress: 0,
        organizationId,
        createdAt: new Date().toISOString(),
        tasks: template.defaultTasks.map((task, index) => ({
            ...task,
            id: `task-${Date.now()}-${index}`,
            startDate: startDate.toISOString(), // Initialize tasks with project start date
            dueDate: new Date(startDate.getTime() + (task.estimatedHours ? (task.estimatedHours / 8) : 1) * 24 * 60 * 60 * 1000).toISOString()
        })),
        relatedRiskIds: [],
        relatedControlIds: [],
        relatedAssetIds: []
    };

    const milestones = template.defaultMilestones.map((milestone, index) => {
        const milestoneDate = new Date(
            startDate.getTime() +
            ((template.estimatedDuration / (template.defaultMilestones.length + 1)) * (index + 1)) * 24 * 60 * 60 * 1000
        );

        return {
            ...milestone,
            id: `milestone-${Date.now()}-${index}`,
            projectId: '', // Will be set after project creation
            targetDate: milestoneDate.toISOString(),
            createdAt: new Date().toISOString()
        };
    });

    return { project, milestones };
}
