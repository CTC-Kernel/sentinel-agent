/**
 * useWebAuthn Hook
 *
 * React hook for WebAuthn/Passkey authentication
 * Provides easy integration of passwordless authentication in components
 *
 * @module useWebAuthn
 */

import { useState, useEffect, useCallback } from 'react';
import {
  WebAuthnService,
  StoredCredential,
  RegistrationOptions,
  AuthenticationOptions
} from '../services/webAuthnService';
import { ErrorLogger } from '../services/errorLogger';

interface UseWebAuthnReturn {
  /** Whether WebAuthn is supported in this browser */
  isSupported: boolean;
  /** Whether platform authenticator (Touch ID, Face ID) is available */
  isPlatformAvailable: boolean;
  /** Whether autofill (conditional mediation) is available */
  isAutofillAvailable: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** User's registered credentials */
  credentials: StoredCredential[];
  /** Register a new passkey */
  registerPasskey: (
    userId: string,
    userEmail: string,
    userName: string,
    organizationId: string,
    deviceName: string,
    authenticatorType?: 'platform' | 'cross-platform'
  ) => Promise<{ success: boolean; credentialId?: string; error?: string }>;
  /** Authenticate with passkey */
  authenticateWithPasskey: (
    userId: string
  ) => Promise<{ success: boolean; error?: string }>;
  /** Delete a credential */
  deleteCredential: (credentialId: string, userId: string) => Promise<boolean>;
  /** Rename a credential */
  renameCredential: (credentialId: string, userId: string, newName: string) => Promise<boolean>;
  /** Refresh credentials list */
  refreshCredentials: (userId: string) => Promise<void>;
  /** Clear error */
  clearError: () => void;
}

/**
 * Hook for WebAuthn/Passkey functionality
 */
