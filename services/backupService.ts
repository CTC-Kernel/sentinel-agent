import { collection, addDoc, getDocs, query, where, doc, setDoc, getDoc, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import { logAction } from './logger';

export interface BackupConfig {
  includeDocuments: boolean;
  includeAssets: boolean;
  includeRisks: boolean;
  includeControls: boolean;
  includeAudits: boolean;
  includeProjects: boolean;
  includeSuppliers: boolean;
  includeIncidents: boolean;
  includeUsers: boolean;
  includeComments: boolean;
}

export interface BackupMetadata {
  id: string;
  organizationId: string;
  createdAt: string;
  createdBy: string;
  config: BackupConfig;
  size: number;
  collections: string[];
  status: 'creating' | 'completed' | 'failed';
  downloadUrl?: string;
  error?: string;
}

export interface RestoreConfig {
  backupId: string;
  collections: string[];
  overwriteExisting: boolean;
  dryRun: boolean;
}

export class BackupService {
  private static readonly BACKUP_COLLECTION = 'backups';

  static async createBackup(config: BackupConfig): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('Utilisateur non authentifié');

    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const metadata: BackupMetadata = {
      id: backupId,
      organizationId: user.uid,
      createdAt: new Date().toISOString(),
      createdBy: user.email || user.uid,
      config,
      size: 0,
      collections: this.getCollectionsToBackup(config),
      status: 'creating'
    };

    try {
      // Créer le document de métadonnées
      await setDoc(doc(db, this.BACKUP_COLLECTION, backupId), metadata);

      // Collecter les données
      const backupData: any = {};
      let totalSize = 0;

      for (const collectionName of metadata.collections) {
        try {
          const snapshot = await getDocs(collection(db, collectionName));
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          backupData[collectionName] = data;
          totalSize += JSON.stringify(data).length;
        } catch (error) {
          // Silently skip collections that cannot be backed up
        }
      }

      // Mettre à jour la taille
      metadata.size = totalSize;

      // Créer le fichier JSON de backup
      const backupBlob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const backupRef = ref(storage, `backups/${user.uid}/${backupId}.json`);
      await uploadBytes(backupRef, backupBlob);
      const downloadUrl = await getDownloadURL(backupRef);

      // Mettre à jour les métadonnées
      await updateDoc(doc(db, this.BACKUP_COLLECTION, backupId), {
        status: 'completed',
        size: totalSize,
        downloadUrl
      });

      await logAction({
        uid: user.uid,
        email: user.email || '',
        organizationId: (user as any).organizationId || 'default'
      }, 'CREATE', 'Backup', `Backup créé: ${backupId}`);
      return backupId;

    } catch (error) {
      await updateDoc(doc(db, this.BACKUP_COLLECTION, backupId), {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      throw error;
    }
  }

  static async restoreBackup(config: RestoreConfig): Promise<{ success: boolean; summary: any }> {
    const user = auth.currentUser;
    if (!user) throw new Error('Utilisateur non authentifié');

    // Récupérer les métadonnées du backup
    const backupDoc = await getDoc(doc(db, this.BACKUP_COLLECTION, config.backupId));
    if (!backupDoc.exists()) throw new Error('Backup introuvable');

    const backupMetadata = backupDoc.data() as BackupMetadata;
    if (backupMetadata.organizationId !== user.uid) {
      throw new Error('Accès non autorisé à ce backup');
    }

    try {
      // Télécharger le fichier de backup
      const backupRef = ref(storage, `backups/${user.uid}/${config.backupId}.json`);
      const downloadUrl = await getDownloadURL(backupRef);
      const response = await fetch(downloadUrl);
      const backupData = await response.json();

      const summary: any = {
        restored: 0,
        skipped: 0,
        errors: [],
        collections: {}
      };

      // Restaurer chaque collection
      for (const collectionName of config.collections) {
        if (!backupData[collectionName]) continue;

        const documents = backupData[collectionName];
        summary.collections[collectionName] = { total: documents.length, restored: 0, skipped: 0 };

        if (config.dryRun) {
          summary.collections[collectionName].restored = documents.length;
          summary.restored += documents.length;
          continue;
        }

        try {
          const batch = writeBatch(db);
          let batchCount = 0;

          for (const docData of documents) {
            const docRef = doc(db, collectionName, docData.id);

            // Vérifier si le document existe
            if (!config.overwriteExisting) {
              const existingDoc = await getDoc(docRef);
              if (existingDoc.exists()) {
                summary.collections[collectionName].skipped++;
                summary.skipped++;
                continue;
              }
            }

            // Ajouter au batch
            batch.set(docRef, docData);
            batchCount++;

            // Exécuter le batch toutes les 500 opérations
            if (batchCount >= 500) {
              await batch.commit();
              batchCount = 0;
            }
          }

          // Exécuter le batch restant
          if (batchCount > 0) {
            await batch.commit();
          }

          summary.collections[collectionName].restored = documents.length - summary.collections[collectionName].skipped;
          summary.restored += summary.collections[collectionName].restored;

        } catch (error) {
          const errorMsg = `Erreur lors de la restauration de ${collectionName}: ${error}`;
          summary.errors.push(errorMsg);
        }
      }

      await logAction({
        uid: user.uid,
        email: user.email || '',
        organizationId: (user as any).organizationId || 'default'
      }, 'RESTORE', 'Backup', `Backup restauré: ${config.backupId}`);
      return { success: summary.errors.length === 0, summary };

    } catch (error) {
      await logAction({
        uid: user.uid,
        email: user.email || '',
        organizationId: (user as any).organizationId || 'default'
      }, 'ERROR', 'Backup', `Erreur restauration: ${error}`);
      throw error;
    }
  }

  static async listBackups(): Promise<BackupMetadata[]> {
    const user = auth.currentUser;
    if (!user) return [];

    try {
      const snapshot = await getDocs(
        query(collection(db, this.BACKUP_COLLECTION), where('organizationId', '==', user.uid))
      );
      return snapshot.docs.map(doc => doc.data() as BackupMetadata);
    } catch (error) {
      return [];
    }
  }

  static async deleteBackup(backupId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('Utilisateur non authentifié');

    try {
      // Supprimer le document de métadonnées
      await deleteDoc(doc(db, this.BACKUP_COLLECTION, backupId));

      // Supprimer le fichier de stockage
      const backupRef = ref(storage, `backups/${user.uid}/${backupId}.json`);
      await deleteObject(backupRef);

      await logAction({
        uid: user.uid,
        email: user.email || '',
        organizationId: (user as any).organizationId || 'default'
      }, 'DELETE', 'Backup', `Backup supprimé: ${backupId}`);
    } catch (error) {
      await logAction({
        uid: user.uid,
        email: user.email || '',
        organizationId: (user as any).organizationId || 'default'
      }, 'ERROR', 'Backup', `Erreur suppression backup: ${error}`);
      throw error;
    }
  }

  static async getBackupUrl(backupId: string): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('Utilisateur non authentifié');

    const backupRef = ref(storage, `backups/${user.uid}/${backupId}.json`);
    return await getDownloadURL(backupRef);
  }

  private static getCollectionsToBackup(config: BackupConfig): string[] {
    const collections: string[] = [];

    if (config.includeDocuments) collections.push('documents');
    if (config.includeAssets) collections.push('assets');
    if (config.includeRisks) collections.push('risks');
    if (config.includeControls) collections.push('controls');
    if (config.includeAudits) collections.push('audits');
    if (config.includeProjects) collections.push('projects');
    if (config.includeSuppliers) collections.push('suppliers');
    if (config.includeIncidents) collections.push('incidents');
    if (config.includeUsers) collections.push('users');
    if (config.includeComments) collections.push('comments');

    return collections;
  }

  static async getBackupStats(): Promise<{ totalBackups: number; totalSize: number; lastBackup?: string }> {
    const user = auth.currentUser;
    if (!user) return { totalBackups: 0, totalSize: 0 };

    try {
      const backups = await this.listBackups();
      const totalBackups = backups.length;
      const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
      const lastBackup = backups.length > 0
        ? backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt
        : undefined;

      return { totalBackups, totalSize, lastBackup };
    } catch (error) {
      return { totalBackups: 0, totalSize: 0 };
    }
  }

  static async scheduleBackup(config: BackupConfig, frequency: 'daily' | 'weekly' | 'monthly'): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('Utilisateur non authentifié');

    // Future implementation with Firebase Functions or cron job
    await logAction({
      uid: user.uid,
      email: user.email || '',
      organizationId: (user as any).organizationId || 'default'
    }, 'SCHEDULE', 'Backup', `Backup programmé: ${frequency}`);
  }
}
