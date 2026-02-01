/**
 * Story 24.4 - ACL Service
 *
 * Access Control List management for documents.
 * Provides functions to check, grant, and revoke document permissions.
 */

import { Timestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { sanitizeData } from '@/utils/dataSanitizer';
import type { DocumentACL, DocumentPermission } from '@/types/vault';
import type { Document } from '@/types/documents';
import { canAccessClassification } from './vaultConfig';
import { ErrorLogger } from './errorLogger';

/**
 * Permission levels in order of increasing privileges
 */
export const PERMISSION_LEVELS = ['read', 'download', 'edit', 'delete', 'share', 'admin'] as const;
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

/**
 * Human-readable permission labels (French)
 */
export const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  read: 'Lecture',
  download: 'Téléchargement',
  edit: 'Modification',
  delete: 'Suppression',
  share: 'Partage',
  admin: 'Administration',
};

/**
 * Permission descriptions (French)
 */
export const PERMISSION_DESCRIPTIONS: Record<PermissionLevel, string> = {
  read: 'Peut consulter le document',
  download: 'Peut télécharger le document',
  edit: 'Peut modifier le document',
  delete: 'Peut supprimer le document',
  share: 'Peut partager le document avec d\'autres',
  admin: 'Accès complet incluant la gestion des permissions',
};

/**
 * Permission hierarchy - each level includes lower levels
 */
export const PERMISSION_HIERARCHY: Record<PermissionLevel, PermissionLevel[]> = {
  read: ['read'],
  download: ['read', 'download'],
  edit: ['read', 'download', 'edit'],
  delete: ['read', 'download', 'edit', 'delete'],
  share: ['read', 'download', 'edit', 'share'],
  admin: ['read', 'download', 'edit', 'delete', 'share', 'admin'],
};

/**
 * Check if a permission level includes another
 * @param grantedPermission - The permission that was granted
 * @param requiredPermission - The permission being checked
 * @returns True if grantedPermission includes requiredPermission
 */
export function permissionIncludes(
  grantedPermission: PermissionLevel,
  requiredPermission: PermissionLevel
): boolean {
  return PERMISSION_HIERARCHY[grantedPermission].includes(requiredPermission);
}

/**
 * Create a default ACL for a new document
 * @returns Default DocumentACL
 */
export function createDefaultACL(): DocumentACL {
  return {
    defaultAccess: 'classification',
    permissions: [],
  };
}

/**
 * Create a new permission entry
 * @param principalType - Type of principal (user, role, or group)
 * @param principalId - ID of the principal
 * @param access - Permission level
 * @param grantedBy - User ID who granted the permission
 * @param expiresAt - Optional expiration timestamp
 * @returns DocumentPermission object
 */
export function createPermission(
  principalType: 'user' | 'role' | 'group',
  principalId: string,
  access: PermissionLevel,
  grantedBy: string,
  expiresAt?: Date
): DocumentPermission {
  return {
    principalType,
    principalId,
    access,
    grantedBy,
    grantedAt: Timestamp.now(),
    expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : undefined,
  };
}

/**
 * Check if a user has a specific permission on a document
 * @param document - The document to check
 * @param userId - User ID to check
 * @param userRole - User's role
 * @param requiredPermission - Required permission level
 * @param userGroups - Optional array of group IDs the user belongs to
 * @returns True if user has the required permission
 */
