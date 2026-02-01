import { useMemo, useState, useEffect } from 'react';
import { useFirestoreCollection } from './useFirestore';
import { Threat, TrustRelationship } from '../types';
import { orderBy, limit, increment, where } from 'firebase/firestore';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { ErrorLogger } from '../services/errorLogger';
import { useTranslation } from 'react-i18next';

export const useThreatIntelligence = () => {
    const { user, addToast, demoMode } = useStore();
    const { t } = useTranslation();
    const myOrgId = user?.organizationId || 'demo';

    // Mock Data State
    const [mockData, setMockData] = useState<{
        threats: Threat[];
        relationships: TrustRelationship[];
    } | null>(null);

    // Data Fetching (Disabled in Demo Mode)
    const {
        data: threatsRaw,
        loading: threatsLoadingRaw,
        update: updateThreat
    } = useFirestoreCollection<Threat>('threats', [where('organizationId', '==', myOrgId), orderBy('timestamp', 'desc'), limit(100)], { realtime: true, enabled: !demoMode && !!user?.organizationId });

    const {
        data: partnersRaw,
        update: updateRelationship,
        remove: removeRelationship
    } = useFirestoreCollection<TrustRelationship>('relationships', [where('organizationId', '==', myOrgId)], { realtime: true, enabled: !demoMode && !!user?.organizationId });

    // Load Mock Data
    useEffect(() => {
        if (demoMode && !mockData) {
            import('../services/mockDataService').then(({ MockDataService }) => {
                setMockData({
                    threats: MockDataService.getCollection('threats') as Threat[],
                    relationships: [] // Mock relationships if needed
                });
            }).catch(() => {
                // Fallback: ensure we always have data even if mock service fails
                setMockData({
                    threats: [],
                    relationships: []
                });
            });
        }
    }, [demoMode, mockData]);

    const threats = useMemo(() => demoMode && mockData ? mockData.threats : threatsRaw, [threatsRaw, mockData, demoMode]);
    const partners = useMemo(() => demoMode && mockData ? mockData.relationships : partnersRaw, [partnersRaw, mockData, demoMode]);
    const threatsLoading = demoMode ? !mockData : threatsLoadingRaw;

    const myPartners = useMemo(() => partners.filter(p => p.sourceOrgId === myOrgId), [partners, myOrgId]);
    const blockedOrgIds = useMemo(() => myPartners.filter(p => p.status === 'blocked').map(p => p.targetOrgId), [myPartners]);

    // Actions
    const handleTrustAction = async (id: string, action: 'trust' | 'block' | 'remove') => {
        if (demoMode) {
            addToast(t('common.toast.demoModeUnavailable', { defaultValue: "Action non disponible en mode démo" }), "info");
            return;
        }
        try {
            if (action === 'remove') {
                await removeRelationship(id);
                addToast(t('threats.relationshipDeleted'), "info");
            } else {
                await updateRelationship(id, { status: action === 'trust' ? 'trusted' : 'blocked' });
                addToast(action === 'trust' ? t('threats.partnerTrusted') : t('threats.partnerBlocked'), "success");
            }
        } catch (e) {
            ErrorLogger.error(e as Error, 'ThreatIntelligence.handleTrustAction');
            addToast(t('threats.updateError'), "error");
        }
    };

    const confirmSighting = async (threatId: string) => {
        if (!user) return;
        if (demoMode) {
            addToast(t('common.toast.demoModeUnavailable', { defaultValue: "Action non disponible en mode démo" }), "info");
            return;
        }
        try {
            await updateThreat(threatId, { votes: increment(1) });
            logAction(user, 'CONFIRM_SIGHTING', 'ThreatIntelligence', `Confirmed sighting ${threatId}`);
            addToast(t('threats.sightingConfirmed'), "success");
        } catch (e) {
            ErrorLogger.error(e as Error, 'ThreatIntelligence.confirmSighting');
            addToast(t('threats.demoModeError'), "info");
        }
    };

    return {
        threats,
        threatsLoading,
        myPartners,
        blockedOrgIds,
        handleTrustAction,
        confirmSighting
    };
};
