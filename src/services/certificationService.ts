/**
 * Certification Service
 *
 * Service for managing organizational certifications lifecycle.
 * Handles CRUD operations, subscriptions, and statistics for certifications
 * like ISO 27001, SOC2, HDS, SecNumCloud, etc.
 *
 * @module services/certificationService
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import type {
  Certification,
  CertificationStats,
  CertificationFilters,
} from '../types/certification';
import type { UserProfile } from '../types';

const COLLECTION = 'certifications';

/**
 * Calculate days until a given date string
 */
function daysUntil(dateStr: string | undefined): number {
  if (!dateStr) return Infinity;
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Auto-compute certification status based on dates
 */
function computeStatus(cert: Partial<Certification>): Certification['status'] {
  if (cert.status === 'suspended' || cert.status === 'withdrawn' || cert.status === 'planning') {
    return cert.status;
  }

  if (cert.expiryDate) {
    const days = daysUntil(cert.expiryDate);
    if (days < 0) return 'expired';
    if (days <= 90) return 'expiring-soon';
  }

  if (cert.currentCertDate) return 'certified';
  if (cert.status === 'in-progress') return 'in-progress';

  return cert.status || 'planning';
}

export class CertificationService {
  /**
   * Get all certifications for an organization
   */
  static async getCertifications(organizationId: string): Promise<Certification[]> {
    try {
      if (!organizationId) throw new Error('Organization ID required');

      const q = query(
        collection(db, COLLECTION),
        where('organizationId', '==', organizationId),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Certification[];
    } catch (error) {
      ErrorLogger.error(error, 'CertificationService.getCertifications');
      throw error;
    }
  }

  /**
   * Subscribe to certifications for real-time updates
   */
  static subscribeToCertifications(
    organizationId: string,
    callback: (certifications: Certification[]) => void
  ): () => void {
    if (!organizationId) {
      ErrorLogger.error(new Error('Organization ID required'), 'CertificationService.subscribeToCertifications');
      return () => {};
    }

    const q = query(
      collection(db, COLLECTION),
      where('organizationId', '==', organizationId),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const certifications = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Certification[];
        callback(certifications);
      },
      (error) => {
        ErrorLogger.error(error, 'CertificationService.subscribeToCertifications');
      }
    );
  }

  /**
   * Get a single certification by ID
   */
  static async getCertification(id: string, organizationId: string): Promise<Certification | null> {
    try {
      if (!organizationId) throw new Error('Organization ID required');

      const docRef = doc(db, COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      const data = docSnap.data();
      if (data.organizationId !== organizationId) {
        throw new Error('Access denied: certification does not belong to this organization');
      }

      return { id: docSnap.id, ...data } as Certification;
    } catch (error) {
      ErrorLogger.error(error, 'CertificationService.getCertification');
      throw error;
    }
  }

  /**
   * Create a new certification
   */
  static async createCertification(
    data: Omit<Certification, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy'>,
    user: UserProfile
  ): Promise<string> {
    try {
      if (!user.organizationId) throw new Error('Organization ID required');

      const now = new Date().toISOString();
      const status = computeStatus(data);

      const certificationData = sanitizeData({
        ...data,
        status,
        organizationId: user.organizationId,
        auditHistory: data.auditHistory || [],
        milestones: data.milestones || [],
        contacts: data.contacts || [],
        tags: data.tags || [],
        createdAt: now,
        updatedAt: now,
        createdBy: user.uid,
      });

      const docRef = await addDoc(collection(db, COLLECTION), certificationData);
      return docRef.id;
    } catch (error) {
      ErrorLogger.error(error, 'CertificationService.createCertification');
      throw error;
    }
  }

  /**
   * Update an existing certification
   */
  static async updateCertification(
    id: string,
    data: Partial<Certification>,
    user: UserProfile
  ): Promise<void> {
    try {
      if (!user.organizationId) throw new Error('Organization ID required');

      // Verify ownership
      const docRef = doc(db, COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error('Certification not found');
      if (docSnap.data().organizationId !== user.organizationId) {
        throw new Error('Access denied: certification does not belong to this organization');
      }

      const merged = { ...docSnap.data(), ...data } as Certification;
      const status = computeStatus(merged);

      const updateData = sanitizeData({
        ...data,
        status,
        updatedAt: new Date().toISOString(),
      });

      // Remove id and organizationId from update payload
      const cleanData: Record<string, unknown> = { ...updateData as Record<string, unknown> };
      delete cleanData.id;
      delete cleanData.organizationId;

      await updateDoc(docRef, cleanData);
    } catch (error) {
      ErrorLogger.error(error, 'CertificationService.updateCertification');
      throw error;
    }
  }

  /**
   * Delete a certification
   */
  static async deleteCertification(id: string, organizationId: string): Promise<void> {
    try {
      if (!organizationId) throw new Error('Organization ID required');

      // Verify ownership
      const docRef = doc(db, COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error('Certification not found');
      if (docSnap.data().organizationId !== organizationId) {
        throw new Error('Access denied: certification does not belong to this organization');
      }

      await deleteDoc(docRef);
    } catch (error) {
      ErrorLogger.error(error, 'CertificationService.deleteCertification');
      throw error;
    }
  }

  /**
   * Get certifications expiring within N days
   */
  static getExpiringCertifications(certifications: Certification[], withinDays: number = 90): Certification[] {
    const now = new Date();
    const deadline = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

    return certifications.filter((cert) => {
      if (!cert.expiryDate) return false;
      const expiryDate = new Date(cert.expiryDate);
      return expiryDate > now && expiryDate <= deadline;
    }).sort((a, b) => {
      return new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime();
    });
  }

  /**
   * Get upcoming audits within N days
   */
  static getUpcomingAudits(certifications: Certification[], withinDays: number = 90): Certification[] {
    const now = new Date();
    const deadline = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

    return certifications.filter((cert) => {
      if (!cert.nextAuditDate) return false;
      const auditDate = new Date(cert.nextAuditDate);
      return auditDate > now && auditDate <= deadline;
    }).sort((a, b) => {
      return new Date(a.nextAuditDate!).getTime() - new Date(b.nextAuditDate!).getTime();
    });
  }

  /**
   * Calculate certification statistics
   */
  static calculateStats(certifications: Certification[]): CertificationStats {
    const now = new Date();
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const stats: CertificationStats = {
      total: certifications.length,
      active: 0,
      expiringSoon: 0,
      expired: 0,
      inProgress: 0,
      upcomingAudits: 0,
      totalAnnualCost: 0,
      byStandard: {},
      byCategory: {},
    };

    for (const cert of certifications) {
      // Status counts
      switch (cert.status) {
        case 'certified':
          stats.active++;
          break;
        case 'expiring-soon':
          stats.active++;
          stats.expiringSoon++;
          break;
        case 'expired':
          stats.expired++;
          break;
        case 'in-progress':
        case 'planning':
          stats.inProgress++;
          break;
      }

      // Upcoming audits
      if (cert.nextAuditDate) {
        const auditDate = new Date(cert.nextAuditDate);
        if (auditDate > now && auditDate <= in90Days) {
          stats.upcomingAudits++;
        }
      }

      // Costs
      if (cert.cost) {
        stats.totalAnnualCost += cert.cost.annualMaintenanceCost + cert.cost.auditCost;
      }

      // By standard
      const standard = cert.standard || 'Autre';
      stats.byStandard[standard] = (stats.byStandard[standard] || 0) + 1;
    }

    return stats;
  }

  /**
   * Filter certifications
   */
  static filterCertifications(
    certifications: Certification[],
    filters: CertificationFilters
  ): Certification[] {
    let filtered = [...certifications];

    if (filters.status) {
      filtered = filtered.filter((c) => c.status === filters.status);
    }

    if (filters.standard) {
      filtered = filtered.filter((c) => c.standard === filters.standard);
    }

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.standard.toLowerCase().includes(q) ||
          c.certificationBody.toLowerCase().includes(q) ||
          c.scope.toLowerCase().includes(q) ||
          (c.certificateNumber && c.certificateNumber.toLowerCase().includes(q))
      );
    }

    return filtered;
  }

  /**
   * Get certification timeline events for a specific certification
   */
  static getCertificationTimeline(cert: Certification): Array<{
    date: string;
    type: 'certification' | 'audit' | 'milestone' | 'expiry' | 'renewal';
    label: string;
    status: 'past' | 'current' | 'future';
    variant: 'success' | 'warning' | 'destructive' | 'primary' | 'secondary';
  }> {
    const events: Array<{
      date: string;
      type: 'certification' | 'audit' | 'milestone' | 'expiry' | 'renewal';
      label: string;
      status: 'past' | 'current' | 'future';
      variant: 'success' | 'warning' | 'destructive' | 'primary' | 'secondary';
    }> = [];

    const now = new Date();
    const getTimeStatus = (dateStr: string): 'past' | 'current' | 'future' => {
      const d = new Date(dateStr);
      const diffDays = Math.abs(Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      if (d < now && diffDays > 7) return 'past';
      if (diffDays <= 7) return 'current';
      return 'future';
    };

    if (cert.initialCertDate) {
      events.push({
        date: cert.initialCertDate,
        type: 'certification',
        label: 'Certification initiale',
        status: getTimeStatus(cert.initialCertDate),
        variant: 'success',
      });
    }

    if (cert.currentCertDate) {
      events.push({
        date: cert.currentCertDate,
        type: 'certification',
        label: 'Certification courante',
        status: getTimeStatus(cert.currentCertDate),
        variant: 'success',
      });
    }

    // Audit history
    for (const audit of cert.auditHistory) {
      const auditLabel = audit.type === 'initial'
        ? 'Audit initial'
        : audit.type === 'recertification'
          ? 'Audit de recertification'
          : 'Audit de surveillance';
      events.push({
        date: audit.date,
        type: 'audit',
        label: auditLabel,
        status: getTimeStatus(audit.date),
        variant: audit.result === 'pass' ? 'success' : audit.result === 'fail' ? 'destructive' : 'warning',
      });
    }

    // Milestones
    for (const milestone of cert.milestones) {
      events.push({
        date: milestone.dueDate,
        type: 'milestone',
        label: milestone.title,
        status: getTimeStatus(milestone.dueDate),
        variant: milestone.status === 'completed' ? 'success' : milestone.status === 'overdue' ? 'destructive' : 'primary',
      });
    }

    // Next audit
    if (cert.nextAuditDate) {
      events.push({
        date: cert.nextAuditDate,
        type: 'audit',
        label: 'Prochain audit',
        status: getTimeStatus(cert.nextAuditDate),
        variant: 'primary',
      });
    }

    // Expiry
    if (cert.expiryDate) {
      events.push({
        date: cert.expiryDate,
        type: 'expiry',
        label: 'Expiration',
        status: getTimeStatus(cert.expiryDate),
        variant: daysUntil(cert.expiryDate) <= 90 ? 'destructive' : 'warning',
      });
    }

    // Renewal
    if (cert.renewalDate) {
      events.push({
        date: cert.renewalDate,
        type: 'renewal',
        label: 'Renouvellement',
        status: getTimeStatus(cert.renewalDate),
        variant: 'secondary',
      });
    }

    // Sort by date
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return events;
  }
}
