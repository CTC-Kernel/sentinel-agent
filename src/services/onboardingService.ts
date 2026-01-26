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
        doneBtnText: "Terminer",
        nextBtnText: "Suivant",
        prevBtnText: "Précédent",
        progressText: "{{current}} / {{total}}",
        popoverClass: 'driverjs-theme-sentinel',
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
            doneBtnText: "Démarrer",
            nextBtnText: "Suivant",
            prevBtnText: "Précédent",
            steps: steps
        });

        this.driverInstance.drive();
    }

    private static getStepsForRole(role: string): DriveStep[] {
        const commonSteps: DriveStep[] = [
            {
                element: '[data-tour="dashboard"]',
                popover: {
                    title: 'Tableau de Bord',
                    description: "Bienvenue sur Sentinel. Cet écran synthétise votre posture de sécurité en temps réel : conformité, risques critiques et incidents actifs.",
                    side: 'bottom',
                    align: 'center'
                }
            },
            {
                element: '[data-tour="sidebar"]',
                popover: {
                    title: 'Navigation Principale',
                    description: "Accédez à tous vos modules de gestion : Registres, Audits, Conformité et Paramètres. Tout est centralisé ici.",
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
                    element: '[data-tour="risks-stats"]',
                    popover: {
                        title: "Vue d'Ensemble",
                        description: "Analysez instantanément votre exposition financière et la répartition de vos risques (Brut vs Net). Ces indicateurs se mettent à jour dynamiquement.",
                        side: 'left', align: 'start'
                    }
                },
                {
                    element: '[data-tour="risks-create"]',
                    popover: {
                        title: "Ajouter un Risque",
                        description: "Déclarez un nouveau risque dans votre registre. Plus la description est précise, meilleure sera l'analyse contextuelle de l'IA.",
                        side: 'bottom', align: 'start'
                    }
                },
                {
                    element: '[data-tour="risks-filters"]',
                    popover: {
                        title: "Filtres et Recherche",
                        description: "Retrouvez rapidement des menaces spécifiques en filtrant par scénario, impact ou niveau de criticité.",
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
                    element: '[data-tour="assets-list"]',
                    popover: {
                        title: "Inventaire des Actifs",
                        description: "Retrouvez ici la liste complète de vos actifs (Serveurs, Applications, Locaux). Chaque actif doit être classifié selon sa sensibilité (DICP).",
                        side: 'top', align: 'start'
                    }
                },
                {
                    element: '[data-tour="assets-add"]',
                    popover: {
                        title: "Déclarer un Actif",
                        description: "Ajoutez un nouvel élément à votre inventaire. Lier des actifs entre eux permet de mieux comprendre la propagation des risques.",
                        side: 'bottom', align: 'start'
                    }
                },
                {
                    element: '[data-tour="assets-export"]',
                    popover: {
                        title: "Rapports & Exports",
                        description: "Exportez votre inventaire au format PDF ou CSV pour vos audits réglementaires ou revues de direction.",
                        side: 'bottom', align: 'center'
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
                        title: "Score de Conformité",
                        description: "Suivez votre progression vers les standards cibles (ISO 27001, DORA, NIS 2). L'objectif est d'atteindre 100% de couverture.",
                        side: 'bottom', align: 'start'
                    }
                },
                {
                    element: '[data-tour="compliance-controls"]',
                    popover: {
                        title: "Contrôles de Sécurité",
                        description: "Gérez l'implémentation de vos mesures. Chaque contrôle doit être documenté et prouvé pour être valide.",
                        side: 'left', align: 'start'
                    }
                },
                {
                    element: '[data-tour="compliance-soa"]',
                    popover: {
                        title: "Déclaration d'Applicabilité (SoA)",
                        description: "Générez automatiquement votre SoA, document indispensable pour justifier le périmètre de votre certification.",
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
                        title: 'Analyse des Tendances',
                        description: 'Visualisez l\'évolution historique de vos métriques. Idéal pour démontrer l\'amélioration continue lors des revues de direction.',
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
                        title: "Signaler un Incident",
                        description: "Déclarez rapidement toute anomalie ou violation de sécurité. La réactivité est clé pour limiter l'impact.",
                        side: 'bottom', align: 'start'
                    }
                },
                {
                    element: '[data-tour="incidents-timeline"]',
                    popover: {
                        title: "Chronologie de l'Incident",
                        description: "Suivez et documentez chaque étape de la gestion de l'incident, de sa détection jusqu'à sa clôture officielle.",
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
                        title: 'Politique de Sauvegarde',
                        description: 'Configurez la fréquence et la rétention de vos sauvegardes pour garantir la résilience de vos données (RPO).',
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
                        title: 'Nouvel Audit',
                        description: 'Planifiez une mission d\'audit (Interne, Fournisseur ou de Certification) et assignez un auditeur.',
                        side: 'bottom', align: 'start'
                    }
                },
                {
                    element: '[data-tour="audits-dashboard"]',
                    popover: {
                        title: 'Suivi des Missions',
                        description: 'Pilotez l\'avancement de vos audits et suivez la résolution des non-conformités détectées.',
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
                    element: '[data-tour="suppliers-dashboard"]',
                    popover: {
                        title: 'Gestion des Tiers',
                        description: 'Surveillez le niveau de risque de vos fournisseurs. Un suivi rigoureux est essentiel pour la conformité DORA.',
                        side: 'bottom', align: 'center'
                    }
                },
                {
                    element: '[data-tour="suppliers-new"]',
                    popover: {
                        title: 'Ajout de Fournisseur',
                        description: 'Référencez un nouveau partenaire et évaluez sa criticité pour votre activité.',
                        side: 'bottom', align: 'start'
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
                        description: 'Visualisez l\'état de vos plans de continuité (PCA/PRA). Assurez-vous que votre organisation est prête à faire face aux crises.',
                        side: 'bottom', align: 'center'
                    }
                },
                {
                    element: '[data-tour="continuity-tabs"]',
                    popover: {
                        title: 'BIA & Stratégies',
                        description: 'Naviguez entre vos Analyses d\'Impact (BIA) et vos stratégies de secours définies.',
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
                        title: 'Importer un Document',
                        description: 'Ajoutez des politiques, procédures ou preuves d\'audit. Vos documents sont sécurisés et versionnés.',
                        side: 'bottom', align: 'start'
                    }
                },
                {
                    element: '[data-tour="documents-folders"]',
                    popover: {
                        title: 'Organisation',
                        description: 'Utilisez les dossiers pour structurer votre base documentaire (ex: par chapitre ISO 27001).',
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
                        description: 'Lancez un projet de conformité ou de sécurisation. Définissez objectifs, échéances et responsables.',
                        side: 'bottom', align: 'start'
                    }
                },
                {
                    element: '[data-tour="projects-kanban"]',
                    popover: {
                        title: 'Suivi Kanban',
                        description: 'Pilotez l\'avancement de vos tâches de manière visuelle et collaborative.',
                        side: 'bottom', align: 'center'
                    }
                }
            ]
        });
        this.driverInstance.drive();
    }

    /**
     * Tour guidé pour le module Agents
     */
    static startAgentsTour() {
        if (this.hasSeenModuleTour('agents')) return;

        this.driverInstance.setConfig({
            ...this.driverInstance.getConfig(),
            onDestroyed: () => this.markModuleTourSeen('agents'),
            steps: [
                {
                    element: '[data-tour="agents-tabs"]',
                    popover: {
                        title: "Gestion des Agents",
                        description: "Naviguez entre la supervision de votre flotte, la configuration des politiques de sécurité et l'inventaire logiciel collecté.",
                        side: 'bottom', align: 'center'
                    }
                },
                {
                    element: '[data-tour="agents-download"]',
                    popover: {
                        title: "Déploiement",
                        description: "Téléchargez l'installateur Sentinel pour vos postes et serveurs (Windows, Linux, macOS). L'installation est silencieuse et automatique.",
                        side: 'left', align: 'start'
                    }
                },
                {
                    element: '[data-tour="agents-stats"]',
                    popover: {
                        title: "État de la Flotte",
                        description: "Visualisez en un coup d'œil la santé de votre parc : agents actifs, systèmes d'exploitation et alertes de sécurité en cours.",
                        side: 'bottom', align: 'center'
                    }
                },
                {
                    element: '[data-tour="agents-filters"]',
                    popover: {
                        title: "Recherche & Filtres",
                        description: "Retrouvez rapidement un agent spécifique par nom, IP ou statut. Basculez entre la vue grille et la vue liste selon vos préférences.",
                        side: 'bottom', align: 'start'
                    }
                },
                {
                    element: '[data-tour="agents-grid"]',
                    popover: {
                        title: "Détails & Actions",
                        description: "Cliquez sur une carte pour voir les détails complets d'un agent : télémétrie en temps réel, vulnérabilités détectées et conformité.",
                        side: 'top', align: 'center'
                    }
                }
            ]
        });
        this.driverInstance.drive();
    }
}
