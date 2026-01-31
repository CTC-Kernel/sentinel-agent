import { collection, getDocs, query, where, updateDoc, doc, writeBatch, setDoc, getDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, getDownloadURL, deleteObject, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase';
import { logAction } from './logger';
import { ErrorLogger } from './errorLogger';
import { UserProfile } from '../types';
import { sanitizeData } from '../utils/dataSanitizer';

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

export interface RestoreSummary {
  restored: number;
  skipped: number;
  errors: string[];
  collections: Record<string, { total: number; restored: number; skipped: number }>;
}

export class BackupService {
  private static readonly BACKUP_COLLECTION = 'backups';

  static async createBackup(user: UserProfile, config: BackupConfig): Promise<string> {
    this.checkPermission(user);
    if (!user.organizationId) throw new Error('Organisation non définie');

    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const metadata: BackupMetadata = {
      id: backupId,
      organizationId: user.organizationId,
      createdAt: serverTimestamp() as unknown as string,
      createdBy: user.email,
      config,
      size: 0,
      collections: this.getCollectionsToBackup(config),
      status: 'creating'
    };

    try {
      // Créer le document de métadonnées
      await setDoc(doc(db, this.BACKUP_COLLECTION, backupId), metadata);

      // Collecter les données
      const backupData: Record<string, unknown[]> = {};
      let totalSize = 0;

      for (const collectionName of metadata.collections) {
        try {
          const snapshot = await getDocs(query(collection(db, collectionName), where('organizationId', '==', user.organizationId)));
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          backupData[collectionName] = data;
          totalSize += JSON.stringify(data).length;

        } catch (error) {
          // Silently skip collections that cannot be backed up
          ErrorLogger.warn(`Skipping backup collection ${collectionName}`, 'BackupService.createBackup', { metadata: { error } });
        }
      }

      // Mettre à jour la taille
      metadata.size = totalSize;

      // Créer le fichier JSON de backup
      const backupBlob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const backupRef = ref(storage, `backups/${user.organizationId}/${backupId}.json`);
      await uploadBytes(backupRef, backupBlob);
      const downloadUrl = await getDownloadURL(backupRef);

      // Mettre à jour les métadonnées
      await updateDoc(doc(db, this.BACKUP_COLLECTION, backupId), {
        status: 'completed',
        size: totalSize,
        downloadUrl
      });

      await logAction(user, 'CREATE', 'Backup', `Backup créé: ${backupId}`);
      return backupId;

    } catch (error) {
      ErrorLogger.error(error, 'BackupService.createBackup');
      await updateDoc(doc(db, this.BACKUP_COLLECTION, backupId), {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      throw error;
    }
  }

  static async restoreBackup(user: UserProfile, config: RestoreConfig): Promise<{ success: boolean; summary: RestoreSummary }> {
    this.checkPermission(user);
    if (!user.organizationId) throw new Error('Organisation non définie');

    // Récupérer les métadonnées du backup
    const backupDoc = await getDoc(doc(db, this.BACKUP_COLLECTION, config.backupId));
    if (!backupDoc.exists()) throw new Error('Backup introuvable');

    const data = backupDoc.data();
    const backupMetadata = {
      ...data,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
      collections: Array.isArray(data.collections) ? data.collections : []
    } as BackupMetadata;

    if (backupMetadata.organizationId !== user.organizationId) {
      throw new Error('Accès non autorisé à ce backup');
    }

    try {
      // Télécharger le fichier de backup
      const backupRef = ref(storage, `backups/${user.organizationId}/${config.backupId}.json`);
      const downloadUrl = await getDownloadURL(backupRef);
      const response = await fetch(downloadUrl);
      const backupData = await response.json();

      const summary: RestoreSummary = {
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
          const BATCH_SIZE = 500;
          let batch = writeBatch(db);
          let batchCount = 0;

          for (const docData of documents) {
            // Vérifier que le document appartient à l'organisation de l'utilisateur
            if (docData.organizationId && docData.organizationId !== user.organizationId) {
              summary.collections[collectionName].skipped++;
              summary.skipped++;
              continue;
            }

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
            batch.set(docRef, sanitizeData(docData));
            batchCount++;

            // Exécuter le batch toutes les 500 opérations
            if (batchCount >= BATCH_SIZE) {
              await batch.commit();
              batch = writeBatch(db);
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
          ErrorLogger.error(error, `BackupService.restoreBackup.collection.${collectionName}`);
          const errorMsg = `Erreur lors de la restauration de ${collectionName}: ${error}`;
          summary.errors.push(errorMsg);
        }
      }

      await logAction(user, 'RESTORE', 'Backup', `Backup restauré: ${config.backupId}`);
      return { success: summary.errors.length === 0, summary };

    } catch (error) {
      ErrorLogger.error(error, 'BackupService.restoreBackup');
      await logAction(user, 'ERROR', 'Backup', `Erreur restauration: ${error}`);
      throw error;
    }
  }

  static async listBackups(organizationId: string): Promise<BackupMetadata[]> {
    if (!organizationId) return [];

    try {
      const snapshot = await getDocs(
        query(collection(db, this.BACKUP_COLLECTION), where('organizationId', '==', organizationId))
      );
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
          collections: Array.isArray(data.collections) ? data.collections : []
        } as BackupMetadata;
      });

    } catch (error) {
      ErrorLogger.error(error, 'BackupService.listBackups');
      return [];
    }
  }

  static async deleteBackup(user: UserProfile, backupId: string): Promise<void> {
    this.checkPermission(user);
    if (!user.organizationId) throw new Error('Organisation non définie');

    try {
      // Supprimer le document de métadonnées
      await deleteDoc(doc(db, this.BACKUP_COLLECTION, backupId));

      // Supprimer le fichier de stockage
      const backupRef = ref(storage, `backups/${user.organizationId}/${backupId}.json`);
      await deleteObject(backupRef);

      await logAction(user, 'DELETE', 'Backup', `Backup supprimé: ${backupId}`);
    } catch (error) {
      ErrorLogger.error(error, 'BackupService.deleteBackup');
      await logAction(user, 'ERROR', 'Backup', `Erreur suppression backup: ${error}`);
      throw error;
    }
  }

  static async getBackupUrl(user: UserProfile, backupId: string): Promise<string> {
    if (!user.organizationId) throw new Error('Organisation non définie');

    const backupRef = ref(storage, `backups/${user.organizationId}/${backupId}.json`);
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

  static async getBackupStats(organizationId: string): Promise<{ totalBackups: number; totalSize: number; lastBackup?: string }> {
    if (!organizationId) return { totalBackups: 0, totalSize: 0 };

    try {
      const backups = await this.listBackups(organizationId);
      const totalBackups = backups.length;
      const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
      const lastBackup = backups.length > 0
        ? backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt
        : undefined;

      return { totalBackups, totalSize, lastBackup };
    } catch (error) {
      ErrorLogger.error(error, 'BackupService.getBackupStats');
      return { totalBackups: 0, totalSize: 0 };
    }
  }

  static async scheduleBackup(user: UserProfile, config: BackupConfig, frequency: 'daily' | 'weekly' | 'monthly'): Promise<void> {
    this.checkPermission(user);
    if (!user.organizationId) throw new Error('Organisation non définie');

    const scheduleId = `schedule_${user.organizationId}`;
    const scheduleData = {
      organizationId: user.organizationId,
      config,
      frequency,
      lastBackup: null,
      nextBackup: this.calculateNextBackup(frequency).toISOString(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, 'backup_schedules', scheduleId), scheduleData);

    await logAction(user, 'SCHEDULE', 'Backup', `Backup programmé: ${frequency}`);
  }

  static async checkScheduledBackups(user: UserProfile): Promise<void> {
    if (!user.organizationId) return;

    try {
      // Use query instead of getDoc to avoid permission denied on non-existent docs
      const q = query(
        collection(db, 'backup_schedules'),
        where('organizationId', '==', user.organizationId)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) return;

      const scheduleDoc = snapshot.docs[0];

      const schedule = scheduleDoc.data();
      const now = new Date();
      const nextBackup = new Date(schedule.nextBackup);

      if (now >= nextBackup) {

        // Trigger backup
        await this.createBackup(user, schedule.config);

        // Update schedule
        await updateDoc(doc(db, 'backup_schedules', `schedule_${user.organizationId}`), {
          lastBackup: now.toISOString(),
          nextBackup: this.calculateNextBackup(schedule.frequency).toISOString()
        });
      }
    } catch (error) {
      ErrorLogger.error(error, 'BackupService.checkScheduledBackups');
    }
  }

  private static calculateNextBackup(frequency: 'daily' | 'weekly' | 'monthly'): Date {
    const date = new Date();
    if (frequency === 'daily') date.setDate(date.getDate() + 1);
    if (frequency === 'weekly') date.setDate(date.getDate() + 7);
    if (frequency === 'monthly') date.setMonth(date.getMonth() + 1);
    return date;
  }
  private static checkPermission(user: UserProfile): void {
    if (user.role !== 'admin' && user.role !== 'rssi') {
      throw new Error('Permission denied: Admin or RSSI role required for backup operations');
    }
  }
}
