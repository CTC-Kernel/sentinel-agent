
import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store';
import { Asset, SystemLog, MaintenanceRecord, Risk, Incident, Project, Audit, Document as GRCDocument, Control } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';
import { AssetService } from '../../services/assetService';

export function useAssetDetails(asset: Asset | null) {
    const { user } = useStore();
    const [history, setHistory] = useState<SystemLog[]>([]);
    const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
    const [linkedRisks, setLinkedRisks] = useState<Risk[]>([]);
    const [linkedIncidents, setLinkedIncidents] = useState<Incident[]>([]);
    const [linkedProjects, setLinkedProjects] = useState<Project[]>([]);
    const [linkedAudits, setLinkedAudits] = useState<Audit[]>([]);
    const [linkedDocuments, setLinkedDocuments] = useState<GRCDocument[]>([]);
    const [linkedControls, setLinkedControls] = useState<Control[]>([]);
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
            setLinkedControls([]);
            return;
        }

        setLoadingDetails(true);
        let unsubMaint: () => void = () => { };

        // Capture organizationId to satisfy TypeScript (already checked above)
        const organizationId = user.organizationId;

        const fetchDetails = async () => {
            try {
                // Fetch history using AssetService
                const historyData = await AssetService.getAssetHistory(asset.name, organizationId);
                setHistory(historyData.logs);

                // Fetch all relationships using AssetService (parallel execution)
                const relationships = await AssetService.getAssetRelationships(asset.id, organizationId);
                setLinkedRisks(relationships.risks);
                setLinkedIncidents(relationships.incidents);
                setLinkedProjects(relationships.projects);
                setLinkedAudits(relationships.audits);
                setLinkedDocuments(relationships.documents);
                setLinkedControls(relationships.controls);

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
        } catch {
            // Error handled by ErrorLogger in onSnapshot callback
        }

        fetchDetails();

        return () => {
            unsubMaint();
        };
    }, [asset, user?.organizationId]);

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
        linkedControls,
        loadingDetails,
        addMaintenance
    };
}
