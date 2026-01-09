
import { useMemo, useState, useEffect } from 'react';
import { useFirestoreCollection } from '../useFirestore';
import { where, limit } from 'firebase/firestore';
import { useStore } from '../../store';
import { useAuth } from '../useAuth';
import { Risk } from '../../types';
import { MockDataService } from '../../services/mockDataService';
import { RiskCalculator } from '../../utils/RiskCalculator';

export const useRiskLogic = () => {
    const { user } = useAuth();
    const { demoMode } = useStore();

    // Mock Data State
    const [mockData, setMockData] = useState<{
        risks: Risk[];
    } | null>(null);

    const [mockLoading, setMockLoading] = useState(true);

    useEffect(() => {
        if (demoMode) {
            // Loading is true by default or set by demoMode toggle logic elsewhere
            // But here we just want to fetch data.
            // If we want to simulate loading, we only set it false at end.
            const timer = setTimeout(() => {
                setMockData({
                    risks: MockDataService.getCollection('risks') as Risk[]
                });
                setMockLoading(false);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [demoMode]);

    // Fetch ONLY Risks (Lightweight)
    const { data: rawRisks, loading: risksLoading } = useFirestoreCollection<Risk>(
        'risks',
        [
            where('organizationId', '==', user?.organizationId || 'ignore'),
            // orderBy('updatedAt', 'desc'), // Requires index, safer to sort client side for now if index missing
            limit(1000)
        ],
        { logError: true, realtime: true, enabled: !!user?.organizationId && !demoMode }
    );

    const risks = useMemo(() => {
        const source = (demoMode && mockData ? mockData.risks : (rawRisks || [])) as Risk[];
        // Sanitize numbers using Centralized Calculator
        return source.map(RiskCalculator.sanitizeRisk).sort((a, b) => {
            // Sort by Score descending, then date
            return (b.score || 0) - (a.score || 0);
        }) as Risk[];
    }, [rawRisks, demoMode, mockData]);

    const loading = demoMode ? mockLoading : risksLoading;

    return {
        risks,
        loading,
        loadingRisks: loading // Alias for clarity
    };
};
