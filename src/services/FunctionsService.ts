import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { ErrorLogger } from './errorLogger';

/** Response type for Cloud Function deleteResource */
interface DeleteResourceResponse {
 success: boolean;
 message?: string;
}

/** Firebase error with code and message */
interface FirebaseError {
 code?: string;
 message?: string;
}

/** Type guard for Firebase errors */
function isFirebaseError(error: unknown): error is FirebaseError {
 return typeof error === 'object' && error !== null && ('code' in error || 'message' in error);
}

export const FunctionsService = {
 /**
 * Securely deletes a resource via Cloud Function, enforcing dependency checks.
 * @param collectionName The Firestore collection name (e.g., 'assets', 'risks')
 * @param docId The document ID to delete
 * @returns Promise resolving to true if successful
 * @throws Error if deletion is blocked or fails
 */
 async deleteResource(collectionName: string, docId: string): Promise<boolean> {
 try {
 const deleteFn = httpsCallable<{ collectionName: string; docId: string }, DeleteResourceResponse>(functions, 'deleteResource');
 const result = await deleteFn({ collectionName, docId });
 return result.data.success === true;
 } catch (error: unknown) {
 // Check for known "failed-precondition" from backend (dependency block)
 if (isFirebaseError(error)) {
 if (error.code === 'failed-precondition' || error.message?.includes('Impossible de supprimer')) {
  // Propagate the specific message for UI display
  throw new Error(error.message || "Suppression bloquée par des dépendances.");
 }
 }

 ErrorLogger.error(error, 'FunctionsService.deleteResource');
 throw error;
 }
 }
};
