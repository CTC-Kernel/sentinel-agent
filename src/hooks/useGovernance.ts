import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { GovernanceService } from '../services/governanceService';
import { Committee, Meeting, Decision } from '../types/governance';
import { ErrorLogger } from '../services/errorLogger';

export function useGovernance() {
  const organization = useStore(s => s.organization);
  const orgId = organization?.id;

  const [committees, setCommittees] = useState<Committee[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof GovernanceService.getGovernanceStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!orgId) return;

    setLoading(true);
    const unsubCommittees = GovernanceService.subscribeToCommittees(orgId, setCommittees);
    const unsubMeetings = GovernanceService.subscribeToMeetings(orgId, setMeetings);
    const unsubDecisions = GovernanceService.subscribeToDecisions(orgId, setDecisions);

    GovernanceService.getGovernanceStats(orgId)
      .then(setStats)
      .catch((err) => {
        ErrorLogger.handleErrorWithToast(err, 'useGovernance');
        setError(err);
      })
      .finally(() => setLoading(false));

    return () => {
      unsubCommittees();
      unsubMeetings();
      unsubDecisions();
    };
  }, [orgId]);

  const createCommittee = useCallback(async (data: Omit<Committee, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>) => {
    if (!orgId) throw new Error('No organization');
    return GovernanceService.createCommittee({ ...data, organizationId: orgId });
  }, [orgId]);

  const updateCommittee = useCallback(async (id: string, data: Partial<Committee>) => {
    return GovernanceService.updateCommittee(id, data);
  }, []);

  const deleteCommittee = useCallback(async (id: string) => {
    return GovernanceService.deleteCommittee(id);
  }, []);

  const createMeeting = useCallback(async (data: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>) => {
    if (!orgId) throw new Error('No organization');
    return GovernanceService.createMeeting({ ...data, organizationId: orgId });
  }, [orgId]);

  const updateMeeting = useCallback(async (id: string, data: Partial<Meeting>) => {
    return GovernanceService.updateMeeting(id, data);
  }, []);

  const createDecision = useCallback(async (data: Omit<Decision, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>) => {
    if (!orgId) throw new Error('No organization');
    return GovernanceService.createDecision({ ...data, organizationId: orgId });
  }, [orgId]);

  const updateDecision = useCallback(async (id: string, data: Partial<Decision>) => {
    return GovernanceService.updateDecision(id, data);
  }, []);

  const refreshStats = useCallback(async () => {
    if (!orgId) return;
    try {
      const newStats = await GovernanceService.getGovernanceStats(orgId);
      setStats(newStats);
    } catch (err) {
      ErrorLogger.error(err, 'useGovernance.refreshStats');
    }
  }, [orgId]);

  return {
    committees,
    meetings,
    decisions,
    stats,
    loading,
    error,
    createCommittee,
    updateCommittee,
    deleteCommittee,
    createMeeting,
    updateMeeting,
    createDecision,
    updateDecision,
    refreshStats,
  };
}
