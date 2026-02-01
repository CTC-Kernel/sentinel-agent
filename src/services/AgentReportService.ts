/**
 * AgentReportService
 *
 * Service for generating, scheduling, and managing agent reports.
 * Supports PDF/Excel exports, scheduled reports, and report history.
 *
 * Sprint 10 - Reporting & RBAC
 */

import {
    collection,
    doc,
    onSnapshot,
    query,
    where,
    orderBy,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    Unsubscribe,
    limit as firestoreLimit,
    increment,
    QueryDocumentSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, functions, storage } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import type {
    AgentReport,
    ReportConfig,
    ScheduledReport,
    ReportTemplate,
    ReportType,
    ReportStatus,
    ExportFormat,
    ComplianceReportData,
    FleetHealthReportData,
    ExecutiveSummaryData,
    ReportFilters,
    ReportDateRange,
} from '../types/agentReport';
import {
    DEFAULT_REPORT_TEMPLATES,
    calculateNextRunDate,
} from '../types/agentReport';

// ============================================================================
// Collection Helpers
// ============================================================================

const getReportsCollection = (organizationId: string) =>
    collection(db, 'organizations', organizationId, 'agentReports');

const getSchedulesCollection = (organizationId: string) =>
    collection(db, 'organizations', organizationId, 'reportSchedules');

const getTemplatesCollection = (organizationId: string) =>
    collection(db, 'organizations', organizationId, 'reportTemplates');

// ============================================================================
// Type-safe conversion helpers
// ============================================================================

function docToReport(d: QueryDocumentSnapshot): AgentReport {
    const data = d.data();
    return {
        ...data,
        id: d.id,
        status: data.status || 'pending',
        downloadCount: data.downloadCount || 0,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        startedAt: data.startedAt?.toDate?.()?.toISOString() || data.startedAt,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt,
    } as unknown as AgentReport;
}

function docToSchedule(d: QueryDocumentSnapshot): ScheduledReport {
    const data = d.data();
    return {
        ...data,
        id: d.id,
        runCount: data.runCount || 0,
        isEnabled: data.isEnabled ?? true,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
    } as ScheduledReport;
}

// ============================================================================
// Report Subscriptions
// ============================================================================

/**
 * Subscribe to agent reports
 */
export function subscribeToReports(
    organizationId: string,
    onReports: (reports: AgentReport[]) => void,
    onError?: (error: Error) => void,
    options?: {
        limit?: number;
        type?: ReportType;
        status?: ReportStatus;
    }
): Unsubscribe {
    let q = query(
        getReportsCollection(organizationId),
        orderBy('startedAt', 'desc')
    );

    if (options?.type) {
        q = query(q, where('type', '==', options.type));
    }

    if (options?.status) {
        q = query(q, where('status', '==', options.status));
    }

    if (options?.limit) {
        q = query(q, firestoreLimit(options.limit));
    }

    return onSnapshot(
        q,
        (snapshot) => {
            const reports = snapshot.docs.map(d => docToReport(d));
            onReports(reports);
        },
        (error) => {
            ErrorLogger.error(error, 'AgentReportService.subscribeToReports', {
                component: 'AgentReportService',
                action: 'subscribeToReports',
                organizationId,
            });
            if (onError) onError(error);
        }
    );
}

/**
 * Subscribe to scheduled reports
 */
export function subscribeToSchedules(
    organizationId: string,
    onSchedules: (schedules: ScheduledReport[]) => void,
    onError?: (error: Error) => void
): Unsubscribe {
    const q = query(
        getSchedulesCollection(organizationId),
        orderBy('nextRunAt', 'asc')
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const schedules = snapshot.docs.map(d => docToSchedule(d));
            onSchedules(schedules);
        },
        (error) => {
            ErrorLogger.error(error, 'AgentReportService.subscribeToSchedules', {
                component: 'AgentReportService',
                action: 'subscribeToSchedules',
                organizationId,
            });
            if (onError) onError(error);
        }
    );
}

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Generate a new report
 */
