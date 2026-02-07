import { collection, query, where, QueryConstraint, Query, DocumentData } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Creates a Firestore query that ALWAYS includes organizationId filter.
 * This prevents cross-tenant data leakage by enforcing tenant isolation at the query level.
 *
 * @param collectionPath - Firestore collection path
 * @param organizationId - The organization ID to filter by
 * @param constraints - Additional query constraints (where, orderBy, limit, etc.)
 * @returns A Firestore Query with organizationId filter guaranteed
 */
export function createTenantQuery(
  collectionPath: string,
  organizationId: string,
  ...constraints: QueryConstraint[]
): Query<DocumentData> {
  if (!organizationId) {
    throw new Error(`[TenantQuery] organizationId is required for collection "${collectionPath}". This is a security requirement to prevent cross-tenant data access.`);
  }

  const collectionRef = collection(db, collectionPath);
  return query(
    collectionRef,
    where('organizationId', '==', organizationId),
    ...constraints
  );
}

/**
 * Creates a tenant-scoped collection reference path.
 * Use when the collection is nested under organizations.
 * Example: organizations/{orgId}/subcollection
 */
export function tenantCollectionPath(organizationId: string, subcollection: string): string {
  if (!organizationId) {
    throw new Error(`[TenantQuery] organizationId is required for subcollection "${subcollection}".`);
  }
  return `organizations/${organizationId}/${subcollection}`;
}

/**
 * Validates that a document belongs to the expected organization.
 * Use as a safety check when reading individual documents.
 */
export function validateTenantAccess(
  documentData: { organizationId?: string } | undefined,
  expectedOrgId: string,
  context: string
): boolean {
  if (!documentData) return false;
  if (documentData.organizationId !== expectedOrgId) {
    console.error(`[TenantQuery] Cross-tenant access attempt detected in ${context}. Expected: ${expectedOrgId}, Got: ${documentData.organizationId}`);
    return false;
  }
  return true;
}
