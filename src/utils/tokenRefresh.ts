import { auth } from '../firebase';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { ErrorLogger } from '../services/errorLogger';

// Flag used to prevent infinite refresh loops across reloads
const SESSION_REFRESH_KEY = 'tokenJustRefreshed';

/**
 * Force refresh the current user's ID token to get updated custom claims
 */
export const refreshUserToken = async (): Promise<boolean> => {
 try {
 const user = auth.currentUser;
 if (!user) {
 return false;
 }

 // Call the Cloud Function to update custom claims
 const app = getApp();
 const functions = getFunctions(app, 'europe-west1');
 const refreshToken = httpsCallable(functions, 'refreshUserToken');

 const result = await refreshToken();
 const data = result.data as { success: boolean };

 if (!data.success) {
 return false;
 }

 // Force token refresh on client side
 await user.getIdToken(true);
 return true;
 } catch {
 ErrorLogger.debug('Token refresh failed', 'tokenRefresh');
 return false;
 }
};

/**
 * Check if user has custom claims set
 */
export const hasCustomClaims = async (): Promise<boolean> => {
 try {
 const user = auth.currentUser;
 if (!user) return false;

 const tokenResult = await user.getIdTokenResult();
 return !!(tokenResult.claims.organizationId);
 } catch {
 ErrorLogger.debug('Token refresh failed', 'tokenRefresh');
 return false;
 }
};

/**
 * Auto-refresh token on app load if custom claims are missing
 */
export const autoRefreshTokenIfNeeded = async (): Promise<void> => {
 try {
 if (sessionStorage.getItem(SESSION_REFRESH_KEY)) {
 sessionStorage.removeItem(SESSION_REFRESH_KEY);
 return;
 }

 const hasClaims = await hasCustomClaims();
 if (!hasClaims) {
 const success = await refreshUserToken();

 if (success) {
 sessionStorage.setItem(SESSION_REFRESH_KEY, 'true');
 window.location.reload();
 }
 }
 } catch {
 ErrorLogger.debug('Token refresh failed', 'tokenRefresh');
 }
};
