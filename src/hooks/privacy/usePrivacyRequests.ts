
import { useState, useEffect, useCallback } from 'react';
import { PrivacyService } from '../../services/PrivacyService';
import { PrivacyRequest, UserProfile } from '../../types';
import { useStore } from '../../store';
// import { ErrorLogger } from '../../services/errorLogger';

export function usePrivacyRequests() {
    const { user, addToast } = useStore();
    const [requests, setRequests] = useState<PrivacyRequest[]>([]);
    const [loading, setLoading] = useState(true);

    const organizationId = user?.organizationId;

    const fetchRequests = useCallback(async () => {
        if (!organizationId) return;
        setLoading(true);
        try {
            const data = await PrivacyService.fetchRequests(organizationId);
            // Sort by priority then date descending
            const sorted = data.sort((a, b) => {
                const priorityWeight = { 'High': 3, 'Medium': 2, 'Low': 1 };
                const pDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
                if (pDiff !== 0) return pDiff;
                return new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime();
            });
            setRequests(sorted);
        } catch {
            // ErrorLogger.handleErrorWithToast(_error, 'usePrivacyRequests.fetchRequests');
        } finally {
            setLoading(false);
        }
    }, [organizationId]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const handleCreateRequest = async (data: Omit<PrivacyRequest, 'id' | 'organizationId'>) => {
        if (!user || !organizationId) return;
        try {
            const newRequest: Omit<PrivacyRequest, 'id'> = {
                ...data,
                organizationId,
                status: 'New'
            };
            await PrivacyService.createRequest(newRequest, user as UserProfile);
            addToast("Demande DSR créée", "success");
            fetchRequests();
        } catch {
            // Service handles toast
        }
    };

    const handleUpdateRequest = async (id: string, updates: Partial<PrivacyRequest>) => {
        if (!user) return;
        try {
            await PrivacyService.updateRequest(id, updates, user as UserProfile);
            setRequests(prev => prev.map(req => req.id === id ? { ...req, ...updates } : req));
            addToast("Demande mise à jour", "success");
        } catch {
            // Service handles toast
        }
    };

    const handleDeleteRequest = async (id: string) => {
        if (!user) return;
        if (user.role !== 'rssi' && user.role !== 'admin') {
            addToast("Permission refusée", "error");
            return;
        }
        try {
            await PrivacyService.deleteRequest(id, user as UserProfile);
            setRequests(prev => prev.filter(req => req.id !== id));
            addToast("Demande supprimée", "success");
        } catch {
            // Service handles toast
        }
    };

    return {
        requests,
        loading,
        createRequest: handleCreateRequest,
        updateRequest: handleUpdateRequest,
        deleteRequest: handleDeleteRequest,
        refresh: fetchRequests
    };
}
