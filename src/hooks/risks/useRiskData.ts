import React from 'react';
import { useFirestoreCollection } from '../useFirestore';
import { where } from 'firebase/firestore'; // Added orderBy support if needed, keeping imports clean
import { useStore } from '../../store';
import { useAuth } from '../useAuth';
import { Risk, Asset, Control, BusinessProcess as Process, Supplier, Incident, Audit, Project, UserProfile } from '../../types';

export const useRiskData = () => {
    const { user } = useAuth();
    const { demoMode } = useStore();
    const [mockData, setMockData] = React.useState<{
        risks: Risk[];
        assets: Asset[];
        controls: Control[];
        processes: Process[];
        suppliers: Supplier[];
        incidents: Incident[];
        audits: Audit[];
        projects: Project[];
        users: UserProfile[];
    }>({ risks: [], assets: [], controls: [], processes: [], suppliers: [], incidents: [], audits: [], projects: [], users: [] } as const);
    const [mockLoading, setMockLoading] = React.useState(true);

    React.useEffect(() => {
        if (demoMode) {
            setMockLoading(true);
            import('../../services/mockDataService').then(({ MockDataService }) => {
                setMockData({
                    risks: MockDataService.getCollection('risks') as Risk[],
                    assets: MockDataService.getCollection('assets') as Asset[],
                    controls: MockDataService.getCollection('controls') as Control[],
                    processes: MockDataService.getCollection('business_processes') as Process[],
                    suppliers: MockDataService.getCollection('suppliers') as Supplier[],
                    incidents: MockDataService.getCollection('incidents') as Incident[],
                    audits: MockDataService.getCollection('audits') as Audit[],
                    projects: MockDataService.getCollection('projects') as Project[],
                    users: MockDataService.getCollection('users') as unknown as UserProfile[]
                });
                setMockLoading(false);
            });
        }
    }, [demoMode]);

    const { data: rawRisks, loading: risksLoading } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true, realtime: true, enabled: !!user?.organizationId && !demoMode }
    );

    const risks = React.useMemo(() => {
        const source = (demoMode ? mockData.risks : (rawRisks || [])) as Risk[];
        return source.map((r: Risk) => ({
            ...r,
            probability: Number(r.probability) as Risk['probability'],
            impact: Number(r.impact) as Risk['impact'],
            score: Number(r.score)
        })) as Risk[];
    }, [rawRisks, demoMode, mockData.risks]);

    const { data: assets, loading: assetsLoading } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId && !demoMode }
    );

    const { data: controls, loading: controlsLoading } = useFirestoreCollection<Control>(
        'controls',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId && !demoMode }
    );

    const { data: rawProcesses, loading: processesLoading } = useFirestoreCollection<Process>(
        'business_processes',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId && !demoMode }
    );

    const { data: suppliers, loading: suppliersLoading } = useFirestoreCollection<Supplier>(
        'suppliers',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId && !demoMode }
    );

    const { data: incidents, loading: incidentsLoading } = useFirestoreCollection<Incident>(
        'incidents',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId && !demoMode }
    );

    const { data: audits, loading: auditsLoading } = useFirestoreCollection<Audit>(
        'audits',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId && !demoMode }
    );

    const { data: projects, loading: projectsLoading } = useFirestoreCollection<Project>(
        'projects',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId && !demoMode }
    );

    const { data: usersList } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId && !demoMode }
    );

    // FIX: Ensure usersList is never empty if we are logged in (fallback to self) to prevent validation errors
    const effectiveUsers = React.useMemo(() => {
        const source = demoMode ? mockData.users : usersList;
        if (source && source.length > 0) return source;
        if (user && user.uid) return [user];
        return [];
    }, [usersList, user, demoMode, mockData.users]);

    const loading = demoMode ? mockLoading : (risksLoading || assetsLoading || controlsLoading || processesLoading || suppliersLoading || incidentsLoading || auditsLoading || projectsLoading);

    return {
        risks,
        assets: (demoMode ? mockData.assets : assets) as Asset[],
        controls: (demoMode ? mockData.controls : controls) as Control[],
        rawProcesses: (demoMode ? mockData.processes : rawProcesses) as Process[],
        suppliers: (demoMode ? mockData.suppliers : suppliers) as Supplier[],
        incidents: (demoMode ? mockData.incidents : incidents) as Incident[],
        audits: (demoMode ? mockData.audits : audits) as Audit[],
        projects: (demoMode ? mockData.projects : projects) as Project[],
        usersList: effectiveUsers,
        loading,
        refreshRisks: () => { }
    };
};
