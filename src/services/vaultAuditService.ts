/**
 * Story 27.2 - Vault Audit Service
 *
 * Client-side service for querying and managing document audit trails.
 * Communicates with Cloud Functions for secure audit data retrieval.
 */

import { httpsCallable } from 'firebase/functions';
import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { functions, db, auth } from '@/firebase';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '@/utils/dataSanitizer';
import { getLocaleConfig, type SupportedLocale } from '@/config/localeConfig';
import i18n from '@/i18n';


// Constants
const DOCUMENT_AUDIT_LOGS_COLLECTION = 'document_audit_logs';

/**
 * Document action types for audit logging
 */
export const DocumentActions = {
  VIEW: 'view',
  DOWNLOAD: 'download',
  UPLOAD: 'upload',
  UPDATE: 'update',
  DELETE: 'delete',
  SHARE: 'share',
  CLASSIFY: 'classify',
  SIGN: 'sign',
  VERIFY: 'verify',
  HOLD_APPLIED: 'hold_applied',
  HOLD_RELEASED: 'hold_released',
  ACCESS_DENIED: 'access_denied',
  INTEGRITY_FAILURE: 'integrity_failure',
  WATERMARKED_DOWNLOAD: 'watermarked_download',
} as const;

export type DocumentAction = (typeof DocumentActions)[keyof typeof DocumentActions];

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  id: string;
  documentId: string;
  organizationId: string;
  action: DocumentAction;
  userId: string;
  userEmail: string;
  timestamp: string | null;
  details: Record<string, unknown>;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    source?: string;
    version?: string;
  };
  integrity?: {
    hash?: string;
    previousLogHash?: string;
    algorithm?: string;
  };
}

/**
 * Pagination info for audit queries
 */
