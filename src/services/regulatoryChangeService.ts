import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  Unsubscribe,
  DocumentData,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import type { RegulatoryChange, RegulatoryAlert } from '../types/regulatoryChange';

export interface RegulatoryChangeStats {
  total: number;
  byStatus: Record<RegulatoryChange['status'], number>;
  bySeverity: Record<string, number>;
  actionRequired: number;
  upcomingDeadlines: number;
  overdueActions: number;
  complianceRate: number;
}

export class RegulatoryChangeService {
  private static readonly COLLECTION = 'regulatoryChanges';
  private static readonly ALERTS_COLLECTION = 'regulatoryAlerts';

  /**
   * Subscribe to regulatory changes in real-time
   * ALL queries filtered by organizationId
   */
  static subscribeToChanges(
    organizationId: string,
    callback: (changes: RegulatoryChange[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    try {
      const q = query(
        collection(db, this.COLLECTION),
        where('organizationId', '==', organizationId),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const changes = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as RegulatoryChange[];
          callback(changes);
        },
        (error) => {
          ErrorLogger.error(error, 'RegulatoryChangeService.subscribeToChanges');
          onError?.(error);
        }
      );
      return unsubscribe;
    } catch (error) {
      ErrorLogger.error(error, 'RegulatoryChangeService.subscribeToChanges.setup');
      return () => {};
    }
  }

  /**
   * Subscribe to regulatory alerts in real-time
   */
  static subscribeToAlerts(
    organizationId: string,
    callback: (alerts: RegulatoryAlert[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    try {
      const q = query(
        collection(db, this.ALERTS_COLLECTION),
        where('organizationId', '==', organizationId),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const alerts = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as RegulatoryAlert[];
          callback(alerts);
        },
        (error) => {
          ErrorLogger.error(error, 'RegulatoryChangeService.subscribeToAlerts');
          onError?.(error);
        }
      );
      return unsubscribe;
    } catch (error) {
      ErrorLogger.error(error, 'RegulatoryChangeService.subscribeToAlerts.setup');
      return () => {};
    }
  }

  /**
   * Create a new regulatory change
   */
  static async createChange(
    organizationId: string,
    data: Omit<RegulatoryChange, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>,
    userId: string
  ): Promise<string> {
    try {
      const now = new Date().toISOString();
      const changeData = sanitizeData({
        ...data,
        organizationId,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
      });

      const docRef = await addDoc(collection(db, this.COLLECTION), changeData);
      return docRef.id;
    } catch (error) {
      ErrorLogger.error(error, 'RegulatoryChangeService.createChange');
      throw error;
    }
  }

  /**
   * Update an existing regulatory change
   */
  static async updateChange(
    changeId: string,
    data: Partial<RegulatoryChange>
  ): Promise<void> {
    try {
      const updateData = sanitizeData({
        ...data,
        updatedAt: serverTimestamp(),
      });

      const docRef = doc(db, this.COLLECTION, changeId);
      await updateDoc(docRef, updateData as DocumentData);
    } catch (error) {
      ErrorLogger.error(error, 'RegulatoryChangeService.updateChange');
      throw error;
    }
  }

  /**
   * Delete a regulatory change
   */
  static async deleteChange(changeId: string): Promise<void> {
    try {
      const docRef = doc(db, this.COLLECTION, changeId);
      await deleteDoc(docRef);
    } catch (error) {
      ErrorLogger.error(error, 'RegulatoryChangeService.deleteChange');
      throw error;
    }
  }

  /**
   * Mark an alert as read
   */
  static async markAlertRead(alertId: string): Promise<void> {
    try {
      const docRef = doc(db, this.ALERTS_COLLECTION, alertId);
      await updateDoc(docRef, { read: true });
    } catch (error) {
      ErrorLogger.error(error, 'RegulatoryChangeService.markAlertRead');
      throw error;
    }
  }

  /**
   * Create a regulatory alert
   */
  static async createAlert(
    organizationId: string,
    data: Omit<RegulatoryAlert, 'id' | 'organizationId' | 'createdAt' | 'read'>
  ): Promise<string> {
    try {
      const alertData = sanitizeData({
        ...data,
        organizationId,
        read: false,
        createdAt: serverTimestamp(),
      });

      const docRef = await addDoc(collection(db, this.ALERTS_COLLECTION), alertData);
      return docRef.id;
    } catch (error) {
      ErrorLogger.error(error, 'RegulatoryChangeService.createAlert');
      throw error;
    }
  }

  /**
   * Calculate statistics from regulatory changes
   */
  static calculateStats(changes: RegulatoryChange[]): RegulatoryChangeStats {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const byStatus: Record<string, number> = {
      'identified': 0,
      'analyzing': 0,
      'action-required': 0,
      'implementing': 0,
      'compliant': 0,
      'not-applicable': 0,
    };

    const bySeverity: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      informational: 0,
    };

    let actionRequired = 0;
    let upcomingDeadlines = 0;
    let overdueActions = 0;
    let compliantCount = 0;
    let applicableCount = 0;

    for (const change of changes) {
      // Count by status
      if (byStatus[change.status] !== undefined) {
        byStatus[change.status]++;
      }

      // Count by severity
      if (bySeverity[change.severity] !== undefined) {
        bySeverity[change.severity]++;
      }

      // Action required
      if (change.status === 'action-required') {
        actionRequired++;
      }

      // Upcoming deadlines (effective date within 30 days)
      if (change.effectiveDate) {
        const effectiveDate = new Date(change.effectiveDate);
        if (effectiveDate > now && effectiveDate <= thirtyDaysFromNow) {
          upcomingDeadlines++;
        }
      }

      // Overdue actions
      if (change.requiredActions) {
        for (const action of change.requiredActions) {
          if (
            action.status !== 'completed' &&
            action.status !== 'cancelled' &&
            new Date(action.dueDate) < now
          ) {
            overdueActions++;
          }
        }
      }

      // Compliance rate
      if (change.status !== 'not-applicable') {
        applicableCount++;
        if (change.status === 'compliant') {
          compliantCount++;
        }
      }
    }

    const complianceRate = applicableCount > 0
      ? Math.round((compliantCount / applicableCount) * 100)
      : 0;

    return {
      total: changes.length,
      byStatus: byStatus as Record<RegulatoryChange['status'], number>,
      bySeverity,
      actionRequired,
      upcomingDeadlines,
      overdueActions,
      complianceRate,
    };
  }
}
