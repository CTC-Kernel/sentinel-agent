import { useState, useEffect, useCallback, useMemo } from 'react';
import { ComplianceCalendarService } from '../services/complianceCalendarService';
import { ErrorLogger } from '../services/errorLogger';
import { toast } from '@/lib/toast';
import { useAuth } from './useAuth';
import type { ComplianceEvent, ComplianceDeadline } from '../types/complianceCalendar';

interface UseComplianceCalendarReturn {
  events: ComplianceEvent[];
  deadlines: ComplianceDeadline[];
  loading: boolean;
  error: string | null;
  submitting: boolean;
  stats: ReturnType<typeof ComplianceCalendarService.computeStats>;
  createEvent: (data: Omit<ComplianceEvent, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<string | null>;
  updateEvent: (id: string, data: Partial<ComplianceEvent>) => Promise<boolean>;
  deleteEvent: (id: string) => Promise<boolean>;
  completeEvent: (id: string) => Promise<boolean>;
  createDeadline: (data: Omit<ComplianceDeadline, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>) => Promise<string | null>;
  updateDeadline: (id: string, data: Partial<ComplianceDeadline>) => Promise<boolean>;
  deleteDeadline: (id: string) => Promise<boolean>;
}

const EMPTY_STATS = {
  totalEvents: 0,
  eventsThisMonth: 0,
  eventsThisWeek: 0,
  overdueCount: 0,
  overdueEvents: [] as ComplianceEvent[],
  criticalDeadlines: 0,
  complianceRate: 100,
  byCategory: {} as Record<string, number>,
  byFramework: {} as Record<string, number>,
  totalDeadlines: 0,
};

export function useComplianceCalendar(): UseComplianceCalendarReturn {
  const { user } = useAuth();
  const organizationId = user?.organizationId;

  const [events, setEvents] = useState<ComplianceEvent[]>([]);
  const [deadlines, setDeadlines] = useState<ComplianceDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubEvents = ComplianceCalendarService.subscribeToEvents(
      organizationId,
      (data) => {
        setEvents(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    const unsubDeadlines = ComplianceCalendarService.subscribeToDeadlines(
      organizationId,
      (data) => setDeadlines(data),
      (err) => ErrorLogger.error(err, 'useComplianceCalendar.subscribeToDeadlines')
    );

    return () => {
      unsubEvents();
      unsubDeadlines();
    };
  }, [organizationId]);

  const stats = useMemo(() => {
    if (events.length === 0 && deadlines.length === 0) return EMPTY_STATS;
    return ComplianceCalendarService.computeStats(events, deadlines);
  }, [events, deadlines]);

  const createEvent = useCallback(async (
    data: Omit<ComplianceEvent, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy'>
  ): Promise<string | null> => {
    if (!organizationId || !user?.uid) return null;
    setSubmitting(true);
    try {
      const id = await ComplianceCalendarService.createEvent(data as Omit<ComplianceEvent, 'id'>, organizationId, user.uid);
      toast.success('Evenement cree avec succes');
      return id;
    } catch (err) {
      ErrorLogger.error(err, 'useComplianceCalendar.createEvent');
      toast.error('Erreur lors de la creation');
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [organizationId, user?.uid]);

  const updateEvent = useCallback(async (id: string, data: Partial<ComplianceEvent>): Promise<boolean> => {
    setSubmitting(true);
    try {
      await ComplianceCalendarService.updateEvent(id, data);
      toast.success('Evenement mis a jour');
      return true;
    } catch (err) {
      ErrorLogger.error(err, 'useComplianceCalendar.updateEvent');
      toast.error('Erreur lors de la mise a jour');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const deleteEvent = useCallback(async (id: string): Promise<boolean> => {
    setSubmitting(true);
    try {
      await ComplianceCalendarService.deleteEvent(id);
      toast.success('Evenement supprime');
      return true;
    } catch (err) {
      ErrorLogger.error(err, 'useComplianceCalendar.deleteEvent');
      toast.error('Erreur lors de la suppression');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const completeEvent = useCallback(async (id: string): Promise<boolean> => {
    setSubmitting(true);
    try {
      await ComplianceCalendarService.completeEvent(id);
      toast.success('Evenement complete');
      return true;
    } catch (err) {
      ErrorLogger.error(err, 'useComplianceCalendar.completeEvent');
      toast.error('Erreur lors de la completion');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const createDeadline = useCallback(async (
    data: Omit<ComplianceDeadline, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>
  ): Promise<string | null> => {
    if (!organizationId) return null;
    setSubmitting(true);
    try {
      const id = await ComplianceCalendarService.createDeadline(data as Omit<ComplianceDeadline, 'id'>, organizationId);
      toast.success('Echeance creee avec succes');
      return id;
    } catch (err) {
      ErrorLogger.error(err, 'useComplianceCalendar.createDeadline');
      toast.error('Erreur lors de la creation');
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [organizationId]);

  const updateDeadline = useCallback(async (id: string, data: Partial<ComplianceDeadline>): Promise<boolean> => {
    setSubmitting(true);
    try {
      await ComplianceCalendarService.updateDeadline(id, data);
      toast.success('Echeance mise a jour');
      return true;
    } catch (err) {
      ErrorLogger.error(err, 'useComplianceCalendar.updateDeadline');
      toast.error('Erreur lors de la mise a jour');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const deleteDeadline = useCallback(async (id: string): Promise<boolean> => {
    setSubmitting(true);
    try {
      await ComplianceCalendarService.deleteDeadline(id);
      toast.success('Echeance supprimee');
      return true;
    } catch (err) {
      ErrorLogger.error(err, 'useComplianceCalendar.deleteDeadline');
      toast.error('Erreur lors de la suppression');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return {
    events,
    deadlines,
    loading,
    error,
    submitting,
    stats,
    createEvent,
    updateEvent,
    deleteEvent,
    completeEvent,
    createDeadline,
    updateDeadline,
    deleteDeadline,
  };
}
