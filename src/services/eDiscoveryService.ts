/**
 * Story 27.4 - eDiscovery Service
 *
 * Advanced search service for legal/compliance teams.
 * Supports boolean operators, saved queries, and bulk exports.
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Query,
  DocumentData,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import type { DocumentAction } from './vaultAuditService';
import type { ClassificationLevel } from '@/types/vault';

// Constants
const DOCUMENT_AUDIT_LOGS_COLLECTION = 'document_audit_logs';
const EDISCOVERY_SEARCHES_COLLECTION = 'ediscovery_searches';

/**
 * Boolean operator for combining search criteria
 */
export type BooleanOperator = 'AND' | 'OR' | 'NOT';

/**
 * Search criterion for building complex queries
 */
export interface SearchCriterion {
  field: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'in' | 'not-in';
  value: unknown;
}

/**
 * Search criteria group with boolean operator
 */
export interface SearchCriteriaGroup {
  operator: BooleanOperator;
  criteria: SearchCriterion[];
}

/**
 * eDiscovery search query definition
 */
export interface EDiscoveryQuery {
  /** Query name for saved searches */
  name: string;
  /** Query description */
  description?: string;
  /** Date range filter */
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  /** User IDs to filter */
  userIds?: string[];
  /** Action types to filter */
  actions?: DocumentAction[];
  /** Document IDs to filter */
  documentIds?: string[];
  /** Classification levels to filter */
  classifications?: ClassificationLevel[];
  /** Keyword search (searches in details) */
  keywords?: string[];
  /** Boolean operator for combining criteria */
  booleanOperator?: BooleanOperator;
  /** Additional criteria groups */
  criteriaGroups?: SearchCriteriaGroup[];
  /** Max results to return */
  maxResults?: number;
}

/**
 * Saved search query
 */
export interface SavedSearch {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  query: EDiscoveryQuery;
  createdBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  lastRunAt?: Date | null;
  runCount: number;
  isPublic: boolean;
}

/**
 * Search result entry
 */
export interface SearchResultEntry {
  id: string;
  documentId: string;
  documentName?: string;
  action: DocumentAction;
  userId: string;
  userEmail: string;
  timestamp: string | null;
  classification?: ClassificationLevel;
  details: Record<string, unknown>;
  highlights?: string[];
}

/**
 * Search results response
 */
export interface SearchResults {
  success: boolean;
  entries: SearchResultEntry[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
  searchTime: number;
  query: EDiscoveryQuery;
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  format: 'csv' | 'json' | 'pdf';
  data: string;
  recordCount: number;
  exportedAt: string;
}

/**
 * Build Firestore query from eDiscovery criteria
 */
function buildFirestoreQuery(
  organizationId: string,
  searchQuery: EDiscoveryQuery
): Query<DocumentData> {
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('timestamp', 'desc'),
  ];

  // Date range filter
  if (searchQuery.dateRange?.startDate) {
    constraints.push(where('timestamp', '>=', new Date(searchQuery.dateRange.startDate)));
  }
  if (searchQuery.dateRange?.endDate) {
    constraints.push(where('timestamp', '<=', new Date(searchQuery.dateRange.endDate)));
  }

  // User filter (Firestore 'in' supports up to 10 values)
  if (searchQuery.userIds && searchQuery.userIds.length > 0 && searchQuery.userIds.length <= 10) {
    constraints.push(where('userId', 'in', searchQuery.userIds));
  }

  // Action filter
  if (searchQuery.actions && searchQuery.actions.length > 0 && searchQuery.actions.length <= 10) {
    constraints.push(where('action', 'in', searchQuery.actions));
  }

  // Document filter
  if (searchQuery.documentIds && searchQuery.documentIds.length > 0 && searchQuery.documentIds.length <= 10) {
    constraints.push(where('documentId', 'in', searchQuery.documentIds));
  }

