/**
 * useWebAuthn Hook
 *
 * React hook for WebAuthn/Passkey authentication
 * Provides easy integration of passwordless authentication in components
 *
 * @module useWebAuthn
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
 WebAuthnService,
 StoredCredential,
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
 const { t } = useTranslation();
 const [isSupported, setIsSupported] = useState(false);
 const [isPlatformAvailable, setIsPlatformAvailable] = useState(false);
 const [isAutofillAvailable, setIsAutofillAvailable] = useState(false);
 const [isLoading, setIsLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [credentials, setCredentials] = useState<StoredCredential[]>([]);

 // Check browser support on mount
 useEffect(() => {
 let cancelled = false;
 const checkSupport = async () => {
 const supported = WebAuthnService.isSupported();
 if (cancelled) return;
 setIsSupported(supported);

 if (supported) {
 const [platform, autofill] = await Promise.all([
 WebAuthnService.isPlatformAuthenticatorAvailable(),
 WebAuthnService.isConditionalMediationAvailable()
 ]);
 if (cancelled) return;
 setIsPlatformAvailable(platform);
 setIsAutofillAvailable(autofill);
 }
 };

 checkSupport();
 return () => { cancelled = true; };
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
 return { success: false, error: t('auth.webauthn.notSupported', { defaultValue: 'WebAuthn is not supported by this browser' }) };
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
 const msg = t('auth.webauthn.creationCancelled', { defaultValue: 'Creation cancelled' });
 setError(msg);
 return { success: false, error: msg };
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
 setError(result.error || t('auth.webauthn.verificationError', { defaultValue: 'Verification error' }));
 }

 return result;
 } catch (err) {
 ErrorLogger.error(err, 'useWebAuthn.register');
 const errorMessage = err instanceof Error ? err.message : t('auth.webauthn.unknownError', { defaultValue: 'Unknown error' });

 // Handle specific WebAuthn errors
 if (err instanceof DOMException) {
 if (err.name === 'NotAllowedError') {
 const msg = t('auth.webauthn.operationCancelled', { defaultValue: 'Operation cancelled' });
 setError(t('auth.webauthn.operationCancelledOrDenied', { defaultValue: 'Operation cancelled or denied by the user' }));
 return { success: false, error: msg };
 }
 if (err.name === 'InvalidStateError') {
 const msg = t('auth.webauthn.deviceAlreadyRegistered', { defaultValue: 'Device already registered' });
 setError(msg);
 return { success: false, error: msg };
 }
 if (err.name === 'NotSupportedError') {
 const msg = t('auth.webauthn.authenticatorNotSupported', { defaultValue: 'Authenticator not supported' });
 setError(t('auth.webauthn.noCompatibleAuthenticator', { defaultValue: 'No compatible authenticator found' }));
 return { success: false, error: msg };
 }
 }

 ErrorLogger.error(err, 'useWebAuthn.registerPasskey');
 setError(errorMessage);
 return { success: false, error: errorMessage };
 } finally {
 setIsLoading(false);
 }
 }, [isSupported, refreshCredentials, t]);

 /**
 * Authenticate with passkey
 */
 const authenticateWithPasskey = useCallback(async (
 userId: string
 ): Promise<{ success: boolean; error?: string }> => {
 if (!isSupported) {
 return { success: false, error: t('auth.webauthn.notSupported', { defaultValue: 'WebAuthn is not supported by this browser' }) };
 }

 setIsLoading(true);
 setError(null);

 try {
 // Get authentication options
 const options = await WebAuthnService.generateAuthenticationOptions(userId);

 if (!options) {
 setError(t('auth.webauthn.noPasskeyForUser', { defaultValue: 'No passkey registered for this user' }));
 return { success: false, error: t('auth.webauthn.noPasskey', { defaultValue: 'No passkey registered' }) };
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
 setError(t('auth.webauthn.authCancelled', { defaultValue: 'Authentication cancelled' }));
 return { success: false, error: t('auth.webauthn.authCancelled', { defaultValue: 'Authentication cancelled' }) };
 }

 // Verify
 const result = await WebAuthnService.verifyAuthentication(userId, credential);

 if (!result.success) {
 setError(result.error || t('auth.webauthn.verificationError', { defaultValue: 'Verification error' }));
 }

 return result;
 } catch (err) {
 ErrorLogger.error(err, 'useWebAuthn.authenticate');
 const errorMessage = err instanceof Error ? err.message : t('auth.webauthn.unknownError', { defaultValue: 'Unknown error' });

 // Handle specific WebAuthn errors
 if (err instanceof DOMException) {
 if (err.name === 'NotAllowedError') {
 setError(t('auth.webauthn.authCancelledOrDenied', { defaultValue: 'Authentication cancelled or denied' }));
 return { success: false, error: t('auth.webauthn.authCancelled', { defaultValue: 'Authentication cancelled' }) };
 }
 if (err.name === 'SecurityError') {
 setError(t('auth.webauthn.securityError', { defaultValue: 'Security error - verify you are on the correct domain' }));
 return { success: false, error: t('auth.webauthn.securityErrorShort', { defaultValue: 'Security error' }) };
 }
 }

 ErrorLogger.error(err, 'useWebAuthn.authenticateWithPasskey');
 setError(errorMessage);
 return { success: false, error: errorMessage };
 } finally {
 setIsLoading(false);
 }
 }, [isSupported, t]);

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
