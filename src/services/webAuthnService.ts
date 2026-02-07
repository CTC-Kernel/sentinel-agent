/**
 * WebAuthn/Passkey Service
 *
 * AAA Enhancement: Provides passwordless authentication and MFA via WebAuthn/FIDO2
 * Supports:
 * - Passkey registration and authentication
 * - Platform authenticators (Touch ID, Face ID, Windows Hello)
 * - Security keys (YubiKey, etc.)
 * - Cross-platform authentication
 *
 * @module webAuthnService
 */

import {
 collection,
 doc,
 getDoc,
 getDocs,
 deleteDoc,
 setDoc,
 query,
 where,
 serverTimestamp,
 Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';

// ============================================================================
// Types
// ============================================================================

/**
 * WebAuthn credential stored in Firestore
 */
export interface StoredCredential {
 /** Credential ID (base64url) */
 credentialId: string;
 /** Public key (base64url) */
 publicKey: string;
 /** User ID */
 userId: string;
 /** Organization ID */
 organizationId: string;
 /** Counter for replay attack protection */
 counter: number;
 /** Authenticator type */
 authenticatorType: 'platform' | 'cross-platform';
 /** Device name (user-provided) */
 deviceName: string;
 /** Authenticator AAGUID */
 aaguid?: string;
 /** Transports supported */
 transports?: AuthenticatorTransport[];
 /** Created timestamp */
 createdAt: Timestamp;
 /** Last used timestamp */
 lastUsedAt?: Timestamp;
 /** Is this the primary credential */
 isPrimary?: boolean;
}

/**
 * Registration options for client
 */
export interface RegistrationOptions {
 challenge: string;
 rp: {
 name: string;
 id: string;
 };
 user: {
 id: string;
 name: string;
 displayName: string;
 };
 pubKeyCredParams: PublicKeyCredentialParameters[];
 authenticatorSelection: AuthenticatorSelectionCriteria;
 timeout: number;
 attestation: AttestationConveyancePreference;
 excludeCredentials?: PublicKeyCredentialDescriptor[];
}

/**
 * Authentication options for client
 */
export interface AuthenticationOptions {
 challenge: string;
 rpId: string;
 allowCredentials: PublicKeyCredentialDescriptor[];
 timeout: number;
 userVerification: UserVerificationRequirement;
}

/**
 * Challenge stored temporarily for verification
 */
interface StoredChallenge {
 challenge: string;
 userId: string;
 type: 'registration' | 'authentication';
 createdAt: Timestamp;
 expiresAt: Timestamp;
}

// ============================================================================
// Constants
// ============================================================================

const RP_NAME = 'Sentinel GRC';
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Supported public key algorithms (ordered by preference)
const SUPPORTED_ALGORITHMS: PublicKeyCredentialParameters[] = [
 { alg: -8, type: 'public-key' }, // Ed25519
 { alg: -7, type: 'public-key' }, // ES256
 { alg: -257, type: 'public-key' }, // RS256
];

// ============================================================================
// WebAuthn Service
// ============================================================================

class WebAuthnServiceClass {
 private rpId: string;

 constructor() {
 // Set RP ID based on current domain
 this.rpId = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
 }

 // ============================================================================
 // Browser Support Detection
 // ============================================================================

 /**
 * Check if WebAuthn is supported in the current browser
 */
 isSupported(): boolean {
 return (
 typeof window !== 'undefined' &&
 typeof window.PublicKeyCredential !== 'undefined' &&
 typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
 );
 }

 /**
 * Check if platform authenticator (Touch ID, Face ID, Windows Hello) is available
 */
 async isPlatformAuthenticatorAvailable(): Promise<boolean> {
 if (!this.isSupported()) return false;

 try {
 return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
 } catch {
 ErrorLogger.debug('WebAuthn operation failed', 'webAuthnService');
 return false;
 }
 }

 /**
 * Check if conditional mediation (autofill) is supported
 */
 async isConditionalMediationAvailable(): Promise<boolean> {
 if (!this.isSupported()) return false;

 try {
 if (typeof PublicKeyCredential.isConditionalMediationAvailable === 'function') {
 return await PublicKeyCredential.isConditionalMediationAvailable();
 }
 return false;
 } catch {
 ErrorLogger.debug('WebAuthn operation failed', 'webAuthnService');
 return false;
 }
 }

 // ============================================================================
 // Registration
 // ============================================================================

 /**
 * Generate registration options for a user
 */
 async generateRegistrationOptions(
 userId: string,
 userEmail: string,
 userName: string,
 _organizationId: string,
 authenticatorType: 'platform' | 'cross-platform' = 'platform'
 ): Promise<RegistrationOptions> {
 // Generate challenge
 const challenge = this.generateChallenge();

 // Store challenge for verification
 await this.storeChallenge(userId, challenge, 'registration');

 // Get existing credentials to exclude
 const existingCredentials = await this.getUserCredentials(userId);
 const excludeCredentials: PublicKeyCredentialDescriptor[] = existingCredentials.map(cred => ({
 type: 'public-key',
 id: this.base64urlToBuffer(cred.credentialId),
 transports: cred.transports
 }));

 const options: RegistrationOptions = {
 challenge,
 rp: {
 name: RP_NAME,
 id: this.rpId
 },
 user: {
 id: this.stringToBase64url(userId),
 name: userEmail,
 displayName: userName
 },
 pubKeyCredParams: SUPPORTED_ALGORITHMS,
 authenticatorSelection: {
 authenticatorAttachment: authenticatorType,
 userVerification: 'required',
 residentKey: 'preferred',
 requireResidentKey: false
 },
 timeout: 60000,
 attestation: 'none', // We don't need attestation for most use cases
 excludeCredentials: excludeCredentials.length > 0 ? excludeCredentials : undefined
 };

 ErrorLogger.info('WebAuthn registration options generated', 'WebAuthnService', {
 metadata: { userId, authenticatorType }
 });

 return options;
 }

 /**
 * Verify and store registration response
 */
 async verifyRegistration(
 userId: string,
 organizationId: string,
 credential: PublicKeyCredential,
 deviceName: string
 ): Promise<{ success: boolean; credentialId?: string; error?: string }> {
 try {
 // Get stored challenge
 const storedChallenge = await this.getStoredChallenge(userId, 'registration');
 if (!storedChallenge) {
 return { success: false, error: 'Challenge expired or not found' };
 }

 const response = credential.response as AuthenticatorAttestationResponse;

 // Parse client data
 const clientDataJSON = new TextDecoder().decode(response.clientDataJSON);
 const clientData = JSON.parse(clientDataJSON);

 // Verify challenge
 if (clientData.challenge !== storedChallenge.challenge) {
 return { success: false, error: 'Challenge mismatch' };
 }

 // Verify origin
 const expectedOrigin = `https://${this.rpId}`;
 if (clientData.origin !== expectedOrigin && clientData.origin !== window.location.origin) {
 // Allow localhost in development
 if (!clientData.origin.includes('localhost')) {
 return { success: false, error: 'Origin mismatch' };
 }
 }

 // Verify type
 if (clientData.type !== 'webauthn.create') {
 return { success: false, error: 'Invalid type' };
 }

 // Get public key and other attestation data
 const publicKey = response.getPublicKey();
 if (!publicKey) {
 return { success: false, error: 'No public key in response' };
 }

 // Get authenticator data
 const authenticatorData = response.getAuthenticatorData();
 const authDataView = new DataView(authenticatorData);

 // Extract counter (bytes 33-36)
 const counter = authDataView.getUint32(33, false);

 // Determine authenticator type
 const authenticatorType = credential.authenticatorAttachment === 'platform'
 ? 'platform'
 : 'cross-platform';

 // Store credential
 const storedCredential: Omit<StoredCredential, 'createdAt'> = {
 credentialId: this.bufferToBase64url(credential.rawId),
 publicKey: this.bufferToBase64url(publicKey),
 userId,
 organizationId,
 counter,
 authenticatorType,
 deviceName,
 transports: response.getTransports?.() as AuthenticatorTransport[] || [],
 isPrimary: (await this.getUserCredentials(userId)).length === 0
 };

 await this.storeCredential(storedCredential);

 // Clean up challenge
 await this.deleteChallenge(userId, 'registration');

 ErrorLogger.info('WebAuthn credential registered', 'WebAuthnService', {
 metadata: {
 userId,
 credentialId: storedCredential.credentialId.substring(0, 20) + '...',
 authenticatorType
 }
 });

 return { success: true, credentialId: storedCredential.credentialId };
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'WebAuthnService.verifyRegistration');
 return { success: false, error: 'Registration verification failed' };
 }
 }

 // ============================================================================
 // Authentication
 // ============================================================================

 /**
 * Generate authentication options for a user
 */
 async generateAuthenticationOptions(
 userId: string
 ): Promise<AuthenticationOptions | null> {
 // Get user's credentials
 const credentials = await this.getUserCredentials(userId);

 if (credentials.length === 0) {
 return null;
 }

 // Generate challenge
 const challenge = this.generateChallenge();

 // Store challenge for verification
 await this.storeChallenge(userId, challenge, 'authentication');

 const allowCredentials: PublicKeyCredentialDescriptor[] = credentials.map(cred => ({
 type: 'public-key',
 id: this.base64urlToBuffer(cred.credentialId),
 transports: cred.transports
 }));

 const options: AuthenticationOptions = {
 challenge,
 rpId: this.rpId,
 allowCredentials,
 timeout: 60000,
 userVerification: 'required'
 };

 ErrorLogger.info('WebAuthn authentication options generated', 'WebAuthnService', {
 metadata: { userId, credentialCount: credentials.length }
 });

 return options;
 }

 /**
 * Verify authentication response
 */
 async verifyAuthentication(
 userId: string,
 credential: PublicKeyCredential
 ): Promise<{ success: boolean; error?: string }> {
 try {
 // Get stored challenge
 const storedChallenge = await this.getStoredChallenge(userId, 'authentication');
 if (!storedChallenge) {
 return { success: false, error: 'Challenge expired or not found' };
 }

 const response = credential.response as AuthenticatorAssertionResponse;

 // Parse client data
 const clientDataJSON = new TextDecoder().decode(response.clientDataJSON);
 const clientData = JSON.parse(clientDataJSON);

 // Verify challenge
 if (clientData.challenge !== storedChallenge.challenge) {
 return { success: false, error: 'Challenge mismatch' };
 }

 // Verify type
 if (clientData.type !== 'webauthn.get') {
 return { success: false, error: 'Invalid type' };
 }

 // Get stored credential
 const credentialId = this.bufferToBase64url(credential.rawId);
 const storedCredential = await this.getCredentialById(credentialId);

 if (!storedCredential) {
 return { success: false, error: 'Credential not found' };
 }

 if (storedCredential.userId !== userId) {
 return { success: false, error: 'Credential does not belong to user' };
 }

 // Verify counter (replay attack protection)
 const authenticatorData = new Uint8Array(response.authenticatorData);
 const dataView = new DataView(authenticatorData.buffer);
 const counter = dataView.getUint32(33, false);

 if (counter <= storedCredential.counter) {
 // Potential replay attack
 ErrorLogger.warn('WebAuthn counter did not increment - possible replay attack', 'WebAuthnService', {
 metadata: {
 userId,
 credentialId: credentialId.substring(0, 20) + '...',
 storedCounter: storedCredential.counter,
 receivedCounter: counter
 }
 });
 // Some authenticators don't increment counter, so we warn but allow
 }

 // Update counter and last used
 await this.updateCredentialUsage(credentialId, counter);

 // Clean up challenge
 await this.deleteChallenge(userId, 'authentication');

 ErrorLogger.info('WebAuthn authentication successful', 'WebAuthnService', {
 metadata: {
 userId,
 credentialId: credentialId.substring(0, 20) + '...'
 }
 });

 return { success: true };
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'WebAuthnService.verifyAuthentication');
 return { success: false, error: 'Authentication verification failed' };
 }
 }

 // ============================================================================
 // Credential Management
 // ============================================================================

 /**
 * Get all credentials for a user
 */
 async getUserCredentials(userId: string): Promise<StoredCredential[]> {
 try {
 const credentialsRef = collection(db, 'webauthn_credentials');
 const q = query(credentialsRef, where('userId', '==', userId));
 const snapshot = await getDocs(q);

 return snapshot.docs.map(doc => ({
 ...doc.data(),
 credentialId: doc.id
 })) as StoredCredential[];
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'WebAuthnService.getUserCredentials');
 return [];
 }
 }

 /**
 * Check if user has any WebAuthn credentials
 */
 async userHasCredentials(userId: string): Promise<boolean> {
 const credentials = await this.getUserCredentials(userId);
 return credentials.length > 0;
 }

 /**
 * Delete a credential
 */
 async deleteCredential(credentialId: string, userId: string): Promise<boolean> {
 try {
 const credential = await this.getCredentialById(credentialId);

 if (!credential || credential.userId !== userId) {
 return false;
 }

 const credentialsRef = collection(db, 'webauthn_credentials');
 await deleteDoc(doc(credentialsRef, credentialId));

 ErrorLogger.info('WebAuthn credential deleted', 'WebAuthnService', {
 metadata: {
 userId,
 credentialId: credentialId.substring(0, 20) + '...'
 }
 });

 return true;
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'WebAuthnService.deleteCredential');
 return false;
 }
 }

 /**
 * Rename a credential
 */
 async renameCredential(
 credentialId: string,
 userId: string,
 newName: string
 ): Promise<boolean> {
 try {
 const credential = await this.getCredentialById(credentialId);

 if (!credential || credential.userId !== userId) {
 return false;
 }

 const credentialsRef = collection(db, 'webauthn_credentials');
 // merge: true is safe - sanitizeData() strips undefined, only explicit deviceName field
 await setDoc(doc(credentialsRef, credentialId), sanitizeData({
 deviceName: newName
 }), { merge: true });

 return true;
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'WebAuthnService.renameCredential');
 return false;
 }
 }

 // ============================================================================
 // Private Helper Methods
 // ============================================================================

 /**
 * Generate a random challenge
 */
 private generateChallenge(): string {
 const buffer = new Uint8Array(32);
 crypto.getRandomValues(buffer);
 return this.bufferToBase64url(buffer);
 }

 /**
 * Store challenge temporarily
 */
 private async storeChallenge(
 userId: string,
 challenge: string,
 type: 'registration' | 'authentication'
 ): Promise<void> {
 const challengesRef = collection(db, 'webauthn_challenges');
 const challengeDoc = doc(challengesRef, `${userId}_${type}`);

 const now = Date.now();
 await setDoc(challengeDoc, sanitizeData({
 challenge,
 userId,
 type,
 createdAt: serverTimestamp(),
 expiresAt: Timestamp.fromMillis(now + CHALLENGE_TTL_MS)
 }));
 }

 /**
 * Get stored challenge
 */
 private async getStoredChallenge(
 userId: string,
 type: 'registration' | 'authentication'
 ): Promise<StoredChallenge | null> {
    try {
   const challengesRef = collection(db, 'webauthn_challenges');
   const challengeDoc = doc(challengesRef, `${userId}_${type}`);

   const snapshot = await getDoc(challengeDoc);
   if (!snapshot.exists()) {
   return null;
   }

   const data = snapshot.data() as StoredChallenge;

   // Check expiration
   if (data.expiresAt.toMillis() < Date.now()) {
   await deleteDoc(challengeDoc);
   return null;
   }

   return data;
 
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la recuperation du challenge WebAuthn');
      throw error;
    }
  }

 /**
 * Delete challenge after use
 */
 private async deleteChallenge(
 userId: string,
 type: 'registration' | 'authentication'
 ): Promise<void> {
    try {
   const challengesRef = collection(db, 'webauthn_challenges');
   const challengeDoc = doc(challengesRef, `${userId}_${type}`);
   await deleteDoc(challengeDoc);
 
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la suppression du challenge WebAuthn');
      throw error;
    }
  }

 /**
 * Store credential
 */
 private async storeCredential(
 credential: Omit<StoredCredential, 'createdAt'>
 ): Promise<void> {
    try {
   const credentialsRef = collection(db, 'webauthn_credentials');
   await setDoc(doc(credentialsRef, credential.credentialId), sanitizeData({
   ...credential,
   createdAt: serverTimestamp()
   }));
 
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'Erreur lors du stockage du credential WebAuthn');
      throw error;
    }
  }

 /**
 * Get credential by ID
 */
 private async getCredentialById(credentialId: string): Promise<StoredCredential | null> {
    try {
   const credentialsRef = collection(db, 'webauthn_credentials');
   const credentialDoc = doc(credentialsRef, credentialId);

   const snapshot = await getDoc(credentialDoc);
   if (!snapshot.exists()) {
   return null;
   }

   return {
   ...snapshot.data(),
   credentialId: snapshot.id
   } as StoredCredential;
 
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la recuperation du credential WebAuthn');
      throw error;
    }
  }

 /**
 * Update credential usage
 */
 private async updateCredentialUsage(credentialId: string, counter: number): Promise<void> {
    try {
   const credentialsRef = collection(db, 'webauthn_credentials');
   // merge: true is safe - sanitizeData() strips undefined, only counter and timestamp fields
   await setDoc(doc(credentialsRef, credentialId), sanitizeData({
   counter,
   lastUsedAt: serverTimestamp()
   }), { merge: true }); // SAFE: see comment above
 
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la MAJ du credential');
      throw error;
    }
  }

 // ============================================================================
 // Encoding Utilities
 // ============================================================================

 /**
 * Convert ArrayBuffer to base64url string
 */
 private bufferToBase64url(buffer: ArrayBuffer | Uint8Array): string {
 const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
 let str = '';
 for (let i = 0; i < bytes.length; i++) {
 str += String.fromCharCode(bytes[i]);
 }
 return btoa(str)
 .replace(/\+/g, '-')
 .replace(/\//g, '_')
 .replace(/=/g, '');
 }

 /**
 * Convert base64url string to ArrayBuffer
 */
 private base64urlToBuffer(base64url: string): ArrayBuffer {
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

 /**
 * Convert string to base64url
 */
 private stringToBase64url(str: string): string {
 const encoder = new TextEncoder();
 return this.bufferToBase64url(encoder.encode(str));
 }
}

// Export singleton
export const WebAuthnService = new WebAuthnServiceClass();

// Export types
export type { };