export async function generateReport(
    organizationId: string,
    config: ReportConfig,
    userId: string
): Promise<string> {
    try {
        const now = new Date().toISOString();

        // Create report record
        const reportDoc = await addDoc(getReportsCollection(organizationId), sanitizeData({
            organizationId,
            type: config.type,
            name: config.name,
            config,
            status: 'pending' as ReportStatus,
            format: config.format,
            startedAt: now,
            generatedBy: userId,
            metadata: {
                agentCount: 0,
                groupCount: 0,
                dateRange: config.dateRange,
            },
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
            downloadCount: 0,
        }));

        // Call Cloud Function to generate report
        const generateReportFn = httpsCallable(functions, 'generateAgentReport');
        await generateReportFn({
            reportId: reportDoc.id,
            organizationId,
            config,
        });

        return reportDoc.id;
    } catch (error) {
        ErrorLogger.error(error, 'AgentReportService.generateReport', {
            component: 'AgentReportService',
            action: 'generateReport',
            organizationId,
            reportType: config.type,
        });
        throw error;
    }
}

/**
 * Get report by ID
 */
export async function getReport(
    organizationId: string,
    reportId: string
): Promise<AgentReport | null> {
    try {
        const docRef = doc(getReportsCollection(organizationId), reportId);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) return null;

        const data = snapshot.data();
        return {
            ...data,
            id: snapshot.id,
            status: data.status || 'pending',
            downloadCount: data.downloadCount || 0,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            startedAt: data.startedAt?.toDate?.()?.toISOString() || data.startedAt,
            completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt,
        } as unknown as AgentReport;
    } catch (error) {
        ErrorLogger.error(error, 'AgentReportService.getReport', {
            component: 'AgentReportService',
            action: 'getReport',
            organizationId,
            reportId,
        });
        throw error;
    }
}

/**
 * Delete a report
 */
export async function deleteReport(
    organizationId: string,
    reportId: string
): Promise<void> {
    try {
        const report = await getReport(organizationId, reportId);

        // Delete file from storage if exists
        if (report?.fileUrl) {
            try {
                const fileRef = ref(storage, report.fileUrl);
                await deleteObject(fileRef);
            } catch {
                // File may not exist, continue but log for debugging (don't log full URL)
                ErrorLogger.warn('Failed to delete report file from storage', 'AgentReportService.deleteReport', {
                    component: 'AgentReportService',
                    action: 'deleteReportFile',
                    metadata: { reportId: report.id },
                });
            }
        }

        // Delete report record
        await deleteDoc(doc(getReportsCollection(organizationId), reportId));
    } catch (error) {
        ErrorLogger.error(error, 'AgentReportService.deleteReport', {
            component: 'AgentReportService',
            action: 'deleteReport',
            organizationId,
            reportId,
        });
        throw error;
    }
}

/**
 * Get report download URL
 */
export async function getReportDownloadUrl(
    organizationId: string,
    reportId: string
): Promise<string | null> {
    try {
        const report = await getReport(organizationId, reportId);

        if (!report?.fileUrl) return null;

        // Get fresh download URL
        const fileRef = ref(storage, report.fileUrl);
        const url = await getDownloadURL(fileRef);

        // Update download count
        await updateDoc(doc(getReportsCollection(organizationId), reportId), sanitizeData({
            downloadCount: increment(1),
            lastDownloadedAt: new Date().toISOString(),
        }));

        return url;
    } catch (error) {
        ErrorLogger.error(error, 'AgentReportService.getReportDownloadUrl', {
            component: 'AgentReportService',
            action: 'getReportDownloadUrl',
            organizationId,
            reportId,
        });
        throw error;
    }
}

// ============================================================================
// Scheduled Reports
// ============================================================================

/**
 * Create a scheduled report
 */
