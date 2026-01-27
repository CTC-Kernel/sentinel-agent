import React, { useState, useMemo } from 'react';

import { motion } from 'framer-motion';
import { staggerContainerVariants } from '../components/ui/animationVariants';
import { SEO } from '../components/SEO';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import {
    Search,
    HelpCircle,
    MessageSquare,
    Menu,
    ChevronRight,
    ChevronDown,
    FileText,
    Shield,
    Zap,
    BookOpen,
    Settings,
    X,
    LayoutDashboard,
    Database,
    Plus,
    FolderKanban,
    AlertTriangle,
    FileSpreadsheet,
    Users,
    Link,
    Play
} from '../components/ui/Icons';
import { Button } from '../components/ui/button';
import { ContactModal } from '../components/ui/ContactModal';
import { FeedbackModal } from '../components/ui/FeedbackModal';
import { PageHeader } from '../components/ui/PageHeader';

interface Section {
    title?: string;
    content: string;
}

interface Article {
    id: string;
    title: string;
    description: string;
    icon?: React.ComponentType<{ className?: string }>;
    sections: Section[];
}

interface Category {
    id: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    articles: Article[];
}

const HELP_DATA: Category[] = [
    {
        id: 'getting-started',
        title: 'Démarrage Rapide',
        icon: Zap,
        articles: [
            {
                id: 'intro',
                title: 'Introduction à Sentinel GRC',
                description: 'Découvrez les fonctionnalités principales de votre plateforme GRC.',
                icon: BookOpen,
                sections: [
                    {
                        title: 'Vue d\'ensemble',
                        content: 'Sentinel GRC est votre centre de commande pour la gouvernance cyber. Plateforme complète de Gestion des Risques, de Conformité et d\'Audit, elle vous permet de centraliser et orchestrer l\'ensemble de votre cybersécurité selon les normes ISO 27001/27005.'
                    },
                    {
                        title: 'Modules principaux',
                        content: '• Tableau de bord : Vue synthétique en temps réel de votre posture de sécurité\n• Actifs : Cartographie dynamique et gestion du patrimoine informationnel\n• Risques : Analyses EBIOS RM et ISO 27005 avec matrices de criticité\n• Conformité : Suivi ISO 27001, RGPD et autres cadres normatifs\n• Audits : Planification, exécution et génération de preuves\n• Projets : Gestion des plans de traitement et initiatives\n• Documents : Vault sécurisé avec versioning et chiffrement\n• Incidents : Playbooks de réponse et gestion de crise\n• Rapports : Génération PDF et tableaux de bord personnalisés'
                    },
                    {
                        title: 'Rôles et permissions',
                        content: 'Sentinel GRC gère 5 niveaux de permissions : Admin (gestion complète), Manager (supervision), Auditor (audit seul), User (saisie), Reader (lecture seule). Le système assure l\'isolation multi-tenant et la traçabilité de chaque action.'
                    }
                ]
            },
            {
                id: 'first-steps',
                title: 'Premiers pas',
                description: 'Configuration initiale et onboarding personnalisé.',
                icon: Settings,
                sections: [
                    {
                        title: 'Configuration du profil',
                        content: '1. Complétez votre profil dans Paramètres > Mon Compte\n2. Activez l\'authentification à deux facteurs (2FA)\n3. Configurez vos préférences de notification\n4. Personnalisez votre tableau de bord'
                    },
                    {
                        title: 'Configuration organisation',
                        content: '1. Renseignez les informations de votre organisation\n2. Définissez les secteurs d\'activité et périmètres\n3. Configurez les rôles et équipes\n4. Invitez les collaborateurs via Paramètres > Équipe'
                    },
                    {
                        title: 'Import initial',
                        content: 'Utilisez les templates CSV pour importer vos actifs, risques et contrôles existants. L\'IA vous assistera dans la classification et la cartographie automatique.'
                    }
                ]
            },
            {
                id: 'dashboard-tour',
                title: 'Visite guidée du tableau de bord',
                description: 'Maîtrisez votre interface principale.',
                icon: LayoutDashboard,
                sections: [
                    {
                        title: 'Widgets principaux',
                        content: '• KPIs de sécurité : Score global, tendances et alertes\n• Actions rapides : Création instantanée d\'actifs/risques\n• Approbations en attente : Validation des modifications\n• Activité récente : Journal des actions de l\'équipe\n• Échéances : SLA et échéances réglementaires'
                    },
                    {
                        title: 'Vues par rôle',
                        content: 'Le tableau de bord s\'adapte à votre rôle : Admin (vue complète), Manager (supervision), Auditor (conformité), Opérationnel (exécution), Lecteur (consultation seule).'
                    },
                    {
                        title: 'Personnalisation',
                        content: 'Glissez-déposez les widgets, filtrez par périmètre, exportez en PDF et configurez les rafraîchissements automatiques.'
                    }
                ]
            }
        ]
    },
    {
        id: 'assets',
        title: 'Gestion des Actifs',
        icon: Database,
        articles: [
            {
                id: 'asset-overview',
                title: 'Vue d\'ensemble des actifs',
                description: 'Cartographie complète du patrimoine informationnel.',
                sections: [
                    {
                        title: 'Types d\'actifs',
                        content: '• Actifs informationnels : Données, applications, systèmes\n• Actifs physiques : Serveurs, équipements, infrastructures\n• Actifs humains : Compétences, responsabilités\n• Actifs immatériels : Brevets, logiciels, réputation'
                    },
                    {
                        title: 'Criticité et classification',
                        content: 'Classification automatique par l\'IA selon 4 niveaux : Critique, Majeur, Mineur, Info. La criticité intègre l\'impact métier, la sensibilité des données et la dépendance opérationnelle.'
                    }
                ]
            },
            {
                id: 'create-asset',
                title: 'Créer et gérer un actif',
                description: 'Méthodologie complète de gestion du patrimoine.',
                icon: Plus,
                sections: [
                    {
                        title: 'Création manuelle',
                        content: '1. Cliquez sur "Nouvel Actif" dans le module Actifs\n2. Remplissez le formulaire : nom, type, propriétaire, localisation\n3. Définissez la criticité et les tags\n4. Associez les processus et dépendances\n5. Ajoutez les documents et contrôles associés'
                    },
                    {
                        title: 'Import CSV',
                        content: 'Utilisez le template fourni pour importer en masse. Colonnes requises : nom, type, criticité, propriétaire. L\'IA validera et enrichira automatiquement les données.'
                    },
                    {
                        title: 'Scan automatique',
                        content: 'Connectez vos outils (SIEM, CMDB) pour une synchronisation automatique. Les actifs sont découverts, classifiés et intégrés dans votre cartographie.'
                    }
                ]
            },
            {
                id: 'asset-inspector',
                title: 'Inspecteur d\'actif',
                description: 'Analyse détaillée et vue 360°.',
                sections: [
                    {
                        title: 'Onglets de l\'inspecteur',
                        content: '• Informations : Fiche d\'identité complète\n• Risques : Menaces et vulnérabilités associées\n• Contrôles : Mesures de sécurité appliquées\n• Documents : Preuves et documentation\n• Historique : Journal des modifications\n• Dépendances : Actifs et processus liés'
                    },
                    {
                        title: 'Actions rapides',
                        content: 'Depuis l\'inspecteur : dupliquer, exporter, archiver, transférer la propriété, lancer une analyse de risque, créer un contrôle.'
                    }
                ]
            },
            {
                id: 'asset-matrix',
                title: 'Matrice des actifs',
                description: 'Visualisation croisée et analyse.',
                sections: [
                    {
                        title: 'Vue matricielle',
                        content: 'Croisez les actifs par type/criticité, processus/localisation, ou propriétaire/segment. Identifiez rapidement les concentrations de risques et les points critiques.'
                    },
                    {
                        title: 'Filtres avancés',
                        content: 'Filtrez par tags, dates, statuts, dépendances. Exportez les vues filtrées en PDF ou Excel pour vos revues de direction.'
                    }
                ]
            }
        ]
    },
    {
        id: 'risks',
        title: 'Gestion des Risques',
        icon: Shield,
        articles: [
            {
                id: 'risk-methodology',
                title: 'Méthodologie EBIOS RM & ISO 27005',
                description: 'Approche structurée de l\'analyse de risques.',
                sections: [
                    {
                        title: 'EBIOS RM 2023',
                        content: 'Méthode de l\'ANSSI adaptée par Sentinel :\n1. Étude du contexte périmètre\n2. Scénarios de menaces adverses\n3. Analyse des risques stratégiques\n4. Traitement des risques (DAR/PAR/TRA)\n5. Validation par la direction'
                    },
                    {
                        title: 'ISO 27005',
                        content: 'Norme internationale de management des risques :\n• Identification et évaluation\n• Traitement et acceptation\n• Communication et surveillance\n• Revue continue'
                    }
                ]
            },
            {
                id: 'create-risk',
                title: 'Créer une analyse de risque',
                description: 'Guide complet de création et évaluation.',
                icon: Plus,
                sections: [
                    {
                        title: 'Formulaire de risque',
                        content: 'Champs obligatoires :\n• Menace : Description claire et précise\n• Probabilité : Échelle 1-5 (quasi impossible à certain)\n• Gravité : Échelle 1-5 (négligeable à catastrophique)\n• Stratégie : DAR (Réduire), PAR (Partager), TRA (Transférer), ACC (Accepter)'
                    },
                    {
                        title: 'Calcul automatique',
                        content: 'Le score de risque = Probabilité × Gravité. La matrice positionne automatiquement le risque dans les quadrants : Critique (>15), Élevé (10-14), Modéré (6-9), Faible (1-5).'
                    },
                    {
                        title: 'Assistance IA',
                        content: 'L\'IA vous aide à : formuler les menaces, évaluer les probabilités, identifier les vulnérabilités associées, et proposer des mesures de traitement adaptées.'
                    }
                ]
            },
            {
                id: 'risk-matrix',
                title: 'Matrice des risques',
                description: 'Visualisation et priorisation.',
                sections: [
                    {
                        title: 'Quadrants de décision',
                        content: '• Zone Critique : Traitement immédiat obligatoire\n• Zone Élevée : Plan d\'action prioritaire\n• Zone Modérée : Surveillance renforcée\n• Zone Faible : Acceptation possible'
                    },
                    {
                        title: 'Filtres et vues',
                        content: 'Filtrez par statut, propriétaire, périmètre, stratégie. Vue temporelle avec évolution des risques. Export PDF pour comités de direction.'
                    }
                ]
            },
            {
                id: 'risk-treatment',
                title: 'Plan de traitement des risques',
                description: 'Mise en œuvre et suivi des actions.',
                sections: [
                    {
                        title: 'Actions de traitement',
                        content: 'Pour chaque risque :\n• Mesures de réduction (contrôles techniques)\n• Partage (assurance, externalisation)\n• Transfert (contractualisation)\n• Acceptation (documentée et justifiée)'
                    },
                    {
                        title: 'Suivi et SLA',
                        content: 'Chaque action a un responsable, une échéance et un statut. Les alertes automatiques notifient les retards et échéances approchantes.'
                    }
                ]
            }
        ]
    },
    {
        id: 'compliance',
        title: 'Conformité & Audits',
        icon: FileText,
        articles: [
            {
                id: 'compliance-overview',
                title: 'Cadres normatifs supportés',
                description: 'ISO 27001, RGPD et plus encore.',
                sections: [
                    {
                        title: 'ISO 27001/27002',
                        content: 'Gestion complète de l\'annexe A : 93 contrôles répartis en 4 domaines (Organisation, Humain, Physique, Technologique). SoA (Statement of Applicability) automatique et exportable.'
                    },
                    {
                        title: 'RGPD',
                        content: 'Registre des activités de traitement, analyse d\'impact, gestion des violations, droits des personnes, et documentation de conformité.'
                    },
                    {
                        title: 'Autres cadres',
                        content: 'NIST CSF, CIS Controls, SOC 2, HDS, PCI-DSS. Frameworks personnalisables selon votre secteur d\'activité.'
                    }
                ]
            },
            {
                id: 'controls-management',
                title: 'Gestion des contrôles',
                description: 'Cycle de vie complet des mesures de sécurité.',
                sections: [
                    {
                        title: 'Implémentation',
                        content: 'Chaque contrôle inclut : description, objectif, propriétaire, preuves, statut, date de revue. Lien automatique avec les actifs et risques concernés.'
                    },
                    {
                        title: 'Preuves et audits',
                        content: 'Upload de preuves (documents, captures), validation par audit, traçabilité complète. Génération automatique des rapports d\'audit.'
                    },
                    {
                        title: 'Surveillance continue',
                        content: 'Tableaux de bord de conformité en temps réel, alertes sur les contrôles expirés, et reporting automatique pour les comités.'
                    }
                ]
            },
            {
                id: 'audits-module',
                title: 'Module d\'audits',
                description: 'Planification et exécution des audits.',
                sections: [
                    {
                        title: 'Plan d\'audit',
                        content: 'Calendrier annuel, programmation des audits internes/externes, affectation des auditeurs, et définition des périmètres et critères.'
                    },
                    {
                        title: 'Exécution',
                        content: 'Checklists personnalisables, collecte des preuves, identification des non-conformités, et génération des rapports d\'audit avec plans d\'action.'
                    },
                    {
                        title: 'Suivi',
                        content: 'Tableau de bord des audits en cours, historique complet, et suivi des plans d\'action correctifs avec échéances.'
                    }
                ]
            },
            {
                id: 'soa-statement',
                title: 'Statement of Applicability',
                description: 'Déclaration d\'applicabilité ISO 27001.',
                sections: [
                    {
                        title: 'Génération automatique',
                        content: 'Le SoA est généré automatiquement à partir de vos contrôles implémentés. Document justifiant l\'exclusion ou l\'adaptation de chaque mesure.'
                    },
                    {
                        title: 'Export et certification',
                        content: 'Export PDF/Word du SoA complet, prêt pour soumission à certificateur. Versioning et historique des modifications.'
                    }
                ]
            }
        ]
    },
    {
        id: 'projects',
        title: 'Gestion de Projet',
        icon: FolderKanban,
        articles: [
            {
                id: 'projects-overview',
                title: 'Projets de sécurité',
                description: 'Plans de traitement et initiatives.',
                sections: [
                    {
                        title: 'Types de projets',
                        content: '• Plans de traitement des risques\n• Projets de mise en conformité\n• Initiatives de sécurité\n• Projets d\'audit et certification\n• Plans de continuité\n• Projets de sensibilisation'
                    },
                    {
                        title: 'Méthodologie',
                        content: 'Gestion de projet agile adaptée à la cybersécurité : phases, livrables, jalons, et dépendances. Intégration avec les risques et contrôles.'
                    }
                ]
            },
            {
                id: 'project-management',
                title: 'Créer et gérer un projet',
                description: 'Cycle de vie complet de projet.',
                sections: [
                    {
                        title: 'Création',
                        content: '1. Définir l\'objectif et périmètre\n2. Lier aux risques/contrôles concernés\n3. Affecter l\'équipe et le budget\n4. Planifier les phases et livrables\n5. Configurer les alertes et reporting'
                    },
                    {
                        title: 'Suivi',
                        content: 'Tableau de bord Kanban, Gantt, timeline. Suivi du budget, des ressources et des risques projet. Rapports d\'avancement automatiques.'
                    }
                ]
            }
        ]
    },
    {
        id: 'incidents',
        title: 'Gestion d\'Incidents',
        icon: AlertTriangle,
        articles: [
            {
                id: 'incident-response',
                title: 'Playbooks de réponse',
                description: 'Procédures et gestion de crise.',
                sections: [
                    {
                        title: 'Types d\'incidents',
                        content: '• Malware et ransomware\n• Fuite de données\n• Attaque par déni de service\n• Intrusion et compromission\n• Erreur humaine\n• Panne technique'
                    },
                    {
                        title: 'Processus de réponse',
                        content: '1. Détection et qualification\n2. Confinement et éradication\n3. Communication et reporting\n4. Analyse post-mortem\n5. Amélioration continue'
                    }
                ]
            },
            {
                id: 'incident-management',
                title: 'Cycle de vie d\'incident',
                description: 'De la détection à la résolution.',
                sections: [
                    {
                        title: 'Déclaration',
                        content: 'Formulaire structuré : type, criticité, impact, description, premières mesures. Affectation automatique selon la matrice de garde.'
                    },
                    {
                        title: 'Traitement',
                        content: 'Timeline des actions, affectation des ressources, communication aux parties prenantes, et documentation des décisions.'
                    }
                ]
            }
        ]
    },
    {
        id: 'documents',
        title: 'Gestion Documentaire',
        icon: FileText,
        articles: [
            {
                id: 'document-vault',
                title: 'Coffre-fort documentaire',
                description: 'Stockage sécurisé et versioning.',
                sections: [
                    {
                        title: 'Sécurité',
                        content: 'Chiffrement AES-256, versioning automatique, signatures numériques, et traçabilité des accès. Conformité RGPD et stockage UE.'
                    },
                    {
                        title: 'Types de documents',
                        content: '• Politiques et procédures\n• Preuves d\'audit\n• Contrats et conventions\n• Rapports d\'analyse\n• Plans de crise\n• Formulaires et templates'
                    }
                ]
            },
            {
                id: 'document-workflow',
                title: 'Workflow documentaire',
                description: 'Cycle de vie et approbations.',
                sections: [
                    {
                        title: 'Versioning',
                        content: 'Traçabilité complète des versions avec diff, historique des modifications, et validation par workflow d\'approbation.'
                    },
                    {
                        title: 'Classification',
                        content: 'Niveaux de confidentialité : Public, Interne, Confidentiel, Secret. Contrôle d\'accès basé sur les rôles et la classification.'
                    }
                ]
            }
        ]
    },
    {
        id: 'reports',
        title: 'Rapports & Tableaux de Bord',
        icon: FileSpreadsheet,
        articles: [
            {
                id: 'reporting-overview',
                title: 'Types de rapports',
                description: 'Reporting complet et personnalisé.',
                sections: [
                    {
                        title: 'Rapports réglementaires',
                        content: '• SoA ISO 27001\n• Registre RGPD\n• Rapports d\'audit\n• Évaluations d\'impact\n• Plans de traitement'
                    },
                    {
                        title: 'Tableaux de bord',
                        content: 'KPIs de sécurité, tendances, alertes, et métriques personnalisées. Export PDF, Excel, et intégration Power BI.'
                    }
                ]
            },
            {
                id: 'custom-reports',
                title: 'Rapports personnalisés',
                description: 'Créez vos propres rapports.',
                sections: [
                    {
                        title: 'Configuration',
                        content: 'Sélectionnez les données, filtres, graphiques, et mise en page. Planifiez la génération automatique et la distribution.'
                    },
                    {
                        title: 'Templates',
                        content: 'Templates prédéfinis adaptés à chaque audience : Direction, RSSI, Auditeurs, Opérationnels.'
                    }
                ]
            }
        ]
    },
    {
        id: 'team',
        title: 'Équipe & Collaborateurs',
        icon: Users,
        articles: [
            {
                id: 'user-management',
                title: 'Gestion des utilisateurs',
                description: 'Rôles, permissions et accès.',
                sections: [
                    {
                        title: 'Rôles et permissions',
                        content: '• Admin : Gestion complète de la plateforme\n• Manager : Supervision et validation\n• Auditor : Accès audit et reporting\n• User : Saisie et consultation\n• Reader : Lecture seule'
                    },
                    {
                        title: 'Multi-tenant',
                        content: 'Isolation complète des données entre organisations. Chaque utilisateur n\'accède qu\'aux données de son organisation.'
                    }
                ]
            },
            {
                id: 'collaboration',
                title: 'Fonctionnalités collaboratives',
                description: 'Travail d\'équipe et communication.',
                sections: [
                    {
                        title: 'Notifications',
                        content: 'Alertes personnalisées par email et in-app. Notifications pour échéances, validations, et assignations.'
                    },
                    {
                        title: 'Partage et commentaires',
                        content: 'Partage de documents, commentaires sur les risques/contrôles, et suivi des discussions en contexte.'
                    }
                ]
            }
        ]
    },
    {
        id: 'integrations',
        title: 'Intégrations & API',
        icon: Link,
        articles: [
            {
                id: 'api-overview',
                title: 'API REST et connecteurs',
                description: 'Connectez Sentinel à votre écosystème.',
                sections: [
                    {
                        title: 'API REST',
                        content: 'API complète avec documentation Swagger. Endpoints pour actifs, risques, contrôles, audits, et reporting. Authentification OAuth 2.0.'
                    },
                    {
                        title: 'Connecteurs natifs',
                        content: '• SIEM : Splunk, ELK, QRadar\n• ITSM : ServiceNow, Jira Service Desk\n• Cloud : AWS, Azure, GCP\n• Auth : SAML, LDAP, Azure AD'
                    }
                ]
            },
            {
                id: 'webhooks',
                title: 'Webhooks et automatisation',
                description: 'Déclenchez des actions automatiques.',
                sections: [
                    {
                        title: 'Événements',
                        content: 'Création/modification d\'actifs, évaluation de risques, validation de contrôles, génération de rapports.'
                    },
                    {
                        title: 'Automatisations',
                        content: 'Intégration avec Power Automate, Zapier, et scripts personnalisés pour vos workflows métier.'
                    }
                ]
            }
        ]
    },
    {
        id: 'security',
        title: 'Sécurité & Confidentialité',
        icon: Shield,
        articles: [
            {
                id: 'data-protection',
                title: 'Protection des données',
                description: 'Mesures de sécurité et conformité.',
                sections: [
                    {
                        title: 'Chiffrement',
                        content: 'Chiffrement AES-256 au repos et TLS 1.3 en transit. Clés gérées par AWS KMS avec rotation automatique.'
                    },
                    {
                        title: 'Conformité',
                        content: 'Hébergement UE (France), certification ISO 27001, conformité RGPD, et audits de sécurité réguliers.'
                    }
                ]
            },
            {
                id: 'access-control',
                title: 'Contrôle d\'accès',
                description: 'Authentification et autorisations.',
                sections: [
                    {
                        title: 'Authentification',
                        content: 'MFA obligatoire, SSO SAML, et politique de mots de passe robuste. Sessions sécurisées avec timeout configurable.'
                    },
                    {
                        title: 'Traçabilité',
                        content: 'Journal complet de toutes les actions : qui, quoi, quand, depuis où. Logs immuables et exportables pour audits.'
                    }
                ]
            }
        ]
    },
    {
        id: 'settings',
        title: 'Paramètres & Configuration',
        icon: Settings,
        articles: [
            {
                id: 'account-settings',
                title: 'Mon Compte',
                description: 'Gestion personnelle et préférences.',
                sections: [
                    {
                        title: 'Profil utilisateur',
                        content: 'Informations personnelles, photo de profil, signature, et préférences de communication.'
                    },
                    {
                        title: 'Sécurité',
                        content: 'Mot de passe, 2FA, sessions actives, et historique des connexions. Révocation d\'accès en un clic.'
                    }
                ]
            },
            {
                id: 'organization-settings',
                title: 'Configuration organisation',
                description: 'Paramètres globaux et préférences.',
                sections: [
                    {
                        title: 'Informations générales',
                        content: 'Dénomination, logo, secteur d\'activité, et informations légales. Configuration multi-entités.'
                    },
                    {
                        title: 'Préférences système',
                        content: 'Langue, fuseau horaire, format de dates, et notifications par défaut. Sauvegarde et rétention des données.'
                    }
                ]
            },
            {
                id: 'backup-restore',
                title: 'Sauvegarde et restauration',
                description: 'Protection de vos données.',
                sections: [
                    {
                        title: 'Sauvegardes automatiques',
                        content: 'Sauvegardes quotidiennes chiffrées avec rétention de 90 jours. Stockage géoredondant en Europe.'
                    },
                    {
                        title: 'Restauration',
                        content: 'Restauration sélective par module. Point-in-time recovery disponible sur demande.'
                    }
                ]
            }
        ]
    },
    {
        id: 'tutorials',
        title: 'Tutoriels Interactifs',
        icon: Play,
        articles: [
            {
                id: 'interactive-guides',
                title: 'Guides pas-à-pas',
                description: 'Apprenez en pratiquant avec nos tutoriels interactifs.',
                sections: [
                    {
                        title: 'Comment ça marche ?',
                        content: "Nos tutoriels interactifs vous guident étape par étape dans l'utilisation de Sentinel GRC. Chaque action est expliquée et peut être réalisée directement dans l'interface."
                    },
                    {
                        title: 'Niveaux de difficulté',
                        content: '• Débutant : Parfait pour découvrir la plateforme\\n• Intermédiaire : Pour maîtriser les fonctionnalités avancées\\n• Avancé : Pour expertiser les workflows complexes'
                    },
                    {
                        title: 'Suivi de progression',
                        content: "Votre progression est automatiquement sauvegardée. Vous pouvez reprendre un tutoriel à tout moment où vous l'avez laissé."
                    }
                ]
            }
        ]
    },
    {
        id: 'faq',
        title: 'FAQ & Dépannage',
        icon: HelpCircle,
        articles: [
            {
                id: 'common-issues',
                title: 'Questions fréquentes',
                description: 'Réponses aux problèmes courants.',
                sections: [
                    {
                        title: 'Connexion et accès',
                        content: 'Q: J\'ai oublié mon mot de passe ?\nR: Utilisez "Mot de passe oublié" sur la page de connexion. Un lien de réinitialisation vous sera envoyé.\n\nQ: Je ne reçois pas les emails ?\nR: Vérifiez vos spams et ajoutez noreply@cyber-threat-consulting.com à vos contacts.'
                    },
                    {
                        title: 'Performance',
                        content: 'Q: L\'application est lente ?\nR: Videz le cache de votre navigateur, vérifiez votre connexion, et contactez le support si le problème persiste.'
                    }
                ]
            },
            {
                id: 'technical-support',
                title: 'Support technique',
                description: 'Obtenir de l\'aide.',
                sections: [
                    {
                        title: 'Canaux de support',
                        content: '• Email : support@cyber-threat-consulting.com\n• Téléphone : +33 1 XX XX XX XX\n• Chat : Disponible dans l\'application\n• Formulaire : Via le centre d\'aide'
                    },
                    {
                        title: 'Niveaux de priorité',
                        content: '• Critique : Indisponibilité totale\n• Haut : Fonctionnalité majeure cassée\n• Moyen : Problème contournable\n• Bas : Amélioration ou question'
                    }
                ]
            }
        ]
    }
];

