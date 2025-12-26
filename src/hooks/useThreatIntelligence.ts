import { useMemo } from 'react';
import { useFirestoreCollection } from './useFirestore';
import { Threat, TrustRelationship } from '../types';
import { orderBy, limit, increment } from 'firebase/firestore';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { ErrorLogger } from '../services/errorLogger';

export const useThreatIntelligence = () => {
    const { user, addToast } = useStore();
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
                addToast("Relation supprimée", "info");
            } else {
                await updateRelationship(id, { status: action === 'trust' ? 'trusted' : 'blocked' });
                addToast(action === 'trust' ? "Partenaire ajouté aux cercles de confiance" : "Organisation bloquée", "success");
            }
        } catch (e) {
            ErrorLogger.error(e as Error, 'ThreatIntelligence.handleTrustAction');
            addToast("Erreur lors de la mise à jour", "error");
        }
    };

    const confirmSighting = async (threatId: string) => {
        if (!user) return;
        try {
            await updateThreat(threatId, { votes: increment(1) });
            logAction(user, 'CONFIRM_SIGHTING', 'ThreatIntelligence', `Confirmed sighting ${threatId}`);
            addToast("Observation confirmée (+1)", "success");
        } catch (e) {
            ErrorLogger.error(e as Error, 'ThreatIntelligence.confirmSighting');
            addToast("Action non autorisée (Mode Démo)", "info");
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
