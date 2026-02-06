/**
 * useCertifications Hook
 *
 * Custom hook for managing certifications lifecycle.
 * Provides real-time subscription, CRUD operations, filtering, and statistics.
 *
 * @module hooks/useCertifications
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { CertificationService } from '../services/certificationService';
import { ErrorLogger } from '../services/errorLogger';
import { toast } from '@/lib/toast';
import { useAuth } from './useAuth';
import type {
  Certification,
  CertificationStats,
  CertificationFilters,
} from '../types/certification';

interface UseCertificationsReturn {
  /** All certifications for the organization */
  certifications: Certification[];
  /** Filtered certifications based on current filters */
  filteredCertifications: Certification[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Submitting state for CRUD operations */
  submitting: boolean;
  /** Certification statistics */
  stats: CertificationStats;
  /** Current filters */
  filters: CertificationFilters;
  /** Update filters */
  setFilters: React.Dispatch<React.SetStateAction<CertificationFilters>>;
  /** Create a new certification */
  createCertification: (data: Omit<Certification, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<string | null>;
  /** Update an existing certification */
  updateCertification: (id: string, data: Partial<Certification>) => Promise<boolean>;
  /** Delete a certification */
  deleteCertification: (id: string) => Promise<boolean>;
  /** Certifications expiring within 90 days */
  expiringCertifications: Certification[];
  /** Certifications with upcoming audits */
  upcomingAudits: Certification[];
}

export function useCertifications(): UseCertificationsReturn {
  const { user } = useAuth();
  const organizationId = user?.organizationId;

  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState<CertificationFilters>({});

  // Subscribe to certifications
  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = CertificationService.subscribeToCertifications(
      organizationId,
      (data) => {
        setCertifications(data);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [organizationId]);

  // Filtered certifications
  const filteredCertifications = useMemo(() => {
    return CertificationService.filterCertifications(certifications, filters);
  }, [certifications, filters]);

  // Statistics
  const stats = useMemo(() => {
    return CertificationService.calculateStats(certifications);
  }, [certifications]);

  // Expiring certifications
  const expiringCertifications = useMemo(() => {
    return CertificationService.getExpiringCertifications(certifications, 90);
  }, [certifications]);

  // Upcoming audits
  const upcomingAudits = useMemo(() => {
    return CertificationService.getUpcomingAudits(certifications, 90);
  }, [certifications]);

  // Create
  const createCertification = useCallback(async (
    data: Omit<Certification, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy'>
  ): Promise<string | null> => {
    if (!user) {
      toast.error('Utilisateur non connecte');
      return null;
    }

    setSubmitting(true);
    try {
      const id = await CertificationService.createCertification(data, user);
      toast.success('Certification ajoutee avec succes');
      return id;
    } catch (err) {
      ErrorLogger.error(err, 'useCertifications.createCertification');
      toast.error('Erreur lors de la creation de la certification');
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [user]);

  // Update
  const updateCertification = useCallback(async (
    id: string,
    data: Partial<Certification>
  ): Promise<boolean> => {
    if (!user) {
      toast.error('Utilisateur non connecte');
      return false;
    }

    setSubmitting(true);
    try {
      await CertificationService.updateCertification(id, data, user);
      toast.success('Certification mise a jour');
      return true;
    } catch (err) {
      ErrorLogger.error(err, 'useCertifications.updateCertification');
      toast.error('Erreur lors de la mise a jour');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [user]);

  // Delete
  const deleteCertification = useCallback(async (id: string): Promise<boolean> => {
    if (!organizationId) {
      toast.error('Organisation non trouvee');
      return false;
    }

    setSubmitting(true);
    try {
      await CertificationService.deleteCertification(id, organizationId);
      toast.success('Certification supprimee');
      return true;
    } catch (err) {
      ErrorLogger.error(err, 'useCertifications.deleteCertification');
      toast.error('Erreur lors de la suppression');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [organizationId]);

  return {
    certifications,
    filteredCertifications,
    loading,
    error,
    submitting,
    stats,
    filters,
    setFilters,
    createCertification,
    updateCertification,
    deleteCertification,
    expiringCertifications,
    upcomingAudits,
  };
}
