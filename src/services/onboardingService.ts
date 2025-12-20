import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useStore } from '../store';
import { doc, updateDoc, collection, query, where, getDocs, addDoc, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { sanitizeData } from '../utils/dataSanitizer';
import { UserProfile, PlanType } from '../types';
import { getRoleName, Role } from '../utils/permissions';
import { sendEmail } from '../services/emailService';
import { getInvitationTemplate } from '../services/emailTemplates';
import { SubscriptionService } from '../services/subscriptionService';
import { analyticsService } from '../services/analyticsService';

export interface SearchResult {
    id: string;
    name: string;
    industry?: string;
}

/**
 * Service pour gérer le tour guidé interactif via driver.js
 * ET la logique métier de l'onboarding (création org, invites, assets)
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

    // --- Business Logic Methods ---

    /**
     * Crée une nouvelle organisation via Cloud Function
     */
    static async createOrganization(data: {
        organizationName: string;
        displayName: string;
        department: string;
        role: string;
        industry: string;
    }): Promise<{ organizationId: string }> {
        const createOrganizationFn = httpsCallable(functions, 'createOrganization');
        const result = await createOrganizationFn(data);
        return result.data as { organizationId: string };
    }

    /**
     * Recherche des organisations par nom (case-insensitive via double query)
     */
    static async searchOrganizations(searchQuery: string): Promise<SearchResult[]> {
        if (!searchQuery.trim()) return [];

        const capitalizedQuery = searchQuery.charAt(0).toUpperCase() + searchQuery.slice(1);

        const q1 = query(
            collection(db, 'organizations'),
            where('name', '>=', searchQuery),
            where('name', '<=', searchQuery + '\uf8ff')
        );

        const promises = [getDocs(q1)];
        if (searchQuery !== capitalizedQuery) {
            promises.push(
                getDocs(query(
                    collection(db, 'organizations'),
                    where('name', '>=', capitalizedQuery),
                    where('name', '<=', capitalizedQuery + '\uf8ff')
                ))
            );
        }

        const snapshots = await Promise.all(promises);
        const allDocs = snapshots.flatMap(snap => snap.docs);

        // Deduplicate by ID
        const uniqueDocs = Array.from(new Map(allDocs.map(item => [item.id, item])).values());

        return uniqueDocs.map(d => ({ id: d.id, ...d.data() } as SearchResult));
    }

    /**
     * Envoie une demande pour rejoindre une organisation
     */
    static async sendJoinRequest(user: UserProfile, orgId: string, orgName: string, displayName?: string): Promise<void> {
        await addDoc(collection(db, 'join_requests'), sanitizeData({
            userId: user.uid,
            userEmail: user.email,
            displayName: displayName || user.displayName || user.email,
            organizationId: orgId,
            organizationName: orgName,
            status: 'pending',
            createdAt: new Date().toISOString()
        }));
    }

    /**
     * Met à jour les étapes de configuration de l'organisation (Step 3)
     */
    static async updateOrganizationConfiguration(orgId: string, standards: string[], scope: string): Promise<void> {
        await updateDoc(doc(db, 'organizations', orgId), sanitizeData({
            standards,
            scope,
            onboardingStep: 3
        }));
    }

    /**
     * Envoie des invitations aux collaborateurs (Step 4)
     */
    static async sendInvites(user: UserProfile, invites: { email: string; role: string }[]): Promise<void> {
        if (!user.organizationId || invites.length === 0) return;

        const batch = writeBatch(db);
        const invitePromises: Promise<void>[] = [];

        for (const invite of invites) {
            const invitationRef = doc(collection(db, 'invitations'));
            batch.set(invitationRef, sanitizeData({
                email: invite.email,
                organizationId: user.organizationId,
                organizationName: user.organizationName || '',
                role: invite.role,
                invitedBy: user.uid,
                createdAt: new Date().toISOString(),
                status: 'pending'
            }));

            // Email sending logic detached from batch to not block Firestore write
            const sendInviteEmail = async () => {
                try {
                    const inviteLink = `${window.location.origin}/login?email=${encodeURIComponent(invite.email)}`;
                    const htmlContent = getInvitationTemplate(
                        user.displayName || user.email || 'Un administrateur',
                        getRoleName(invite.role as Role) || 'Collaborateur',
                        inviteLink
                    );

                    const invitedUserContext = {
                        uid: invitationRef.id,
                        email: invite.email,
                        displayName: 'Invité',
                        organizationId: user.organizationId
                    } as UserProfile;

                    await sendEmail(invitedUserContext, {
                        to: invite.email,
                        subject: `Invitation à rejoindre ${user.organizationName || 'Sentinel GRC'}`,
                        html: htmlContent,
                        type: 'INVITATION'
                    }, false);
                } catch (error) {
                    console.error('Failed to send invite email to ' + invite.email, error);
                }
            };
            invitePromises.push(sendInviteEmail());
        }

        await batch.commit();
        await Promise.all(invitePromises);
    }

    /**
     * Crée les actifs initiaux (Step 5)
     */
    static async createInitialAssets(user: UserProfile, assets: { name: string, type: string }[]): Promise<void> {
        if (!user.organizationId || assets.length === 0) return;

        const batch = writeBatch(db);
        assets.forEach(asset => {
            const ref = doc(collection(db, 'assets'));
            batch.set(ref, sanitizeData({
                name: asset.name,
                type: asset.type,
                organizationId: user.organizationId,
                createdAt: new Date().toISOString(),
                lifecycleStatus: 'En service',
                confidentiality: 'Medium',
                integrity: 'Medium',
                availability: 'Medium',
                owner: user.displayName || 'Admin'
            }));
        });
        await batch.commit();
    }

    /**
     * Finalise l'onboarding pour l'utilisateur et gère l'abonnement
     */
    static async finalizeOnboarding(user: UserProfile, plan: PlanType): Promise<void> {
        if (!user.organizationId) throw new Error("Organization ID missing");

        // 1. Mark user as onboarded
        await updateDoc(doc(db, 'users', user.uid), { onboardingCompleted: true });

        // 2. Track event
        analyticsService.logEvent('complete_onboarding', {
            plan: plan,
            organization_id: user.organizationId
        });

        // 3. Handle Subscription if not free
        if (plan !== 'discovery') {
            await SubscriptionService.startSubscription(user.organizationId, plan, 'month');
        }
    }


    // --- Tour Logic Methods ---

    /**
     * Initialise et démarre le tour guidé principal basé sur le rôle
     */
    static startMainTour(role: string = 'user') {
        const steps = this.getStepsForRole(role);

        this.driverInstance.setConfig({
            ...this.driverInstance.getConfig(),
            steps: steps
        });

        this.driverInstance.drive();
    }

    private static getStepsForRole(role: string): DriveStep[] {
        const commonSteps: DriveStep[] = [
            {
                element: '[data-tour="dashboard"]',
                popover: {
                    title: '👋 Bienvenue sur Sentinel GRC',
                    description: 'Votre plateforme de gouvernance. Commençons par un tour rapide!',
                    side: 'bottom',
                    align: 'center'
                }
            },
            {
                element: '[data-tour="sidebar"]',
                popover: {
                    title: '📋 Navigation',
                    description: 'Accédez à vos modules principaux ici.',
                    side: 'right',
                    align: 'start'
                }
            }
        ];

        const adminSteps: DriveStep[] = [
            {
                element: '[data-tour="command-palette"]',
                popover: {
                    title: '⚡ Palette de Commandes',
                    description: 'Cmd/Ctrl + K pour tout trouver instantanément.',
                    side: 'bottom',
                    align: 'center'
                }
            },
            {
                element: '[data-tour="notifications"]',
                popover: {
                    title: '🔔 Centre de Notifications',
                    description: 'Gérez les alertes de sécurité et les échéances.',
                    side: 'bottom',
                    align: 'end'
                }
            },
            {
                element: '[data-tour="settings"]',
                popover: {
                    title: '⚙️ Administration',
                    description: 'Configurez les utilisateurs, les rôles et les intégrations.',
                    side: 'top',
                    align: 'start'
                }
            }
        ];

        const directionSteps: DriveStep[] = [
            {
                element: '[data-tour="dashboard-reports"]',
                popover: {
                    title: '📊 Reporting Exécutif',
                    description: 'Consultez les tableaux de bord décisionnels et exportez les rapports PDF.',
                    side: 'bottom',
                    align: 'center'
                }
            },
            {
                element: '[data-tour="risks-overview"]',
                popover: {
                    title: '🛡️ Vue Macro des Risques',
                    description: 'Surveillez l\'exposition globale et les risques majeurs.',
                    side: 'right',
                    align: 'start'
                }
            }
        ];

        const auditorSteps: DriveStep[] = [
            {
                element: '[data-tour="compliance-nav"]',
                popover: {
                    title: '✓ Conformité',
                    description: 'Accédez au score de conformité et aux déclarations d\'applicabilité (SoA).',
                    side: 'right',
                    align: 'center'
                }
            },
            {
                element: '[data-tour="audits-nav"]',
                popover: {
                    title: '📋 Gestion des Audits',
                    description: 'Planifiez et documentez vos revues d\'audit.',
                    side: 'right',
                    align: 'center'
                }
            }
        ];

        // Combine steps based on role
        if (role === 'admin' || role === 'rssi') {
            return [...commonSteps, ...adminSteps, {
                element: '[data-tour="theme-toggle"]',
                popover: { title: '🌓 Thème', description: 'Mode clair ou sombre.', side: 'bottom', align: 'end' }
            }];
        }

        if (role === 'direction') {
            return [...commonSteps, ...directionSteps];
        }

        if (role === 'auditor') {
            return [...commonSteps, ...auditorSteps];
        }

        // Default / User
        return [...commonSteps, {
            element: '[data-tour="notifications"]',
            popover: { title: '🔔 Alertes', description: 'Vos notifications importantes.', side: 'bottom', align: 'end' }
        }];
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
                element: '[data-tour="risks-stats"]',
                popover: {
                    title: '📊 Vue d\'ensemble',
                    description: 'Visualisez la répartition de vos risques et les indicateurs clés.',
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
     * Tour guidé pour le module Actifs
     */
    static startAssetsTour() {
        const steps: DriveStep[] = [
            {
                element: '[data-tour="assets-add"]',
                popover: {
                    title: '📦 Ajouter un Actif',
                    description: 'Déclarez vos serveurs, applications, ou données sensibles ici.',
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '[data-tour="assets-export"]',
                popover: {
                    title: '📤 Export Données',
                    description: 'Exportez votre inventaire en CSV pour vos rapports ou analyses externes.',
                    side: 'bottom',
                    align: 'center'
                }
            },
            {
                element: '[data-tour="assets-list"]',
                popover: {
                    title: '📋 Inventaire',
                    description: 'Retrouvez la liste complète de vos actifs avec leur criticité (CIA).',
                    side: 'top',
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
