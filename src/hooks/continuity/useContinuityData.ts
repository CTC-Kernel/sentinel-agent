import { useState, useEffect } from 'react';
import { where, orderBy, collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store';
import { BusinessProcess, BcpDrill, Asset, Risk, Supplier, UserProfile, Incident, TlptCampaign, RecoveryPlan } from '../../types';

export const useContinuityData = (organizationId?: string) => {
    const { demoMode } = useStore();
    const [processes, setProcesses] = useState<BusinessProcess[]>([]);
    const [drills, setDrills] = useState<BcpDrill[]>([]);
    const [tlptCampaigns, setTlptCampaigns] = useState<TlptCampaign[]>([]);
    const [recoveryPlans, setRecoveryPlans] = useState<RecoveryPlan[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [risks, setRisks] = useState<Risk[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!organizationId) {
            setLoading(false);
            return;
        }

        let mounted = true;
        setLoading(true);

        // Harden demoMode detection for E2E tests where store might lag
        const isDemo = demoMode || (typeof window !== 'undefined' && (
            !!((window as unknown as { __TEST_MODE__: boolean }).__TEST_MODE__) ||
            (() => { try { return localStorage.getItem('demoMode') === 'true' } catch { return false } })()
        ));

        if (isDemo) {
            import('../../services/mockDataService').then(module => {
                if (!mounted) return;
                setProcesses(module.MockDataService.getCollection('business_processes') as unknown as BusinessProcess[]);
                setDrills(module.MockDataService.getCollection('bcp_drills') as unknown as BcpDrill[]);
                setAssets(module.MockDataService.getCollection('assets') as unknown as Asset[]);
                setRisks(module.MockDataService.getCollection('risks') as unknown as Risk[]);
                setSuppliers(module.MockDataService.getCollection('suppliers') as unknown as Supplier[]);
                setUsers(module.MockDataService.getCollection('users') as unknown as UserProfile[]);
                setIncidents(module.MockDataService.getCollection('incidents') as unknown as Incident[]);
                setTlptCampaigns(module.MockDataService.getCollection('tlpt_campaigns') as unknown as TlptCampaign[]);
                setLoading(false);
            }).catch(err => {
                if (mounted) {
                    console.error('[useContinuityData] Failed to load mock data:', err);
                    setLoading(false);
                }
            });
            return () => { mounted = false; };
        }

        // Firestore Realtime Listeners
        const unsubscribes: (() => void)[] = [];

        const qProcesses = query(collection(db, 'business_processes'), where('organizationId', '==', organizationId));
        unsubscribes.push(onSnapshot(qProcesses, (s) => setProcesses(s.docs.map(d => ({ id: d.id, ...d.data() } as BusinessProcess)))));

        const qDrills = query(collection(db, 'bcp_drills'), where('organizationId', '==', organizationId), orderBy('date', 'desc'));
        unsubscribes.push(onSnapshot(qDrills, (s) => setDrills(s.docs.map(d => ({ id: d.id, ...d.data() } as BcpDrill)))));

        const qAssets = query(collection(db, 'assets'), where('organizationId', '==', organizationId));
        unsubscribes.push(onSnapshot(qAssets, (s) => setAssets(s.docs.map(d => ({ id: d.id, ...d.data() } as Asset)))));

        const qRisks = query(collection(db, 'risks'), where('organizationId', '==', organizationId));
        unsubscribes.push(onSnapshot(qRisks, (s) => setRisks(s.docs.map(d => ({ id: d.id, ...d.data() } as Risk)))));

        const qSuppliers = query(collection(db, 'suppliers'), where('organizationId', '==', organizationId));
        unsubscribes.push(onSnapshot(qSuppliers, (s) => setSuppliers(s.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)))));

        const qUsers = query(collection(db, 'users'), where('organizationId', '==', organizationId));
        unsubscribes.push(onSnapshot(qUsers, (s) => setUsers(s.docs.map(d => ({ id: d.id, ...d.data() } as unknown as UserProfile)))));

        const qIncidents = query(collection(db, 'incidents'), where('organizationId', '==', organizationId));
        unsubscribes.push(onSnapshot(qIncidents, (s) => setIncidents(s.docs.map(d => ({ id: d.id, ...d.data() } as Incident)))));

        const qTlpt = query(collection(db, 'tlpt_campaigns'), where('organizationId', '==', organizationId));
        unsubscribes.push(onSnapshot(qTlpt, (s) => setTlptCampaigns(s.docs.map(d => ({ id: d.id, ...d.data() } as TlptCampaign)))));

        const qPlans = query(collection(db, 'recovery_plans'), where('organizationId', '==', organizationId));
        unsubscribes.push(onSnapshot(qPlans, (s) => setRecoveryPlans(s.docs.map(d => ({ id: d.id, ...d.data() } as RecoveryPlan)))));

        // We assume loading finishes reasonably quickly for realtime listeners for now, 
        // or effectively "stream" updates. For strict loading state, one would count initial loads.
        // Simplification: set loading false after a short timeout or rely on initial empty state if appropriate.
        // Better: Wait for first snapshot of at least processes?
        setLoading(false);

        return () => {
            mounted = false;
            unsubscribes.forEach(u => u());
        };

    }, [organizationId, demoMode]);

    return {
        processes,
        drills,
        assets,
        risks,
        suppliers,
        users,
        incidents,
        tlptCampaigns,
        recoveryPlans,
        loading
    };
};
