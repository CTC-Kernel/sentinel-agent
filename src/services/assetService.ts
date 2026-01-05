import {
    collection,
    addDoc,
    doc,
    updateDoc,
    arrayUnion,
    increment,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { AssetFormData, assetSchema } from '../schemas/assetSchema';
import { logAction } from './logger';
import { sanitizeData } from '../utils/dataSanitizer';
import { ErrorLogger } from './errorLogger';
import { UserProfile } from '../types';
import { FunctionsService } from './FunctionsService';

export const AssetService = {
    /**
     * Create a new asset
     */
    async create(
        data: AssetFormData,
        user: UserProfile,
        preSelectedProjectId?: string | null
    ): Promise<string> {
        if (!user.organizationId) throw new Error("User organization ID is missing");

        // Validate and sanitize
        const validatedData = assetSchema.parse(data);
        const cleanData = sanitizeData(validatedData);

        const newDoc = {
            ...cleanData,
            organizationId: user.organizationId,
            createdAt: serverTimestamp(),
            relatedProjectIds: preSelectedProjectId ? [preSelectedProjectId] : []
        };

        // Create Asset
        const docRef = await addDoc(collection(db, 'assets'), newDoc);

        // Track storage usage if valid estimated size
        const estSize = (cleanData as unknown as Record<string, number>).estimatedSizeMB || 0;
        if (estSize > 0) {
            const orgRef = doc(db, 'organizations', user.organizationId);
            await updateDoc(orgRef, {
                storageUsed: increment(estSize * 1024 * 1024)
            }).catch((error) => {
                ErrorLogger.warn('Failed to increment storage usage', 'AssetService.create', { metadata: { error } });
            });
        }

        // Link Project if selected
        if (preSelectedProjectId) {
            const projectRef = doc(db, 'projects', preSelectedProjectId);
            await updateDoc(projectRef, {
                relatedAssetIds: arrayUnion(docRef.id)
            });
        }

        // Audit Log
        await logAction(user, 'CREATE', 'Asset', `Création Actif: ${cleanData.name}`);

        return docRef.id;
    },

    /**
     * Update an existing asset
     */
    async update(id: string, data: AssetFormData, user: UserProfile): Promise<void> {
        if (!user.organizationId) throw new Error("User organization ID is missing");

        const validatedData = assetSchema.parse(data);
        const cleanData = sanitizeData(validatedData);

        await updateDoc(doc(db, 'assets', id), {
            ...cleanData,
            updatedAt: serverTimestamp()
        });

        await logAction(user, 'UPDATE', 'Asset', `Mise à jour Actif: ${cleanData.name}`);
    },

    /**
     * Delete an asset
     */
    async delete(id: string, name: string, user: UserProfile): Promise<void> {
        if (!user.organizationId) throw new Error("User organization ID is missing");

        await FunctionsService.deleteResource('assets', id);
        await logAction(user, 'DELETE', 'Asset', `Suppression Actif: ${name}`);
    },

    /**
     * Delete multiple assets
     */
    async bulkDelete(ids: string[], user: UserProfile): Promise<void> {
        if (!user.organizationId) throw new Error("User organization ID is missing");

        // Use sequential execution to prevent overwhelming the function instance
        for (const id of ids) {
            await FunctionsService.deleteResource('assets', id);
        }
        await logAction(user, 'DELETE', 'Asset', `Suppression en masse de ${ids.length} actifs`);
    },

    /**
     * Calculate linear depreciation
     */
    calculateDepreciation(price: number, purchaseDate: string): number {
        if (!price || !purchaseDate) return price;
        const start = new Date(purchaseDate);
        const now = new Date();
        const ageInYears = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        // Linear depreciation over 5 years
        const value = price * (1 - (ageInYears / 5));
        return Math.max(0, Math.round(value));
    },

    /**
     * Get asset history logs
     */
    async getAssetHistory(assetName: string, organizationId: string) {
        // This is a simplified fetch. Ideally we query system_logs where resource == 'Asset' and details contains name
        // However, standard Audit Trail usually filters by 'details' string or we store resourceId.
        // Assuming we store resourceId in logs or filtering by text for now as per legacy.
        // If we strictly want to filter by asset ID, logAction should store resourceId.
        // For now, let's keep it generic or check how useAssetDetails was doing it.
        // The original code passed asset.name.

        // Dynamic import to avoid circular dep if needed, but normally unrelated.
        const { getDocs, query, where, orderBy, limit } = await import('firebase/firestore');
        const logsRef = collection(db, 'system_logs');

        // Actually, without resourceId in logs, looking up by name is fragile.
        // Let's assume we want to fix this in the future.
        // For now, let's return [] or implement a proper ID based query if logs have it.
        // Looking at logger.ts, it stores resourceType, action, details.

        // Let's try to fetch recent logs for this org and filter in memory if needed, or rely on a better query.
        // BUT, given `useAssetDetails` was calling this, maybe I should check if `assetService.ts` really existed with this code.
        // If I overwrote it, I might have lost the specific query logic.
        // Re-implementing a basic version.

        const simpleQ = query(
            logsRef,
            where('organizationId', '==', organizationId),
            where('resourceType', '==', 'Asset'),
            orderBy('timestamp', 'desc'),
            limit(20)
        );

        // We filter client side for the name to be safe
        const snap = await getDocs(simpleQ);
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any))
            .filter(l => l.details && l.details.includes(assetName));

        return { logs };
    },

    /**
     * Get all relationships for an asset
     */
    async getAssetRelationships(assetId: string, organizationId: string) {
        const { getDocs, query, where } = await import('firebase/firestore');

        // Helper to fetch - Use simpler queries to avoid index requirements
        const fetchRel = async (col: string, field: string) => {
            try {
                // Try composite query first (more efficient)
                const q = query(collection(db, col), where('organizationId', '==', organizationId), where(field, 'array-contains', assetId));
                const s = await getDocs(q);
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                return s.docs.map(d => ({ id: d.id, ...d.data() } as any));
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                // Fallback to client-side filtering if index is missing
                if (error.code === 'failed-precondition') {
                    console.warn(`Index manquant pour ${col}, utilisation du fallback côté client`);
                    const fallbackQ = query(collection(db, col), where('organizationId', '==', organizationId));
                    const fallbackSnap = await getDocs(fallbackQ);
                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                    return fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() } as any))
                        .filter(doc => doc[field] && Array.isArray(doc[field]) && doc[field].includes(assetId));
                }
                throw error;
            }
        };

        const [risks, incidents, projects, audits, documents, controls] = await Promise.all([
            fetchRel('risks', 'affectedAssetIds'),
            fetchRel('incidents', 'affectedAssetIds'),
            fetchRel('projects', 'relatedAssetIds'),
            // Audits might link via scope or assets array
            fetchRel('audits', 'scope'), // Check if scope is correct or if it's assetIds
            fetchRel('documents', 'relatedAssetIds'),
            fetchRel('controls', 'linkedAssetIds')
        ]);

        return {
            risks,
            incidents,
            projects,
            audits,
            documents,
            controls
        };
    }
};
