import { collection, query, where, getDocs, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { deleteUser, User } from 'firebase/auth';
import { db, storage } from '../firebase';
import { ref, deleteObject } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { UserProfile } from '../types';
import { ErrorLogger } from './errorLogger';

export class AccountService {
  /**
   * Permanently deletes the current user's account and their user profile document.
   */
  static async deleteAccount(user: UserProfile, firebaseUser: User): Promise<void> {
    if (!user.uid) throw new Error("User ID not found");

    try {
      // 1. Delete user profile document
      await deleteDoc(doc(db, 'users', user.uid));

      // 2. Delete user avatar from storage if exists
      if (user.photoURL && user.photoURL.includes('firebase')) {
        try {
          const photoRef = ref(storage, `avatars/${user.uid}`);
          await deleteObject(photoRef);
        } catch (error) {
          ErrorLogger.error(error, 'AccountService.deleteAccount');
        }
      }

      // 3. If user is the only member of their organization, delete the organization
      if (user.organizationId) {
        try {
          const usersInOrg = await getDocs(
            query(collection(db, 'users'), where('organizationId', '==', user.organizationId))
          );

          // If no other users in this org (we already deleted current user doc), delete the org
          if (usersInOrg.empty) {
            // We use the same Cloud Function if possible? 
            // PROBLEM: The user is already deleted from Firestore (step 1). 
            // If we call Cloud Function, it expects a caller. The caller (firebaseUser) still exists until step 4.
            // However, the Cloud Function checks strict ownership "orgData.ownerId === callerUid".
            // If the user matches the ownerId, it should work.

            // Let's rely on the Cloud Function for atomic cleanup even here.
            await this.deleteOrganization(user.organizationId);
          }
        } catch (error) {
          ErrorLogger.error(error, 'AccountService.deleteAccount.deleteOrg');
          // Start manual forced cleanup of org doc just in case cloud function fails or isn't called
          try {
            await deleteDoc(doc(db, 'organizations', user.organizationId));
          } catch (e) {
            ErrorLogger.error(e, 'AccountService.deleteAccount.manualCleanup');
          }
        }
      }

      // 4. Delete Firebase Auth user
      await deleteUser(firebaseUser);
    } catch (error) {
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
      const functions = getFunctions();
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
