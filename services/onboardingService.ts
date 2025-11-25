import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

/**
 * Service pour gérer le tour guidé interactif
 */
export class OnboardingService {

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
            onDestroyStarted: async () => {
                if (driverObj.hasNextStep()) {
                    const confirmed = window.confirm('Voulez-vous vraiment quitter le tour guidé?');
                    if (!confirmed) {
                        return;
                    }
                }
                driverObj.destroy();
                localStorage.setItem('onboarding-completed', 'true');

                // Sync to Firestore
                try {
                    const { auth, db } = await import('../firebase');
                    const { doc, updateDoc } = await import('firebase/firestore');
                    const user = auth.currentUser;
                    if (user) {
                        await updateDoc(doc(db, 'users', user.uid), {
                            onboardingCompleted: true
                        });
                    }
                } catch (error) {
                    console.error('Error syncing onboarding status:', error);
                }
            }
        });


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
    /**
     * Tour guidé pour le module Analytics
     */
    static startAnalyticsTour() {
        const driverObj = driver({
            showProgress: true,
            steps: [
                {
                    element: '[data-tour="analytics-trends"]',
                    popover: {
                        title: '📈 Tendances Historiques',
                        description: 'Analysez l\'évolution de vos risques et de votre conformité sur les 30 derniers jours.',
                        side: 'bottom'
                    }
                },
                {
                    element: '[data-tour="analytics-kpi"]',
                    popover: {
                        title: '🎯 KPIs Clés',
                        description: 'Suivez les indicateurs de performance essentiels pour votre gouvernance.',
                        side: 'bottom'
                    }
                }
            ]
        });
        driverObj.drive();
    }

    /**
     * Tour guidé pour le module Incidents
     */
    static startIncidentsTour() {
        const driverObj = driver({
            showProgress: true,
            steps: [
                {
                    element: '[data-tour="incidents-timeline"]',
                    popover: {
                        title: '⏱️ Timeline Visuelle',
                        description: 'Suivez le cycle de vie de chaque incident étape par étape.',
                        side: 'left'
                    }
                },
                {
                    element: '[data-tour="incidents-playbook"]',
                    popover: {
                        title: '📖 Playbooks',
                        description: 'Accédez aux procédures de réponse standardisées pour chaque type d\'incident.',
                        side: 'bottom'
                    }
                }
            ]
        });
        driverObj.drive();
    }

    /**
     * Tour guidé pour le module Backup
     */
    static startBackupTour() {
        const driverObj = driver({
            showProgress: true,
            steps: [
                {
                    element: '[data-tour="backup-schedule"]',
                    popover: {
                        title: '📅 Planification',
                        description: 'Configurez des sauvegardes automatiques quotidiennes, hebdomadaires ou mensuelles.',
                        side: 'bottom'
                    }
                },
                {
                    element: '[data-tour="backup-restore"]',
                    popover: {
                        title: '↺ Restauration',
                        description: 'Restaurez vos données à partir d\'un point de sauvegarde précédent en un clic.',
                        side: 'top'
                    }
                }
            ]
        });
        driverObj.drive();
    }
}
