import { useState, useCallback } from 'react';
import { useFirestoreCollection } from '../useFirestore';
import { Control, Asset, Risk, Audit } from '../../types';
import { where } from 'firebase/firestore';
import { useStore } from '../../store';
import { MockDataService } from '../../services/mockDataService';

export const useDocumentDependencies = (organizationId?: string) => {
    const { demoMode } = useStore();
    const [shouldFetch, setShouldFetch] = useState(false);

    // Mock Data State
    const [mockData, setMockData] = useState<{
        controls: Control[];
        assets: Asset[];
        risks: Risk[];
        audits: Audit[];
    } | null>(null);

    // Trigger for loading
    const loadDependencies = useCallback(() => {
        if (!shouldFetch) {
            setShouldFetch(true);
            if (demoMode && !mockData) {
                // Simulate fetch delay for mock data
                setTimeout(() => {
                    setMockData({
                        controls: MockDataService.getCollection('controls') as Control[],
                        assets: MockDataService.getCollection('assets') as Asset[],
                        risks: MockDataService.getCollection('risks') as Risk[],
                        audits: MockDataService.getCollection('audits') as Audit[]
                    });
                }, 500);
            }
        }
    }, [shouldFetch, demoMode, mockData]);

    const queryConstraints = organizationId ? [where('organizationId', '==', organizationId)] : undefined;
    const options = {
        logError: true,
        enabled: shouldFetch && !!organizationId && !demoMode,
        realtime: false // Dependencies don't need realtime updates usually, optimizing for perf
    };

    const { data: rawControls, loading: loadingControls } = useFirestoreCollection<Control>('controls', queryConstraints, options);
    const { data: rawAssets, loading: loadingAssets } = useFirestoreCollection<Asset>('assets', queryConstraints, options);
    const { data: rawRisks, loading: loadingRisks } = useFirestoreCollection<Risk>('risks', queryConstraints, options);
    const { data: rawAudits, loading: loadingAudits } = useFirestoreCollection<Audit>('audits', queryConstraints, options);

    const dependencies = {
        controls: (demoMode && mockData ? mockData.controls : rawControls) || [],
        assets: (demoMode && mockData ? mockData.assets : rawAssets) || [],
        risks: (demoMode && mockData ? mockData.risks : rawRisks) || [],
        audits: (demoMode && mockData ? mockData.audits : rawAudits) || []
    };

    const loading = shouldFetch && (demoMode ? !mockData : (loadingControls || loadingAssets || loadingRisks || loadingAudits));

    return {
        dependencies,
        loading,
        loadDependencies,
        hasLoaded: !!mockData || (shouldFetch && !loading)
    };
};