export interface AuditPagination {
  limit: number;
  count: number;
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Audit trail query result
 */
export interface AuditTrailResult {
  success: boolean;
  entries: AuditLogEntry[];
  pagination: AuditPagination;
}

/**
 * Audit filters for queries
 */
export interface AuditFilters {
  actions?: DocumentAction[];
  userId?: string;
  documentId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Audit statistics summary
 */
export interface AuditStatistics {
  success: boolean;
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
  summary: {
    totalActions: number;
    uniqueUsers: number;
    uniqueDocuments: number;
    accessDeniedCount: number;
    integrityFailures: number;
  };
  topActions: Array<{ action: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
  topDocuments: Array<{ documentId: string; count: number }>;
  dailyTrend: Array<{ date: string; count: number }>;
}

/**
 * Export result structure
 */
export interface AuditExportResult {
  success: boolean;
  format: 'json' | 'csv';
  contentType: string;
  data: string;
  recordCount: number;
  exportedAt: string;
}

/**
 * Firebase error type guard
 */
interface FirebaseError {
  code?: string;
  message?: string;
}

function isFirebaseError(error: unknown): error is FirebaseError {
  return typeof error === 'object' && error !== null && ('code' in error || 'message' in error);
}

/**
 * Vault Audit Service for document audit trail operations
 */
export const VaultAuditService = {
  /**
   * Get audit trail for a specific document
   */
  async getDocumentAuditTrail(
    documentId: string,
    options: {
      limit?: number;
      startAfter?: string;
      filters?: Partial<AuditFilters>;
    } = {}
  ): Promise<AuditTrailResult> {
    try {
      const fn = httpsCallable<
        {
          documentId: string;
          limit?: number;
          startAfter?: string;
          filters?: Partial<AuditFilters>;
        },
        AuditTrailResult
      >(functions, 'getDocumentAuditTrail');

      const result = await fn({
        documentId,
        limit: options.limit || 50,
        startAfter: options.startAfter,
        filters: options.filters || {},
      });

      return result.data;
    } catch (error) {
      ErrorLogger.error(error, 'VaultAuditService.getDocumentAuditTrail');

      if (isFirebaseError(error)) {
        if (error.code === 'permission-denied') {
          throw new Error('Accès refusé');
        }
        if (error.message) {
          throw new Error(error.message);
        }
      }

      throw new Error('Échec de la récupération du journal d\'audit');
    }
  },

  /**
   * Get audit trail for a specific user
   */
  async getUserAuditTrail(
    userId?: string,
    options: {
      limit?: number;
      startAfter?: string;
      filters?: Partial<AuditFilters>;
    } = {}
  ): Promise<AuditTrailResult> {
    try {
      const fn = httpsCallable<
        {
          userId?: string;
          limit?: number;
          startAfter?: string;
          filters?: Partial<AuditFilters>;
        },
        AuditTrailResult
      >(functions, 'getUserAuditTrail');

      const result = await fn({
        userId,
        limit: options.limit || 50,
        startAfter: options.startAfter,
        filters: options.filters || {},
      });

      return result.data;
    } catch (error) {
      ErrorLogger.error(error, 'VaultAuditService.getUserAuditTrail');

      if (isFirebaseError(error)) {
        if (error.code === 'permission-denied') {
          throw new Error('Accès refusé');
        }
      }

      throw new Error('Échec de la récupération du journal d\'audit utilisateur');
    }
  },

  /**
   * Get organization-wide audit trail (admin/rssi only)
   */
  async getOrganizationAuditTrail(
    options: {
      limit?: number;
      startAfter?: string;
      filters?: AuditFilters;
    } = {}
  ): Promise<AuditTrailResult> {
    try {
      const fn = httpsCallable<
        {
          limit?: number;
          startAfter?: string;
          filters?: AuditFilters;
        },
        AuditTrailResult
      >(functions, 'getOrganizationAuditTrail');

      const result = await fn({
        limit: options.limit || 100,
        startAfter: options.startAfter,
        filters: options.filters || {},
      });

      return result.data;
    } catch (error) {
      ErrorLogger.error(error, 'VaultAuditService.getOrganizationAuditTrail');

      if (isFirebaseError(error)) {
        if (error.code === 'permission-denied') {
          throw new Error('Accès administrateur requis');
        }
      }

      throw new Error('Échec de la récupération du journal d\'audit organisation');
    }
  },

  /**
   * Export audit trail to file format
   */
  async exportAuditTrail(
    format: 'json' | 'csv',
    filters: AuditFilters = {},
    maxRecords = 10000
  ): Promise<AuditExportResult> {
    try {
      const fn = httpsCallable<
        {
          format: 'json' | 'csv';
          filters: AuditFilters;
          maxRecords: number;
        },
        AuditExportResult
      >(functions, 'exportAuditTrail');

      const result = await fn({
        format,
        filters,
        maxRecords,
      });

      return result.data;
    } catch (error) {
      ErrorLogger.error(error, 'VaultAuditService.exportAuditTrail');

      if (isFirebaseError(error)) {
        if (error.code === 'permission-denied') {
          throw new Error('Accès administrateur requis pour l\'export');
        }
      }

      throw new Error('Échec de l\'export du journal d\'audit');
    }
  },

  /**
   * Get audit statistics for dashboard
   */
  async getAuditStatistics(days = 30): Promise<AuditStatistics> {
    try {
      const fn = httpsCallable<{ days: number }, AuditStatistics>(
        functions,
        'getAuditStatistics'
      );

      const result = await fn({ days });
      return result.data;
    } catch (error) {
      ErrorLogger.error(error, 'VaultAuditService.getAuditStatistics');

      if (isFirebaseError(error)) {
        if (error.code === 'permission-denied') {
          throw new Error('Accès administrateur requis');
        }
      }

      throw new Error('Échec de la récupération des statistiques');
    }
  },

  /**
   * Log a document action from the client side
   * This is used for actions like view that happen entirely on the client
   */
  async logClientAction(
    documentId: string,
    organizationId: string,
    action: DocumentAction,
    _userId: string,
    _userEmail: string,
    details: Record<string, unknown> = {}
  ): Promise<string | null> {
    try {
      // Validate authentication - use auth.currentUser instead of passed userId to prevent forgery
      if (!auth.currentUser) {
        throw new Error('Not authenticated');
      }

      const authenticatedUserId = auth.currentUser.uid;
      const authenticatedEmail = auth.currentUser.email || '';

      const logEntry = {
        documentId,
        organizationId,
        action,
        userId: authenticatedUserId,
        userEmail: authenticatedEmail,
        timestamp: serverTimestamp(),
        details,
        metadata: {
          source: 'client',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        },
      };

      const docRef = await addDoc(
        collection(db, DOCUMENT_AUDIT_LOGS_COLLECTION),
        sanitizeData(logEntry)
      );

      return docRef.id;
    } catch (error) {
      ErrorLogger.error(error, 'VaultAuditService.logClientAction');
      // Don't throw - audit logging should not break the main operation
      return null;
    }
  },

  /**
   * Download exported data as a file
   */
  downloadExport(data: string, format: 'json' | 'csv', filename?: string): void {
    const blob = new Blob([data], {
      type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `audit-export-${Date.now()}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Get human-readable action label (French)
   */
  getActionLabel(action: DocumentAction): string {
    const labels: Record<DocumentAction, string> = {
      view: 'Consultation',
      download: 'Téléchargement',
      upload: 'Téléchargement (envoi)',
      update: 'Modification',
      delete: 'Suppression',
      share: 'Partage',
      classify: 'Classification',
      sign: 'Signature',
      verify: 'Vérification',
      hold_applied: 'Gel juridique appliqué',
      hold_released: 'Gel juridique levé',
      access_denied: 'Accès refusé',
      integrity_failure: 'Échec d\'intégrité',
      watermarked_download: 'Téléchargement avec filigrane',
    };

    return labels[action] || action;
  },

  /**
   * Get action icon name for UI
   */
  getActionIcon(action: DocumentAction): string {
    const icons: Record<DocumentAction, string> = {
      view: 'Eye',
      download: 'Download',
      upload: 'Upload',
      update: 'Edit',
      delete: 'Trash2',
      share: 'Share2',
      classify: 'Tag',
      sign: 'PenTool',
      verify: 'CheckCircle',
      hold_applied: 'Lock',
      hold_released: 'Unlock',
      access_denied: 'XCircle',
      integrity_failure: 'AlertTriangle',
      watermarked_download: 'FileText',
    };

    return icons[action] || 'Activity';
  },

  /**
   * Get action color class for UI
   */
  getActionColorClass(action: DocumentAction): {
    text: string;
    bg: string;
    border: string;
  } {
    const colors: Record<string, { text: string; bg: string; border: string }> = {
      view: {
        text: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-950',
        border: 'border-blue-200 dark:border-blue-800',
      },
      download: {
        text: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-50 dark:bg-green-950',
        border: 'border-green-200 dark:border-green-800',
      },
      upload: {
        text: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950',
        border: 'border-emerald-200 dark:border-emerald-800',
      },
      update: {
        text: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950',
        border: 'border-amber-200 dark:border-amber-800',
      },
      delete: {
        text: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-950',
        border: 'border-red-200 dark:border-red-800',
      },
      share: {
        text: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-950',
        border: 'border-purple-200 dark:border-purple-800',
      },
      classify: {
        text: 'text-indigo-600 dark:text-indigo-400',
        bg: 'bg-indigo-50 dark:bg-indigo-950',
        border: 'border-indigo-200 dark:border-indigo-800',
      },
      sign: {
        text: 'text-teal-600 dark:text-teal-400',
        bg: 'bg-teal-50 dark:bg-teal-950',
        border: 'border-teal-200 dark:border-teal-800',
      },
      verify: {
        text: 'text-cyan-600 dark:text-cyan-400',
        bg: 'bg-cyan-50 dark:bg-cyan-950',
        border: 'border-cyan-200 dark:border-cyan-800',
      },
      hold_applied: {
        text: 'text-orange-600 dark:text-orange-400',
        bg: 'bg-orange-50 dark:bg-orange-950',
        border: 'border-orange-200 dark:border-orange-800',
      },
      hold_released: {
        text: 'text-lime-600 dark:text-lime-400',
        bg: 'bg-lime-50 dark:bg-lime-950',
        border: 'border-lime-200 dark:border-lime-800',
      },
      access_denied: {
        text: 'text-red-700 dark:text-red-300',
        bg: 'bg-red-100 dark:bg-red-900',
        border: 'border-red-300 dark:border-red-700',
      },
      integrity_failure: {
        text: 'text-red-700 dark:text-red-300',
        bg: 'bg-red-100 dark:bg-red-900',
        border: 'border-red-300 dark:border-red-700',
      },
      watermarked_download: {
        text: 'text-slate-600 dark:text-slate-400',
        bg: 'bg-slate-50 dark:bg-slate-950',
        border: 'border-slate-200 dark:border-slate-800',
      },
    };

    return (
      colors[action] || {
        text: 'text-slate-600 dark:text-slate-400',
        bg: 'bg-slate-50 dark:bg-slate-950',
        border: 'border-slate-200 dark:border-slate-800',
      }
    );
  },

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamp: string | null): string {
    if (!timestamp) return 'N/A';

    try {
      const date = new Date(timestamp);
      return new Intl.DateTimeFormat(getLocaleConfig(i18n.language as SupportedLocale).intlLocale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return timestamp;
    }
  },

  /**
   * Get all available actions for filtering
   */
  getAllActions(): Array<{ value: DocumentAction; label: string }> {
    return Object.values(DocumentActions).map((action) => ({
      value: action,
      label: this.getActionLabel(action),
    }));
  },
};

export default VaultAuditService;
