/**
 * Continuity Methods & Workshops Component
 * Provides structured methodologies for BIA, Strategies, PRA, Drills, TLPT, and Crisis Management
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PremiumCard } from '../ui/PremiumCard';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';
import {
    AlertOctagon,
    ShieldCheck,
    FileText,
    Zap,
    Target,
    AlertTriangle,
    ChevronRight,
    CheckCircle,
    Circle,
    Clock,
    ClipboardList,
    Lightbulb,
    Play,
    RotateCcw,
    FileCheck,
    BookOpen,
} from '../ui/Icons';
import { Button } from '../ui/button';
import type { ContinuityMethodTemplate, ContinuityWorkshopPhase } from '../../types/business';

interface ContinuityMethodsWorkshopsProps {
    onStartWorkshop?: (templateId: string) => void;
}

// Module configuration - Using muted, professional colors aligned with design tokens
const MODULE_CONFIG: Record<string, {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    label: string;
    labelFr: string;
}> = {
    bia: {
        icon: AlertOctagon,
        color: 'bg-warning',
        bgColor: 'bg-warning-bg dark:bg-warning/10',
        borderColor: 'border-warning-border dark:border-warning/30',
        label: 'BIA',
        labelFr: 'Analyse d\'Impact'
    },
    strategies: {
        icon: ShieldCheck,
        color: 'bg-brand-500',
        bgColor: 'bg-brand-50 dark:bg-brand-900',
        borderColor: 'border-brand-200 dark:border-brand-800',
        label: 'Strategies',
        labelFr: 'Stratégies'
    },
    pra: {
        icon: FileText,
        color: 'bg-violet-500',
        bgColor: 'bg-violet-50/50 dark:bg-violet-900/10',
        borderColor: 'border-violet-200 dark:border-violet-800',
        label: 'DRP',
        labelFr: 'PRA'
    },
    drills: {
        icon: Zap,
        color: 'bg-info',
        bgColor: 'bg-info-bg dark:bg-info/10',
        borderColor: 'border-info-border dark:border-info/30',
        label: 'Exercises',
        labelFr: 'Exercices'
    },
    tlpt: {
        icon: Target,
        color: 'bg-error',
        bgColor: 'bg-error-bg dark:bg-error/10',
        borderColor: 'border-error-border dark:border-error/30',
        label: 'TLPT',
        labelFr: 'TLPT (DORA)'
    },
    crisis: {
        icon: AlertTriangle,
        color: 'bg-destructive',
        bgColor: 'bg-destructive/5 dark:bg-destructive/10',
        borderColor: 'border-destructive/30 dark:border-destructive/40',
        label: 'Crisis',
        labelFr: 'Gestion de Crise'
    },
};

// Method templates for each continuity sub-module
const CONTINUITY_METHOD_TEMPLATES: ContinuityMethodTemplate[] = [
    // BIA - Business Impact Analysis (ISO 22317)
    {
        id: 'bia-iso-22317',
        name: 'Analyse d\'Impact sur l\'Activité (BIA)',
        module: 'bia',
        framework: 'ISO 22317',
        description: 'Méthodologie structurée pour identifier et évaluer les impacts d\'une interruption sur les processus métiers critiques.',
        estimatedDuration: '3-6 semaines',
        phases: [
            {
                id: 'bia-1',
                name: 'Phase 1: Préparation & Cadrage',
                description: 'Définir le périmètre et mobiliser les parties prenantes',
                order: 1,
                tasks: [
                    { id: 'bia-1-1', title: 'Définir le périmètre de l\'analyse', description: 'Identifier les processus et activités à analyser', isCompleted: false, isRequired: true },
                    { id: 'bia-1-2', title: 'Identifier les parties prenantes', description: 'Lister les responsables métiers et IT à interviewer', isCompleted: false, isRequired: true },
                    { id: 'bia-1-3', title: 'Préparer les questionnaires BIA', description: 'Créer les formulaires de collecte d\'information', isCompleted: false, isRequired: true },
                    { id: 'bia-1-4', title: 'Planifier les entretiens', description: 'Organiser le calendrier des interviews', isCompleted: false, isRequired: false },
                ],
                deliverables: ['Plan de projet BIA', 'Liste des parties prenantes', 'Questionnaires BIA']
            },
            {
                id: 'bia-2',
                name: 'Phase 2: Collecte des Données',
                description: 'Recueillir les informations sur les processus et leurs dépendances',
                order: 2,
                tasks: [
                    { id: 'bia-2-1', title: 'Cartographier les processus métiers', description: 'Documenter chaque processus critique', isCompleted: false, isRequired: true },
                    { id: 'bia-2-2', title: 'Identifier les ressources critiques', description: 'Lister personnel, systèmes, locaux, fournisseurs', isCompleted: false, isRequired: true },
                    { id: 'bia-2-3', title: 'Évaluer les périodes critiques', description: 'Identifier les pics d\'activité et contraintes temporelles', isCompleted: false, isRequired: true },
                    { id: 'bia-2-4', title: 'Documenter les interdépendances', description: 'Cartographier les liens entre processus', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Cartographie des processus', 'Matrice des dépendances', 'Calendrier des périodes critiques']
            },
            {
                id: 'bia-3',
                name: 'Phase 3: Analyse des Impacts',
                description: 'Évaluer les conséquences d\'une interruption',
                order: 3,
                tasks: [
                    { id: 'bia-3-1', title: 'Définir les catégories d\'impact', description: 'Financier, opérationnel, réputationnel, réglementaire', isCompleted: false, isRequired: true },
                    { id: 'bia-3-2', title: 'Évaluer les impacts par durée', description: 'Analyser impacts à 1h, 4h, 24h, 48h, 1 semaine', isCompleted: false, isRequired: true },
                    { id: 'bia-3-3', title: 'Calculer le MTPD', description: 'Maximum Tolerable Period of Disruption', isCompleted: false, isRequired: true },
                    { id: 'bia-3-4', title: 'Prioriser les processus', description: 'Classer par criticité et urgence de reprise', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Matrice d\'impacts', 'Classification des processus', 'Tableau MTPD']
            },
            {
                id: 'bia-4',
                name: 'Phase 4: Définition RTO/RPO',
                description: 'Établir les objectifs de reprise',
                order: 4,
                tasks: [
                    { id: 'bia-4-1', title: 'Définir les RTO par processus', description: 'Recovery Time Objective - délai max d\'interruption', isCompleted: false, isRequired: true },
                    { id: 'bia-4-2', title: 'Définir les RPO par processus', description: 'Recovery Point Objective - perte de données tolérée', isCompleted: false, isRequired: true },
                    { id: 'bia-4-3', title: 'Valider avec les métiers', description: 'Confirmer les objectifs avec les responsables', isCompleted: false, isRequired: true },
                    { id: 'bia-4-4', title: 'Aligner avec les capacités IT', description: 'Vérifier la faisabilité technique', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Tableau RTO/RPO validé', 'Analyse des écarts', 'Plan d\'alignement']
            },
            {
                id: 'bia-5',
                name: 'Phase 5: Rapport & Recommandations',
                description: 'Synthétiser les résultats et proposer des actions',
                order: 5,
                tasks: [
                    { id: 'bia-5-1', title: 'Rédiger le rapport BIA', description: 'Document de synthèse complet', isCompleted: false, isRequired: true },
                    { id: 'bia-5-2', title: 'Formuler les recommandations', description: 'Actions pour améliorer la résilience', isCompleted: false, isRequired: true },
                    { id: 'bia-5-3', title: 'Présenter à la direction', description: 'Valider les conclusions et priorités', isCompleted: false, isRequired: true },
                    { id: 'bia-5-4', title: 'Planifier la révision', description: 'Définir la fréquence de mise à jour', isCompleted: false, isRequired: false },
                ],
                deliverables: ['Rapport BIA complet', 'Plan d\'action', 'Présentation direction']
            },
        ],
        bestPractices: [
            'Impliquer les responsables métiers dès le début',
            'Utiliser des scénarios concrets pour évaluer les impacts',
            'Valider les RTO/RPO avec l\'IT pour assurer la faisabilité',
            'Mettre à jour le BIA annuellement ou après changement majeur',
            'Documenter les hypothèses et limitations de l\'analyse'
        ],
        deliverables: [
            'Rapport d\'Analyse d\'Impact (BIA)',
            'Matrice RTO/RPO validée',
            'Cartographie des dépendances',
            'Plan d\'action prioritisé'
        ],
        isDefault: true
    },
    // Strategies - Continuity Strategies (ISO 22301)
    {
        id: 'strategies-iso-22301',
        name: 'Stratégies de Continuité',
        module: 'strategies',
        framework: 'ISO 22301',
        description: 'Développement des stratégies de continuité pour protéger les activités critiques identifiées dans le BIA.',
        estimatedDuration: '2-4 semaines',
        phases: [
            {
                id: 'strat-1',
                name: 'Phase 1: Analyse des Options',
                description: 'Identifier les stratégies possibles pour chaque processus critique',
                order: 1,
                tasks: [
                    { id: 'strat-1-1', title: 'Analyser les résultats du BIA', description: 'Identifier les besoins de continuité par processus', isCompleted: false, isRequired: true },
                    { id: 'strat-1-2', title: 'Identifier les options de stratégie', description: 'Active-Active, Active-Passive, Cold Standby, Cloud DR', isCompleted: false, isRequired: true },
                    { id: 'strat-1-3', title: 'Évaluer les coûts/bénéfices', description: 'Analyser le rapport coût vs protection', isCompleted: false, isRequired: true },
                    { id: 'strat-1-4', title: 'Évaluer les risques résiduels', description: 'Identifier les risques non couverts', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Catalogue des options stratégiques', 'Analyse coûts-bénéfices', 'Matrice de décision']
            },
            {
                id: 'strat-2',
                name: 'Phase 2: Sélection des Stratégies',
                description: 'Choisir les stratégies optimales',
                order: 2,
                tasks: [
                    { id: 'strat-2-1', title: 'Définir les critères de sélection', description: 'Coût, délai, complexité, fiabilité', isCompleted: false, isRequired: true },
                    { id: 'strat-2-2', title: 'Évaluer les stratégies candidates', description: 'Noter chaque option selon les critères', isCompleted: false, isRequired: true },
                    { id: 'strat-2-3', title: 'Valider avec les parties prenantes', description: 'Confirmer les choix avec métiers et IT', isCompleted: false, isRequired: true },
                    { id: 'strat-2-4', title: 'Documenter les décisions', description: 'Justifier les choix stratégiques', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Stratégies sélectionnées', 'Documentation des décisions', 'Plan de mise en œuvre']
            },
            {
                id: 'strat-3',
                name: 'Phase 3: Ressources & Infrastructure',
                description: 'Définir les moyens nécessaires',
                order: 3,
                tasks: [
                    { id: 'strat-3-1', title: 'Identifier les ressources humaines', description: 'Équipes de crise, astreintes, compétences clés', isCompleted: false, isRequired: true },
                    { id: 'strat-3-2', title: 'Définir l\'infrastructure technique', description: 'Sites de repli, systèmes de backup, réseaux', isCompleted: false, isRequired: true },
                    { id: 'strat-3-3', title: 'Planifier les contrats fournisseurs', description: 'SLA, garanties de service, escalade', isCompleted: false, isRequired: true },
                    { id: 'strat-3-4', title: 'Budgétiser les investissements', description: 'CAPEX et OPEX des stratégies', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Plan des ressources', 'Architecture de reprise', 'Budget prévisionnel']
            },
            {
                id: 'strat-4',
                name: 'Phase 4: Validation & Documentation',
                description: 'Formaliser et approuver les stratégies',
                order: 4,
                tasks: [
                    { id: 'strat-4-1', title: 'Rédiger le document stratégique', description: 'Formaliser les stratégies de continuité', isCompleted: false, isRequired: true },
                    { id: 'strat-4-2', title: 'Obtenir l\'approbation direction', description: 'Validation par le COMEX/CODIR', isCompleted: false, isRequired: true },
                    { id: 'strat-4-3', title: 'Communiquer les stratégies', description: 'Informer les équipes concernées', isCompleted: false, isRequired: true },
                    { id: 'strat-4-4', title: 'Intégrer au SMCA', description: 'Lier aux plans de continuité', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Document de stratégie de continuité', 'Validation direction', 'Plan de communication']
            },
        ],
        bestPractices: [
            'Baser les stratégies sur les résultats du BIA',
            'Considérer plusieurs scénarios de sinistre',
            'Équilibrer coût et niveau de protection',
            'Prévoir des stratégies évolutives',
            'Tester la faisabilité avant validation'
        ],
        deliverables: [
            'Document de Stratégie de Continuité',
            'Architecture de reprise technique',
            'Budget et plan d\'investissement',
            'Validation direction'
        ],
        isDefault: true
    },
    // PRA - Disaster Recovery Plan
    {
        id: 'pra-drp',
        name: 'Plan de Reprise d\'Activité (PRA)',
        module: 'pra',
        framework: 'ISO 22301 / ISO 27031',
        description: 'Élaboration du plan de reprise d\'activité IT pour restaurer les systèmes et données critiques.',
        estimatedDuration: '4-8 semaines',
        phases: [
            {
                id: 'pra-1',
                name: 'Phase 1: Inventaire & Priorisation',
                description: 'Identifier et prioriser les systèmes à protéger',
                order: 1,
                tasks: [
                    { id: 'pra-1-1', title: 'Inventorier les systèmes critiques', description: 'Lister applications, serveurs, bases de données', isCompleted: false, isRequired: true },
                    { id: 'pra-1-2', title: 'Mapper les dépendances techniques', description: 'Documenter les interconnexions systèmes', isCompleted: false, isRequired: true },
                    { id: 'pra-1-3', title: 'Classifier par criticité', description: 'Aligner sur le BIA et les RTO/RPO', isCompleted: false, isRequired: true },
                    { id: 'pra-1-4', title: 'Identifier les données sensibles', description: 'Localiser données critiques et réglementées', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Inventaire des systèmes critiques', 'Cartographie des dépendances', 'Classification par criticité']
            },
            {
                id: 'pra-2',
                name: 'Phase 2: Architecture de Reprise',
                description: 'Concevoir l\'infrastructure de reprise',
                order: 2,
                tasks: [
                    { id: 'pra-2-1', title: 'Définir l\'architecture cible', description: 'Site de reprise, réplication, basculement', isCompleted: false, isRequired: true },
                    { id: 'pra-2-2', title: 'Configurer les sauvegardes', description: 'Politique de backup alignée sur RPO', isCompleted: false, isRequired: true },
                    { id: 'pra-2-3', title: 'Mettre en place la réplication', description: 'Réplication synchrone/asynchrone selon RTO', isCompleted: false, isRequired: true },
                    { id: 'pra-2-4', title: 'Sécuriser le site de reprise', description: 'Accès, chiffrement, conformité', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Architecture de reprise', 'Politique de sauvegarde', 'Documentation technique']
            },
            {
                id: 'pra-3',
                name: 'Phase 3: Procédures de Reprise',
                description: 'Documenter les procédures détaillées',
                order: 3,
                tasks: [
                    { id: 'pra-3-1', title: 'Rédiger les procédures de basculement', description: 'Étapes détaillées pour chaque système', isCompleted: false, isRequired: true },
                    { id: 'pra-3-2', title: 'Définir les critères de déclenchement', description: 'Quand activer le PRA', isCompleted: false, isRequired: true },
                    { id: 'pra-3-3', title: 'Documenter le retour à la normale', description: 'Procédures de retour au site principal', isCompleted: false, isRequired: true },
                    { id: 'pra-3-4', title: 'Créer les runbooks', description: 'Guides opérationnels pas à pas', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Procédures de basculement', 'Critères de déclenchement', 'Runbooks opérationnels']
            },
            {
                id: 'pra-4',
                name: 'Phase 4: Organisation & Rôles',
                description: 'Définir l\'organisation de crise IT',
                order: 4,
                tasks: [
                    { id: 'pra-4-1', title: 'Définir les rôles et responsabilités', description: 'Cellule de crise IT, escalade', isCompleted: false, isRequired: true },
                    { id: 'pra-4-2', title: 'Établir l\'annuaire de crise', description: 'Contacts, astreintes, prestataires', isCompleted: false, isRequired: true },
                    { id: 'pra-4-3', title: 'Former les équipes', description: 'Formation aux procédures de reprise', isCompleted: false, isRequired: true },
                    { id: 'pra-4-4', title: 'Coordonner avec le PCA', description: 'Aligner PRA et plans métiers', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Organigramme de crise', 'Annuaire de crise', 'Plan de formation']
            },
            {
                id: 'pra-5',
                name: 'Phase 5: Tests & Validation',
                description: 'Valider le PRA par des tests',
                order: 5,
                tasks: [
                    { id: 'pra-5-1', title: 'Planifier les tests', description: 'Calendrier et périmètre des tests', isCompleted: false, isRequired: true },
                    { id: 'pra-5-2', title: 'Exécuter les tests techniques', description: 'Tests de restauration, basculement', isCompleted: false, isRequired: true },
                    { id: 'pra-5-3', title: 'Analyser les résultats', description: 'Identifier les écarts et améliorations', isCompleted: false, isRequired: true },
                    { id: 'pra-5-4', title: 'Mettre à jour le PRA', description: 'Intégrer les retours d\'expérience', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Rapport de tests', 'Plan d\'amélioration', 'PRA mis à jour']
            },
        ],
        bestPractices: [
            'Aligner le PRA sur les RTO/RPO du BIA',
            'Tester régulièrement les sauvegardes et restaurations',
            'Maintenir à jour la documentation technique',
            'Former les équipes aux procédures de reprise',
            'Simuler des scénarios réalistes lors des tests'
        ],
        deliverables: [
            'Plan de Reprise d\'Activité (PRA)',
            'Procédures de basculement',
            'Runbooks opérationnels',
            'Rapports de tests'
        ],
        isDefault: true
    },
    // Drills - Exercise Program (ISO 22398)
    {
        id: 'drills-iso-22398',
        name: 'Programme d\'Exercices',
        module: 'drills',
        framework: 'ISO 22398',
        description: 'Planification et exécution des exercices pour valider et améliorer les plans de continuité.',
        estimatedDuration: '2-4 semaines par exercice',
        phases: [
            {
                id: 'drill-1',
                name: 'Phase 1: Conception de l\'Exercice',
                description: 'Définir les objectifs et le format de l\'exercice',
                order: 1,
                tasks: [
                    { id: 'drill-1-1', title: 'Définir les objectifs', description: 'Que veut-on tester et valider ?', isCompleted: false, isRequired: true },
                    { id: 'drill-1-2', title: 'Choisir le type d\'exercice', description: 'Tabletop, simulation, bascule réelle', isCompleted: false, isRequired: true },
                    { id: 'drill-1-3', title: 'Définir le scénario', description: 'Contexte, événement déclencheur, chronologie', isCompleted: false, isRequired: true },
                    { id: 'drill-1-4', title: 'Identifier les participants', description: 'Équipes métiers, IT, direction', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Fiche d\'objectifs', 'Scénario d\'exercice', 'Liste des participants']
            },
            {
                id: 'drill-2',
                name: 'Phase 2: Préparation',
                description: 'Organiser la logistique et préparer les participants',
                order: 2,
                tasks: [
                    { id: 'drill-2-1', title: 'Planifier la date et le lieu', description: 'Réserver salles, systèmes de test', isCompleted: false, isRequired: true },
                    { id: 'drill-2-2', title: 'Préparer les supports', description: 'Livrets, injects, fiches de rôle', isCompleted: false, isRequired: true },
                    { id: 'drill-2-3', title: 'Briefer les facilitateurs', description: 'Former l\'équipe d\'animation', isCompleted: false, isRequired: true },
                    { id: 'drill-2-4', title: 'Communiquer aux participants', description: 'Convocations, briefing préalable', isCompleted: false, isRequired: false },
                ],
                deliverables: ['Planning logistique', 'Supports d\'exercice', 'Kit facilitateur']
            },
            {
                id: 'drill-3',
                name: 'Phase 3: Exécution',
                description: 'Conduire l\'exercice',
                order: 3,
                tasks: [
                    { id: 'drill-3-1', title: 'Briefing initial', description: 'Rappeler les règles et objectifs', isCompleted: false, isRequired: true },
                    { id: 'drill-3-2', title: 'Dérouler le scénario', description: 'Injecter les événements, observer les réactions', isCompleted: false, isRequired: true },
                    { id: 'drill-3-3', title: 'Documenter les observations', description: 'Noter décisions, problèmes, bonnes pratiques', isCompleted: false, isRequired: true },
                    { id: 'drill-3-4', title: 'Débriefing à chaud', description: 'Recueillir les impressions immédiates', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Journal de l\'exercice', 'Notes d\'observation', 'Feedback participants']
            },
            {
                id: 'drill-4',
                name: 'Phase 4: Analyse & Amélioration',
                description: 'Exploiter les résultats et améliorer les plans',
                order: 4,
                tasks: [
                    { id: 'drill-4-1', title: 'Analyser les observations', description: 'Identifier forces et faiblesses', isCompleted: false, isRequired: true },
                    { id: 'drill-4-2', title: 'Rédiger le rapport d\'exercice', description: 'Synthèse, constats, recommandations', isCompleted: false, isRequired: true },
                    { id: 'drill-4-3', title: 'Définir le plan d\'action', description: 'Actions correctives prioritaires', isCompleted: false, isRequired: true },
                    { id: 'drill-4-4', title: 'Mettre à jour les plans', description: 'Intégrer les améliorations au PCA/PRA', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Rapport d\'exercice', 'Plan d\'action', 'Plans mis à jour']
            },
        ],
        bestPractices: [
            'Varier les types d\'exercices (tabletop, simulation, réel)',
            'Inclure des scénarios cyber et non-cyber',
            'Impliquer la direction dans certains exercices',
            'Tester les communications de crise',
            'Planifier un calendrier annuel d\'exercices'
        ],
        deliverables: [
            'Rapport d\'exercice',
            'Plan d\'amélioration continue',
            'Mise à jour des plans PCA/PRA',
            'Tableau de bord des exercices'
        ],
        isDefault: true
    },
    // TLPT - Threat-Led Penetration Testing (DORA)
    {
        id: 'tlpt-dora',
        name: 'TLPT - Tests de Pénétration (DORA)',
        module: 'tlpt',
        framework: 'DORA Article 26-27',
        description: 'Programme de tests de pénétration avancés basés sur le renseignement sur les menaces, conformément aux exigences DORA.',
        estimatedDuration: '12-16 semaines',
        phases: [
            {
                id: 'tlpt-1',
                name: 'Phase 1: Planification & Gouvernance',
                description: 'Établir le cadre et obtenir les autorisations',
                order: 1,
                tasks: [
                    { id: 'tlpt-1-1', title: 'Définir le périmètre TLPT', description: 'Fonctions critiques, systèmes en scope', isCompleted: false, isRequired: true },
                    { id: 'tlpt-1-2', title: 'Obtenir l\'approbation direction', description: 'Validation COMEX et notification régulateur', isCompleted: false, isRequired: true },
                    { id: 'tlpt-1-3', title: 'Sélectionner les prestataires', description: 'Threat Intelligence (TI) et Red Team certifiés', isCompleted: false, isRequired: true },
                    { id: 'tlpt-1-4', title: 'Établir les règles d\'engagement', description: 'Limites, escalade, communication', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Plan de test TLPT', 'Autorisation direction', 'Contrats prestataires']
            },
            {
                id: 'tlpt-2',
                name: 'Phase 2: Threat Intelligence',
                description: 'Développer le renseignement sur les menaces ciblées',
                order: 2,
                tasks: [
                    { id: 'tlpt-2-1', title: 'Analyser le paysage des menaces', description: 'Acteurs ciblant le secteur financier', isCompleted: false, isRequired: true },
                    { id: 'tlpt-2-2', title: 'Identifier les TTPs pertinents', description: 'Tactiques, Techniques, Procédures des attaquants', isCompleted: false, isRequired: true },
                    { id: 'tlpt-2-3', title: 'Développer les scénarios d\'attaque', description: 'Scénarios réalistes basés sur la TI', isCompleted: false, isRequired: true },
                    { id: 'tlpt-2-4', title: 'Valider avec le régulateur', description: 'Si requis, soumettre le rapport TI', isCompleted: false, isRequired: false },
                ],
                deliverables: ['Rapport Threat Intelligence', 'Scénarios d\'attaque', 'Profils d\'attaquants']
            },
            {
                id: 'tlpt-3',
                name: 'Phase 3: Red Team Testing',
                description: 'Exécuter les tests de pénétration avancés',
                order: 3,
                tasks: [
                    { id: 'tlpt-3-1', title: 'Reconnaissance', description: 'Collecte d\'informations sur la cible', isCompleted: false, isRequired: true },
                    { id: 'tlpt-3-2', title: 'Accès initial', description: 'Techniques d\'intrusion (phishing, exploitation)', isCompleted: false, isRequired: true },
                    { id: 'tlpt-3-3', title: 'Mouvement latéral', description: 'Progression dans le réseau', isCompleted: false, isRequired: true },
                    { id: 'tlpt-3-4', title: 'Atteinte des objectifs', description: 'Exfiltration, persistence, impact simulé', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Journal d\'attaque', 'Preuves (flags)', 'Rapport technique Red Team']
            },
            {
                id: 'tlpt-4',
                name: 'Phase 4: Purple Team & Remediation',
                description: 'Collaboration défense-attaque et remédiation',
                order: 4,
                tasks: [
                    { id: 'tlpt-4-1', title: 'Session Purple Team', description: 'Partage technique Red Team / Blue Team', isCompleted: false, isRequired: true },
                    { id: 'tlpt-4-2', title: 'Analyser les détections', description: 'Efficacité du SOC et des outils', isCompleted: false, isRequired: true },
                    { id: 'tlpt-4-3', title: 'Définir les remédiations', description: 'Actions correctives prioritaires', isCompleted: false, isRequired: true },
                    { id: 'tlpt-4-4', title: 'Planifier le retest', description: 'Vérification des corrections', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Rapport Purple Team', 'Plan de remédiation', 'Planning retest']
            },
            {
                id: 'tlpt-5',
                name: 'Phase 5: Reporting & Conformité',
                description: 'Documenter et rapporter aux autorités',
                order: 5,
                tasks: [
                    { id: 'tlpt-5-1', title: 'Rédiger le rapport TLPT', description: 'Synthèse conforme aux exigences DORA', isCompleted: false, isRequired: true },
                    { id: 'tlpt-5-2', title: 'Valider avec la direction', description: 'Approbation du rapport final', isCompleted: false, isRequired: true },
                    { id: 'tlpt-5-3', title: 'Soumettre au régulateur', description: 'Transmission dans les délais requis', isCompleted: false, isRequired: true },
                    { id: 'tlpt-5-4', title: 'Archiver les preuves', description: 'Conservation sécurisée des documents', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Rapport TLPT final', 'Attestation de conformité', 'Archives sécurisées']
            },
        ],
        bestPractices: [
            'Utiliser des prestataires certifiés TIBER-EU ou équivalent',
            'Maintenir la confidentialité (White Team restreinte)',
            'Tester les fonctions critiques identifiées dans le BIA',
            'Intégrer les leçons apprises dans la roadmap sécurité',
            'Respecter les délais réglementaires de reporting'
        ],
        deliverables: [
            'Rapport Threat Intelligence',
            'Rapport Red Team',
            'Rapport TLPT final (conforme DORA)',
            'Plan de remédiation'
        ],
        isDefault: true
    },
    // Crisis Management (ISO 22361)
    {
        id: 'crisis-iso-22361',
        name: 'Gestion de Crise',
        module: 'crisis',
        framework: 'ISO 22361',
        description: 'Mise en place du dispositif de gestion de crise pour coordonner la réponse aux événements majeurs.',
        estimatedDuration: '4-6 semaines',
        phases: [
            {
                id: 'crisis-1',
                name: 'Phase 1: Organisation de Crise',
                description: 'Définir la structure de gouvernance de crise',
                order: 1,
                tasks: [
                    { id: 'crisis-1-1', title: 'Définir la cellule de crise', description: 'Composition, rôles, responsabilités', isCompleted: false, isRequired: true },
                    { id: 'crisis-1-2', title: 'Établir les critères d\'activation', description: 'Quand déclencher la cellule de crise', isCompleted: false, isRequired: true },
                    { id: 'crisis-1-3', title: 'Définir les niveaux de crise', description: 'Escalade progressive (alerte, crise, catastrophe)', isCompleted: false, isRequired: true },
                    { id: 'crisis-1-4', title: 'Identifier les War Rooms', description: 'Lieux physiques et virtuels de pilotage', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Charte de crise', 'Organigramme de crise', 'Critères d\'activation']
            },
            {
                id: 'crisis-2',
                name: 'Phase 2: Communication de Crise',
                description: 'Préparer la stratégie de communication',
                order: 2,
                tasks: [
                    { id: 'crisis-2-1', title: 'Définir les parties prenantes', description: 'Internes, externes, médias, régulateurs', isCompleted: false, isRequired: true },
                    { id: 'crisis-2-2', title: 'Préparer les messages clés', description: 'Templates de communication par scénario', isCompleted: false, isRequired: true },
                    { id: 'crisis-2-3', title: 'Établir les canaux de communication', description: 'Outils, backup, procédures dégradées', isCompleted: false, isRequired: true },
                    { id: 'crisis-2-4', title: 'Former les porte-parole', description: 'Media training, Q&A', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Plan de communication de crise', 'Templates de messages', 'Liste des porte-parole']
            },
            {
                id: 'crisis-3',
                name: 'Phase 3: Processus de Décision',
                description: 'Définir les processus de prise de décision en crise',
                order: 3,
                tasks: [
                    { id: 'crisis-3-1', title: 'Définir le processus de décision', description: 'Qui décide quoi, délégations', isCompleted: false, isRequired: true },
                    { id: 'crisis-3-2', title: 'Créer les fiches réflexes', description: 'Actions immédiates par type de crise', isCompleted: false, isRequired: true },
                    { id: 'crisis-3-3', title: 'Établir le journal de crise', description: 'Traçabilité des décisions et actions', isCompleted: false, isRequired: true },
                    { id: 'crisis-3-4', title: 'Définir les critères de sortie de crise', description: 'Conditions de désactivation', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Processus de décision', 'Fiches réflexes', 'Template journal de crise']
            },
            {
                id: 'crisis-4',
                name: 'Phase 4: Ressources & Logistique',
                description: 'Préparer les moyens de gestion de crise',
                order: 4,
                tasks: [
                    { id: 'crisis-4-1', title: 'Équiper les salles de crise', description: 'Matériel, connectivité, affichage', isCompleted: false, isRequired: true },
                    { id: 'crisis-4-2', title: 'Préparer les kits de crise', description: 'Documentation, contacts, outils', isCompleted: false, isRequired: true },
                    { id: 'crisis-4-3', title: 'Mettre en place les astreintes', description: 'Planning, escalade, moyens de contact', isCompleted: false, isRequired: true },
                    { id: 'crisis-4-4', title: 'Sécuriser les outils de crise', description: 'Redondance, accès dégradé', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Inventaire salles de crise', 'Kits de crise', 'Planning d\'astreinte']
            },
            {
                id: 'crisis-5',
                name: 'Phase 5: Formation & Exercices',
                description: 'Entraîner les équipes à la gestion de crise',
                order: 5,
                tasks: [
                    { id: 'crisis-5-1', title: 'Former la cellule de crise', description: 'Formation aux rôles et processus', isCompleted: false, isRequired: true },
                    { id: 'crisis-5-2', title: 'Réaliser des exercices de crise', description: 'Simulations de scénarios', isCompleted: false, isRequired: true },
                    { id: 'crisis-5-3', title: 'Tester la communication', description: 'Call tree, notifications, médias', isCompleted: false, isRequired: true },
                    { id: 'crisis-5-4', title: 'Capitaliser les retours', description: 'Amélioration continue du dispositif', isCompleted: false, isRequired: true },
                ],
                deliverables: ['Plan de formation', 'Rapports d\'exercices', 'Plan d\'amélioration']
            },
        ],
        bestPractices: [
            'Impliquer la direction générale dans les exercices',
            'Préparer des scénarios variés (cyber, naturel, sanitaire)',
            'Tester régulièrement les communications de crise',
            'Maintenir à jour les contacts et procédures',
            'Documenter et capitaliser sur chaque crise réelle'
        ],
        deliverables: [
            'Plan de Gestion de Crise',
            'Fiches réflexes',
            'Plan de communication de crise',
            'Programme de formation et d\'exercices'
        ],
        isDefault: true
    },
];

export const ContinuityMethodsWorkshops: React.FC<ContinuityMethodsWorkshopsProps> = ({
    onStartWorkshop,
}) => {
    const [selectedTemplate, setSelectedTemplate] = useState<ContinuityMethodTemplate | null>(null);
    const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
    const [activeWorkshop, setActiveWorkshop] = useState<{
        templateId: string;
        phases: ContinuityWorkshopPhase[];
        progress: number;
    } | null>(null);

    // Calculate progress for active workshop
    const workshopProgress = useMemo(() => {
        if (!activeWorkshop) return 0;
        const allTasks = activeWorkshop.phases.flatMap(p => p.tasks);
        const completedTasks = allTasks.filter(t => t.isCompleted).length;
        return Math.round((completedTasks / allTasks.length) * 100);
    }, [activeWorkshop]);

    const handleStartWorkshop = (template: ContinuityMethodTemplate) => {
        const phases: ContinuityWorkshopPhase[] = template.phases.map(p => ({
            ...p,
            status: 'not_started' as const,
            tasks: p.tasks.map(t => ({ ...t, isCompleted: false })),
        }));

        setActiveWorkshop({
            templateId: template.id,
            phases,
            progress: 0,
        });

        if (onStartWorkshop) {
            onStartWorkshop(template.id);
        }
    };

    const handleToggleTask = (phaseId: string, taskId: string) => {
        if (!activeWorkshop) return;

        setActiveWorkshop(prev => {
            if (!prev) return prev;

            const updatedPhases = prev.phases.map(phase => {
                if (phase.id !== phaseId) return phase;

                const updatedTasks = phase.tasks.map(task =>
                    task.id === taskId ? { ...task, isCompleted: !task.isCompleted } : task
                );

                const allCompleted = updatedTasks.filter(t => t.isRequired).every(t => t.isCompleted);
                const anyStarted = updatedTasks.some(t => t.isCompleted);

                return {
                    ...phase,
                    tasks: updatedTasks,
                    status: allCompleted ? 'completed' : anyStarted ? 'in_progress' : 'not_started',
                    completedAt: allCompleted ? new Date().toISOString() : undefined,
                } as ContinuityWorkshopPhase;
            });

            return { ...prev, phases: updatedPhases };
        });
    };

    const handleResetWorkshop = () => {
        setActiveWorkshop(null);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-indigo-500" />
                        Méthodes & Ateliers de Continuité
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-muted-foreground mt-1">
                        Méthodologies structurées pour vos projets de continuité d'activité
                    </p>
                </div>
                {activeWorkshop && (
                    <Button variant="outline" size="sm" onClick={handleResetWorkshop} className="gap-2">
                        <RotateCcw className="w-4 h-4" />
                        Réinitialiser l'atelier
                    </Button>
                )}
            </div>

            {/* Method Templates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {CONTINUITY_METHOD_TEMPLATES.map((template) => {
                    const config = MODULE_CONFIG[template.module];
                    const Icon = config.icon;
                    const isActive = activeWorkshop?.templateId === template.id;
                    const isSelected = selectedTemplate?.id === template.id;

                    return (
                        <motion.div
                            key={template.id || 'unknown'}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                        >
                            <PremiumCard glass
                                className={cn(
                                    "p-5 cursor-pointer transition-all border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                                    isSelected ? "ring-2 ring-indigo-500 border-indigo-300 dark:border-indigo-700" : "border-transparent",
                                    isActive && "bg-green-500 dark:bg-green-50 dark:bg-green-900 border-green-300 dark:border-green-700 dark:border-green-700",
                                    config.bgColor,
                                    config.borderColor
                                )}
                                onClick={() => setSelectedTemplate(template)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setSelectedTemplate(template);
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className={cn("p-3 rounded-3xl text-white", config.color)}>
                                        {React.createElement(Icon, { className: "w-6 h-6" })}
                                    </div>
                                    {isActive && (
                                        <Badge status="success" size="sm">En cours</Badge>
                                    )}
                                </div>

                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                                    {template.name}
                                </h3>

                                <div className="flex items-center gap-2 mb-3 flex-wrap">
                                    <Badge variant="outline" size="sm">{config.labelFr}</Badge>
                                    {template.framework && (
                                        <Badge variant="outline" size="sm">{template.framework}</Badge>
                                    )}
                                </div>

                                <p className="text-sm text-slate-600 dark:text-muted-foreground mb-4 line-clamp-2">
                                    {template.description}
                                </p>

                                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        {template.estimatedDuration}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <ClipboardList className="w-3.5 h-3.5" />
                                        {template.phases.length} phases
                                    </span>
                                </div>

                                {isActive && (
                                    <div className="mt-4 pt-4 border-t border-border/40 dark:border-slate-700">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-medium text-slate-600 dark:text-muted-foreground">Progression</span>
                                            <span className="text-xs font-bold text-slate-900 dark:text-white">{workshopProgress}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-green-500 rounded-full transition-all"
                                                style={{ width: `${workshopProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </PremiumCard>
                        </motion.div>
                    );
                })}
            </div>

            {/* Selected Template Detail */}
            <AnimatePresence mode="popLayout">
                {selectedTemplate && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-6"
                    >
                        {/* Template Overview */}
                        <PremiumCard glass className="p-6">
                            <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={cn("p-4 rounded-2xl text-white", MODULE_CONFIG[selectedTemplate.module].color)}>
                                        {React.createElement(MODULE_CONFIG[selectedTemplate.module].icon, { className: "w-6 h-6" })}
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                                            {selectedTemplate.name}
                                        </h3>
                                        <p className="text-slate-500 dark:text-muted-foreground mt-1">{selectedTemplate.description}</p>
                                    </div>
                                </div>
                                {!activeWorkshop || activeWorkshop.templateId !== selectedTemplate.id ? (
                                    <Button
                                        onClick={() => handleStartWorkshop(selectedTemplate)}
                                        className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600"
                                    >
                                        <Play className="w-4 h-4" />
                                        Démarrer l'atelier
                                    </Button>
                                ) : (
                                    <Badge status="success" className="text-sm px-4 py-2">
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Atelier en cours
                                    </Badge>
                                )}
                            </div>

                            {/* Best Practices & Deliverables */}
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="p-4 rounded-3xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800">
                                    <h4 className="flex items-center gap-2 text-sm font-bold text-indigo-700 dark:text-indigo-400 mb-3">
                                        <Lightbulb className="w-4 h-4" />
                                        Bonnes pratiques
                                    </h4>
                                    <ul className="space-y-2">
                                        {selectedTemplate.bestPractices.map((practice, i) => (
                                            <li key={i || 'unknown'} className="flex items-start gap-2 text-sm text-slate-600 dark:text-muted-foreground">
                                                <CheckCircle className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                                                {practice}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="p-4 rounded-3xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
                                    <h4 className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-3">
                                        <FileText className="w-4 h-4" />
                                        Livrables attendus
                                    </h4>
                                    <ul className="space-y-2">
                                        {selectedTemplate.deliverables.map((deliverable, i) => (
                                            <li key={i || 'unknown'} className="flex items-start gap-2 text-sm text-slate-600 dark:text-muted-foreground">
                                                <FileCheck className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                                {deliverable}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </PremiumCard>

                        {/* Phases Accordion */}
                        <div className="space-y-3">
                            <h4 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Target className="w-5 h-5 text-indigo-500" />
                                Phases de l'atelier
                            </h4>

                            {(activeWorkshop?.templateId === selectedTemplate.id
                                ? activeWorkshop.phases
                                : selectedTemplate.phases
                            ).map((phase, index) => {
                                const isExpanded = expandedPhase === phase.id;
                                const phaseStatus = 'status' in phase ? phase.status : 'not_started';
                                const completedTasks = phase.tasks.filter(t => t.isCompleted).length;
                                const totalTasks = phase.tasks.length;
                                const phaseProgress = Math.round((completedTasks / totalTasks) * 100);

                                return (
                                    <PremiumCard glass key={phase.id || 'unknown'} className="overflow-hidden">
                                        <button
                                            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                            onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold",
                                                    phaseStatus === 'completed' ? "bg-green-100 text-green-600 dark:text-green-400 dark:bg-green-900/30 dark:text-green-400" :
                                                        phaseStatus === 'in_progress' ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" :
                                                            "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                                )}>
                                                    {phaseStatus === 'completed' ? <CheckCircle className="w-4 h-4" /> : index + 1}
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-medium text-slate-900 dark:text-white">{phase.name}</div>
                                                    <div className="text-xs text-slate-500 dark:text-muted-foreground">
                                                        {completedTasks}/{totalTasks} tâches • {phaseProgress}%
                                                    </div>
                                                </div>
                                            </div>
                                            <ChevronRight className={cn(
                                                "w-5 h-5 text-slate-400 transition-transform",
                                                isExpanded && "rotate-90"
                                            )} />
                                        </button>

                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    <div className="px-4 pb-4 border-t border-border/40 dark:border-slate-700 pt-4">
                                                        <p className="text-sm text-slate-600 dark:text-muted-foreground mb-4">{phase.description}</p>

                                                        {/* Tasks */}
                                                        <div className="space-y-2 mb-4">
                                                            {phase.tasks.map(task => {
                                                                const isWorkshopActive = activeWorkshop?.templateId === selectedTemplate.id;
                                                                return (
                                                                    <div
                                                                        key={task.id || 'unknown'}
                                                                        className={cn(
                                                                            "flex items-start gap-3 p-3 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                                                                            isWorkshopActive ? "hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" : "opacity-70",
                                                                            task.isCompleted && "bg-green-50 dark:bg-green-50 dark:bg-green-900"
                                                                        )}
                                                                        onClick={() => isWorkshopActive && handleToggleTask(phase.id, task.id)}
                                                                        onKeyDown={(e) => {
                                                                            if (isWorkshopActive && (e.key === 'Enter' || e.key === ' ')) {
                                                                                e.preventDefault();
                                                                                handleToggleTask(phase.id, task.id);
                                                                            }
                                                                        }}
                                                                        role="button"
                                                                        tabIndex={0}
                                                                        aria-label={`Toggle task: ${task.title}`}
                                                                    >
                                                                        {task.isCompleted ? (
                                                                            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                                                                        ) : (
                                                                            <Circle className="w-5 h-5 text-slate-300 dark:text-slate-300 mt-0.5 flex-shrink-0" />
                                                                        )}
                                                                        <div className="flex-1">
                                                                            <div className={cn(
                                                                                "text-sm font-medium",
                                                                                task.isCompleted ? "text-slate-500 line-through" : "text-slate-900 dark:text-white"
                                                                            )}>
                                                                                {task.title}
                                                                                {task.isRequired && <span className="text-red-500 ml-1">*</span>}
                                                                            </div>
                                                                            <div className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5">{task.description}</div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Phase Deliverables */}
                                                        {phase.deliverables && phase.deliverables.length > 0 && (
                                                            <div className="pt-4 border-t border-border/40 dark:border-slate-700">
                                                                <div className="text-xs font-medium text-slate-500 dark:text-muted-foreground mb-2">
                                                                    Livrables de cette phase:
                                                                </div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {phase.deliverables.map((deliverable, i) => (
                                                                        <Badge key={i || 'unknown'} variant="outline" size="sm">
                                                                            {deliverable}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </PremiumCard>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Empty State when no template selected */}
            {!selectedTemplate && (
                <PremiumCard glass className="p-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
                        <BookOpen className="w-8 h-8 text-indigo-500" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                        Sélectionnez une méthodologie
                    </h3>
                    <p className="text-slate-500 dark:text-slate-300 text-sm max-w-md mx-auto">
                        Choisissez une méthode ci-dessus pour voir les détails et démarrer un atelier guidé.
                    </p>
                </PremiumCard>
            )}
        </div>
    );
};

export default ContinuityMethodsWorkshops;
