import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { SystemLog, Risk, Incident, Project, Audit, Document as GRCDocument, Control } from '../types';
import { ErrorLogger } from './errorLogger';

export interface AssetRelationships {
    risks: Risk[];
    incidents: Incident[];
    projects: Project[];
    audits: Audit[];
    documents: GRCDocument[];
    controls: Control[];
}

export interface AssetHistory {
    logs: SystemLog[];
}

export class AssetService {
    /**
     * Fetch all relationships for a given asset
     */
    static async getAssetRelationships(
        assetId: string,
        organizationId: string
    ): Promise<AssetRelationships> {
        try {
            // Execute all queries in parallel for better performance
            const [risks, incidents, projects, audits, documents, controls] = await Promise.all([
                this.getLinkedRisks(assetId, organizationId),
                this.getLinkedIncidents(assetId, organizationId),
                this.getLinkedProjects(assetId, organizationId),
                this.getLinkedAudits(assetId, organizationId),
                this.getLinkedDocuments(assetId, organizationId),
                this.getLinkedControls(assetId, organizationId),
            ]);

            return { risks, incidents, projects, audits, documents, controls };
        } catch (error) {
            ErrorLogger.error(error, 'AssetService.getAssetRelationships');
            throw error;
        }
    }

    /**
     * Get risks linked to an asset
     */
    static async getLinkedRisks(assetId: string, organizationId: string): Promise<Risk[]> {
        const risksQ = query(
            collection(db, 'risks'),
            where('organizationId', '==', organizationId),
            where('assetId', '==', assetId)
        );
        const snapshot = await getDocs(risksQ);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Risk));
    }

    /**
     * Get incidents affecting an asset
     */
    static async getLinkedIncidents(assetId: string, organizationId: string): Promise<Incident[]> {
        const incQ = query(
            collection(db, 'incidents'),
            where('organizationId', '==', organizationId),
            where('affectedAssetId', '==', assetId)
        );
        const snapshot = await getDocs(incQ);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Incident));
    }

    /**
     * Get projects related to an asset
     */
    static async getLinkedProjects(assetId: string, organizationId: string): Promise<Project[]> {
        const projQ = query(
            collection(db, 'projects'),
            where('organizationId', '==', organizationId),
            where('relatedAssetIds', 'array-contains', assetId)
        );
        const snapshot = await getDocs(projQ);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Project));
    }

    /**
     * Get audits related to an asset
     */
    static async getLinkedAudits(assetId: string, organizationId: string): Promise<Audit[]> {
        try {
            const auditQ = query(
                collection(db, 'audits'),
                where('organizationId', '==', organizationId),
                where('relatedAssetIds', 'array-contains', assetId)
            );
            const snapshot = await getDocs(auditQ);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Audit));
        } catch (error) {
            ErrorLogger.error(error, 'AssetService.getLinkedAudits');
            throw error;
        }
    }

    /**
     * Get documents related to an asset
     */
    static async getLinkedDocuments(assetId: string, organizationId: string): Promise<GRCDocument[]> {
        try {
            const docQ = query(
                collection(db, 'documents'),
                where('organizationId', '==', organizationId),
                where('relatedAssetIds', 'array-contains', assetId)
            );
            const snapshot = await getDocs(docQ);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as GRCDocument));
        } catch (error) {
            ErrorLogger.error(error, 'AssetService.getLinkedDocuments');
            throw error;
        }
    }

    /**
     * Get controls related to an asset
     */
    static async getLinkedControls(assetId: string, organizationId: string): Promise<Control[]> {
        try {
            const ctrlQ = query(
                collection(db, 'controls'),
                where('organizationId', '==', organizationId),
                where('relatedAssetIds', 'array-contains', assetId)
            );
            const snapshot = await getDocs(ctrlQ);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Control));
        } catch (error) {
            ErrorLogger.error(error, 'AssetService.getLinkedControls');
            throw error;
        }
    }

    /**
     * Get filtered history logs for an asset
     */
    static async getAssetHistory(
        assetName: string,
        organizationId: string,
        limitCount = 50
    ): Promise<AssetHistory> {
        try {
            const logsQ = query(
                collection(db, 'system_logs'),
                where('organizationId', '==', organizationId),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            );
            const snapshot = await getDocs(logsQ);
            const allLogs = snapshot.docs.map(d => d.data() as SystemLog);

            // Filter logs that mention this asset
            const logs = allLogs.filter(l => l.details?.includes(assetName));
            logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            return { logs };
        } catch (error) {
            ErrorLogger.error(error, 'AssetService.getAssetHistory');
            throw error;
        }
    }
}
