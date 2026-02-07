/**
 * Scheduled Reports Service
 * Story 7.3: Scheduled Recurring Reports
 * Handles CRUD operations for scheduled report configurations
 */

import {
 collection,
 doc,
 addDoc,
 updateDoc,
 deleteDoc,
 getDoc,
 query,
 where,
 orderBy,
 getDocs,
 serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import {
 ScheduledReport,
 ScheduledReportFormData,
 calculateNextRunDate
} from '../types/reports';

const COLLECTION_NAME = 'scheduledReports';

/**
 * Get all scheduled reports for an organization
 */
export async function getScheduledReports(organizationId: string): Promise<ScheduledReport[]> {
 try {
 const q = query(
 collection(db, COLLECTION_NAME),
 where('organizationId', '==', organizationId),
 orderBy('createdAt', 'desc')
 );

 const snapshot = await getDocs(q);
 return snapshot.docs.map(doc => ({
 id: doc.id,
 ...doc.data()
 } as ScheduledReport));
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la recuperation des rapports planifies');
 throw error;
 }
}

/**
 * Create a new scheduled report
 */
export async function createScheduledReport(
 organizationId: string,
 userId: string,
 userName: string,
 data: ScheduledReportFormData
): Promise<ScheduledReport> {
    try {
      const now = new Date().toISOString();
      const nextRunAt = calculateNextRunDate(
        data.frequency,
        data.dayOfWeek,
        data.dayOfMonth
      );

      const reportData: Omit<ScheduledReport, 'id'> = {
        organizationId,
        name: data.name,
        templateId: data.templateId,
        frequency: data.frequency,
        dayOfWeek: data.dayOfWeek,
        dayOfMonth: data.dayOfMonth,
        recipients: data.recipients,
        config: data.config,
        createdBy: userId,
        createdByName: userName,
        createdAt: now,
        updatedAt: now,
        nextRunAt: nextRunAt.toISOString(),
        status: 'active'
      };

      const docRef = await addDoc(collection(db, COLLECTION_NAME), sanitizeData({ ...reportData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));

      return {
        id: docRef.id,
        ...reportData
      };
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la creation du rapport planifie');
      throw error;
    }
  }

/**
 * Update an existing scheduled report
 */
export async function updateScheduledReport(
 reportId: string,
 organizationId: string,
 data: Partial<ScheduledReportFormData>
): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, reportId);

      // Verify ownership before update
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data()?.organizationId !== organizationId) {
        throw new Error('Not authorized');
      }

      const updateData: Record<string, unknown> = {
        ...data,
        updatedAt: serverTimestamp()
      };

      // Recalculate next run if frequency or day changed
      if (data.frequency || data.dayOfWeek !== undefined || data.dayOfMonth !== undefined) {
        const nextRunAt = calculateNextRunDate(
          data.frequency!,
          data.dayOfWeek,
          data.dayOfMonth
        );
        updateData.nextRunAt = nextRunAt.toISOString();
      }

      await updateDoc(docRef, sanitizeData(updateData));
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la mise a jour du rapport planifie');
      throw error;
    }
  }

/**
 * Toggle the status of a scheduled report (active/paused)
 */
export async function toggleScheduledReportStatus(
 reportId: string,
 currentStatus: 'active' | 'paused'
): Promise<void> {
 try {
 const docRef = doc(db, COLLECTION_NAME, reportId);
 const newStatus = currentStatus === 'active' ? 'paused' : 'active';

 const updateData: Record<string, unknown> = {
 status: newStatus,
 updatedAt: serverTimestamp()
 };

 // If reactivating, recalculate next run date
 if (newStatus === 'active') {
 // We'll need to fetch the doc to get frequency info
 // For now, just set the status
 }

 await updateDoc(docRef, sanitizeData(updateData));
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'Erreur lors du changement de statut du rapport');
 throw error;
 }
}

/**
 * Delete a scheduled report
 */
export async function deleteScheduledReport(reportId: string, organizationId: string): Promise<void> {
 try {
 const docRef = doc(db, COLLECTION_NAME, reportId);

 // Verify ownership before delete
 const docSnap = await getDoc(docRef);
 if (!docSnap.exists() || docSnap.data()?.organizationId !== organizationId) {
 throw new Error('Not authorized');
 }

 await deleteDoc(docRef);
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la suppression du rapport planifie');
 throw error;
 }
}

/**
 * Mark a report as run (update lastRunAt and calculate next run)
 */
export async function markReportAsRun(
 report: ScheduledReport
): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, report.id);
      const now = new Date();
      const nextRunAt = calculateNextRunDate(
        report.frequency,
        report.dayOfWeek,
        report.dayOfMonth,
        now
      );

      await updateDoc(docRef, sanitizeData({
        lastRunAt: now.toISOString(),
        nextRunAt: nextRunAt.toISOString(),
        updatedAt: now.toISOString()
      }));
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'Erreur lors du marquage du rapport comme execute');
      throw error;
    }
  }

export const ScheduledReportsService = {
 getScheduledReports,
 createScheduledReport,
 updateScheduledReport,
 toggleScheduledReportStatus,
 deleteScheduledReport,
 markReportAsRun
};
