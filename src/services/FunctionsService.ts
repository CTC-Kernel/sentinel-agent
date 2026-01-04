import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { ErrorLogger } from './errorLogger';

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
            const deleteFn = httpsCallable(functions, 'deleteResource');
            const result = await deleteFn({ collectionName, docId });
            return (result.data as any).success === true;
        } catch (error: any) {
            // Check for known "failed-precondition" from backend (dependency block)
            if (error.code === 'failed-precondition' || error.message?.includes('Impossible de supprimer')) {
                // Propagate the specific message for UI display
                throw new Error(error.message || "Suppression bloquée par des dépendances.");
            }

            ErrorLogger.error(error, 'FunctionsService.deleteResource');
            throw error;
        }
    }
};
