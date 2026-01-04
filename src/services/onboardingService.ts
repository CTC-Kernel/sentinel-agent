import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

import { doc, updateDoc, collection, query, where, getDocs, addDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { sanitizeData } from '../utils/dataSanitizer';
import { UserProfile, PlanType } from '../types';
import { getRoleName, Role } from '../utils/permissions';
import { sendEmail } from '../services/emailService';
import { getInvitationTemplate } from '../services/emailTemplates';
import { SubscriptionService } from '../services/subscriptionService';
import { analyticsService } from '../services/analyticsService';
import { ErrorLogger } from '../services/errorLogger';
import i18n from '../i18n';

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
        doneBtnText: "C'est parti !", // Will be overridden dynamically
        nextBtnText: "Suivant",
        prevBtnText: "Précédent",
        progressText: "{{current}} sur {{total}}",
        popoverClass: 'driverjs-theme-masterpiece',
        onDestroyed: () => {
            // Callback when tour ends or is skipped
            // Only mark the TOUR as seen locally
            localStorage.setItem('tour-seen', 'true');
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

        try {
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
        } catch (error) {
            ErrorLogger.error(error, 'OnboardingService.searchOrganizations');
            return [];
        }
    }

    /**
     * Envoie une demande pour rejoindre une organisation
     */
    static async sendJoinRequest(user: UserProfile, orgId: string, orgName: string, displayName?: string): Promise<void> {
        try {
            await addDoc(collection(db, 'join_requests'), sanitizeData({
                userId: user.uid,
                userEmail: user.email,
                displayName: displayName || user.displayName || user.email,
                organizationId: orgId,
                organizationName: orgName,
                status: 'pending',
                createdAt: serverTimestamp()
            }));
        } catch (error) {
            ErrorLogger.error(error, 'OnboardingService.sendJoinRequest');
            throw error;
        }
    }

    /**
     * Met à jour les étapes de configuration de l'organisation (Step 3)
     */
    static async updateOrganizationConfiguration(orgId: string, standards: string[], scope: string): Promise<void> {
        try {
            await updateDoc(doc(db, 'organizations', orgId), sanitizeData({
                standards,
                scope,
                onboardingStep: 3
            }));
        } catch (error) {
            ErrorLogger.error(error, 'OnboardingService.updateOrganizationConfiguration');
            throw error;
        }
    }

    /**
     * Envoie des invitations aux collaborateurs (Step 4)
     */
    static async sendInvites(user: UserProfile, invites: { email: string; role: string }[]): Promise<void> {
        if (!user.organizationId || invites.length === 0) return;

        try {
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
                    createdAt: serverTimestamp(),
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
                        ErrorLogger.error(error, 'OnboardingService.sendInvites', { metadata: { email: invite.email } });
                    }
                };
                invitePromises.push(sendInviteEmail());
            }

            await batch.commit();
            await Promise.all(invitePromises);
        } catch (error) {
            ErrorLogger.error(error, 'OnboardingService.sendInvitesBatch');
            throw error;
        }
    }

    /**
     * Crée les actifs initiaux (Step 5)
     */
    static async createInitialAssets(user: UserProfile, assets: { name: string, type: string }[]): Promise<void> {
        if (!user.organizationId || assets.length === 0) return;

        try {
            const batch = writeBatch(db);
            assets.forEach(asset => {
                const ref = doc(collection(db, 'assets'));
                batch.set(ref, sanitizeData({
                    name: asset.name,
                    type: asset.type,
                    organizationId: user.organizationId,
                    createdAt: serverTimestamp(),
                    lifecycleStatus: 'En service',
                    confidentiality: 'Medium',
                    integrity: 'Medium',
                    availability: 'Medium',
                    owner: user.displayName || 'Admin'
                }));
            });
            await batch.commit();
        } catch (error) {
            ErrorLogger.error(error, 'OnboardingService.createInitialAssets');
            throw error;
        }
    }

    /**
     * Finalise l'onboarding pour l'utilisateur et gère l'abonnement
     */
    static async finalizeOnboarding(user: UserProfile, plan: PlanType): Promise<void> {
        if (!user.organizationId) throw new Error("Organization ID missing");

        try {
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
        } catch (error) {
            ErrorLogger.error(error, 'OnboardingService.finalizeOnboarding');
            throw error;
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
            doneBtnText: i18n.t('common.actions.finish') || "Terminer",
            nextBtnText: i18n.t('common.actions.next') || "Suivant",
            prevBtnText: i18n.t('common.actions.prev') || "Précédent",
            steps: steps
        });

        this.driverInstance.drive();
    }

    private static getStepsForRole(role: string): DriveStep[] {
        const commonSteps: DriveStep[] = [
            {
                element: '[data-tour="dashboard"]',
                popover: {
                    title: i18n.t('tour.welcome.title'),
                    description: i18n.t('tour.welcome.desc'),
                    side: 'bottom',
                    align: 'center'
                }
            },
            {
                element: '[data-tour="sidebar"]', // Changed from sidebar-nav to sidebar
                popover: {
                    title: i18n.t('tour.nav.title'),
                    description: i18n.t('tour.nav.desc'),
                    side: 'right',
                    align: 'start'
                }
            }
        ];

        const adminSteps: DriveStep[] = [
            {
                element: '[data-tour="command-palette"]',
                popover: {
                    title: '⚡ ' + i18n.t('commandPalette.placeholder').split('...')[0],
                    description: "Cmd/Ctrl + K",
                    side: 'bottom',
                    align: 'center'
                }
            },
            {
                element: '[data-tour="notifications"]',
                popover: {
                    title: i18n.t('notifications.title'),
                    description: i18n.t('notifications.subtitle'),
                    side: 'bottom',
                    align: 'end'
                }
            },
            {
                element: '[data-tour="settings"]',
                popover: {
                    title: i18n.t('sidebar.settings'),
                    description: i18n.t('tour.profile.desc'),
                    side: 'top',
                    align: 'start'
                }
            }
        ];

        const directionSteps: DriveStep[] = [
            {
                element: '[data-tour="dashboard-reports"]',
                popover: {
                    title: i18n.t('reports.riskExecTitle'),
                    description: i18n.t('reports.riskExecDesc'),
                    side: 'bottom',
                    align: 'center'
                }
            },
            {
                element: '[data-tour="risks-overview"]',
                popover: {
                    title: i18n.t('risks.title_exec'),
                    description: i18n.t('risks.subtitle_exec'),
                    side: 'right',
                    align: 'start'
                }
            }
        ];

        const auditorSteps: DriveStep[] = [
            {
                element: '[data-tour="compliance-nav"]',
                popover: {
                    title: i18n.t('compliance.title'),
                    description: i18n.t('compliance.subtitle'),
                    side: 'right',
                    align: 'center'
                }
            },
            {
                element: '[data-tour="audits-nav"]',
                popover: {
                    title: i18n.t('audits.title'),
                    description: i18n.t('audits.subtitle'),
                    side: 'right',
                    align: 'center'
                }
            }
        ];

        // Combine steps based on role
        if (role === 'admin' || role === 'rssi') {
            return [...commonSteps, ...adminSteps, {
                element: '[data-tour="theme-toggle"]',
                popover: { title: i18n.t('common.darkMode'), description: i18n.t('tour.profile.desc'), side: 'bottom', align: 'end' }
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
            popover: { title: i18n.t('notifications.title'), description: i18n.t('notifications.subtitle'), side: 'bottom', align: 'end' }
        }];
    }

    /**
     * Tour guidé pour le module Risques
     */

    /**
     * Vérifie si l'utilisateur a déjà vu le tour principal
     */
    static hasSeenTour(): boolean {
        return localStorage.getItem('tour-seen') === 'true';
    }

    /**
     * Vérifie si l'utilisateur a déjà vu le tour d'un module spécifique
     */
    static hasSeenModuleTour(module: string): boolean {
        return localStorage.getItem(`tour-seen-${module}`) === 'true';
    }

    /**
     * Marque le tour d'un module comme vu
     */
    static markModuleTourSeen(module: string) {
        localStorage.setItem(`tour-seen-${module}`, 'true');
    }

    /**
     * Tour guidé pour le module Risques
     */
    static startRisksTour() {
        if (this.hasSeenModuleTour('risks')) return;

        this.driverInstance.setConfig({
            ...this.driverInstance.getConfig(),
            onDestroyed: () => this.markModuleTourSeen('risks'),
            steps: [
                {
                    element: '[data-tour="risks-create"]',
                    popover: {
                        title: i18n.t('tour.risks.create.title') || "Créer un Risque",
                        description: i18n.t('tour.risks.create.desc') || "Démarrez ici pour ajouter un nouveau risque au registre.",
                        side: 'bottom', align: 'start'
                    }
                },
                {
                    element: '[data-tour="risks-stats"]',
                    popover: {
                        title: i18n.t('tour.risks.stats.title') || "Vue d'ensemble",
                        description: i18n.t('tour.risks.stats.desc') || "Suivez la répartition (Brut vs Net) et la couverture des risques.",
                        side: 'left', align: 'start'
                    }
                },
                {
                    element: '[data-tour="risks-filters"]',
                    popover: {
                        title: i18n.t('tour.risks.filters.title') || "Filtres Avancés",
                        description: i18n.t('tour.risks.filters.desc') || "Filtrez par scénario, gravité ou statut pour cibler l'essentiel.",
                        side: 'bottom', align: 'start'
                    }
                }
            ]
        });
        this.driverInstance.drive();
    }

    /**
     * Tour guidé pour le module Actifs
     */
    static startAssetsTour() {
        if (this.hasSeenModuleTour('assets')) return;

        this.driverInstance.setConfig({
            ...this.driverInstance.getConfig(),
            onDestroyed: () => this.markModuleTourSeen('assets'),
            steps: [
                {
                    element: '[data-tour="assets-add"]',
                    popover: {
                        title: i18n.t('tour.assets.add.title') || "Ajouter un Actif",
                        description: i18n.t('tour.assets.add.desc') || "Déclarez vos serveurs, applications ou locaux ici.",
                        side: 'bottom', align: 'start'
                    }
                },
                {
                    element: '[data-tour="assets-export"]',
                    popover: {
                        title: i18n.t('tour.assets.export.title') || "Export & Rapports",
                        description: i18n.t('tour.assets.export.desc') || "Générez un inventaire complet PDF ou CSV en un clic.",
                        side: 'bottom', align: 'center'
                    }
                },
                {
                    element: '[data-tour="assets-list"]',
                    popover: {
                        title: i18n.t('tour.assets.list.title') || "Inventaire",
                        description: i18n.t('tour.assets.list.desc') || "Visualisez, modifiez et classez vos actifs par criticité.",
                        side: 'top', align: 'start'
                    }
                }
            ]
        });
        this.driverInstance.drive();
    }

    /**
     * Tour guidé pour le module Conformité
     */
    static startComplianceTour() {
        if (this.hasSeenModuleTour('compliance')) return;

        this.driverInstance.setConfig({
            ...this.driverInstance.getConfig(),
            onDestroyed: () => this.markModuleTourSeen('compliance'),
            steps: [
                {
                    element: '[data-tour="compliance-scorecard"]',
                    popover: {
                        title: i18n.t('tour.compliance.score.title') || "Score de Conformité",
                        description: i18n.t('tour.compliance.score.desc') || "Votre progression en temps réel vers l'objectif (ex: ISO 27001).",
                        side: 'bottom', align: 'start'
                    }
                },
                {
                    element: '[data-tour="compliance-controls"]',
                    popover: {
                        title: i18n.t('tour.compliance.controls.title') || "Contrôles",
                        description: i18n.t('tour.compliance.controls.desc') || "Gérez les preuves et l'efficacité de chaque mesure de sécurité.",
                        side: 'left', align: 'start'
                    }
                },
                {
                    element: '[data-tour="compliance-soa"]',
                    popover: {
                        title: i18n.t('tour.compliance.soa.title') || "Déclaration d'Applicabilité",
                        description: i18n.t('tour.compliance.soa.desc') || "Générez votre SoA (Statement of Applicability) automatiquement.",
                        side: 'bottom', align: 'start'
                    }
                }
            ]
        });
        this.driverInstance.drive();
    }

    /**
     * Tour guidé pour le module Analytics
     */
    static startAnalyticsTour() {
        if (this.hasSeenModuleTour('analytics')) return;

        this.driverInstance.setConfig({
            ...this.driverInstance.getConfig(),
            onDestroyed: () => this.markModuleTourSeen('analytics'),
            steps: [
                {
                    element: '[data-tour="analytics-trends"]',
                    popover: {
                        title: '📈 Tendances',
                        description: 'Analysez l\'évolution de vos risques et incidents sur la durée.',
                        side: 'bottom', align: 'center'
                    }
                }
            ]
        });
        this.driverInstance.drive();
    }

    /**
     * Tour guidé pour le module Incidents
     */
    static startIncidentsTour() {
        if (this.hasSeenModuleTour('incidents')) return;

        this.driverInstance.setConfig({
            ...this.driverInstance.getConfig(),
            onDestroyed: () => this.markModuleTourSeen('incidents'),
            steps: [
                {
                    element: '[data-tour="incidents-add"]',
                    popover: {
                        title: 'Nouveau Signalement',
                        description: 'Signalez un incident de sécurité ou une violation de données.',
                        side: 'bottom', align: 'start'
                    }
                },
                {
                    element: '[data-tour="incidents-timeline"]',
                    popover: {
                        title: '⏱️ Timeline Visuelle',
                        description: 'Suivez le cycle de vie de l\'incident, de la détection à la clôture.',
                        side: 'left', align: 'center'
                    }
                }
            ]
        });
        this.driverInstance.drive();
    }

    /**
     * Tour guidé pour le module Backup
     */
    static startBackupTour() {
        if (this.hasSeenModuleTour('backup')) return;

        this.driverInstance.setConfig({
            ...this.driverInstance.getConfig(),
            onDestroyed: () => this.markModuleTourSeen('backup'),
            steps: [
                {
                    element: '[data-tour="backup-schedule"]',
                    popover: {
                        title: '📅 Planification',
                        description: 'Configurez la fréquence et la rétention de vos sauvegardes.',
                        side: 'bottom', align: 'center'
                    }
                }
            ]
        });
        this.driverInstance.drive();
    }

    /**
     * Tour guidé pour le module Audits
     */
    static startAuditsTour() {
        if (this.hasSeenModuleTour('audits')) return;

        this.driverInstance.setConfig({
            ...this.driverInstance.getConfig(),
            onDestroyed: () => this.markModuleTourSeen('audits'),
            steps: [
                {
                    element: '[data-tour="audits-new"]',
                    popover: {
                        title: 'Planifier un Audit',
                        description: 'Créez un nouvel audit interne, externe ou de certification.',
                        side: 'bottom', align: 'start'
                    }
                },
                {
                    element: '[data-tour="audits-dashboard"]',
                    popover: {
                        title: 'Vue d\'ensemble',
                        description: 'Suivez l\'avancement de vos audits et les non-conformités détectées.',
                        side: 'bottom', align: 'center'
                    }
                }
            ]
        });
        this.driverInstance.drive();
    }

    /**
     * Tour guidé pour le module Fournisseurs
     */
    static startSuppliersTour() {
        if (this.hasSeenModuleTour('suppliers')) return;

        this.driverInstance.setConfig({
            ...this.driverInstance.getConfig(),
            onDestroyed: () => this.markModuleTourSeen('suppliers'),
            steps: [
                {
                    element: '[data-tour="suppliers-new"]',
                    popover: {
                        title: 'Nouveau Fournisseur',
                        description: 'Ajoutez un tiers à votre inventaire pour l\'évaluer.',
                        side: 'bottom', align: 'start'
                    }
                },
                {
                    element: '[data-tour="suppliers-dashboard"]',
                    popover: {
                        title: 'Gestion des Tiers',
                        description: 'Analysez la criticité et le score de sécurité de vos fournisseurs (DORA).',
                        side: 'bottom', align: 'center'
                    }
                }
            ]
        });
        this.driverInstance.drive();
    }

    /**
     * Tour guidé pour le module Continuité
     */
    static startContinuityTour() {
        if (this.hasSeenModuleTour('continuity')) return;

        this.driverInstance.setConfig({
            ...this.driverInstance.getConfig(),
            onDestroyed: () => this.markModuleTourSeen('continuity'),
            steps: [
                {
                    element: '[data-tour="continuity-dashboard"]',
                    popover: {
                        title: 'Continuité d\'Activité',
                        description: 'Gérez vos plans de continuité (PCA/PRA) et visualisez vos indicateurs de résilience.',
                        side: 'bottom', align: 'center'
                    }
                },
                {
                    element: '[data-tour="continuity-tabs"]',
                    popover: {
                        title: 'Navigation BIA et Stratégies',
                        description: 'Accédez aux analyses d\'impact (BIA), aux stratégies de secours et à la gestion de crise via ces onglets.',
                        side: 'bottom', align: 'center'
                    }
                }
            ]
        });
        this.driverInstance.drive();
    }

    /**
     * Tour guidé pour le module Documents
     */
    static startDocumentsTour() {
        if (this.hasSeenModuleTour('documents')) return;

        this.driverInstance.setConfig({
            ...this.driverInstance.getConfig(),
            onDestroyed: () => this.markModuleTourSeen('documents'),
            steps: [
                {
                    element: '[data-tour="documents-upload"]',
                    popover: {
                        title: 'Importer des Documents',
                        description: 'Stockez vos politiques, procédures et preuves ici.',
                        side: 'bottom', align: 'start'
                    }
                },
                {
                    element: '[data-tour="documents-folders"]',
                    popover: {
                        title: 'Organisation',
                        description: 'Classez vos fichiers par dossiers pour une meilleure gestion.',
                        side: 'right', align: 'start'
                    }
                }
            ]
        });
        this.driverInstance.drive();
    }

    /**
     * Tour guidé pour le module Projets
     */
    static startProjectsTour() {
        if (this.hasSeenModuleTour('projects')) return;

        this.driverInstance.setConfig({
            ...this.driverInstance.getConfig(),
            onDestroyed: () => this.markModuleTourSeen('projects'),
            steps: [
                {
                    element: '[data-tour="projects-create"]',
                    popover: {
                        title: 'Nouveau Projet',
                        description: 'Lancez un projet de mise en conformité ou de sécurisation.',
                        side: 'bottom', align: 'start'
                    }
                },
                {
                    element: '[data-tour="projects-kanban"]',
                    popover: {
                        title: 'Suivi Kanban',
                        description: 'Gérez l\'avancement des tâches visuellement.',
                        side: 'bottom', align: 'center'
                    }
                }
            ]
        });
        this.driverInstance.drive();
    }
}