export function checkAccess(
  document: Document,
  userId: string,
  userRole: string,
  requiredPermission: PermissionLevel,
  userGroups: string[] = []
): boolean {
  // Admin and RSSI always have access (organization-level)
  if (['admin', 'super_admin', 'rssi'].includes(userRole)) {
    return true;
  }

  // Document owner always has admin access
  if (document.ownerId === userId) {
    return true;
  }

  const acl = document.acl;
  const classification = document.classification?.level || 'internal';

  // Check classification-based access first
  if (!acl || acl.defaultAccess === 'classification') {
    // If user doesn't have classification access, deny
    if (!canAccessClassification(classification, userRole)) {
      return false;
    }
    // Classification access only grants read permission
    if (requiredPermission === 'read') {
      return true;
    }
    // For other permissions, check explicit ACL
  }

  // No explicit ACL and permission requires more than read
  if (!acl || acl.permissions.length === 0) {
    return false;
  }

  // Check explicit permissions
  const now = Timestamp.now();

  for (const permission of acl.permissions) {
    // Skip expired permissions
    if (permission.expiresAt && permission.expiresAt.toMillis() < now.toMillis()) {
      continue;
    }

    let matches = false;

    // Check by principal type
    switch (permission.principalType) {
      case 'user':
        matches = permission.principalId === userId;
        break;
      case 'role':
        matches = permission.principalId === userRole;
        break;
      case 'group':
        matches = userGroups.includes(permission.principalId);
        break;
    }

    if (matches && permissionIncludes(permission.access, requiredPermission)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a user can view a document (considering classification)
 * @param document - The document to check
 * @param userId - User ID
 * @param userRole - User's role
 * @returns True if user can view the document
 */
export function canViewDocument(
  document: Document,
  userId: string,
  userRole: string
): boolean {
  // First check classification
  const classification = document.classification?.level || 'internal';
  if (!canAccessClassification(classification, userRole)) {
    return false;
  }

  return checkAccess(document, userId, userRole, 'read');
}

/**
 * Get all permissions for a user on a document
 * @param document - The document
 * @param userId - User ID
 * @param userRole - User's role
 * @param userGroups - User's group memberships
 * @returns Array of permission levels the user has
 */
export function getUserPermissions(
  document: Document,
  userId: string,
  userRole: string,
  userGroups: string[] = []
): PermissionLevel[] {
  const permissions: Set<PermissionLevel> = new Set();

  // Admin/RSSI/Owner have all permissions
  if (['admin', 'super_admin', 'rssi'].includes(userRole) || document.ownerId === userId) {
    return [...PERMISSION_LEVELS];
  }

  const acl = document.acl;
  const classification = document.classification?.level || 'internal';

  // Classification-based read access
  if (canAccessClassification(classification, userRole)) {
    permissions.add('read');
  }

  if (!acl) {
    return Array.from(permissions);
  }

  // Collect explicit permissions
  const now = Timestamp.now();

  for (const permission of acl.permissions) {
    // Skip expired permissions
    if (permission.expiresAt && permission.expiresAt.toMillis() < now.toMillis()) {
      continue;
    }

    let matches = false;

    switch (permission.principalType) {
      case 'user':
        matches = permission.principalId === userId;
        break;
      case 'role':
        matches = permission.principalId === userRole;
        break;
      case 'group':
        matches = userGroups.includes(permission.principalId);
        break;
    }

    if (matches) {
      // Add all permissions included in the granted level
      PERMISSION_HIERARCHY[permission.access].forEach(p => permissions.add(p));
    }
  }

  return Array.from(permissions);
}

/**
 * Grant access to a document for a user/role/group
 * @param documentId - Document ID
 * @param permission - Permission to grant
 * @returns Promise that resolves when permission is granted
 */
export async function grantAccess(
  documentId: string,
  permission: DocumentPermission,
  organizationId?: string
): Promise<void> {
  try {
    const docRef = doc(db, 'documents', documentId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Document not found');
    }

    const currentData = docSnap.data() as Document;

    // IDOR protection: verify document belongs to caller's organization
    if (organizationId && currentData.organizationId !== organizationId) {
      throw new Error('Access denied: document does not belong to your organization');
    }
    const currentAcl = currentData.acl || createDefaultACL();

    // Remove any existing permission for the same principal
    const filteredPermissions = currentAcl.permissions.filter(
      p => !(p.principalType === permission.principalType && p.principalId === permission.principalId)
    );

    // Add the new permission
    const updatedAcl: DocumentACL = {
      ...currentAcl,
      permissions: [...filteredPermissions, permission],
    };

    await updateDoc(docRef, sanitizeData({ acl: updatedAcl }));
  } catch (error) {
    ErrorLogger.error(error, 'AclService.grantAccess');
    throw error;
  }
}

/**
 * Revoke access from a document for a user/role/group
 * @param documentId - Document ID
 * @param principalType - Type of principal
 * @param principalId - ID of the principal
 * @returns Promise that resolves when permission is revoked
 */
export async function revokeAccess(
  documentId: string,
  principalType: 'user' | 'role' | 'group',
  principalId: string,
  organizationId?: string
): Promise<void> {
  try {
    const docRef = doc(db, 'documents', documentId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Document not found');
    }

    const currentData = docSnap.data() as Document;

    // IDOR protection: verify document belongs to caller's organization
    if (organizationId && currentData.organizationId !== organizationId) {
      throw new Error('Access denied: document does not belong to your organization');
    }

    const currentAcl = currentData.acl;

    if (!currentAcl) {
      return; // No ACL to modify
    }

    // Filter out the permission to revoke
    const updatedPermissions = currentAcl.permissions.filter(
      p => !(p.principalType === principalType && p.principalId === principalId)
    );

    const updatedAcl: DocumentACL = {
      ...currentAcl,
      permissions: updatedPermissions,
    };

    await updateDoc(docRef, sanitizeData({ acl: updatedAcl }));
  } catch (error) {
    ErrorLogger.error(error, 'AclService.revokeAccess');
    throw error;
  }
}

/**
 * Update document ACL settings
 * @param documentId - Document ID
 * @param defaultAccess - Default access mode
 * @returns Promise that resolves when ACL is updated
 */
export async function updateAclSettings(
  documentId: string,
  defaultAccess: 'classification' | 'explicit',
  organizationId?: string
): Promise<void> {
  try {
    const docRef = doc(db, 'documents', documentId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Document not found');
    }

    const currentData = docSnap.data() as Document;

    // IDOR protection: verify document belongs to caller's organization
    if (organizationId && currentData.organizationId !== organizationId) {
      throw new Error('Access denied: document does not belong to your organization');
    }

    const currentAcl = currentData.acl || createDefaultACL();

    const updatedAcl: DocumentACL = {
      ...currentAcl,
      defaultAccess,
    };

    await updateDoc(docRef, sanitizeData({ acl: updatedAcl }));
  } catch (error) {
    ErrorLogger.error(error, 'AclService.updateAclSettings');
    throw error;
  }
}

/**
 * Get effective permissions explanation for a user
 * Useful for showing why a user has/doesn't have access
 * @param document - The document
 * @param userId - User ID
 * @param userRole - User's role
 * @param userGroups - User's group memberships
 * @returns Explanation object with permissions and reasons
 */
export function explainPermissions(
  document: Document,
  userId: string,
  userRole: string,
  userGroups: string[] = []
): {
  permissions: PermissionLevel[];
  reasons: string[];
  hasClassificationAccess: boolean;
  isOwner: boolean;
  isAdmin: boolean;
} {
  const reasons: string[] = [];
  const classification = document.classification?.level || 'internal';
  const hasClassificationAccess = canAccessClassification(classification, userRole);
  const isOwner = document.ownerId === userId;
  const isAdmin = ['admin', 'super_admin', 'rssi'].includes(userRole);

  if (isAdmin) {
    reasons.push(`Role "${userRole}" donne un accès complet`);
  }

  if (isOwner) {
    reasons.push('Propriétaire du document');
  }

  if (hasClassificationAccess && !isAdmin && !isOwner) {
    reasons.push(`Classification "${classification}" accessible pour le role "${userRole}"`);
  }

  // Check explicit ACL entries
  const acl = document.acl;
  if (acl && acl.permissions.length > 0) {
    const now = Timestamp.now();

    for (const permission of acl.permissions) {
      if (permission.expiresAt && permission.expiresAt.toMillis() < now.toMillis()) {
        continue;
      }

      if (
        (permission.principalType === 'user' && permission.principalId === userId) ||
        (permission.principalType === 'role' && permission.principalId === userRole) ||
        (permission.principalType === 'group' && userGroups.includes(permission.principalId))
      ) {
        reasons.push(
          `Permission "${PERMISSION_LABELS[permission.access]}" accordée par ${permission.principalType}`
        );
      }
    }
  }

  const permissions = getUserPermissions(document, userId, userRole, userGroups);

  return {
    permissions,
    reasons,
    hasClassificationAccess,
    isOwner,
    isAdmin,
  };
}

/**
 * Clean up expired permissions from a document
 * @param documentId - Document ID
 * @returns Promise that resolves with the number of removed permissions
 */
export async function cleanupExpiredPermissions(documentId: string): Promise<number> {
  try {
    const docRef = doc(db, 'documents', documentId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return 0;
    }

    const currentData = docSnap.data() as Document;
    const currentAcl = currentData.acl;

    if (!currentAcl || currentAcl.permissions.length === 0) {
      return 0;
    }

    const now = Timestamp.now();
    const validPermissions = currentAcl.permissions.filter(
      p => !p.expiresAt || p.expiresAt.toMillis() >= now.toMillis()
    );

    const removedCount = currentAcl.permissions.length - validPermissions.length;

    if (removedCount > 0) {
      const updatedAcl: DocumentACL = {
        ...currentAcl,
        permissions: validPermissions,
      };

      await updateDoc(docRef, sanitizeData({ acl: updatedAcl }));
    }

    return removedCount;
  } catch (error) {
    ErrorLogger.error(error, 'AclService.cleanupExpiredPermissions');
    throw error;
  }
}