  // Limit
  constraints.push(limit(searchQuery.maxResults || 1000));

  return query(collection(db, DOCUMENT_AUDIT_LOGS_COLLECTION), ...constraints);
}

/**
 * Apply keyword filter to results (client-side filtering)
 */
function applyKeywordFilter(
  entries: SearchResultEntry[],
  keywords: string[],
  booleanOperator: BooleanOperator = 'AND'
): SearchResultEntry[] {
  if (!keywords || keywords.length === 0) {
    return entries;
  }

  return entries.filter(entry => {
    const searchableText = JSON.stringify(entry.details).toLowerCase();

    if (booleanOperator === 'AND') {
      return keywords.every(kw => searchableText.includes(kw.toLowerCase()));
    } else if (booleanOperator === 'OR') {
      return keywords.some(kw => searchableText.includes(kw.toLowerCase()));
    } else if (booleanOperator === 'NOT') {
      return !keywords.some(kw => searchableText.includes(kw.toLowerCase()));
    }

    return true;
  });
}

/**
 * Highlight keywords in text
 */
function highlightKeywords(text: string, keywords: string[]): string[] {
  const highlights: string[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();
    let index = lowerText.indexOf(lowerKeyword);

    while (index !== -1) {
      const start = Math.max(0, index - 30);
      const end = Math.min(text.length, index + keyword.length + 30);
      let snippet = text.substring(start, end);

      if (start > 0) snippet = '...' + snippet;
      if (end < text.length) snippet = snippet + '...';

      highlights.push(snippet);
      index = lowerText.indexOf(lowerKeyword, index + 1);
    }
  }

  return highlights.slice(0, 5); // Limit highlights
}

/**
 * eDiscovery Service for advanced search operations
 */
