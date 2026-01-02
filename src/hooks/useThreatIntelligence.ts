import { useMemo } from 'react';
import { useFirestoreCollection } from './useFirestore';
import { Threat, TrustRelationship } from '../types';
import { orderBy, limit, increment } from 'firebase/firestore';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { ErrorLogger } from '../services/errorLogger';
import { useTranslation } from 'react-i18next';

export const useThreatIntelligence = () => {
    const { user, addToast } = useStore();
    const { t } = useTranslation();
    const myOrgId = user?.organizationId || 'demo';

    // Data Fetching
    const {
        data: threats,
        loading: threatsLoading,
        update: updateThreat
    } = useFirestoreCollection<Threat>('threats', [orderBy('timestamp', 'desc'), limit(100)], { realtime: true });

    const {
        data: partners,
        update: updateRelationship,
        remove: removeRelationship
    } = useFirestoreCollection<TrustRelationship>('relationships', [], { realtime: true });

    const myPartners = useMemo(() => partners.filter(p => p.sourceOrgId === myOrgId), [partners, myOrgId]);
    const blockedOrgIds = useMemo(() => myPartners.filter(p => p.status === 'blocked').map(p => p.targetOrgId), [myPartners]);

    // Actions
    const handleTrustAction = async (id: string, action: 'trust' | 'block' | 'remove') => {
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
