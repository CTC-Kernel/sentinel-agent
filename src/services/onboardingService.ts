import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useStore } from '../store';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Service pour gérer le tour guidé interactif via driver.js
 * "Masterpiece" Edition
 */
export class OnboardingService {
    private static driverInstance = driver({
        showProgress: true,
        animate: true,
        allowClose: true,
        doneBtnText: 'C\'est parti !',
        nextBtnText: 'Suivant',
        prevBtnText: 'Précédent',
        progressText: 'Étape {{current}} sur {{total}}',
        popoverClass: 'driverjs-theme-masterpiece', // Custom class for styling in index.css
        onDestroyed: () => {
            // Callback when tour ends or is skipped
            const { user, setUser } = useStore.getState();
            if (user && !user.onboardingCompleted) {
                // Local persistence
                localStorage.setItem('onboarding-completed', 'true');

                // Optimistic State Update
                setUser({ ...user, onboardingCompleted: true });

                // Firestore Persistence
                if (user.uid) {
                    updateDoc(doc(db, 'users', user.uid), {
                        onboardingCompleted: true
                    }).catch(console.error);
                }
            }
        }
    });

    /**
     * Initialise et démarre le tour guidé principal
     */
    static startMainTour() {
        const steps: DriveStep[] = [
            {
                element: '[data-tour="dashboard"]',
                popover: {
                    title: '👋 Bienvenue sur Sentinel GRC',
                    description: 'Votre plateforme complète de gestion des risques et de la conformité ISO 27001. Commençons par un tour rapide!',
                    side: 'bottom',
                    align: 'center'
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
                element: '[data-tour="command-palette"]', // Needs to be visible
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
                    description: 'Basculez entre le mode clair et sombre selon vos préférences.',
                    side: 'bottom',
                    align: 'end'
                }
            }
        ];

        this.driverInstance.setConfig({
            ...this.driverInstance.getConfig(),
            steps: steps
        });

        this.driverInstance.drive();
    }

    /**
     * Tour guidé pour le module Risques
     */
    static startRisksTour() {
        const steps: DriveStep[] = [
            {
                element: '[data-tour="risks-create"]',
                popover: {
                    title: '➕ Créer un Risque',
                    description: 'Identifiez et enregistrez les menaces et vulnérabilités de votre organisation.',
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '[data-tour="risks-matrix"]',
                popover: {
                    title: '📊 Matrice des Risques',
                    description: 'Visualisez vos risques selon leur probabilité et impact (méthode ISO 27005).',
                    side: 'left',
                    align: 'start'
                }
            },
            {
                element: '[data-tour="risks-filters"]',
                popover: {
                    title: '🔍 Filtres',
                    description: 'Filtrez les risques par statut, score, ou responsable pour une vue ciblée.',
                    side: 'bottom',
                    align: 'start'
                }
            }
        ];

        this.driverInstance.setSteps(steps);
        this.driverInstance.drive();
    }

    /**
     * Tour guidé pour le module Conformité
     */
    static startComplianceTour() {
        const steps: DriveStep[] = [
            {
                element: '[data-tour="compliance-scorecard"]',
                popover: {
                    title: '📈 Scorecard de Conformité',
                    description: 'Suivez votre progression vers la conformité ISO 27001 en temps réel.',
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '[data-tour="compliance-controls"]',
                popover: {
                    title: '✅ Contrôles ISO 27001',
                    description: 'Gérez les 93 contrôles de l\'Annexe A et documentez leur mise en œuvre.',
                    side: 'left',
                    align: 'start'
                }
            },
            {
                element: '[data-tour="compliance-soa"]',
                popover: {
                    title: '📄 Statement of Applicability',
                    description: 'Générez automatiquement votre SoA pour les audits de certification.',
                    side: 'bottom',
                    align: 'start'
                }
            }
        ];

        this.driverInstance.setSteps(steps);
        this.driverInstance.drive();
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
        this.driverInstance.highlight({
            element: selector,
            popover: {
                title: '💡 Astuce',
                description: message,
                side: 'bottom',
                align: 'center'
            }
        });
    }

    /**
     * Tour guidé pour le module Analytics
     */
    static startAnalyticsTour() {
        const steps: DriveStep[] = [
            {
                element: '[data-tour="analytics-trends"]',
                popover: {
                    title: '📈 Tendances Historiques',
                    description: 'Analysez l\'évolution de vos risques et de votre conformité sur les 30 derniers jours.',
                    side: 'bottom',
                    align: 'center'
                }
            },
            {
                element: '[data-tour="analytics-kpi"]',
                popover: {
                    title: '🎯 KPIs Clés',
                    description: 'Suivez les indicateurs de performance essentiels pour votre gouvernance.',
                    side: 'bottom',
                    align: 'center'
                }
            }
        ];
        this.driverInstance.setSteps(steps);
        this.driverInstance.drive();
    }

    /**
     * Tour guidé pour le module Incidents
     */
    static startIncidentsTour() {
        const steps: DriveStep[] = [
            {
                element: '[data-tour="incidents-timeline"]',
                popover: {
                    title: '⏱️ Timeline Visuelle',
                    description: 'Suivez le cycle de vie de chaque incident étape par étape.',
                    side: 'left',
                    align: 'center'
                }
            },
            {
                element: '[data-tour="incidents-playbook"]',
                popover: {
                    title: '📖 Playbooks',
                    description: 'Accédez aux procédures de réponse standardisées pour chaque type d\'incident.',
                    side: 'bottom',
                    align: 'center'
                }
            }
        ];
        this.driverInstance.setSteps(steps);
        this.driverInstance.drive();
    }

    /**
     * Tour guidé pour le module Backup
     */
    static startBackupTour() {
        const steps: DriveStep[] = [
            {
                element: '[data-tour="backup-schedule"]',
                popover: {
                    title: '📅 Planification',
                    description: 'Configurez des sauvegardes automatiques quotidiennes, hebdomadaires ou mensuelles.',
                    side: 'bottom',
                    align: 'center'
                }
            },
            {
                element: '[data-tour="backup-restore"]',
                popover: {
                    title: '↺ Restauration',
                    description: 'Restaurez vos données à partir d\'un point de sauvegarde précédent en un clic.',
                    side: 'top',
                    align: 'center'
                }
            }
        ];
        this.driverInstance.setSteps(steps);
        this.driverInstance.drive();
    }
}
