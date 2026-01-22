import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { UserProfile } from '../types';
import { ErrorLogger } from './errorLogger';

export class AccountService {
  /**
   * GDPR-compliant account deletion (Article 17 - Right to Erasure)
   * Calls Cloud Function for comprehensive data deletion:
   * - Activity logs, consent records, notifications
   * - Comments are anonymized (content preserved, author info removed)
   * - Owned items are anonymized (ownerId cleared)
   * - Storage files are deleted
   * - Auth account is deleted
   */
  static async deleteAccount(_user: UserProfile, _firebaseUser: User): Promise<void> {
    try {
      // Call the GDPR-compliant Cloud Function for complete data erasure
      const deleteUserAccountFn = httpsCallable(functions, 'deleteUserAccount');
      await deleteUserAccountFn({});

      // The Cloud Function handles everything including Auth deletion
      // No additional client-side cleanup needed
    } catch (error) {
      const err = error as { code?: string; message?: string };

      // Handle specific errors
      if (err.code === 'functions/failed-precondition') {
        // User is org owner with other members - must transfer ownership first
        throw new Error(err.message || 'Transférez la propriété de l\'organisation avant de supprimer votre compte.');
      }

      ErrorLogger.error(error, 'AccountService.deleteAccount');
      throw error;
    }
  }

  /**
   * Permanently deletes the entire organization and all associated data.
   * Uses a Cloud Function to ensure atomic and complete deletion (including Auth accounts).
   */
  static async deleteOrganization(organizationId: string): Promise<void> {
    if (!organizationId) throw new Error("Organization ID is required");

    try {
      const deleteOrgFn = httpsCallable(functions, 'deleteOrganization');
      await deleteOrgFn({ organizationId });
    } catch (error) {
      ErrorLogger.error(error, 'AccountService.deleteOrganization');
      throw error;
    }
  }

  /**
   * Updates the user profile.
   */
  static async updateProfile(userId: string, data: Partial<UserProfile>): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      // We use setDoc with merge: true which is equivalent to update but safer if doc doesn't exist
      await setDoc(userRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      ErrorLogger.error(error, 'AccountService.updateProfile');
      throw error;
    }
  }
}
