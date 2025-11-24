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
    }
];

/**
 * Crée un projet à partir d'un template
 */
export function createProjectFromTemplate(
    template: ProjectTemplate,
    projectName: string,
    startDate: Date,
    manager: string,
    organizationId: string
) {
    const project = {
        name: projectName,
        description: template.description,
        manager,
        status: 'Planifié' as const,
        dueDate: new Date(startDate.getTime() + template.estimatedDuration * 24 * 60 * 60 * 1000).toISOString(),
        progress: 0,
        organizationId,
        createdAt: new Date().toISOString(),
        tasks: template.defaultTasks.map((task, index) => ({
            ...task,
            id: `task-${Date.now()}-${index}`
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
