/**
 * useDuplicate Hook (Story 1.6)
 *
 * Generic hook for duplicating entities in Firestore.
 * Adds locale-aware suffix to name field and resets status fields.
 *
 * @module useDuplicate
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import { useLocale } from './useLocale';
import { logAction } from '../services/logger';
import { ErrorLogger } from '../services/errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import type { SupportedLocale } from '../config/localeConfig';

/**
 * Localized suffix for duplicated entities
 */

/**
 * Options for configuring the duplicate behavior
 */
export interface UseDuplicateOptions<T> {
 /** Firestore collection name (e.g., 'risks', 'assets') */
 collectionName: string;
 /** Field name that contains the entity name/title to add suffix to */
 nameField: keyof T;
 /** Fields to reset on duplicate (e.g., status, dates) */
 resetFields?: Partial<T>;
 /** Entity type name for audit logging (e.g., 'Risk', 'Asset') */
 entityType?: string;
 /** Callback after successful duplication */
 onSuccess?: (newEntity: T & { id: string }) => void;
 /** Callback on duplication error */
 onError?: (error: Error) => void;
}

/**
 * Return type for the useDuplicate hook
 */
export interface UseDuplicateReturn<T> {
 /** Function to duplicate an entity */
 duplicate: (entity: T) => Promise<string | null>;
 /** Whether a duplication is in progress */
 isDuplicating: boolean;
 /** Error from the last duplication attempt */
 error: Error | null;
 /** Clear the error state */
 clearError: () => void;
}

// Re-export utility (moved to utils/duplicateUtils.ts to satisfy hooks naming convention)
export { addDuplicateSuffix } from '../utils/duplicateUtils';

/**
 * Hook for duplicating entities in Firestore
 *
 * @param options - Configuration for the duplicate behavior
 * @returns Duplicate function, loading state, and error state
 *
 * @example
 * ```tsx
 * const { duplicate, isDuplicating } = useDuplicate({
 * collectionName: 'risks',
 * nameField: 'threat',
 * resetFields: { status: 'Ouvert' },
 * entityType: 'Risk',
 * onSuccess: (newRisk) => toast.success('Risque dupliqué avec succès'),
 * });
 *
 * // Later...
 * await duplicate(existingRisk);
 * ```
 */
export function useDuplicate<T extends { id: string }>(
 options: UseDuplicateOptions<T>
): UseDuplicateReturn<T> {
 const {
 collectionName,
 nameField,
 resetFields: resetFieldsRaw,
 entityType = 'Entity',
 onSuccess,
 onError,
 } = options;

 // Memoize resetFields to avoid unstable dependency in useCallback
 const resetFieldsKey = JSON.stringify(resetFieldsRaw);
 // Justification: resetFieldsRaw is intentionally excluded -- resetFieldsKey (JSON.stringify)
 // provides a stable key to memoize against, avoiding reference equality issues.
 const resetFields = useMemo(() => resetFieldsRaw ?? ({} as Partial<T>), [resetFieldsKey]); // eslint-disable-line react-hooks/exhaustive-deps

 const { user } = useAuth();
 const { locale } = useLocale();
 const [isDuplicating, setIsDuplicating] = useState(false);
 const [error, setError] = useState<Error | null>(null);
 const duplicatingRef = useRef(false); // Synchronous guard for double-click prevention

 const clearError = useCallback(() => {
 setError(null);
 }, []);

 const duplicate = useCallback(
 async (entity: T): Promise<string | null> => {
 if (!user?.organizationId || !user?.uid) {
 const err = new Error('User not authenticated or missing organization');
 setError(err);
 onError?.(err);
 return null;
 }

 // Use ref for synchronous double-click prevention
 if (duplicatingRef.current) {
 return null; // Prevent double-click
 }

 duplicatingRef.current = true;
 setIsDuplicating(true);
 setError(null);

 try {
 // Get the original name and add suffix
 const originalName = String(entity[nameField] || '');
 const newName = addDuplicateSuffix(originalName, locale);

 const {
 id: _id,
 createdAt: _createdAt,
 updatedAt: _updatedAt,
 ...entityData
 } = entity as T & { createdAt?: unknown; updatedAt?: unknown };
 const duplicateData = {
 ...entityData,
 [nameField]: newName,
 ...resetFields,
 organizationId: user.organizationId,
 createdAt: serverTimestamp(),
 createdBy: user.uid,
 duplicatedFrom: entity.id,
 };

 // Create the new document
 const docRef = await addDoc(
 collection(db, collectionName),
 sanitizeData(duplicateData)
 );

 // Audit log
 await logAction(
 user,
 'CREATE',
 entityType,
 `Duplication ${entityType}: ${newName} (from ${originalName})`
 ).catch((logError) => {
 // Don't fail the operation if logging fails
 ErrorLogger.warn('Failed to log duplicate action', 'useDuplicate', {
 metadata: { error: logError },
 });
 });

 // Call success callback with the new entity
 const newEntity = {
 ...duplicateData,
 id: docRef.id,
 } as unknown as T & { id: string };

 onSuccess?.(newEntity);

 return docRef.id;
 } catch (err) {
 const error = err instanceof Error ? err : new Error('Duplication failed');
 setError(error);
 onError?.(error);

 ErrorLogger.error(err, 'useDuplicate.duplicate', {
 metadata: {
 collectionName,
 entityId: entity.id,
 entityType,
 },
 });

 return null;
 } finally {
 duplicatingRef.current = false;
 setIsDuplicating(false);
 }
 },
 [
 user,
 locale,
 collectionName,
 nameField,
 resetFields,
 entityType,
 onSuccess,
 onError,
 ]
 );

 return {
 duplicate,
 isDuplicating,
 error,
 clearError,
 };
}

export default useDuplicate;