export function useWebAuthn(): UseWebAuthnReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isPlatformAvailable, setIsPlatformAvailable] = useState(false);
  const [isAutofillAvailable, setIsAutofillAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);

  // Check browser support on mount
  useEffect(() => {
    const checkSupport = async () => {
      setIsSupported(WebAuthnService.isSupported());

      if (WebAuthnService.isSupported()) {
        const [platform, autofill] = await Promise.all([
          WebAuthnService.isPlatformAuthenticatorAvailable(),
          WebAuthnService.isConditionalMediationAvailable()
        ]);
        setIsPlatformAvailable(platform);
        setIsAutofillAvailable(autofill);
      }
    };

    checkSupport();
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Refresh the credentials list for a user
   */
  const refreshCredentials = useCallback(async (userId: string) => {
    try {
      const creds = await WebAuthnService.getUserCredentials(userId);
      setCredentials(creds);
    } catch (err) {
      ErrorLogger.error(err, 'useWebAuthn.refreshCredentials');
    }
  }, []);

  /**
   * Register a new passkey
   */
  const registerPasskey = useCallback(async (
    userId: string,
    userEmail: string,
    userName: string,
    organizationId: string,
    deviceName: string,
    authenticatorType: 'platform' | 'cross-platform' = 'platform'
  ): Promise<{ success: boolean; credentialId?: string; error?: string }> => {
    if (!isSupported) {
      return { success: false, error: 'WebAuthn n\'est pas supporté par ce navigateur' };
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get registration options
      const options = await WebAuthnService.generateRegistrationOptions(
        userId,
        userEmail,
        userName,
        organizationId,
        authenticatorType
      );

      // Convert options for browser API
      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge: base64urlToBuffer(options.challenge),
        rp: options.rp,
        user: {
          id: base64urlToBuffer(options.user.id),
          name: options.user.name,
          displayName: options.user.displayName
        },
        pubKeyCredParams: options.pubKeyCredParams,
        authenticatorSelection: options.authenticatorSelection,
        timeout: options.timeout,
        attestation: options.attestation,
        excludeCredentials: options.excludeCredentials?.map(cred => ({
          ...cred,
          id: cred.id instanceof ArrayBuffer ? cred.id : base64urlToBuffer(cred.id as unknown as string)
        }))
      };

      // Create credential
      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      }) as PublicKeyCredential;

      if (!credential) {
        setError('Création de credential annulée');
        return { success: false, error: 'Création annulée' };
      }

      // Verify and store
      const result = await WebAuthnService.verifyRegistration(
        userId,
        organizationId,
        credential,
        deviceName
      );

      if (result.success) {
        await refreshCredentials(userId);
      } else {
        setError(result.error || 'Erreur de vérification');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';

      // Handle specific WebAuthn errors
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setError('Opération annulée ou refusée par l\'utilisateur');
          return { success: false, error: 'Opération annulée' };
        }
        if (err.name === 'InvalidStateError') {
          setError('Cet appareil est déjà enregistré');
          return { success: false, error: 'Appareil déjà enregistré' };
        }
        if (err.name === 'NotSupportedError') {
          setError('Aucun authentificateur compatible trouvé');
          return { success: false, error: 'Authentificateur non supporté' };
        }
      }

      ErrorLogger.error(err, 'useWebAuthn.registerPasskey');
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, refreshCredentials]);

  /**
   * Authenticate with passkey
   */
  const authenticateWithPasskey = useCallback(async (
    userId: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isSupported) {
      return { success: false, error: 'WebAuthn n\'est pas supporté par ce navigateur' };
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get authentication options
      const options = await WebAuthnService.generateAuthenticationOptions(userId);

      if (!options) {
        setError('Aucun passkey enregistré pour cet utilisateur');
        return { success: false, error: 'Aucun passkey enregistré' };
      }

      // Convert options for browser API
      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge: base64urlToBuffer(options.challenge),
        rpId: options.rpId,
        allowCredentials: options.allowCredentials.map(cred => ({
          ...cred,
          id: cred.id instanceof ArrayBuffer ? cred.id : base64urlToBuffer(cred.id as unknown as string)
        })),
        timeout: options.timeout,
        userVerification: options.userVerification
      };

      // Get credential
      const credential = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
      }) as PublicKeyCredential;

      if (!credential) {
        setError('Authentification annulée');
        return { success: false, error: 'Authentification annulée' };
      }

      // Verify
      const result = await WebAuthnService.verifyAuthentication(userId, credential);

      if (!result.success) {
        setError(result.error || 'Erreur de vérification');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';

      // Handle specific WebAuthn errors
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setError('Authentification annulée ou refusée');
          return { success: false, error: 'Authentification annulée' };
        }
        if (err.name === 'SecurityError') {
          setError('Erreur de sécurité - vérifiez que vous êtes sur le bon domaine');
          return { success: false, error: 'Erreur de sécurité' };
        }
      }

      ErrorLogger.error(err, 'useWebAuthn.authenticateWithPasskey');
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  /**
   * Delete a credential
   */
  const deleteCredential = useCallback(async (
    credentialId: string,
    userId: string
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await WebAuthnService.deleteCredential(credentialId, userId);
      if (success) {
        await refreshCredentials(userId);
      }
      return success;
    } catch (err) {
      ErrorLogger.error(err, 'useWebAuthn.deleteCredential');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshCredentials]);

  /**
   * Rename a credential
   */
  const renameCredential = useCallback(async (
    credentialId: string,
    userId: string,
    newName: string
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await WebAuthnService.renameCredential(credentialId, userId, newName);
      if (success) {
        await refreshCredentials(userId);
      }
      return success;
    } catch (err) {
      ErrorLogger.error(err, 'useWebAuthn.renameCredential');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshCredentials]);

  return {
    isSupported,
    isPlatformAvailable,
    isAutofillAvailable,
    isLoading,
    error,
    credentials,
    registerPasskey,
    authenticateWithPasskey,
    deleteCredential,
    renameCredential,
    refreshCredentials,
    clearError
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert base64url string to ArrayBuffer
 */
function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

export default useWebAuthn;
