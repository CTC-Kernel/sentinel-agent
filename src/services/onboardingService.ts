import { useOnboardingStore } from '../components/ui/onboarding/useOnboardingStore';
import { TourStep } from '../components/ui/onboarding/types';

/**
 * Service pour gérer le tour guidé interactif
 * utilise le store personnalisé 'Masterpiece'
 */
export class OnboardingService {

    /**
     * Initialise et démarre le tour guidé principal
     */
    static startMainTour() {
        const steps: TourStep[] = [
            {
                id: 'dashboard',
                target: '[data-tour="dashboard"]',
                title: '👋 Bienvenue sur Sentinel GRC',
                description: 'Votre plateforme complète de gestion des risques et de la conformité ISO 27001. Commençons par un tour rapide!',
                position: 'bottom'
            },
            {
                id: 'sidebar',
                target: '[data-tour="sidebar"]',
                title: '📋 Navigation Principale',
                description: 'Accédez rapidement à tous les modules: Risques, Actifs, Conformité, Audits, et plus encore.',
                position: 'right'
            },
            {
                id: 'command-palette',
                target: '[data-tour="command-palette"]',
                title: '⚡ Palette de Commandes',
                description: 'Appuyez sur Cmd/Ctrl + K pour ouvrir la palette de commandes et naviguer ultra-rapidement!',
                position: 'bottom'
            },
            {
                id: 'notifications',
                target: '[data-tour="notifications"]',
                title: '🔔 Notifications',
                description: 'Restez informé des incidents critiques, audits imminents et alertes importantes.',
                position: 'bottom'
            },
            {
                id: 'theme-toggle',
                target: '[data-tour="theme-toggle"]',
                title: '🌓 Thème',
                description: 'Basculez entre le mode clair et sombre selon vos préférences. Raccourci: Cmd/Ctrl + Shift + T',
                position: 'bottom'
            }
        ];

        useOnboardingStore.getState().startTour(steps);
    }

    /**
     * Tour guidé pour le module Risques
     */
    static startRisksTour() {
        const steps: TourStep[] = [
            {
                id: 'risks-create',
                target: '[data-tour="risks-create"]',
                title: '➕ Créer un Risque',
                description: 'Identifiez et enregistrez les menaces et vulnérabilités de votre organisation.',
                position: 'bottom'
            },
            {
                id: 'risks-matrix',
                target: '[data-tour="risks-matrix"]',
                title: '📊 Matrice des Risques',
                description: 'Visualisez vos risques selon leur probabilité et impact (méthode ISO 27005).',
                position: 'left'
            },
            {
                id: 'risks-filters',
                target: '[data-tour="risks-filters"]',
                title: '🔍 Filtres',
                description: 'Filtrez les risques par statut, score, ou responsable pour une vue ciblée.',
                position: 'bottom'
            }
        ];
        useOnboardingStore.getState().startTour(steps);
    }

    /**
     * Tour guidé pour le module Conformité
     */
    static startComplianceTour() {
        const steps: TourStep[] = [
            {
                id: 'compliance-scorecard',
                target: '[data-tour="compliance-scorecard"]',
                title: '📈 Scorecard de Conformité',
                description: 'Suivez votre progression vers la conformité ISO 27001 en temps réel.',
                position: 'bottom'
            },
            {
                id: 'compliance-controls',
                target: '[data-tour="compliance-controls"]',
                title: '✅ Contrôles ISO 27001',
                description: 'Gérez les 93 contrôles de l\'Annexe A et documentez leur mise en œuvre.',
                position: 'left'
            },
            {
                id: 'compliance-soa',
                target: '[data-tour="compliance-soa"]',
                title: '📄 Statement of Applicability',
                description: 'Générez automatiquement votre SoA pour les audits de certification.',
                position: 'bottom'
            }
        ];
        useOnboardingStore.getState().startTour(steps);
    }

    /**
     * Tour guidé pour les raccourcis clavier
     */
    static startShortcutsTour() {
        const event = new CustomEvent('open-shortcuts-help');
        window.dispatchEvent(event);
    }

    /**
     * Vérifie si l'utilisateur a déjà complété l'onboarding
     */
    static hasCompletedOnboarding(): boolean {
        return localStorage.getItem('onboarding-completed') === 'true';
    }

    /**
     * Réinitialise l'onboarding
     */
    static resetOnboarding() {
        localStorage.removeItem('onboarding-completed');
    }

    /**
     * Affiche un highlight sur un élément spécifique
     */
    static highlightElement(selector: string, message: string) {
        useOnboardingStore.getState().startTour([{
            id: 'highlight',
            target: selector,
            title: '💡 Astuce',
            description: message,
            position: 'bottom'
        }]);
    }

    /**
     * Tour guidé pour le module Analytics
     */
    static startAnalyticsTour() {
        const steps: TourStep[] = [
            {
                id: 'analytics-trends',
                target: '[data-tour="analytics-trends"]',
                title: '📈 Tendances Historiques',
                description: 'Analysez l\'évolution de vos risques et de votre conformité sur les 30 derniers jours.',
                position: 'bottom'
            },
            {
                id: 'analytics-kpi',
                target: '[data-tour="analytics-kpi"]',
                title: '🎯 KPIs Clés',
                description: 'Suivez les indicateurs de performance essentiels pour votre gouvernance.',
                position: 'bottom'
            }
        ];
        useOnboardingStore.getState().startTour(steps);
    }

    /**
     * Tour guidé pour le module Incidents
     */
    static startIncidentsTour() {
        const steps: TourStep[] = [
            {
                id: 'incidents-timeline',
                target: '[data-tour="incidents-timeline"]',
                title: '⏱️ Timeline Visuelle',
                description: 'Suivez le cycle de vie de chaque incident étape par étape.',
                position: 'left'
            },
            {
                id: 'incidents-playbook',
                target: '[data-tour="incidents-playbook"]',
                title: '📖 Playbooks',
                description: 'Accédez aux procédures de réponse standardisées pour chaque type d\'incident.',
                position: 'bottom'
            }
        ];
        useOnboardingStore.getState().startTour(steps);
    }

    /**
     * Tour guidé pour le module Backup
     */
    static startBackupTour() {
        const steps: TourStep[] = [
            {
                id: 'backup-schedule',
                target: '[data-tour="backup-schedule"]',
                title: '📅 Planification',
                description: 'Configurez des sauvegardes automatiques quotidiennes, hebdomadaires ou mensuelles.',
                position: 'bottom'
            },
            {
                id: 'backup-restore',
                target: '[data-tour="backup-restore"]',
                title: '↺ Restauration',
                description: 'Restaurez vos données à partir d\'un point de sauvegarde précédent en un clic.',
                position: 'top'
            }
        ];
        useOnboardingStore.getState().startTour(steps);
    }
}
