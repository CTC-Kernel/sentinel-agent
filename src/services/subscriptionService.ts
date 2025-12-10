import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Organization, PlanType, PlanLimits } from '../types';
import { getPlanLimits } from '../config/plans';
import { ErrorLogger } from './errorLogger';

export const SubscriptionService = {

  /**
   * Get current plan limits for an organization
   */
  getLimits: async (organizationId: string): Promise<PlanLimits> => {
    const orgRef = doc(db, 'organizations', organizationId);
    const orgSnap = await getDoc(orgRef);

    if (!orgSnap.exists()) return getPlanLimits('discovery');

    const orgData = orgSnap.data() as Organization;
    const planId = orgData.subscription?.planId || 'discovery';

    return getPlanLimits(planId);
  },

  /**
   * Check if a specific action is allowed based on current usage and plan limits
   * @returns true if allowed, false otherwise
   */
  checkLimit: async (
    organizationId: string,
    resource: 'users' | 'projects' | 'assets' | 'storage',
    currentCount: number
  ): Promise<boolean> => {
    const limits = await SubscriptionService.getLimits(organizationId);

    switch (resource) {
      case 'users':
        return currentCount < limits.maxUsers;
      case 'projects':
        return currentCount < limits.maxProjects;
      case 'assets':
        return currentCount < limits.maxAssets;
      case 'storage':
        return currentCount < limits.maxStorageGB;
      default:
        return true;
    }
  },

  /**
   * Check if a specific feature is enabled for the organization
   */
  hasFeature: async (organizationId: string, feature: keyof PlanLimits['features']): Promise<boolean> => {
    const limits = await SubscriptionService.getLimits(organizationId);
    return limits.features[feature];
  },

  /**
   * Initiate Checkout Session
   */
  startSubscription: async (organizationId: string, planId: PlanType, interval: 'month' | 'year' = 'month') => {
    const functions = getFunctions();
    const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');

    const { data } = await createCheckoutSession({
      organizationId,
      planId,
      interval,
      successUrl: `${window.location.origin}/settings?billing_success=true`,
      cancelUrl: `${window.location.origin}/pricing?canceled=true`
    }) as { data: { url: string } };

    if (data.url) {
      window.location.href = data.url;
    }
  },

  /**
   * Manage existing subscription (Portal)
   */
  manageSubscription: async (organizationId: string) => {
    try {
      const functions = getFunctions();
      const createPortalSession = httpsCallable(functions, 'createPortalSession');

      const { data } = await createPortalSession({
        organizationId,
        returnUrl: `${window.location.origin}/settings`
      }) as { data: { url: string } };

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      ErrorLogger.error(error, 'SubscriptionService.manageSubscription');

      // Fallback: Si les Cloud Functions ne sont pas déployées, rediriger vers Stripe directement
      const err = error as { code?: string; message?: string };
      if (err.code === 'functions/not-found' || err.message?.includes('404')) {
        throw new Error('La gestion des abonnements n\'est pas encore configurée. Veuillez contacter le support ou déployer les Cloud Functions.');
      }
      throw error;
    }
  }
};
