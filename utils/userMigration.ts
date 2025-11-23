import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';

/**
 * ADMIN ONLY: Fix all users by adding organizationId and setting custom claims
 * This should be run once to migrate existing users
 */
export const fixAllUsers = async (): Promise<{
    success: boolean;
    results?: {
        total: number;
        fixed: number;
        alreadyOk: number;
        errors: Array<{ userId: string; error: string }>;
    };
    error?: string;
}> => {
    try {
        const app = getApp();
        const functions = getFunctions(app);
        const fixAllUsersFunc = httpsCallable(functions, 'fixAllUsers');

        console.log('Calling fixAllUsers Cloud Function...');
        const result = await fixAllUsersFunc();

        console.log('Migration complete:', result.data);
        return result.data as any;
    } catch (error) {
        console.error('Error calling fixAllUsers:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};
