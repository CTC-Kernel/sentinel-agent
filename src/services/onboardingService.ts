import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

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
                createdAt: new Date().toISOString()
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
                    createdAt: new Date().toISOString(),
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
                    title: '⚡ ' + i18n.t('settings.commandPalette.placeholder').split('...')[0],
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
    static startRisksTour() {
        this.driverInstance.setConfig({
            ...this.driverInstance.getConfig(),
            nextBtnText: i18n.t('common.actions.next') || "Suivant",
            prevBtnText: i18n.t('common.actions.prev') || "Précédent",
            doneBtnText: i18n.t('common.actions.finish') || "Terminer"
        });

        const steps: DriveStep[] = [
            {
                element: '[data-tour="risks-create"]',
                popover: {
                    title: i18n.t('tour.risks.create.title'),
                    description: i18n.t('tour.risks.create.desc'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '[data-tour="risks-stats"]',
                popover: {
                    title: i18n.t('tour.risks.stats.title'),
                    description: i18n.t('tour.risks.stats.desc'),
                    side: 'left',
                    align: 'start'
                }
            },
            {
                element: '[data-tour="risks-filters"]',
                popover: {
                    title: i18n.t('tour.risks.filters.title'),
                    description: i18n.t('tour.risks.filters.desc'),
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
        this.driverInstance.setConfig({
            ...this.driverInstance.getConfig(),
            nextBtnText: i18n.t('common.actions.next') || "Suivant",
            prevBtnText: i18n.t('common.actions.prev') || "Précédent",
            doneBtnText: i18n.t('common.actions.finish') || "Terminer"
        });

        const steps: DriveStep[] = [
            {
                element: '[data-tour="assets-add"]',
                popover: {
                    title: i18n.t('tour.assets.add.title'),
                    description: i18n.t('tour.assets.add.desc'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '[data-tour="assets-export"]',
                popover: {
                    title: i18n.t('tour.assets.export.title'),
                    description: i18n.t('tour.assets.export.desc'),
                    side: 'bottom',
                    align: 'center'
                }
            },
            {
                element: '[data-tour="assets-list"]',
                popover: {
                    title: i18n.t('tour.assets.list.title'),
                    description: i18n.t('tour.assets.list.desc'),
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
        this.driverInstance.setConfig({
            ...this.driverInstance.getConfig(),
            nextBtnText: i18n.t('common.actions.next') || "Suivant",
            prevBtnText: i18n.t('common.actions.prev') || "Précédent",
            doneBtnText: i18n.t('common.actions.finish') || "Terminer"
        });

        const steps: DriveStep[] = [
            {
                element: '[data-tour="compliance-scorecard"]',
                popover: {
                    title: i18n.t('tour.compliance.score.title'),
                    description: i18n.t('tour.compliance.score.desc'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '[data-tour="compliance-controls"]',
                popover: {
                    title: i18n.t('tour.compliance.controls.title'),
                    description: i18n.t('tour.compliance.controls.desc'),
                    side: 'left',
                    align: 'start'
                }
            },
            {
                element: '[data-tour="compliance-soa"]',
                popover: {
                    title: i18n.t('tour.compliance.soa.title'),
                    description: i18n.t('tour.compliance.soa.desc'),
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
     * Vérifie si l'utilisateur a déjà vu le tour
     */
    static hasSeenTour(): boolean {
        return localStorage.getItem('tour-seen') === 'true';
    }

    /**
     * Vérifie si l'utilisateur a déjà complété l'onboarding (Setup)
     */
    static hasCompletedOnboarding(): boolean {
        // We rely on the caller to check User Store, but this can check localStorage as well.
        return localStorage.getItem('onboarding-completed') === 'true';
    }

    /**
     * Réinitialise le tour
     */
    static resetTour() {
        localStorage.removeItem('tour-seen');
    }

    /**
     * Réinitialise l'onboarding (Dev only)
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
        // ... (can be localized later if needed)
        const steps: DriveStep[] = [
            {
                element: '[data-tour="analytics-trends"]',
                popover: {
                    title: '📈 Tendances',
                    description: 'Analysez l\'évolution.',
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
                    description: 'Suivez le cycle de vie.',
                    side: 'left',
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
                    description: 'Configurez des sauvegardes.',
                    side: 'bottom',
                    align: 'center'
                }
            }
        ];
        this.driverInstance.setSteps(steps);
        this.driverInstance.drive();
    }
}
