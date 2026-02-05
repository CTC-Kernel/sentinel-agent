
import { useMemo, useState, useEffect } from 'react';
import { useFirestoreCollection } from '../useFirestore';
import { where, limit } from 'firebase/firestore';
import { useStore } from '../../store';
import { useAuth } from '../useAuth';
import { Risk } from '../../types';
import { MockDataService } from '../../services/mockDataService';
import { RiskCalculator } from '../../utils/RiskCalculator';

export const useRiskLogic = (enabled = true) => {
 const { user, claimsSynced } = useAuth();
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

 const organizationId = user?.organizationId;

 const constraints = useMemo(() => {
 return organizationId ? [where('organizationId', '==', organizationId), limit(1000)] : undefined;
 }, [organizationId]);

 // Fetch ONLY Risks (Lightweight)
 const { data: rawRisks, loading: risksLoading } = useFirestoreCollection<Risk>(
 'risks',
 constraints,
 { logError: true, realtime: true, enabled: !!organizationId && !demoMode && claimsSynced && enabled }
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
