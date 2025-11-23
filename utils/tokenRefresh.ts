import { auth } from '../firebase';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { getApp } from 'firebase/app';

/**
 * Force refresh the current user's ID token to get updated custom claims
 */
export const refreshUserToken = async (): Promise<boolean> => {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.warn('No user logged in');
            return false;
        }

        // Call the Cloud Function to update custom claims
        const app = getApp();
        const functions = getFunctions(app);
        const refreshToken = httpsCallable(functions, 'refreshUserToken');

        await refreshToken();

        // Force token refresh on client side
        await user.getIdToken(true);

        console.log('User token refreshed successfully');
        return true;
    } catch (error) {
        console.error('Error refreshing user token:', error);
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
    } catch (error) {
        console.error('Error checking custom claims:', error);
        return false;
    }
};

/**
 * Auto-refresh token on app load if custom claims are missing
 */
export const autoRefreshTokenIfNeeded = async (): Promise<void> => {
    try {
        const hasClaims = await hasCustomClaims();
        if (!hasClaims) {
            console.log('Custom claims missing, refreshing token...');
            await refreshUserToken();
        }
    } catch (error) {
        console.error('Error in auto-refresh:', error);
    }
};
