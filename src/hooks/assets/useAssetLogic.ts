
import { useMemo, useState, useEffect } from 'react';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { where, limit, getCountFromServer, collection, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import { Asset, UserProfile } from '../../types';
import { MockDataService } from '../../services/mockDataService';
import { AssetService } from '../../services/assetService';
import { canEditResource } from '../../utils/permissions';
import { toast } from '@/lib/toast';
import { AssetFormData } from '../../schemas/assetSchema';
import { usePlanLimits } from '../usePlanLimits';
import { DependencyService } from '../../services/dependencyService';
import { ErrorLogger } from '../../services/errorLogger';
import { AgentService } from '../../services/AgentService';
import { SentinelAgent } from '../../types/agent';

export const useAssetLogic = (enabled = true) => {
    const { user, claimsSynced } = useAuth();
    const { demoMode, t } = useStore();
    const { limits } = usePlanLimits();

    // Mock Data State
    const [mockData, setMockData] = useState<{
        assets: Asset[];
    } | null>(null);

    const [mockLoading, setMockLoading] = useState(true);

    useEffect(() => {
        if (demoMode) {
            // Loading handled implicitly or by layout, just simulate data arrival
            const timer = setTimeout(() => {
                setMockData({
                    assets: MockDataService.getCollection('assets') as unknown as Asset[]
                });
                setMockLoading(false);
            }, 500);
            return () => clearTimeout(timer);
        } else {
            setMockLoading(false);
        }
    }, [demoMode]);

    const organizationId = user?.organizationId;

    const constraints = useMemo(() => {
        return organizationId ? [where('organizationId', '==', organizationId), limit(1000)] : undefined;
    }, [organizationId]);

    // Fetch ONLY Assets (Lightweight)
    // We keep limit(1000) for now until pagination is fully implemented in UI
    const { data: rawAssets, loading: assetsLoading, refresh: refreshFirestoreAssets } = useFirestoreCollection<Asset>(
        'assets',
        constraints,
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode && claimsSynced && enabled }
    );

    // Fetch Agents for Real-time Discovery
    // Fetch Agents for Real-time Discovery
    const [agents, setAgents] = useState<SentinelAgent[]>([]);
    useEffect(() => {
        if (!organizationId || demoMode) return;

        const unsubscribe = AgentService.subscribeToAgents(
            organizationId,
            (newAgents: SentinelAgent[]) => {
                setAgents(newAgents);
            },
            (error: Error) => {
                // Silent fail for agents to not break asset flow
                console.warn('Failed to subscribe to agents', error);
            }
        );
        return () => unsubscribe();
    }, [organizationId, demoMode]);

    const assets = useMemo(() => {
        const source = (demoMode && mockData ? mockData.assets : (rawAssets || [])) as Asset[];

        // Map agents to virtual assets if they don't exist
        const agentAssets = agents.filter(agent =>
            !source.some(asset => asset.name === agent.hostname || asset.ipAddress === agent.ipAddress || asset.name === agent.name)
        ).map(agent => ({
            id: `agent-${agent.id}`, // Virtual ID
            organizationId: agent.organizationId,
            name: agent.hostname || agent.name || 'Unknown Agent',
            type: 'Matériel',
            owner: 'Système',
            confidentiality: 'Moyen',
            integrity: 'Moyen',
            availability: 'Moyen',
            location: 'Unknown',
            createdAt: agent.enrolledAt || new Date().toISOString(),
            updatedAt: agent.lastHeartbeat,
            lifecycleStatus: 'En service',
            ipAddress: agent.ipAddress,
            hostname: agent.hostname,
            os: agent.os,
            isAgent: true // Flag to identify virtual assets
        } as unknown as Asset));

        return [...source, ...agentAssets].map(a => ({
            ...a,
            currentValue: AssetService.calculateDepreciation(a.purchasePrice || 0, a.purchaseDate || '')
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [rawAssets, demoMode, mockData, agents]);

    const loading = demoMode ? mockLoading : assetsLoading;

    // Actions
    const [isSubmitting, setIsSubmitting] = useState(false);

    const refreshAssets = () => {
        if (!demoMode) refreshFirestoreAssets();
    };

    const createAsset = async (data: AssetFormData, preSelectedProjectId?: string | null): Promise<{ success: boolean; id?: string; error?: unknown }> => {
        if (!user?.organizationId || !user?.uid) return { success: false, error: 'No organization ID' };

        if (!canEditResource(user as UserProfile, 'Asset')) {
            toast.error(t('common.accessDenied'));
            return { success: false, error: 'PERMISSION_DENIED' };
        }

        // Server-side check for accurate limit enforcement and cost optimization
        // (prevents downloading all assets just to check count)
        try {
            const countSnap = await getCountFromServer(query(
                collection(db, 'assets'),
                where('organizationId', '==', user.organizationId)
            ));

            if (countSnap.data().count >= limits.maxAssets) {
                return { success: false, error: 'LIMIT_REACHED' };
            }
        } catch (err) {
            ErrorLogger.error(err, 'useAssetLogic.checkAssetLimits');
            // Fail safe: if check fails, maybe allow or block? Blocking is safer for quotas.
            return { success: false, error: 'LIMIT_CHECK_FAILED' };
        }

        setIsSubmitting(true);
        try {
            const assetId = await AssetService.create(data, user, preSelectedProjectId);
            refreshAssets();
            return { success: true, id: assetId };
        } catch (e) {
            return { success: false, error: e };
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateAsset = async (id: string, data: AssetFormData, oldData?: Asset): Promise<{ success: boolean; error?: unknown }> => {
        if (!user?.organizationId) return { success: false, error: 'No organization ID' };

        if (!canEditResource(user as UserProfile, 'Asset')) {
            toast.error(t('common.accessDenied'));
            return { success: false, error: 'PERMISSION_DENIED' };
        }

        setIsSubmitting(true);
        try {
            await AssetService.update(id, data, user as UserProfile, oldData as unknown as Record<string, unknown>);
            refreshAssets();
            return { success: true };
        } catch (e) {
            return { success: false, error: e };
        } finally {
            setIsSubmitting(false);
        }
    };

    const deleteAsset = async (id: string, name: string): Promise<{ success: boolean; error?: unknown }> => {
        if (!user?.organizationId) return { success: false, error: 'No organization ID' };

        if (!canEditResource(user as UserProfile, 'Asset')) {
            toast.error(t('common.accessDenied'));
            return { success: false, error: 'PERMISSION_DENIED' };
        }

        try {
            await AssetService.delete(id, name, user);
            refreshAssets();
            return { success: true };
        } catch (e) {
            return { success: false, error: e };
        }
    };

    const bulkDeleteAssets = async (ids: string[]): Promise<{ success: boolean; count: number; error?: unknown }> => {
        if (!user?.organizationId) return { success: false, count: 0, error: 'No organization ID' };

        if (!canEditResource(user as UserProfile, 'Asset')) {
            toast.error(t('common.accessDenied'));
            return { success: false, count: 0, error: 'PERMISSION_DENIED' };
        }

        try {
            await AssetService.bulkDelete(ids, user);
            refreshAssets();
            return { success: true, count: ids.length };
        } catch (e) {
            return { success: false, count: 0, error: e };
        }
    };

    const checkDependencies = async (assetId: string) => {
        if (!user?.organizationId) return { hasDependencies: false, dependencies: [], canDelete: true, blockingReasons: [] };
        return await DependencyService.checkAssetDependencies(assetId, user.organizationId);
    };


    return {
        assets,
        loading,
        loadingAssets: loading, // Explicit alias
        createAsset,
        updateAsset,
        deleteAsset,
        bulkDeleteAssets,
        checkDependencies,
        isSubmitting,
        refreshAssets
    };
};