export async function createSchedule(
    organizationId: string,
    schedule: Omit<ScheduledReport, 'id' | 'createdAt' | 'updatedAt' | 'nextRunAt' | 'runCount'>,
    userId: string
): Promise<string> {
    try {
        const now = new Date().toISOString();

        // Calculate next run
        const tempSchedule = { ...schedule } as ScheduledReport;
        const nextRunAt = calculateNextRunDate(tempSchedule).toISOString();

        const docRef = await addDoc(getSchedulesCollection(organizationId), sanitizeData({
            ...schedule,
            nextRunAt,
            runCount: 0,
            createdAt: now,
            updatedAt: now,
            createdBy: userId,
        }));

        return docRef.id;
    } catch (error) {
        ErrorLogger.error(error, 'AgentReportService.createSchedule', {
            component: 'AgentReportService',
            action: 'createSchedule',
            organizationId,
        });
        throw error;
    }
}

/**
 * Update a scheduled report
 */
export async function updateSchedule(
    organizationId: string,
    scheduleId: string,
    updates: Partial<ScheduledReport>
): Promise<void> {
    try {
        const now = new Date().toISOString();

        // Recalculate next run if schedule changed
        if (updates.frequency || updates.hour !== undefined || updates.minute !== undefined) {
            const currentSchedule = await getSchedule(organizationId, scheduleId);
            if (currentSchedule) {
                const merged = { ...currentSchedule, ...updates };
                updates.nextRunAt = calculateNextRunDate(merged as ScheduledReport).toISOString();
            }
        }

        await updateDoc(doc(getSchedulesCollection(organizationId), scheduleId), sanitizeData({
            ...updates,
            updatedAt: now,
        }));
    } catch (error) {
        ErrorLogger.error(error, 'AgentReportService.updateSchedule', {
            component: 'AgentReportService',
            action: 'updateSchedule',
            organizationId,
            scheduleId,
        });
        throw error;
    }
}

/**
 * Get scheduled report by ID
 */
export async function getSchedule(
    organizationId: string,
    scheduleId: string
): Promise<ScheduledReport | null> {
    try {
        const docRef = doc(getSchedulesCollection(organizationId), scheduleId);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) return null;

        const data = snapshot.data();
        return {
            ...data,
            id: snapshot.id,
            runCount: data.runCount || 0,
            isEnabled: data.isEnabled ?? true,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        } as ScheduledReport;
    } catch (error) {
        ErrorLogger.error(error, 'AgentReportService.getSchedule', {
            component: 'AgentReportService',
            action: 'getSchedule',
            organizationId,
            scheduleId,
        });
        throw error;
    }
}

/**
 * Delete a scheduled report
 */
export async function deleteSchedule(
    organizationId: string,
    scheduleId: string
): Promise<void> {
    try {
        await deleteDoc(doc(getSchedulesCollection(organizationId), scheduleId));
    } catch (error) {
        ErrorLogger.error(error, 'AgentReportService.deleteSchedule', {
            component: 'AgentReportService',
            action: 'deleteSchedule',
            organizationId,
            scheduleId,
        });
        throw error;
    }
}

/**
 * Toggle schedule enabled state
 */
export async function toggleSchedule(
    organizationId: string,
    scheduleId: string,
    isEnabled: boolean
): Promise<void> {
    try {
        await updateSchedule(organizationId, scheduleId, { isEnabled });
    } catch (error) {
        ErrorLogger.error(error, 'AgentReportService.toggleSchedule', {
            component: 'AgentReportService',
            action: 'toggleSchedule',
            organizationId,
            scheduleId,
        });
        throw error;
    }
}

/**
 * Run a scheduled report now
 */
