/**
 * CMDB Service
 *
 * Service for Configuration Item CRUD operations.
 * Handles all CI lifecycle management with audit logging.
 *
 * @module services/CMDBService
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  Timestamp,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/firebase';
import {
  ConfigurationItem,
  CMDBFilters,
  CMDBPagination,
  PaginatedCIs,
  DiscoveryStats,
  CIClass,
  CIStatus,
  CMDBActivity,
  DailyActivityStats,
} from '@/types/cmdb';
import { createCISchema, updateCISchema, CreateCIFormData } from '@/schemas/cmdbSchema';

const COLLECTION_NAME = 'cmdb_cis';

/**
 * CMDB Service - Static methods for CI operations
 */
export class CMDBService {
  // ===========================================================================
  // CREATE
  // ===========================================================================

  /**
   * Create a new Configuration Item
   */
  static async createCI(
    organizationId: string,
    data: CreateCIFormData,
    userId: string
  ): Promise<string> {
    // Validate input
    const validated = createCISchema.safeParse(data);
    if (!validated.success) {
      throw new Error(`Validation error: ${validated.error.message}`);
    }

    const ciData = {
      ...validated.data,
      organizationId,
      dataQualityScore: this.calculateDataQualityScore(validated.data),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
      updatedBy: userId,
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), ciData);

    // Audit logging
    await this.logActivity(organizationId, {
      type: 'create',
      message: `CI "${validated.data.name}" créé`,
      ciId: docRef.id,
      ciName: validated.data.name,
      userId,
    });

