/**
 * Hook for managing SMSI Program data and operations
 * Provides access to the ISO 27003 SMSI Program and milestones
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../useAuth';
import { EbiosService } from '../../services/ebiosService';
import { ErrorLogger } from '../../services/errorLogger';
import type { SMSIProgram, Milestone, PDCAPhase } from '../../types/ebios';

interface UseSMSIProgramReturn {
  program: SMSIProgram | null;
  milestones: Milestone[];
  loading: boolean;
  error: string | null;
  createProgram: (data: { name: string; description?: string; targetCertificationDate?: string; template?: 'standard' | 'fast-track' | 'maintenance' }) => Promise<SMSIProgram | null>;
  createMilestone: (data: Omit<Milestone, 'id' | 'programId' | 'organizationId' | 'createdAt' | 'status'>) => Promise<Milestone | null>;
  updateMilestone: (milestoneId: string, data: Partial<Omit<Milestone, 'id' | 'programId' | 'organizationId' | 'createdAt'>>) => Promise<Milestone | null>;
  updateMilestoneStatus: (milestoneId: string, status: Milestone['status']) => Promise<void>;
  getMilestonesByPhase: (phase: PDCAPhase) => Milestone[];
  getOverdueMilestones: () => Milestone[];
  refreshData: () => Promise<void>;
}

export function useSMSIProgram(): UseSMSIProgramReturn {
  const { user } = useAuth();
  const [program, setProgram] = useState<SMSIProgram | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const organizationId = user?.organizationId;

  const fetchData = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [programData, milestonesData] = await Promise.all([
        EbiosService.getSMSIProgram(organizationId),
        EbiosService.getMilestones(organizationId),
      ]);

      setProgram(programData);
      setMilestones(milestonesData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors du chargement du programme SMSI';
      setError(errorMessage);
      ErrorLogger.error(err, 'useSMSIProgram.fetchData');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createProgram = useCallback(async (
    data: { name: string; description?: string; targetCertificationDate?: string; template?: 'standard' | 'fast-track' | 'maintenance' }
  ): Promise<SMSIProgram | null> => {
    if (!organizationId || !user?.uid) return null;

    try {
      const newProgram = await EbiosService.createSMSIProgram(organizationId, data, user.uid);
      setProgram(newProgram);
      // Refresh milestones since they are auto-generated
      const newMilestones = await EbiosService.getMilestones(organizationId);
      setMilestones(newMilestones);
      return newProgram;
    } catch (err) {
      ErrorLogger.error(err, 'useSMSIProgram.createProgram');
      throw err;
    }
  }, [organizationId, user?.uid]);

  const createMilestone = useCallback(async (
    data: Omit<Milestone, 'id' | 'programId' | 'organizationId' | 'createdAt' | 'status'>
  ): Promise<Milestone | null> => {
    if (!organizationId) return null;

    try {
      const newMilestone = await EbiosService.createMilestone(organizationId, data);
      setMilestones(prev => [...prev, newMilestone].sort((a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      ));
      return newMilestone;
    } catch (err) {
      ErrorLogger.error(err, 'useSMSIProgram.createMilestone');
      throw err;
    }
  }, [organizationId]);

  const updateMilestone = useCallback(async (
    milestoneId: string,
    data: Partial<Omit<Milestone, 'id' | 'programId' | 'organizationId' | 'createdAt'>>
  ): Promise<Milestone | null> => {
    if (!organizationId) return null;

    try {
      const updatedMilestone = await EbiosService.updateMilestone(organizationId, milestoneId, data);
      setMilestones(prev => prev.map(m =>
        m.id === milestoneId ? updatedMilestone : m
      ).sort((a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      ));
      return updatedMilestone;
    } catch (err) {
      ErrorLogger.error(err, 'useSMSIProgram.updateMilestone');
      throw err;
    }
  }, [organizationId]);

  const updateMilestoneStatus = useCallback(async (
    milestoneId: string,
    status: Milestone['status']
  ): Promise<void> => {
    if (!organizationId) return;

    try {
      await EbiosService.updateMilestoneStatus(organizationId, milestoneId, status);
      setMilestones(prev => prev.map(m =>
        m.id === milestoneId
          ? { ...m, status, completedAt: status === 'completed' ? new Date().toISOString() : undefined }
          : m
      ));
    } catch (err) {
      ErrorLogger.error(err, 'useSMSIProgram.updateMilestoneStatus');
      throw err;
    }
  }, [organizationId]);

  const getMilestonesByPhase = useCallback((phase: PDCAPhase): Milestone[] => {
    return milestones.filter(m => m.phase === phase);
  }, [milestones]);

  const getOverdueMilestones = useCallback((): Milestone[] => {
    const now = new Date();
    return milestones.filter(m =>
      m.status !== 'completed' && new Date(m.dueDate) < now
    );
  }, [milestones]);

  return {
    program,
    milestones,
    loading,
    error,
    createProgram,
    createMilestone,
    updateMilestone,
    updateMilestoneStatus,
    getMilestonesByPhase,
    getOverdueMilestones,
    refreshData: fetchData,
  };
}