export async function runScheduleNow(
    organizationId: string,
    scheduleId: string,
    userId: string
): Promise<string> {
    try {
        const schedule = await getSchedule(organizationId, scheduleId);
        if (!schedule) throw new Error('Schedule not found');

        // Generate report with schedule config
        const reportId = await generateReport(organizationId, schedule.config, userId);

        // Update schedule with atomic increment
        await updateDoc(doc(getSchedulesCollection(organizationId), scheduleId), sanitizeData({
            lastRunAt: new Date().toISOString(),
            lastReportId: reportId,
            runCount: increment(1),
        }));

        return reportId;
    } catch (error) {
        ErrorLogger.error(error, 'AgentReportService.runScheduleNow', {
            component: 'AgentReportService',
            action: 'runScheduleNow',
            organizationId,
            scheduleId,
        });
        throw error;
    }
}

// ============================================================================
// Report Templates
// ============================================================================

/**
 * Get all report templates (built-in + custom)
 */
export async function getTemplates(
    organizationId: string
): Promise<ReportTemplate[]> {
    try {
        // Get custom templates
        const snapshot = await getDocs(getTemplatesCollection(organizationId));
        const customTemplates = snapshot.docs.map(d => {
            const data = d.data();
            return {
                ...data,
                id: d.id,
                isBuiltIn: data.isBuiltIn ?? false,
            } as ReportTemplate;
        });

        // Combine with built-in templates
        return [...DEFAULT_REPORT_TEMPLATES, ...customTemplates];
    } catch (error) {
        ErrorLogger.error(error, 'AgentReportService.getTemplates', {
            component: 'AgentReportService',
            action: 'getTemplates',
            organizationId,
        });
        // Return built-in templates on error
        return DEFAULT_REPORT_TEMPLATES;
    }
}

/**
 * Create custom template
 */
export async function createTemplate(
    organizationId: string,
    template: Omit<ReportTemplate, 'id' | 'isBuiltIn'>
): Promise<string> {
    try {
        const docRef = await addDoc(getTemplatesCollection(organizationId), sanitizeData({
            ...template,
            isBuiltIn: false,
        }));
        return docRef.id;
    } catch (error) {
        ErrorLogger.error(error, 'AgentReportService.createTemplate', {
            component: 'AgentReportService',
            action: 'createTemplate',
            organizationId,
        });
        throw error;
    }
}

/**
 * Delete custom template
 */
export async function deleteTemplate(
    organizationId: string,
    templateId: string
): Promise<void> {
    try {
        // Don't delete built-in templates
        const template = await getDoc(doc(getTemplatesCollection(organizationId), templateId));
        if (template.exists() && template.data()?.isBuiltIn) {
            throw new Error('Cannot delete built-in template');
        }

        await deleteDoc(doc(getTemplatesCollection(organizationId), templateId));
    } catch (error) {
        ErrorLogger.error(error, 'AgentReportService.deleteTemplate', {
            component: 'AgentReportService',
            action: 'deleteTemplate',
            organizationId,
            templateId,
        });
        throw error;
    }
}

// ============================================================================
// Report Data Fetching
// ============================================================================

/**
 * Fetch compliance report data
 */
export async function fetchComplianceReportData(
    organizationId: string,
    filters: ReportFilters,
    dateRange: ReportDateRange
): Promise<ComplianceReportData> {
    try {
        const fetchDataFn = httpsCallable(functions, 'fetchComplianceReportData');
        const result = await fetchDataFn({
            organizationId,
            filters,
            dateRange,
        });

        return result.data as ComplianceReportData;
    } catch (error) {
        ErrorLogger.error(error, 'AgentReportService.fetchComplianceReportData', {
            component: 'AgentReportService',
            action: 'fetchComplianceReportData',
            organizationId,
        });
        throw error;
    }
}

/**
 * Fetch fleet health report data
 */
export async function fetchFleetHealthReportData(
    organizationId: string,
    filters: ReportFilters,
    dateRange: ReportDateRange
): Promise<FleetHealthReportData> {
    try {
        const fetchDataFn = httpsCallable(functions, 'fetchFleetHealthReportData');
        const result = await fetchDataFn({
            organizationId,
            filters,
            dateRange,
        });

        return result.data as FleetHealthReportData;
    } catch (error) {
        ErrorLogger.error(error, 'AgentReportService.fetchFleetHealthReportData', {
            component: 'AgentReportService',
            action: 'fetchFleetHealthReportData',
            organizationId,
        });
        throw error;
    }
}