    return docRef.id;
  }

  // ===========================================================================
  // READ
  // ===========================================================================

  /**
   * Get a single CI by ID
   */
  static async getCI(
    organizationId: string,
    ciId: string
  ): Promise<ConfigurationItem | null> {
    const docRef = doc(db, COLLECTION_NAME, ciId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();

    // Security: Verify organization access
    if (data.organizationId !== organizationId) {
      throw new Error('Access denied: CI belongs to different organization');
    }

    return { id: docSnap.id, ...data } as ConfigurationItem;
  }

  /**
   * List CIs with filters and pagination
   */
  static async listCIs(
    organizationId: string,
    filters: CMDBFilters = {},
    pagination: CMDBPagination = { limit: 50 }
  ): Promise<PaginatedCIs> {
    const constraints: QueryConstraint[] = [
      where('organizationId', '==', organizationId),
    ];

    // Apply filters
    if (filters.ciClass) {
      constraints.push(where('ciClass', '==', filters.ciClass));
    }
    if (filters.status) {
      constraints.push(where('status', '==', filters.status));
    }
    if (filters.environment) {
      constraints.push(where('environment', '==', filters.environment));
    }
    if (filters.criticality) {
      constraints.push(where('criticality', '==', filters.criticality));
    }
    if (filters.ownerId) {
      constraints.push(where('ownerId', '==', filters.ownerId));
    }
    if (filters.discoverySource) {
      constraints.push(where('discoverySource', '==', filters.discoverySource));
    }
    if (filters.lowQuality) {
      constraints.push(where('dataQualityScore', '<', 50));
    }
    if (filters.stale) {
      const thirtyDaysAgo = Timestamp.fromDate(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );
      constraints.push(where('lastDiscoveredAt', '<', thirtyDaysAgo));
    }

    // Sorting
    const sortField = pagination.sortBy || 'name';
    const sortDir = pagination.sortDirection || 'asc';
    constraints.push(orderBy(sortField, sortDir));

    // Pagination
    constraints.push(limit(pagination.limit + 1)); // +1 to check for more

    if (pagination.cursor) {
      const cursorDoc = await getDoc(doc(db, COLLECTION_NAME, pagination.cursor));
      if (cursorDoc.exists()) {
        constraints.push(startAfter(cursorDoc));
      }
    }

    const q = query(collection(db, COLLECTION_NAME), ...constraints);
    const snapshot = await getDocs(q);

    const items: ConfigurationItem[] = [];
    snapshot.forEach((docSnap) => {
      if (items.length < pagination.limit) {
        items.push({ id: docSnap.id, ...docSnap.data() } as ConfigurationItem);
      }
    });

    // Client-side search filter (Firestore doesn't support full-text search)
    let filteredItems = items;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredItems = items.filter(
        (ci) =>
          ci.name.toLowerCase().includes(searchLower) ||
          ci.description?.toLowerCase().includes(searchLower) ||
          ci.fingerprint.hostname?.toLowerCase().includes(searchLower)
      );
    }

    const hasMore = snapshot.size > pagination.limit;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : undefined;

    return {
      items: filteredItems,
      total: filteredItems.length, // Note: For accurate total, use a count query
      hasMore,
      nextCursor,
    };
  }

  /**
   * Search CIs by text query
   */
  static async searchCIs(
    organizationId: string,
    searchQuery: string,
    maxResults: number = 20
  ): Promise<ConfigurationItem[]> {
    // For basic search, we fetch and filter client-side
    // For production, consider using Algolia or Elasticsearch
    const result = await this.listCIs(
      organizationId,
      { search: searchQuery },
      { limit: maxResults }
    );
    return result.items;
  }

  /**
   * Get CI by fingerprint (for reconciliation)
   */
  static async getCIByFingerprint(
    organizationId: string,
    field: string,
    value: string
  ): Promise<ConfigurationItem | null> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('organizationId', '==', organizationId),
      where(field, '==', value),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as ConfigurationItem;
  }

  // ===========================================================================
  // UPDATE
  // ===========================================================================

  /**
   * Update a CI
   */
  static async updateCI(
    organizationId: string,
    ciId: string,
    updates: Partial<CreateCIFormData>,
    userId: string
  ): Promise<void> {
    // Get current CI for audit
    const currentCI = await this.getCI(organizationId, ciId);
    if (!currentCI) {
      throw new Error('CI not found');
    }

    // Validate updates
    const validated = updateCISchema.safeParse(updates);
    if (!validated.success) {
      throw new Error(`Validation error: ${validated.error.message}`);
    }

    const updateData = {
      ...validated.data,
      dataQualityScore: this.calculateDataQualityScore({
        ...currentCI,
        ...validated.data,
      }),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };

    const docRef = doc(db, COLLECTION_NAME, ciId);
    await updateDoc(docRef, updateData);

    // Audit logging
    await this.logActivity(organizationId, {
      type: 'update',
      message: `CI "${currentCI.name}" mis à jour`,
      ciId,
      ciName: currentCI.name,
      userId,
      metadata: {
        changedFields: Object.keys(validated.data),
      },
    });
  }

  /**
   * Update CI discovery timestamp (called by agent sync)
   */
  static async updateDiscoveryTimestamp(
    _organizationId: string,
    ciId: string,
    agentId: string
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, ciId);
    await updateDoc(docRef, {
      lastDiscoveredAt: serverTimestamp(),
      sourceAgentId: agentId,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Mark CI as missing (not discovered recently)
   */
  static async markCIAsMissing(
    organizationId: string,
    ciId: string,
    userId: string
  ): Promise<void> {
    await this.updateCI(
      organizationId,
      ciId,
      { status: 'Missing' as CIStatus },
      userId
    );
  }

  // ===========================================================================
  // DELETE
  // ===========================================================================

  /**
   * Delete (retire) a CI - soft delete by setting status to Retired
   */
  static async deleteCI(
    organizationId: string,
    ciId: string,
    userId: string
  ): Promise<void> {
    const currentCI = await this.getCI(organizationId, ciId);
    if (!currentCI) {
      throw new Error('CI not found');
    }

    // Soft delete - set status to Retired
    const docRef = doc(db, COLLECTION_NAME, ciId);
    await updateDoc(docRef, {
      status: 'Retired',
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    // Audit logging
    await this.logActivity(organizationId, {
      type: 'delete',
      message: `CI "${currentCI.name}" retiré`,
      ciId,
      ciName: currentCI.name,
      userId,
    });
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get discovery statistics for dashboard
   */
  static async getDiscoveryStats(organizationId: string): Promise<DiscoveryStats> {
    const baseQuery = query(
      collection(db, COLLECTION_NAME),
      where('organizationId', '==', organizationId)
    );

    const snapshot = await getDocs(baseQuery);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let total = 0;
    let missing = 0;
    let createdToday = 0;
    let updatedToday = 0;
    let totalDQS = 0;

    // Distribution by class
    const classDistribution: Record<CIClass, number> = {
      Hardware: 0,
      Software: 0,
      Service: 0,
      Document: 0,
      Network: 0,
      Cloud: 0,
      Container: 0,
    };

    // Quality score distribution
    const qualityDistribution = {
      excellent: 0, // 80-100
      good: 0,      // 60-79
      needsImprovement: 0, // <60
    };

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      total++;
      totalDQS += data.dataQualityScore || 0;

      // Count by class
      if (data.ciClass && classDistribution[data.ciClass as CIClass] !== undefined) {
        classDistribution[data.ciClass as CIClass]++;
      }

      // Count by quality
      const dqs = data.dataQualityScore || 0;
      if (dqs >= 80) {
        qualityDistribution.excellent++;
      } else if (dqs >= 60) {
        qualityDistribution.good++;
      } else {
        qualityDistribution.needsImprovement++;
      }

      if (data.status === 'Missing') {
        missing++;
      } else if (data.lastDiscoveredAt) {
        const lastDiscovered = data.lastDiscoveredAt.toDate();
        if (lastDiscovered < thirtyDaysAgo) {
          missing++;
        }
      }

      if (data.createdAt) {
        const created = data.createdAt.toDate();
        if (created >= todayStart) {
          createdToday++;
        }
      }

      if (data.updatedAt) {
        const updated = data.updatedAt.toDate();
        if (updated >= todayStart) {
          updatedToday++;
        }
      }
    });

    // Get pending validation count from queue
    const pendingQuery = query(
      collection(db, 'cmdb_reconciliation_queue'),
      where('organizationId', '==', organizationId),
      where('status', '==', 'Pending')
    );
    const pendingSnapshot = await getDocs(pendingQuery);
    const pending = pendingSnapshot.size;

    return {
      total,
      pending,
      matched: total - pending,
      missing,
      createdToday,
      updatedToday,
      avgDataQualityScore: total > 0 ? Math.round(totalDQS / total) : 0,
      classDistribution,
      qualityDistribution,
    };
  }

  /**
   * Get recent CMDB activity from audit logs
   */
  static async getRecentActivity(
    organizationId: string,
    limitCount: number = 10
  ): Promise<CMDBActivity[]> {
    const activityQuery = query(
      collection(db, 'cmdb_activity'),
      where('organizationId', '==', organizationId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(activityQuery);
    const activities: CMDBActivity[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      activities.push({
        id: docSnap.id,
        type: data.type,
        message: data.message,
        ciId: data.ciId,
        ciName: data.ciName,
        userId: data.userId,
        userName: data.userName,
        timestamp: data.timestamp?.toDate() || new Date(),
        metadata: data.metadata,
      });
    });

    return activities;
  }

  /**
   * Log CMDB activity
   */
  static async logActivity(
    organizationId: string,
    activity: Omit<CMDBActivity, 'id' | 'timestamp'>
  ): Promise<void> {
    await addDoc(collection(db, 'cmdb_activity'), {
      ...activity,
      organizationId,
      timestamp: serverTimestamp(),
    });
  }

  /**
   * Get daily activity statistics for the last N days
   */
  static async getDailyActivityStats(
    organizationId: string,
    days: number = 14
  ): Promise<DailyActivityStats[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const activityQuery = query(
      collection(db, COLLECTION_NAME),
      where('organizationId', '==', organizationId),
      where('createdAt', '>=', Timestamp.fromDate(startDate))
    );

    const snapshot = await getDocs(activityQuery);

    // Initialize stats for each day
    const dailyStats: Record<string, { discovered: number; reconciled: number }> = {};
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const key = date.toISOString().split('T')[0];
      dailyStats[key] = { discovered: 0, reconciled: 0 };
    }

    // Count CIs by creation date
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.createdAt) {
        const createdDate = data.createdAt.toDate();
        const key = createdDate.toISOString().split('T')[0];
        if (dailyStats[key]) {
          dailyStats[key].discovered++;
          // Count as reconciled if it has a data quality score >= 60
          if (data.dataQualityScore >= 60) {
            dailyStats[key].reconciled++;
          }
        }
      }
    });

    // Convert to array
    return Object.entries(dailyStats).map(([date, stats]) => ({
      date: new Date(date).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
      }),
      discovered: stats.discovered,
      reconciled: stats.reconciled,
    }));
  }

  // ===========================================================================
  // DATA QUALITY
  // ===========================================================================

  /**
   * Calculate Data Quality Score for a CI
   * Score is 0-100 based on completeness, freshness, and relations
   */
  static calculateDataQualityScore(ci: Partial<ConfigurationItem>): number {
    let score = 0;

    // Completeness (40 points max)
    const requiredFields = ['name', 'ciClass', 'ciType', 'status', 'ownerId'];
    const completedRequired = requiredFields.filter(
      (f) => ci[f as keyof typeof ci] !== undefined && ci[f as keyof typeof ci] !== ''
    ).length;
    score += (completedRequired / requiredFields.length) * 20;

    // Optional fields bonus
    const optionalFields = ['description', 'supportGroupId', 'environment', 'criticality'];
    const completedOptional = optionalFields.filter(
      (f) => ci[f as keyof typeof ci] !== undefined && ci[f as keyof typeof ci] !== ''
    ).length;
    score += (completedOptional / optionalFields.length) * 10;

    // Fingerprint completeness
    const fingerprint = ci.fingerprint || {};
    const fingerprintFields = ['serialNumber', 'primaryMacAddress', 'hostname'];
    const completedFingerprint = fingerprintFields.filter(
      (f) => fingerprint[f as keyof typeof fingerprint]
    ).length;
    score += (completedFingerprint / fingerprintFields.length) * 10;

    // Freshness (30 points max)
    if (ci.lastDiscoveredAt) {
      const lastDiscovered =
        ci.lastDiscoveredAt instanceof Timestamp
          ? ci.lastDiscoveredAt.toDate()
          : ci.lastDiscoveredAt;
      const daysSinceDiscovery =
        (Date.now() - new Date(lastDiscovered).getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceDiscovery <= 1) {
        score += 30;
      } else if (daysSinceDiscovery <= 7) {
        score += 25;
      } else if (daysSinceDiscovery <= 30) {
        score += 15;
      } else {
        score += 5;
      }
    } else if (ci.discoverySource === 'Manual') {
      // Manual CIs don't need discovery freshness
      score += 20;
    }

    // Discovery source bonus (10 points)
    if (ci.discoverySource === 'Agent') {
      score += 10;
    } else if (ci.discoverySource === 'Manual' || ci.discoverySource === 'Import') {
      score += 5;
    }

    // Status penalty
    if (ci.status === 'Missing') {
      score -= 20;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // ===========================================================================
  // BULK OPERATIONS
  // ===========================================================================

  /**
   * Get CIs by IDs
   */
  static async getCIsByIds(
    organizationId: string,
    ciIds: string[]
  ): Promise<ConfigurationItem[]> {
    if (ciIds.length === 0) return [];

    // Firestore 'in' query limited to 30 items
    const chunks: string[][] = [];
    for (let i = 0; i < ciIds.length; i += 30) {
      chunks.push(ciIds.slice(i, i + 30));
    }

    const results: ConfigurationItem[] = [];

    for (const chunk of chunks) {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('organizationId', '==', organizationId),
        where('__name__', 'in', chunk)
      );

      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        results.push({ id: docSnap.id, ...docSnap.data() } as ConfigurationItem);
      });
    }

    return results;
  }

  /**
   * Get CIs by class
   */
  static async getCIsByClass(
    organizationId: string,
    ciClass: CIClass
  ): Promise<ConfigurationItem[]> {
    const result = await this.listCIs(
      organizationId,
      { ciClass },
      { limit: 1000 }
    );
    return result.items;
  }
}
