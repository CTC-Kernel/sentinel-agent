import { useFirestoreCollection } from '../useFirestore';
import { where } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { Risk, Asset, Control, BusinessProcess as Process, Supplier, Incident, Audit, Project } from '../../types';

export const useRiskData = () => {
    const { user } = useAuth();


    const { data: risks, loading: risksLoading } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true, realtime: true, enabled: !!user?.organizationId }
    );

    const { data: assets, loading: assetsLoading } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId }
    );

    const { data: controls, loading: controlsLoading } = useFirestoreCollection<Control>(
        'controls',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId }
    );

    const { data: rawProcesses, loading: processesLoading } = useFirestoreCollection<Process>(
        'processes',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId }
    );

    const { data: suppliers, loading: suppliersLoading } = useFirestoreCollection<Supplier>(
        'suppliers',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId }
    );

    const { data: incidents, loading: incidentsLoading } = useFirestoreCollection<Incident>(
        'incidents',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId }
    );

    const { data: audits, loading: auditsLoading } = useFirestoreCollection<Audit>(
        'audits',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId }
    );

    const { data: projects, loading: projectsLoading } = useFirestoreCollection<Project>(
        'projects',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId }
    );

    const { data: usersList } = useFirestoreCollection<{ uid: string; email: string; displayName: string; role: string }>(
        'users',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId }
    );

    const loading = risksLoading || assetsLoading || controlsLoading || processesLoading || suppliersLoading || incidentsLoading || auditsLoading || projectsLoading;

    return {
        risks,
        assets,
        controls,
        rawProcesses,
        suppliers,
        incidents,
        audits,
        projects,
        usersList,
        loading,
        refreshRisks: () => { }
    };
};