/**
 * Fetch executive summary data
 */
export async function fetchExecutiveSummaryData(
    organizationId: string,
    dateRange: ReportDateRange
): Promise<ExecutiveSummaryData> {
    try {
        const fetchDataFn = httpsCallable(functions, 'fetchExecutiveSummaryData');
        const result = await fetchDataFn({
            organizationId,
            dateRange,
        });

        return result.data as ExecutiveSummaryData;
    } catch (error) {
        ErrorLogger.error(error, 'AgentReportService.fetchExecutiveSummaryData', {
            component: 'AgentReportService',
            action: 'fetchExecutiveSummaryData',
            organizationId,
        });
        throw error;
    }
}

// ============================================================================
// Report Statistics
// ============================================================================

/**
 * Get report statistics
 */
export async function getReportStats(
    organizationId: string
): Promise<{
    totalReports: number;
    byType: Record<ReportType, number>;
    byFormat: Record<ExportFormat, number>;
    activeSchedules: number;
    storageUsed: number;
}> {
    try {
        const reportsSnapshot = await getDocs(query(getReportsCollection(organizationId), firestoreLimit(2000)));
        const schedulesSnapshot = await getDocs(
            query(getSchedulesCollection(organizationId), where('isEnabled', '==', true), firestoreLimit(2000))
        );

        const stats = {
            totalReports: reportsSnapshot.size,
            byType: {} as Record<ReportType, number>,
            byFormat: {} as Record<ExportFormat, number>,
            activeSchedules: schedulesSnapshot.size,
            storageUsed: 0,
        };

        reportsSnapshot.docs.forEach(d => {
            const data = d.data() as AgentReport;

            // By type
            stats.byType[data.type] = (stats.byType[data.type] || 0) + 1;

            // By format
            stats.byFormat[data.format] = (stats.byFormat[data.format] || 0) + 1;

            // Storage
            if (data.fileSize) {
                stats.storageUsed += data.fileSize;
            }
        });

        return stats;
    } catch (error) {
        ErrorLogger.error(error, 'AgentReportService.getReportStats', {
            component: 'AgentReportService',
            action: 'getReportStats',
            organizationId,
        });
        throw error;
    }
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Delete expired reports
 */
export async function cleanupExpiredReports(
    organizationId: string
): Promise<number> {
    try {
        const now = new Date().toISOString();

        const expiredSnapshot = await getDocs(
            query(
                getReportsCollection(organizationId),
                where('expiresAt', '<=', now)
            )
        );

        let deleted = 0;

        for (const docSnapshot of expiredSnapshot.docs) {
            try {
                await deleteReport(organizationId, docSnapshot.id);
                deleted++;
            } catch {
                // Continue with other deletions
            }
        }

        return deleted;
    } catch (error) {
        ErrorLogger.error(error, 'AgentReportService.cleanupExpiredReports', {
            component: 'AgentReportService',
            action: 'cleanupExpiredReports',
            organizationId,
        });
        throw error;
    }
}

// ============================================================================
// Export Service Object
// ============================================================================

export const AgentReportService = {
    // Subscriptions
    subscribeToReports,
    subscribeToSchedules,

    // Report Generation
    generateReport,
    getReport,
    deleteReport,
    getReportDownloadUrl,

    // Scheduled Reports
    createSchedule,
    updateSchedule,
    getSchedule,
    deleteSchedule,
    toggleSchedule,
    runScheduleNow,

    // Templates
    getTemplates,
    createTemplate,
    deleteTemplate,

    // Data Fetching
    fetchComplianceReportData,
    fetchFleetHealthReportData,
    fetchExecutiveSummaryData,

    // Statistics
    getReportStats,

    // Cleanup
    cleanupExpiredReports,
};
