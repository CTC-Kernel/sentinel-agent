import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { useStore } from '../store';
import { RegulatoryChangeService, RegulatoryChangeStats } from '../services/regulatoryChangeService';
import { ErrorLogger } from '../services/errorLogger';
import { toast } from '@/lib/toast';
import type { RegulatoryChange, RegulatoryAlert } from '../types/regulatoryChange';

interface UseRegulatoryChangesReturn {
  changes: RegulatoryChange[];
  alerts: RegulatoryAlert[];
  stats: RegulatoryChangeStats;
  loading: boolean;
  error: Error | null;
  createChange: (data: Omit<RegulatoryChange, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>) => Promise<string | null>;
  updateChange: (id: string, data: Partial<RegulatoryChange>) => Promise<boolean>;
  deleteChange: (id: string) => Promise<boolean>;
  markAlertRead: (alertId: string) => Promise<void>;
}

const EMPTY_STATS: RegulatoryChangeStats = {
  total: 0,
  byStatus: {
    'identified': 0,
    'analyzing': 0,
    'action-required': 0,
    'implementing': 0,
    'compliant': 0,
    'not-applicable': 0,
  },
  bySeverity: {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    informational: 0,
  },
  actionRequired: 0,
  upcomingDeadlines: 0,
  overdueActions: 0,
  complianceRate: 0,
};

export const useRegulatoryChanges = (): UseRegulatoryChangesReturn => {
  const { user, claimsSynced } = useAuth();
  const { demoMode } = useStore();

  const [changes, setChanges] = useState<RegulatoryChange[]>([]);
  const [alerts, setAlerts] = useState<RegulatoryAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const organizationId = user?.organizationId;
  const shouldFetch = !!organizationId && !demoMode && claimsSynced;

  // Subscribe to regulatory changes
  useEffect(() => {
    if (!shouldFetch || !organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribeChanges = RegulatoryChangeService.subscribeToChanges(
      organizationId,
      (data) => {
        setChanges(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    const unsubscribeAlerts = RegulatoryChangeService.subscribeToAlerts(
      organizationId,
      (data) => {
        setAlerts(data);
      },
      (err) => {
        ErrorLogger.error(err, 'useRegulatoryChanges.subscribeToAlerts');
      }
    );

    return () => {
      unsubscribeChanges();
      unsubscribeAlerts();
    };
  }, [shouldFetch, organizationId]);

  // Calculate stats
  const stats = useMemo(() => {
    if (changes.length === 0) return EMPTY_STATS;
    return RegulatoryChangeService.calculateStats(changes);
  }, [changes]);

  // CRUD callbacks
  const createChange = useCallback(
    async (
      data: Omit<RegulatoryChange, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>
    ): Promise<string | null> => {
      if (!organizationId || !user?.uid) return null;
      try {
        const id = await RegulatoryChangeService.createChange(
          organizationId,
          data,
          user.uid
        );
        toast.success('Changement reglementaire cree avec succes');
        return id;
      } catch (err) {
        ErrorLogger.handleErrorWithToast(err, 'useRegulatoryChanges.createChange', 'CREATE_FAILED');
        return null;
      }
    },
    [organizationId, user?.uid]
  );

  const updateChange = useCallback(
    async (id: string, data: Partial<RegulatoryChange>): Promise<boolean> => {
      try {
        await RegulatoryChangeService.updateChange(id, data);
        toast.success('Changement reglementaire mis a jour');
        return true;
      } catch (err) {
        ErrorLogger.handleErrorWithToast(err, 'useRegulatoryChanges.updateChange', 'UPDATE_FAILED');
        return false;
      }
    },
    []
  );

  const deleteChange = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await RegulatoryChangeService.deleteChange(id);
        toast.success('Changement reglementaire supprime');
        return true;
      } catch (err) {
        ErrorLogger.handleErrorWithToast(err, 'useRegulatoryChanges.deleteChange', 'DELETE_FAILED');
        return false;
      }
    },
    []
  );

  const markAlertRead = useCallback(async (alertId: string): Promise<void> => {
    try {
      await RegulatoryChangeService.markAlertRead(alertId);
    } catch (err) {
      ErrorLogger.error(err, 'useRegulatoryChanges.markAlertRead');
    }
  }, []);

  return {
    changes,
    alerts,
    stats,
    loading,
    error,
    createChange,
    updateChange,
    deleteChange,
    markAlertRead,
  };
};
