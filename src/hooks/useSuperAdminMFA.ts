/**
 * useSuperAdminMFA Hook
 *
 * Security hook for requiring MFA verification before sensitive super admin actions.
 * Uses Firebase TOTP MFA to verify the user's second factor before allowing destructive
 * or highly privileged operations.
 *
 * Usage:
 * const { requireMFAVerification, MFAModal, isPendingVerification } = useSuperAdminMFA();
 *
 * // Wrap sensitive action with MFA verification
 * const handleDeleteTenant = async () => {
 *   const verified = await requireMFAVerification('Supprimer ce tenant');
 *   if (!verified) return;
 *   // Proceed with deletion...
 * };
 */

import { useState, useCallback } from 'react';
import { auth } from '../firebase';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';

interface MFAVerificationState {
  isOpen: boolean;
  actionDescription: string;
  resolve: ((value: boolean) => void) | null;
}

export function useSuperAdminMFA() {
  const { user, addToast, t } = useStore();
  const [verificationState, setVerificationState] = useState<MFAVerificationState>({
    isOpen: false,
    actionDescription: '',
    resolve: null,
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [verificationError, setVerificationError] = useState<string | null>(null);

  /**
   * Check if the current user has MFA enabled
   */
  const hasMFAEnabled = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false;

    try {
      const { multiFactor } = await import('firebase/auth');
      const enrolledFactors = multiFactor(auth.currentUser).enrolledFactors;
      return enrolledFactors.length > 0;
    } catch (error) {
      ErrorLogger.error(error, 'useSuperAdminMFA.hasMFAEnabled');
      return false;
    }
  }, []);

  /**
   * Require MFA verification before proceeding with an action
   * Returns true if verified, false if cancelled or failed
   */
  const requireMFAVerification = useCallback(async (actionDescription: string): Promise<boolean> => {
    // Only require MFA for super admin role
    if (user?.role !== 'super_admin') {
      return true; // Non-super-admin users don't need MFA verification for this hook
    }

    // Check if user has MFA enabled
    const mfaEnabled = await hasMFAEnabled();
    if (!mfaEnabled) {
      // SECURITY: MFA is required for super admin actions - deny if not enrolled
      ErrorLogger.error(new Error('Super admin MFA not enabled'), 'useSuperAdminMFA.requireMFAVerification', {
        metadata: { userId: user?.uid }
      });
      addToast(t('superAdmin.toast.mfaRequired', { defaultValue: 'MFA obligatoire pour les actions super admin. Veuillez activer la MFA dans vos paramètres.' }), 'error');
      return false;
    }

    // Open MFA verification modal and wait for result
    return new Promise((resolve) => {
      setVerificationState({
        isOpen: true,
        actionDescription,
        resolve,
      });
      setMfaCode('');
      setVerificationError(null);
    });
  }, [user, hasMFAEnabled, addToast, t]);

  /**
   * Handle MFA code verification
   */
  const handleVerifyMFA = useCallback(async () => {
    if (mfaCode.length !== 6) {
      setVerificationError(t('superAdmin.mfa.codeLength', { defaultValue: 'Le code doit contenir 6 chiffres' }));
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);

    try {
      if (!auth.currentUser) {
        throw new Error('Utilisateur non connecté');
      }

      const { TotpMultiFactorGenerator, multiFactor } = await import('firebase/auth');

      // Get the enrolled TOTP factor
      const enrolledFactors = multiFactor(auth.currentUser).enrolledFactors;
      const totpFactor = enrolledFactors.find(f => f.factorId === TotpMultiFactorGenerator.FACTOR_ID);

      if (!totpFactor) {
        throw new Error('Aucun facteur TOTP trouvé');
      }

      // For verification, we need to use the assertion mechanism
      // Firebase doesn't have a direct "verify TOTP code" method for already-enrolled users
      // We'll use a custom verification approach via Cloud Function
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../firebase');

      const verifyMFACode = httpsCallable(functions, 'verifyMFACode');
      const result = await verifyMFACode({ code: mfaCode });

      if ((result.data as { verified: boolean }).verified) {
        verificationState.resolve?.(true);
        setVerificationState(prev => ({ ...prev, isOpen: false, resolve: null }));
        addToast(t('superAdmin.toast.mfaVerified', { defaultValue: 'Vérification MFA réussie' }), 'success');
      } else {
        setVerificationError(t('superAdmin.mfa.invalidCode', { defaultValue: 'Code MFA invalide' }));
      }
    } catch (error) {
      ErrorLogger.error(error, 'useSuperAdminMFA.handleVerifyMFA');

      const firebaseError = error as { code?: string; message?: string };
      if (firebaseError.code === 'functions/not-found') {
        // SECURITY: Do NOT bypass MFA when Cloud Function is missing - deny the action
        ErrorLogger.error(new Error('MFA verification Cloud Function not deployed'), 'useSuperAdminMFA.handleVerifyMFA');
        setVerificationError(t('superAdmin.mfa.serviceUnavailable', { defaultValue: 'Service de vérification MFA indisponible. Contactez l\'administrateur.' }));
      } else {
        setVerificationError(firebaseError.message || t('superAdmin.mfa.verificationError', { defaultValue: 'Erreur de vérification MFA' }));
      }
    } finally {
      setIsVerifying(false);
    }
  }, [mfaCode, verificationState, addToast, t]);

  /**
   * Cancel MFA verification
   */
  const handleCancel = useCallback(() => {
    verificationState.resolve?.(false);
    setVerificationState({ isOpen: false, actionDescription: '', resolve: null });
    setMfaCode('');
    setVerificationError(null);
  }, [verificationState]);

  return {
    requireMFAVerification,
    isPendingVerification: verificationState.isOpen,
    mfaModalProps: {
      isOpen: verificationState.isOpen,
      actionDescription: verificationState.actionDescription,
      mfaCode,
      setMfaCode,
      isVerifying,
      verificationError,
      onVerify: handleVerifyMFA,
      onCancel: handleCancel,
    },
  };
}

export type SuperAdminMFAModalProps = ReturnType<typeof useSuperAdminMFA>['mfaModalProps'];
