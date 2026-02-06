import { useMemo } from 'react';
import { Asset, Risk, Control, Criticality } from '../types';

export interface IntelligenceFindings {
    exposedAssets: Asset[];
    unprotectedRisks: Risk[];
    auditReadiness: number;
}

export const useContextualIntelligence = (
    assets: Asset[] = [],
    risks: Risk[] = [],
    controls: Control[] = []
): IntelligenceFindings => {
    const exposedAssets = useMemo(() => {
        const riskAssetIds = new Set(risks.map(r => r.assetId));
        return assets.filter(a =>
            (a.confidentiality === Criticality.CRITICAL || a.integrity === Criticality.CRITICAL || a.availability === Criticality.CRITICAL) &&
            !riskAssetIds.has(a.id)
        );
    }, [assets, risks]);

    const unprotectedRisks = useMemo(() => {
        return risks.filter(r => r.score >= 12 && (!r.mitigationControlIds || r.mitigationControlIds.length === 0));
    }, [risks]);

    const auditReadiness = useMemo(() => {
        if (controls.length === 0) return 0;
        const documented = controls.filter(c => c.status === 'Implémenté' && c.evidenceIds && c.evidenceIds.length > 0).length;
        return Math.round((documented / controls.length) * 100);
    }, [controls]);

    return {
        exposedAssets,
        unprotectedRisks,
        auditReadiness
    };
};
