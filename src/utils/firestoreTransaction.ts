import { writeBatch, doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from '../services/errorLogger';

/**
 * Execute multiple Firestore document updates atomically using a batch write.
 * If any update fails, ALL updates are rolled back.
 *
 * @param operations - Array of { collection, docId, data } to update
 * @returns Promise that resolves when all updates succeed
 */
export async function batchUpdate(
  operations: Array<{
    collection: string;
    docId: string;
    data: Record<string, unknown>;
  }>
): Promise<void> {
  if (operations.length === 0) return;
  if (operations.length > 500) {
    throw new Error('Firestore batch limit is 500 operations. Split into multiple batches.');
  }

  const batch = writeBatch(db);

  for (const op of operations) {
    const docRef = doc(db, op.collection, op.docId);
    batch.update(docRef, op.data);
  }

  try {
    await batch.commit();
  } catch (error) {
    ErrorLogger.error(error, 'firestoreTransaction.batchUpdate', {
      metadata: { operationCount: operations.length, collections: [...new Set(operations.map(o => o.collection))] }
    });
    throw error;
  }
}

/**
 * Execute multiple Firestore document creates atomically using a batch write.
 */
export async function batchCreate(
  operations: Array<{
    collection: string;
    docId?: string;
    data: Record<string, unknown>;
  }>
): Promise<string[]> {
  if (operations.length === 0) return [];
  if (operations.length > 500) {
    throw new Error('Firestore batch limit is 500 operations. Split into multiple batches.');
  }

  const batch = writeBatch(db);
  const docIds: string[] = [];

  for (const op of operations) {
    const docRef = op.docId
      ? doc(db, op.collection, op.docId)
      : doc(db, op.collection, crypto.randomUUID());
    batch.set(docRef, op.data);
    docIds.push(docRef.id);
  }

  try {
    await batch.commit();
    return docIds;
  } catch (error) {
    ErrorLogger.error(error, 'firestoreTransaction.batchCreate', {
      metadata: { operationCount: operations.length }
    });
    throw error;
  }
}

/**
 * Execute a read-then-write transaction atomically.
 * Use when you need to read a document and update it based on its current value.
 *
 * @param callback - Function that receives a transaction object
 * @returns Promise with the result of the callback
 */
export async function atomicTransaction<T>(
  callback: (transaction: Parameters<Parameters<typeof runTransaction>[1]>[0]) => Promise<T>
): Promise<T> {
  try {
    return await runTransaction(db, callback);
  } catch (error) {
    ErrorLogger.error(error, 'firestoreTransaction.atomicTransaction');
    throw error;
  }
}

/**
 * Batch delete multiple documents atomically.
 */
export async function batchDelete(
  operations: Array<{
    collection: string;
    docId: string;
  }>
): Promise<void> {
  if (operations.length === 0) return;
  if (operations.length > 500) {
    throw new Error('Firestore batch limit is 500 operations.');
  }

  const batch = writeBatch(db);

  for (const op of operations) {
    const docRef = doc(db, op.collection, op.docId);
    batch.delete(docRef);
  }

  try {
    await batch.commit();
  } catch (error) {
    ErrorLogger.error(error, 'firestoreTransaction.batchDelete', {
      metadata: { operationCount: operations.length }
    });
    throw error;
  }
}
