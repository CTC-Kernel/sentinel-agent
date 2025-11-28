import { collection, query, where, getDocs, deleteDoc, doc, writeBatch, collectionGroup } from 'firebase/firestore';
import { deleteUser, User } from 'firebase/auth';
import { db, storage } from '../firebase';
import { ref, deleteObject, listAll } from 'firebase/storage';
import { UserProfile } from '../types';
import { ErrorLogger } from './errorLogger';

export class AccountService {
  private static readonly COLLECTIONS_TO_CLEAN = [
    'assets',
    'risks',
    'controls',
    'audits',
    'projects',
    'suppliers',
    'incidents',
    'documents',
    'processing_activities',
    'business_processes',
    'bcp_drills',
    'system_logs',
    'notifications',
    'backups',
    'backup_schedules',
    'supplier_assessments',
    'supplier_incidents',
    // New collections added for completeness
    'join_requests',
    'invitations',
    'risk_history',
    'incidentResponses',
    'audit_checklists',
    'findings',
    'project_milestones'
  ];

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
        } catch (e) {
          ErrorLogger.error(e, 'AccountService.deleteAccount');
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
            await deleteDoc(doc(db, 'organizations', user.organizationId));
            console.log(`Organization ${user.organizationId} deleted (no remaining users)`);
          }
        } catch (e) {
          console.warn("Could not delete organization:", e);
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
   * This is an irreversible admin action.
   */
  static async deleteOrganization(organizationId: string): Promise<void> {
    if (!organizationId) throw new Error("Organization ID is required");

    try {
      // 1. Delete all documents in collections linked to this org
      for (const collectionName of this.COLLECTIONS_TO_CLEAN) {
        await this.deleteCollectionData(collectionName, organizationId);
      }

      // 2. Delete subcollections (comments) using collectionGroup
      // Note: This requires 'organizationId' to be present on the subcollection documents
      await this.deleteCollectionGroupData('comments', organizationId);

      // 3. Delete users associated with this org
      // Note: We can only delete their profile docs from Firestore. 
      // We cannot delete their Auth accounts without Admin SDK (Cloud Functions).
      // They will be orphaned.
      await this.deleteCollectionData('users', organizationId);

      // 4. Delete Organization document
      await deleteDoc(doc(db, 'organizations', organizationId));

      // 5. Cleanup Storage (Best effort)
      try {
        const orgStorageRef = ref(storage, `organizations/${organizationId}`);
        await this.deleteStorageFolder(orgStorageRef);

        const backupStorageRef = ref(storage, `backups/${organizationId}`);
        await this.deleteStorageFolder(backupStorageRef);
      } catch (e) {
        console.warn("Storage cleanup warning:", e);
      }

    } catch (error) {
      ErrorLogger.error(error, 'AccountService.deleteOrganization');
      throw error;
    }
  }

  private static async deleteCollectionData(collectionName: string, organizationId: string) {
    const q = query(collection(db, collectionName), where('organizationId', '==', organizationId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return;

    // Batch delete (Firestore limits batches to 500 operations)
    const chunks = [];
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += 500) {
      chunks.push(docs.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }
  }

  private static async deleteCollectionGroupData(collectionId: string, organizationId: string) {
    // This query requires a composite index on 'organizationId' for the collection group
    const q = query(collectionGroup(db, collectionId), where('organizationId', '==', organizationId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return;

    const chunks = [];
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += 500) {
      chunks.push(docs.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }
  }

  private static async deleteStorageFolder(folderRef: any) {
    try {
      const list = await listAll(folderRef);

      // Delete files
      await Promise.all(list.items.map(item => deleteObject(item)));

      // Recurse for subfolders
      await Promise.all(list.prefixes.map(prefix => this.deleteStorageFolder(prefix)));
    } catch (_error) {
      // Folder might not exist or permission denied
    }
  }
}