export const EDiscoveryService = {
  /**
   * Execute an eDiscovery search
   */
  async executeSearch(
    organizationId: string,
    searchQuery: EDiscoveryQuery
  ): Promise<SearchResults> {
    const startTime = Date.now();

    try {
      // Build and execute the Firestore query
      const firestoreQuery = buildFirestoreQuery(organizationId, searchQuery);
      const snapshot = await getDocs(firestoreQuery);

      let entries: SearchResultEntry[] = [];

      // Map results
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        entries.push({
          id: docSnap.id,
          documentId: data.documentId,
          documentName: data.details?.filename || data.details?.documentName,
          action: data.action,
          userId: data.userId,
          userEmail: data.userEmail,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
          classification: data.details?.classification,
          details: data.details || {},
        });
      });

      // Apply keyword filter (client-side)
      if (searchQuery.keywords && searchQuery.keywords.length > 0) {
        entries = applyKeywordFilter(entries, searchQuery.keywords, searchQuery.booleanOperator);

        // Add highlights
        entries = entries.map(entry => ({
          ...entry,
          highlights: highlightKeywords(
            JSON.stringify(entry.details),
            searchQuery.keywords || []
          ),
        }));
      }

      const searchTime = Date.now() - startTime;

      return {
        success: true,
        entries,
        totalCount: entries.length,
        hasMore: entries.length === (searchQuery.maxResults || 1000),
        searchTime,
        query: searchQuery,
      };
    } catch (error) {
      ErrorLogger.error(error, 'EDiscoveryService.executeSearch');
      throw new Error('Échec de la recherche eDiscovery');
    }
  },

  /**
   * Save a search query for reuse
   */
  async saveSearchQuery(
    organizationId: string,
    userId: string,
    name: string,
    searchQuery: EDiscoveryQuery,
    options?: {
      description?: string;
      isPublic?: boolean;
    }
  ): Promise<string> {
    try {
      const savedSearch: Omit<SavedSearch, 'id' | 'createdAt' | 'updatedAt'> = {
        organizationId,
        name,
        description: options?.description,
        query: searchQuery,
        createdBy: userId,
        runCount: 0,
        isPublic: options?.isPublic || false,
      };

      const docRef = await addDoc(collection(db, EDISCOVERY_SEARCHES_COLLECTION), sanitizeData({
        ...savedSearch,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      return docRef.id;
    } catch (error) {
      ErrorLogger.error(error, 'EDiscoveryService.saveSearchQuery');
      throw new Error('Échec de la sauvegarde de la recherche');
    }
  },

  /**
   * Load saved search queries
   */
  async loadSearchQueries(
    organizationId: string,
    userId: string
  ): Promise<SavedSearch[]> {
    try {
      // Get user's own searches and public searches
      const userSearchesQuery = query(
        collection(db, EDISCOVERY_SEARCHES_COLLECTION),
        where('organizationId', '==', organizationId),
        where('createdBy', '==', userId),
        orderBy('updatedAt', 'desc'),
        limit(50)
      );

      const publicSearchesQuery = query(
        collection(db, EDISCOVERY_SEARCHES_COLLECTION),
        where('organizationId', '==', organizationId),
        where('isPublic', '==', true),
        orderBy('updatedAt', 'desc'),
        limit(50)
      );

      const [userSnapshot, publicSnapshot] = await Promise.all([
        getDocs(userSearchesQuery),
        getDocs(publicSearchesQuery),
      ]);

      const searchesMap = new Map<string, SavedSearch>();

      // Process user searches
      userSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        searchesMap.set(docSnap.id, {
          id: docSnap.id,
          organizationId: data.organizationId,
          name: data.name,
          description: data.description,
          query: data.query,
          createdBy: data.createdBy,
          createdAt: data.createdAt?.toDate?.() || null,
          updatedAt: data.updatedAt?.toDate?.() || null,
          lastRunAt: data.lastRunAt?.toDate?.() || null,
          runCount: data.runCount || 0,
          isPublic: data.isPublic || false,
        });
      });

      // Process public searches (avoid duplicates)
      publicSnapshot.forEach(docSnap => {
        if (!searchesMap.has(docSnap.id)) {
          const data = docSnap.data();
          searchesMap.set(docSnap.id, {
            id: docSnap.id,
            organizationId: data.organizationId,
            name: data.name,
            description: data.description,
            query: data.query,
            createdBy: data.createdBy,
            createdAt: data.createdAt?.toDate?.() || null,
            updatedAt: data.updatedAt?.toDate?.() || null,
            lastRunAt: data.lastRunAt?.toDate?.() || null,
            runCount: data.runCount || 0,
            isPublic: data.isPublic || false,
          });
        }
      });

      return Array.from(searchesMap.values());
    } catch (error) {
      ErrorLogger.error(error, 'EDiscoveryService.loadSearchQueries');
      throw new Error('Échec du chargement des recherches sauvegardées');
    }
  },

  /**
   * Update a saved search query
   */
  async updateSearchQuery(
    searchId: string,
    updates: {
      name?: string;
      description?: string;
      query?: EDiscoveryQuery;
      isPublic?: boolean;
    }
  ): Promise<void> {
    try {
      const docRef = doc(db, EDISCOVERY_SEARCHES_COLLECTION, searchId);
      await updateDoc(docRef, sanitizeData({
        ...updates,
        updatedAt: serverTimestamp(),
      }));
    } catch (error) {
      ErrorLogger.error(error, 'EDiscoveryService.updateSearchQuery');
      throw new Error('Échec de la mise à jour de la recherche');
    }
  },

  /**
   * Delete a saved search query
   */
  async deleteSearchQuery(searchId: string): Promise<void> {
    try {
      const docRef = doc(db, EDISCOVERY_SEARCHES_COLLECTION, searchId);
      await deleteDoc(docRef);
    } catch (error) {
      ErrorLogger.error(error, 'EDiscoveryService.deleteSearchQuery');
      throw new Error('Échec de la suppression de la recherche');
    }
  },

  /**
   * Record search execution (for analytics)
   */
  async recordSearchExecution(searchId: string): Promise<void> {
    try {
      const docRef = doc(db, EDISCOVERY_SEARCHES_COLLECTION, searchId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const currentCount = docSnap.data().runCount || 0;
        await updateDoc(docRef, sanitizeData({
          runCount: currentCount + 1,
          lastRunAt: serverTimestamp(),
        }));
      }
    } catch (error) {
      // Non-critical, just log
      ErrorLogger.error(error, 'EDiscoveryService.recordSearchExecution');
    }
  },

  /**
   * Export search results
   */
  async exportSearchResults(
    results: SearchResults,
    format: 'csv' | 'json'
  ): Promise<ExportResult> {
    try {
      let data: string;

      if (format === 'csv') {
        // Generate CSV
        const headers = [
          'ID',
          'Document ID',
          'Document Name',
          'Action',
          'User ID',
          'User Email',
          'Timestamp',
          'Classification',
          'Details',
        ];

        const rows = [headers.join(',')];

        for (const entry of results.entries) {
          const row = [
            entry.id,
            entry.documentId,
            entry.documentName || 'N/A',
            entry.action,
            entry.userId,
            entry.userEmail,
            entry.timestamp || 'N/A',
            entry.classification || 'N/A',
            `"${JSON.stringify(entry.details).replace(/"/g, '""')}"`,
          ];
          rows.push(row.join(','));
        }

        data = rows.join('\n');
      } else {
        // JSON format
        data = JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            query: results.query,
            totalCount: results.totalCount,
            entries: results.entries,
          },
          null,
          2
        );
      }

      return {
        success: true,
        format,
        data,
        recordCount: results.entries.length,
        exportedAt: new Date().toISOString(),
      };
    } catch (error) {
      ErrorLogger.error(error, 'EDiscoveryService.exportSearchResults');
      throw new Error('Échec de l\'export des résultats');
    }
  },

  /**
   * Download export data as file
   */
  downloadExport(exportResult: ExportResult, filename?: string): void {
    const blob = new Blob([exportResult.data], {
      type: exportResult.format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `ediscovery-export-${Date.now()}.${exportResult.format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Build a quick search query from simple parameters
   */
  buildQuickQuery(params: {
    keywords?: string;
    dateRange?: { start: string; end: string };
    actions?: DocumentAction[];
    userEmail?: string;
  }): EDiscoveryQuery {
    const query: EDiscoveryQuery = {
      name: 'Quick Search',
      booleanOperator: 'AND',
    };

    if (params.keywords) {
      query.keywords = params.keywords.split(/\s+/).filter(k => k.length > 0);
    }

    if (params.dateRange?.start || params.dateRange?.end) {
      query.dateRange = {
        startDate: params.dateRange.start || '',
        endDate: params.dateRange.end || '',
      };
    }

    if (params.actions && params.actions.length > 0) {
      query.actions = params.actions;
    }

    return query;
  },

  /**
   * Validate search query
   */
  validateQuery(searchQuery: EDiscoveryQuery): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (searchQuery.userIds && searchQuery.userIds.length > 10) {
      errors.push('Maximum 10 utilisateurs peuvent être sélectionnés');
    }

    if (searchQuery.actions && searchQuery.actions.length > 10) {
      errors.push('Maximum 10 types d\'action peuvent être sélectionnés');
    }

    if (searchQuery.documentIds && searchQuery.documentIds.length > 10) {
      errors.push('Maximum 10 documents peuvent être sélectionnés');
    }

    if (searchQuery.dateRange) {
      if (searchQuery.dateRange.startDate && searchQuery.dateRange.endDate) {
        const start = new Date(searchQuery.dateRange.startDate);
        const end = new Date(searchQuery.dateRange.endDate);
        if (start > end) {
          errors.push('La date de début doit être antérieure à la date de fin');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};

export default EDiscoveryService;
