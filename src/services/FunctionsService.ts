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
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            return (result.data as any).success === true;
        } catch (error: unknown) {
            // Check for known "failed-precondition" from backend (dependency block)
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            if ((error as any).code === 'failed-precondition' || (error as any).message?.includes('Impossible de supprimer')) {
                // Propagate the specific message for UI display
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                throw new Error((error as any).message || "Suppression bloquée par des dépendances.");
            }

            ErrorLogger.error(error, 'FunctionsService.deleteResource');
            throw error;
        }
    }
};
