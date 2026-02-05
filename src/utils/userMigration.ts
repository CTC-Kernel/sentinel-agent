import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';

import { ErrorLogger } from '../services/errorLogger';

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
 const functions = getFunctions(app, 'europe-west1');
 const fixAllUsersFunc = httpsCallable(functions, 'fixAllUsers');

 const result = await fixAllUsersFunc();
 return result.data as {
 success: boolean;
 results?: {
 total: number;
 fixed: number;
 alreadyOk: number;
 errors: Array<{ userId: string; error: string }>;
 };
 error?: string;
 };
 } catch (error) {
 ErrorLogger.error(error, 'UserMigration.fixAllUsers');
 return {
 success: false,
 error: error instanceof Error ? error.message : 'Unknown error'
 };
 }
};
