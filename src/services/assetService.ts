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
import { getDiff } from '../utils/diffUtils';
import { sanitizeData } from '../utils/dataSanitizer';
import { ErrorLogger } from './errorLogger';
import { UserProfile, Risk, Incident, Project, Audit, Document, Control, SystemLog } from '../types';
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
    async update(id: string, data: Partial<AssetFormData>, user: UserProfile, oldData?: Record<string, any>): Promise<void> {
        if (!user.organizationId) throw new Error("User organization ID is missing");

        const validatedData = assetSchema.partial().parse(data);
        const cleanData = sanitizeData(validatedData);

        // Calculate changes for Audit Trail using standard utility
        const changes = oldData ? getDiff(cleanData as any, oldData) : [];

        await updateDoc(doc(db, 'assets', id), {
            ...cleanData,
            updatedAt: serverTimestamp()
        });

        await logAction(
            user,
            'UPDATE',
            'Asset',
            `Mise à jour Actif: ${cleanData.name || oldData?.name || 'Inconnu'}`,
            undefined,
            id,
            undefined,
            changes.length > 0 ? changes : undefined
        );
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
    async getAssetHistory(assetId: string, organizationId: string) {
        const { getDocs, query, where, orderBy, limit } = await import('firebase/firestore');
        const logsRef = collection(db, 'system_logs');

        // AUDIT FIX: Primary query by resourceId for accurate traceability
        const primaryQ = query(
            logsRef,
            where('organizationId', '==', organizationId),
            where('resourceId', '==', assetId),
            orderBy('timestamp', 'desc'),
            limit(50)
        );

        const snap = await getDocs(primaryQ);
        const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as SystemLog));

        return { logs };
    },

    /**
     * Get all relationships for an asset
     */
    async getAssetRelationships(assetId: string, organizationId: string) {
        const { getDocs, query, where } = await import('firebase/firestore');

        // Helper to fetch - Use simpler queries to avoid index requirements
        const fetchRel = async <T>(col: string, field: string): Promise<T[]> => {
            try {
                // Try composite query first (more efficient)
                const q = query(collection(db, col), where('organizationId', '==', organizationId), where(field, 'array-contains', assetId));
                const s = await getDocs(q);
                return s.docs.map(d => ({ id: d.id, ...d.data() } as T));
            } catch (error: unknown) {
                // Fallback to client-side filtering if index is missing
                const firebaseError = error as { code?: string } | null;
                if (firebaseError?.code === 'failed-precondition') {
                    ErrorLogger.warn(`Index manquant pour ${col}, utilisation du fallback côté client`, 'assetService.getCollection');
                    const fallbackQ = query(collection(db, col), where('organizationId', '==', organizationId));
                    const fallbackSnap = await getDocs(fallbackQ);
                    return fallbackSnap.docs
                        .map(d => ({ id: d.id, ...d.data() } as unknown as T & { [key: string]: unknown }))
                        .filter(doc => {
                            const fieldValue = doc[field];
                            return fieldValue && Array.isArray(fieldValue) && fieldValue.includes(assetId);
                        }) as T[];
                }
                throw error;
            }
        };

        const [risks, incidents, projects, audits, documents, controls] = await Promise.all([
            fetchRel<Risk>('risks', 'affectedAssetIds'),
            fetchRel<Incident>('incidents', 'affectedAssetIds'),
            fetchRel<Project>('projects', 'relatedAssetIds'),
            // Audits might link via scope or assets array
            fetchRel<Audit>('audits', 'scope'), // Check if scope is correct or if it's assetIds
            fetchRel<Document>('documents', 'relatedAssetIds'),
            fetchRel<Control>('controls', 'linkedAssetIds')
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
