
import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store';
import { Asset, SystemLog, MaintenanceRecord, Risk, Incident, Project, Audit, Document as GRCDocument } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';

export function useAssetDetails(asset: Asset | null) {
    const { user } = useStore();
    const [history, setHistory] = useState<SystemLog[]>([]);
    const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
    const [linkedRisks, setLinkedRisks] = useState<Risk[]>([]);
    const [linkedIncidents, setLinkedIncidents] = useState<Incident[]>([]);
    const [linkedProjects, setLinkedProjects] = useState<Project[]>([]);
    const [linkedAudits, setLinkedAudits] = useState<Audit[]>([]);
    const [linkedDocuments, setLinkedDocuments] = useState<GRCDocument[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        if (!asset || !user?.organizationId) {
            setHistory([]);
            setMaintenanceRecords([]);
            setLinkedRisks([]);
            setLinkedIncidents([]);
            setLinkedProjects([]);
            setLinkedAudits([]);
            setLinkedDocuments([]);
            return;
        }

        setLoadingDetails(true);
        let unsubMaint: () => void = () => { };

        const fetchDetails = async () => {
            try {
                // History
                const logsQ = query(collection(db, 'system_logs'), where('organizationId', '==', user.organizationId), orderBy('timestamp', 'desc'), limit(50));
                const snapLogs = await getDocs(logsQ);
                const logs = snapLogs.docs.map(d => d.data() as SystemLog);
                const filteredLogs = logs.filter(l => l.details?.includes(asset.name));
                filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                setHistory(filteredLogs);

                // Risks
                const risksQ = query(collection(db, 'risks'), where('organizationId', '==', user.organizationId), where('assetId', '==', asset.id));
                const snapRisks = await getDocs(risksQ);
                setLinkedRisks(snapRisks.docs.map(d => ({ id: d.id, ...d.data() } as Risk)));

                // Incidents
                const incQ = query(collection(db, 'incidents'), where('organizationId', '==', user.organizationId), where('affectedAssetId', '==', asset.id));
                const snapInc = await getDocs(incQ);
                setLinkedIncidents(snapInc.docs.map(d => ({ id: d.id, ...d.data() } as Incident)));

                // Projects
                const projQ = query(collection(db, 'projects'), where('organizationId', '==', user.organizationId), where('relatedAssetIds', 'array-contains', asset.id));
                const snapProj = await getDocs(projQ);
                setLinkedProjects(snapProj.docs.map(d => ({ id: d.id, ...d.data() } as Project)));

                // Audits
                const auditQ = query(collection(db, 'audits'), where('organizationId', '==', user.organizationId), where('relatedAssetIds', 'array-contains', asset.id));
                const snapAudit = await getDocs(auditQ);
                setLinkedAudits(snapAudit.docs.map(d => ({ id: d.id, ...d.data() } as Audit)));

                // Documents
                const docQ = query(collection(db, 'documents'), where('organizationId', '==', user.organizationId), where('relatedAssetIds', 'array-contains', asset.id));
                const snapDoc = await getDocs(docQ);
                setLinkedDocuments(snapDoc.docs.map(d => ({ id: d.id, ...d.data() } as GRCDocument)));

            } catch (e) {
                ErrorLogger.handleErrorWithToast(e, 'useAssetDetails', 'FETCH_FAILED');
            } finally {
                setLoadingDetails(false);
            }
        };

        // Realtime Maintenance
        try {
            const maintQ = query(collection(db, 'assets', asset.id, 'maintenance'), orderBy('date', 'desc'));
            unsubMaint = onSnapshot(maintQ, (snap) => {
                setMaintenanceRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceRecord)));
            }, (err) => ErrorLogger.handleErrorWithToast(err, 'useAssetDetails.maintenance'));
        } catch (e) {
            console.error(e);
        }

        fetchDetails();

        return () => {
            unsubMaint();
        };
    }, [asset?.id, user?.organizationId]);

    const addMaintenance = async (data: MaintenanceRecord) => {
        if (!asset || !user?.organizationId) return false;
        try {
            await addDoc(collection(db, 'assets', asset.id, 'maintenance'), data); // data is already sanitized in component
            return true;
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'useAssetDetails.addMaintenance', 'CREATE_FAILED');
            return false;
        }
    };

    return {
        history,
        maintenanceRecords,
        linkedRisks,
        linkedIncidents,
        linkedProjects,
        linkedAudits,
        linkedDocuments,
        loadingDetails,
        addMaintenance
    };
}
