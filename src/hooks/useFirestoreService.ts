import { useCallback } from 'react';
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    setDoc,
    serverTimestamp,
    DocumentData,
    WithFieldValue,
    UpdateData,
    SetOptions
} from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store';
import { sanitizeData } from '../utils/dataSanitizer';
import { ErrorLogger } from '../services/errorLogger';

interface EnrichedData extends DocumentData {
    organizationId?: string;
    updatedAt: ReturnType<typeof serverTimestamp>;
    updatedBy?: string;
}

/**
 * Centered Firestore Write Service Hook
 * 
 * Provides secured and audited write operations for Firestore.
 * Automatically applies data sanitization and handles demo mode.
 * Part of Audit Round 3 Remediation.
 */
export const useFirestoreService = () => {
    const { demoMode, user } = useStore();

    /**
     * Internal helper to verify organization context
     * (Basic check, actual enforcement should be in rules/backend)
     */
    const getEnrichedData = useCallback((data: WithFieldValue<DocumentData>): EnrichedData => {
        // Automatically inject organizationId if available and missing
        if (user?.organizationId && !data.organizationId) {
            return {
                ...data,
                organizationId: user.organizationId,
                updatedAt: serverTimestamp(),
                updatedBy: user.uid
            };
        }
        return {
            ...data,
            updatedAt: serverTimestamp(),
            updatedBy: user?.uid
        };
    }, [user]);

    /**
     * Securely add a document to a collection
     */
    const addDocument = useCallback(async (collectionName: string, data: WithFieldValue<DocumentData>) => {
        if (demoMode) {
            return `mock-id-${Date.now()}`;
        }

        try {
            const sanitized = sanitizeData(getEnrichedData(data));
            const docRef = await addDoc(collection(db, collectionName), sanitized);
            return docRef.id;
        } catch (error) {
            ErrorLogger.error(error, `FirestoreService.addDocument.${collectionName}`);
            throw error;
        }
    }, [demoMode, getEnrichedData]);

    /**
     * Securely update a document
     */
    const updateDocument = useCallback(async (collectionName: string, id: string, data: UpdateData<DocumentData>) => {
        if (demoMode) return;

        try {
            const sanitized = sanitizeData(getEnrichedData(data));
            const docRef = doc(db, collectionName, id);
            await updateDoc(docRef, sanitized);
        } catch (error) {
            ErrorLogger.error(error, `FirestoreService.updateDocument.${collectionName}.${id}`);
            throw error;
        }
    }, [demoMode, getEnrichedData]);

    /**
     * Securely set a document (create or overwrite)
     */
    const setDocument = useCallback(async (collectionName: string, id: string, data: WithFieldValue<DocumentData>, options?: SetOptions) => {
        if (demoMode) return;

        try {
            const sanitized = sanitizeData(getEnrichedData(data));
            const docRef = doc(db, collectionName, id);
            if (options) {
                await setDoc(docRef, sanitized, options);
            } else {
                await setDoc(docRef, sanitized);
            }
        } catch (error) {
            ErrorLogger.error(error, `FirestoreService.setDocument.${collectionName}.${id}`);
            throw error;
        }
    }, [demoMode, getEnrichedData]);

    /**
     * Securely delete a document
     */
    const deleteDocument = useCallback(async (collectionName: string, id: string) => {
        if (demoMode) return;

        try {
            const docRef = doc(db, collectionName, id);
            await deleteDoc(docRef);
        } catch (error) {
            ErrorLogger.error(error, `FirestoreService.deleteDocument.${collectionName}.${id}`);
            throw error;
        }
    }, [demoMode]);

    return {
        addDocument,
        updateDocument,
        setDocument,
        deleteDocument
    };
};