export const Help: React.FC = () => {
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('getting-started');
    const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isContactOpen, setIsContactOpen] = useState(false);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

    const filteredContent = useMemo(() => {
        if (!search) return HELP_DATA;

        return HELP_DATA.map(category => ({
            ...category,
            articles: category.articles.filter(article =>
                article.title.toLowerCase().includes(search.toLowerCase()) ||
                article.description.toLowerCase().includes(search.toLowerCase())
            )
        })).filter(category => category.articles.length > 0);
    }, [search]);

    const activeCategory = useMemo(() =>
        filteredContent.find(c => c.id === selectedCategory) || filteredContent[0],
        [filteredContent, selectedCategory]);

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="flex flex-col gap-6 sm:gap-8 lg:gap-10"
        >
            <MasterpieceBackground />
            <SEO title="Centre d'Aide" description="Documentation et support Sentinel GRC" />

            <PageHeader
                title="Centre d'Aide"
                subtitle="Documentation, guides et support pour Sentinel GRC"
                icon={
                    <img
                        src="/images/support.png"
                        alt="SUPPORT"
                        className="w-full h-full object-contain"
                    />
                }
            />

            <div className="flex h-[calc(100vh-16rem)] animate-fade-in overflow-hidden rounded-3xl glass-premium border border-slate-200 dark:border-slate-800 shadow-2xl relative">

                {/* Mobile Menu Overlay */}
                {mobileMenuOpen && (
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                )}

                {/* Sidebar Navigation */}
                <div className={`
                    absolute inset-y-0 left-0 z-40 w-80 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-out
                    md:relative md:translate-x-0
                    ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
                `}>
                    <div className="p-6 h-full flex flex-col gap-6">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)}
                                aria-label="Rechercher dans l'aide"
                                type="text"
                                placeholder="Rechercher..."
                                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus-visible:ring-brand-500 outline-none transition-all placeholder:text-muted-foreground"
                            />
                        </div>

                        <nav className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-2">
                            {filteredContent.map(category => (
                                <Button
                                    key={category.id}
                                    variant="ghost"
                                    aria-label={category.title}
                                    onClick={() => {
                                        setSelectedCategory(category.id);
                                        setSelectedArticle(null);
                                        setMobileMenuOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-start gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group ${selectedCategory === category.id
                                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                        }`}
                                >
                                    <div className={`p-2 rounded-lg transition-colors ${selectedCategory === category.id
                                        ? 'bg-brand-500 text-white shadow-sm'
                                        : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700'
                                        }`}>
                                        <category.icon className="w-4 h-4" />
                                    </div>
                                    <span>{category.title}</span>
                                    {selectedCategory === category.id && (
                                        <ChevronRight className="w-4 h-4 ml-auto" />
                                    )}
                                </Button>
                            ))}
                        </nav>

                        <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
                            <Button
                                variant="outline"
                                aria-label="Donner mon avis"
                                onClick={() => setIsFeedbackOpen(true)}
                                className="w-full py-3 bg-brand-50 dark:bg-brand-900 text-brand-700 dark:text-white rounded-xl text-sm font-bold border border-brand-200 dark:border-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900 transition-all flex items-center justify-center gap-2"
                            >
                                <MessageSquare className="w-4 h-4 mr-2" />
                                Donner mon avis
                            </Button>
                            <Button
                                aria-label="Contacter le support"
                                onClick={() => setIsContactOpen(true)}
                                className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                            >
                                <HelpCircle className="w-4 h-4 mr-2" />
                                Support
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-white/50 dark:bg-slate-900/50 relative backdrop-blur-sm">
                    {/* Mobile Header */}
                    <div className="md:hidden p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                        <span className="font-bold text-slate-900 dark:text-white">Menu</span>
                        <button
                            aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800"
                        >
                            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 scroll-smooth">
                        {activeCategory ? (
                            <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="p-3 bg-brand-50 rounded-2xl ring-1 ring-brand-300">
                                        <activeCategory.icon className="w-8 h-8 text-brand-600 dark:text-brand-400" />
                                    </div>
                                    <div>
                                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{activeCategory.title}</h1>
                                        <p className="text-slate-600 dark:text-muted-foreground mt-1">
                                            {activeCategory.articles.length} articles disponibles
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-6">
                                    {activeCategory.articles.map(article => (
                                        <div
                                            key={article.id}
                                            id={article.id}
                                            className={`group rounded-2xl border transition-all duration-300 overflow-hidden ${selectedArticle === article.id
                                                ? 'bg-brand-50 dark:bg-brand-900 border-brand-200 dark:border-brand-300 ring-1 ring-brand-300'
                                                : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-lg hover:shadow-brand-500/25'
                                                }`}
                                        >
                                            <div
                                                aria-label={`Voir l'article ${article.title}`}
                                                onClick={() => setSelectedArticle(selectedArticle === article.id ? null : article.id)}
                                                className="w-full flex items-start gap-4 p-6 text-left cursor-pointer"
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        setSelectedArticle(selectedArticle === article.id ? null : article.id);
                                                    }
                                                }}
                                            >
                                                <div className={`p-2 rounded-xl shrink-0 transition-colors ${selectedArticle === article.id
                                                    ? 'bg-brand-500 text-white'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-brand-100 dark:group-hover:bg-brand-900 group-hover:text-brand-600 dark:group-hover:text-white'
                                                    }`}>
                                                    {article.icon ? <article.icon className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        {/* Heading hierarchy: h2 for article title (follows h1 page title) */}
                                                        <h2 className={`text-lg font-bold transition-colors ${selectedArticle === article.id ? 'text-slate-900 dark:text-white' : 'text-slate-900 dark:text-white'
                                                            }`}>
                                                            {article.title}
                                                        </h2>
                                                        <ChevronDown className={`w-5 h-5 text-slate-500 dark:text-slate-400 transition-transform duration-300 ${selectedArticle === article.id ? 'rotate-180 text-brand-500' : ''}`} />
                                                    </div>
                                                    <p className="text-slate-600 dark:text-muted-foreground mt-1 text-sm leading-relaxed">
                                                        {article.description}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className={`grid transition-all duration-300 ease-in-out ${selectedArticle === article.id ? 'grid-rows-[1fr] opacity-70' : 'grid-rows-[0fr] opacity-0'
                                                }`}>
                                                <div className="overflow-hidden">
                                                    <div className="px-6 pb-6 pt-0 space-y-6">
                                                        <div className="h-px w-full bg-slate-200 dark:bg-slate-700/50 mb-6" />
                                                        {article.sections.map((section, idx) => (
                                                            <div key={`section-${idx}-${section.title || 'untitled'}`} className="prose prose-slate dark:prose-invert max-w-none">
                                                                {section.title && (
                                                                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                                                                        {section.title}
                                                                    </h3>
                                                                )}
                                                                <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed pl-3.5 border-l-2 border-brand-200 dark:border-brand-300">
                                                                    {section.content}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                                <Search className="w-16 h-16 mb-4 opacity-20" />
                                <p className="text-lg font-medium">Sélectionnez une catégorie ou effectuez une recherche</p>
                            </div>
                        )}
                    </div>
                </div>

                <ContactModal
                    isOpen={isContactOpen}
                    onClose={() => setIsContactOpen(false)}
                    subject="Support Sentinel GRC"
                />

                <FeedbackModal
                    isOpen={isFeedbackOpen}
                    onClose={() => setIsFeedbackOpen(false)}
                />
            </div>
        </motion.div>
    );
};

// Headless UI handles FocusTrap and keyboard navigation
