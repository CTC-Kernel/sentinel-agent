/**
 * Certificate Service
 *
 * Service for managing SSL/TLS certificate inventory.
 * Part of NIS2 Article 21.2(h) compliance.
 *
 * @module services/CertificateService
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
  Timestamp,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { ErrorLogger } from './errorLogger';
import type {
  Certificate,
  CertificateFormData,
  CertificateStats,
  CertificateStatus,
  CertificateFilters,
  CertificateImportRow,
} from '../types/certificates';
import type { UserProfile } from '../types';

const COLLECTION = 'certificates';

/**
 * Calculate certificate status based on expiration date
 */
function calculateStatus(validTo: Timestamp): CertificateStatus {
  const now = new Date();
  const expirationDate = validTo.toDate();
  const daysUntilExpiration = Math.ceil(
    (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiration < 0) return 'expired';
  if (daysUntilExpiration <= 30) return 'expiring_soon';
  return 'valid';
}

export class CertificateService {
  /**
   * Get all certificates for an organization
   */
  static async getCertificates(organizationId: string): Promise<Certificate[]> {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('organizationId', '==', organizationId),
        orderBy('validTo', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Certificate[];
    } catch (error) {
      ErrorLogger.error(error, 'CertificateService.getCertificates');
      throw error;
    }
  }

  /**
   * Subscribe to certificates for real-time updates
   */
  static subscribeToCertificates(
    organizationId: string,
    callback: (certificates: Certificate[]) => void
  ): () => void {
    const q = query(
      collection(db, COLLECTION),
      where('organizationId', '==', organizationId),
      orderBy('validTo', 'asc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const certificates = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Certificate[];
        callback(certificates);
      },
      (error) => {
        ErrorLogger.error(error, 'CertificateService.subscribeToCertificates');
      }
    );
  }

  /**
   * Get a single certificate by ID
   */
  static async getCertificate(id: string): Promise<Certificate | null> {
    try {
      const docRef = doc(db, COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      return { id: docSnap.id, ...docSnap.data() } as Certificate;
    } catch (error) {
      ErrorLogger.error(error, 'CertificateService.getCertificate');
      throw error;
    }
  }

  /**
   * Create a new certificate
   */
  static async createCertificate(
    data: CertificateFormData,
    user: UserProfile
  ): Promise<string> {
    try {
      if (!user.organizationId) throw new Error('Organization ID required');

      const validTo = Timestamp.fromDate(data.validTo as unknown as Date);
      const status = calculateStatus(validTo);

      const certificateData: Omit<Certificate, 'id'> = {
        ...data,
        organizationId: user.organizationId,
        validFrom: Timestamp.fromDate(data.validFrom as unknown as Date),
        validTo,
        status,
        alertsSent: {},
        createdAt: Timestamp.now(),
        createdBy: user.uid,
        updatedAt: Timestamp.now(),
        updatedBy: user.uid,
      };

      const docRef = await addDoc(collection(db, COLLECTION), certificateData);
      return docRef.id;
    } catch (error) {
      ErrorLogger.error(error, 'CertificateService.createCertificate');
      throw error;
    }
  }

  /**
   * Update an existing certificate
   */
  static async updateCertificate(
    id: string,
    data: Partial<CertificateFormData>,
    user: UserProfile
  ): Promise<void> {
    try {
      const updateData: Record<string, unknown> = {
        ...data,
        updatedAt: Timestamp.now(),
        updatedBy: user.uid,
      };

      // Convert dates to Timestamps
      if (data.validFrom) {
        updateData.validFrom = Timestamp.fromDate(data.validFrom as unknown as Date);
      }
      if (data.validTo) {
        const validTo = Timestamp.fromDate(data.validTo as unknown as Date);
        updateData.validTo = validTo;
        updateData.status = calculateStatus(validTo);
      }

      await updateDoc(doc(db, COLLECTION, id), updateData);
    } catch (error) {
      ErrorLogger.error(error, 'CertificateService.updateCertificate');
      throw error;
    }
  }

  /**
   * Delete a certificate
   */
  static async deleteCertificate(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION, id));
    } catch (error) {
      ErrorLogger.error(error, 'CertificateService.deleteCertificate');
      throw error;
    }
  }

  /**
   * Import certificates from CSV data
   */
  static async importCertificates(
    rows: CertificateImportRow[],
    user: UserProfile
  ): Promise<{ success: number; errors: Array<{ row: number; error: string }> }> {
    if (!user.organizationId) throw new Error('Organization ID required');

    const batch = writeBatch(db);
    const errors: Array<{ row: number; error: string }> = [];
    let success = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const validFrom = new Date(row.validFrom);
        const validTo = new Date(row.validTo);

        if (isNaN(validFrom.getTime()) || isNaN(validTo.getTime())) {
          throw new Error('Invalid date format');
        }

        const validToTs = Timestamp.fromDate(validTo);
        const status = calculateStatus(validToTs);

        const certificateData: Omit<Certificate, 'id'> = {
          organizationId: user.organizationId,
          name: row.name,
          type: 'ssl_tls',
          commonName: row.commonName,
          domains: row.domains.split(',').map((d) => d.trim()),
          serialNumber: row.serialNumber,
          issuer: row.issuer,
          issuerType: (row.issuerType as Certificate['issuerType']) || 'public_ca',
          validFrom: Timestamp.fromDate(validFrom),
          validTo: validToTs,
          status,
          keyAlgorithm: (row.keyAlgorithm as Certificate['keyAlgorithm']) || 'RSA',
          keySize: parseInt(row.keySize) || 2048,
          signatureAlgorithm: row.signatureAlgorithm || 'SHA256withRSA',
          owner: row.owner,
          ownerEmail: row.ownerEmail,
          autoRenew: false,
          alertsSent: {},
          notes: row.notes,
          tags: row.tags?.split(',').map((t) => t.trim()),
          createdAt: Timestamp.now(),
          createdBy: user.uid,
          updatedAt: Timestamp.now(),
          updatedBy: user.uid,
        };

        const docRef = doc(collection(db, COLLECTION));
        batch.set(docRef, certificateData);
        success++;
      } catch (error) {
        errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    if (success > 0) {
      await batch.commit();
    }

    return { success, errors };
  }

  /**
   * Calculate certificate statistics
   */
  static calculateStats(certificates: Certificate[]): CertificateStats {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const stats: CertificateStats = {
      total: certificates.length,
      valid: 0,
      expiringSoon: 0,
      expired: 0,
      revoked: 0,
      byType: {
        ssl_tls: 0,
        code_signing: 0,
        email: 0,
        client: 0,
        root_ca: 0,
        intermediate_ca: 0,
        other: 0,
      },
      byAlgorithm: {
        RSA: 0,
        ECDSA: 0,
        Ed25519: 0,
        DSA: 0,
        other: 0,
      },
      byIssuerType: {
        public_ca: 0,
        private_ca: 0,
        self_signed: 0,
      },
      expiringNext30Days: [],
      weakCrypto: 0,
    };

    for (const cert of certificates) {
      // Status counts
      switch (cert.status) {
        case 'valid':
          stats.valid++;
          break;
        case 'expiring_soon':
          stats.expiringSoon++;
          break;
        case 'expired':
          stats.expired++;
          break;
        case 'revoked':
          stats.revoked++;
          break;
      }

      // Type counts
      stats.byType[cert.type]++;

      // Algorithm counts
      stats.byAlgorithm[cert.keyAlgorithm]++;

      // Issuer type counts
      stats.byIssuerType[cert.issuerType]++;

      // Expiring in next 30 days
      const expirationDate = cert.validTo.toDate();
      if (expirationDate > now && expirationDate <= in30Days) {
        stats.expiringNext30Days.push(cert);
      }

      // Weak crypto detection
      if (
        (cert.keyAlgorithm === 'RSA' && cert.keySize < 2048) ||
        cert.signatureAlgorithm?.toLowerCase().includes('sha1')
      ) {
        stats.weakCrypto++;
      }
    }

    // Sort expiring by date
    stats.expiringNext30Days.sort(
      (a, b) => a.validTo.toDate().getTime() - b.validTo.toDate().getTime()
    );

    return stats;
  }

  /**
   * Filter certificates
   */
  static filterCertificates(
    certificates: Certificate[],
    filters: CertificateFilters
  ): Certificate[] {
    let filtered = [...certificates];

    if (filters.status) {
      filtered = filtered.filter((c) => c.status === filters.status);
    }

    if (filters.type) {
      filtered = filtered.filter((c) => c.type === filters.type);
    }

    if (filters.issuerType) {
      filtered = filtered.filter((c) => c.issuerType === filters.issuerType);
    }

    if (filters.expiringWithin) {
      const now = new Date();
      const deadline = new Date(
        now.getTime() + filters.expiringWithin * 24 * 60 * 60 * 1000
      );
      filtered = filtered.filter((c) => {
        const expirationDate = c.validTo.toDate();
        return expirationDate > now && expirationDate <= deadline;
      });
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.commonName.toLowerCase().includes(query) ||
          c.domains.some((d) => d.toLowerCase().includes(query)) ||
          c.issuer.toLowerCase().includes(query)
      );
    }

    return filtered;
  }

  /**
   * Update certificate statuses based on expiration
   */
  static async refreshStatuses(organizationId: string): Promise<number> {
    try {
      const certificates = await this.getCertificates(organizationId);
      const batch = writeBatch(db);
      let updated = 0;

      for (const cert of certificates) {
        if (cert.status === 'revoked') continue; // Don't update revoked certs

        const newStatus = calculateStatus(cert.validTo);
        if (newStatus !== cert.status) {
          batch.update(doc(db, COLLECTION, cert.id), {
            status: newStatus,
            updatedAt: Timestamp.now(),
          });
          updated++;
        }
      }

      if (updated > 0) {
        await batch.commit();
      }

      return updated;
    } catch (error) {
      ErrorLogger.error(error, 'CertificateService.refreshStatuses');
      throw error;
    }
  }

  /**
   * Trigger certificate expiration check via Cloud Function
   * Returns statistics about expiring certificates
   */
  static async checkExpirations(): Promise<{
    expired: number;
    critical: number;
    warning: number;
    notice: number;
    total: number;
    notificationsSent: boolean;
  }> {
    try {
      const checkFn = httpsCallable<
        Record<string, never>,
        {
          success: boolean;
          expired: number;
          critical: number;
          warning: number;
          notice: number;
          total: number;
          notificationsSent: boolean;
        }
      >(functions, 'checkCertificateExpirations');

      const result = await checkFn({});
      return {
        expired: result.data.expired,
        critical: result.data.critical,
        warning: result.data.warning,
        notice: result.data.notice,
        total: result.data.total,
        notificationsSent: result.data.notificationsSent,
      };
    } catch (error) {
      ErrorLogger.error(error, 'CertificateService.checkExpirations');
      throw error;
    }
  }
}
