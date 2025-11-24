import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

/**
 * Service pour gérer le tour guidé interactif
 */
export class OnboardingService {
    private static driverInstance: ReturnType<typeof driver> | null = null;

    /**
     * Initialise et démarre le tour guidé principal
     */
    static startMainTour() {
        const driverObj = driver({
            showProgress: true,
            showButtons: ['next', 'previous', 'close'],
            steps: [
                {
                    element: '[data-tour="dashboard"]',
                    popover: {
                        title: '👋 Bienvenue sur Sentinel GRC',
                        description: 'Votre plateforme complète de gestion des risques et de la conformité ISO 27001. Commençons par un tour rapide!',
                        side: 'bottom',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="sidebar"]',
                    popover: {
                        title: '📋 Navigation Principale',
                        description: 'Accédez rapidement à tous les modules: Risques, Actifs, Conformité, Audits, et plus encore.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="command-palette"]',
                    popover: {
                        title: '⚡ Palette de Commandes',
                        description: 'Appuyez sur Cmd/Ctrl + K pour ouvrir la palette de commandes et naviguer ultra-rapidement!',
                        side: 'bottom',
                        align: 'center'
                    }
                },
                {
                    element: '[data-tour="notifications"]',
                    popover: {
                        title: '🔔 Notifications',
                        description: 'Restez informé des incidents critiques, audits imminents et alertes importantes.',
                        side: 'bottom',
                        align: 'end'
                    }
                },
                {
                    element: '[data-tour="theme-toggle"]',
                    popover: {
                        title: '🌓 Thème',
                        description: 'Basculez entre le mode clair et sombre selon vos préférences. Raccourci: Cmd/Ctrl + Shift + T',
                        side: 'bottom',
                        align: 'end'
                    }
                },
                {
                    popover: {
                        title: '✅ Tour Terminé!',
                        description: 'Vous êtes prêt à utiliser Sentinel GRC. Consultez le Centre d\'aide (Cmd/Ctrl + Shift + H) pour plus d\'informations.',
                        side: 'top',
                        align: 'center'
                    }
                }
            ],
            onDestroyStarted: () => {
                if (driverObj.hasNextStep()) {
                    const confirmed = window.confirm('Voulez-vous vraiment quitter le tour guidé?');
                    if (!confirmed) {
                        return;
                    }
                }
                driverObj.destroy();
                localStorage.setItem('onboarding-completed', 'true');
            }
        });

        this.driverInstance = driverObj;
        driverObj.drive();
    }

    /**
     * Tour guidé pour le module Risques
     */
    static startRisksTour() {
        const driverObj = driver({
            showProgress: true,
            steps: [
                {
                    element: '[data-tour="risks-create"]',
                    popover: {
                        title: '➕ Créer un Risque',
                        description: 'Identifiez et enregistrez les menaces et vulnérabilités de votre organisation.',
                        side: 'bottom'
                    }
                },
                {
                    element: '[data-tour="risks-matrix"]',
                    popover: {
                        title: '📊 Matrice des Risques',
                        description: 'Visualisez vos risques selon leur probabilité et impact (méthode ISO 27005).',
                        side: 'left'
                    }
                },
                {
                    element: '[data-tour="risks-filters"]',
                    popover: {
                        title: '🔍 Filtres',
                        description: 'Filtrez les risques par statut, score, ou responsable pour une vue ciblée.',
                        side: 'bottom'
                    }
                }
            ]
        });

        driverObj.drive();
    }

    /**
     * Tour guidé pour le module Conformité
     */
    static startComplianceTour() {
        const driverObj = driver({
            showProgress: true,
            steps: [
                {
                    element: '[data-tour="compliance-scorecard"]',
                    popover: {
                        title: '📈 Scorecard de Conformité',
                        description: 'Suivez votre progression vers la conformité ISO 27001 en temps réel.',
                        side: 'bottom'
                    }
                },
                {
                    element: '[data-tour="compliance-controls"]',
                    popover: {
                        title: '✅ Contrôles ISO 27001',
                        description: 'Gérez les 93 contrôles de l\'Annexe A et documentez leur mise en œuvre.',
                        side: 'left'
                    }
                },
                {
                    element: '[data-tour="compliance-soa"]',
                    popover: {
                        title: '📄 Statement of Applicability',
                        description: 'Générez automatiquement votre SoA pour les audits de certification.',
                        side: 'bottom'
                    }
                }
            ]
        });

        driverObj.drive();
    }

    /**
     * Tour guidé pour les raccourcis clavier
     */
    static startShortcutsTour() {
        const driverObj = driver({
            showProgress: false,
            steps: [
                {
                    popover: {
                        title: '⌨️ Raccourcis Clavier',
                        description: `
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span>Palette de commandes</span>
                  <kbd class="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs">Cmd/Ctrl + K</kbd>
                </div>
                <div class="flex justify-between">
                  <span>Navigation rapide (1-9)</span>
                  <kbd class="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs">Cmd/Ctrl + 1-9</kbd>
                </div>
                <div class="flex justify-between">
                  <span>Changer le thème</span>
                  <kbd class="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs">Cmd/Ctrl + Shift + T</kbd>
                </div>
                <div class="flex justify-between">
                  <span>Recherche globale</span>
                  <kbd class="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs">Cmd/Ctrl + /</kbd>
                </div>
                <div class="flex justify-between">
                  <span>Aide</span>
                  <kbd class="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs">Cmd/Ctrl + Shift + H</kbd>
                </div>
              </div>
            `,
                        side: 'top'
                    }
                }
            ]
        });

        driverObj.drive();
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
        const driverObj = driver({
            showProgress: false,
            steps: [
                {
                    element: selector,
                    popover: {
                        title: '💡 Astuce',
                        description: message,
                        side: 'bottom'
                    }
                }
            ]
        });

        driverObj.drive();
    }
}
