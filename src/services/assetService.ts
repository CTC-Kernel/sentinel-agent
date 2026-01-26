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
import { AuditLogService } from './auditLogService';
import { canEditResource, canDeleteResource } from '../utils/permissions';
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
        if (!canEditResource(user, 'Asset')) throw new Error("Permission refusée");

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
        if (user.organizationId) {
            await AuditLogService.logCreate(
                user.organizationId,
                { id: user.uid, name: user.displayName || user.email, email: user.email },
                'asset',
                docRef.id,
                cleanData,
                cleanData.name
            );
        }

        return docRef.id;
    },

    /**
     * Update an existing asset
     */
    async update(id: string, data: Partial<AssetFormData>, user: UserProfile, oldData?: Record<string, unknown>): Promise<void> {
        if (!user.organizationId) throw new Error("User organization ID is missing");
        if (!canEditResource(user, 'Asset')) throw new Error("Permission refusée");

        const validatedData = assetSchema.partial().parse(data);
        const cleanData = sanitizeData(validatedData);

        await updateDoc(doc(db, 'assets', id), {
            ...cleanData,
            updatedAt: serverTimestamp()
        });

        if (user.organizationId && oldData) {
            await AuditLogService.logUpdate(
                user.organizationId,
                { id: user.uid, name: user.displayName || user.email, email: user.email },
                'asset',
                id,
                oldData,
                cleanData,
                (cleanData.name as string) || (oldData.name as string) || 'Actif'
            );
        }
    },

    /**
     * Delete an asset
     */
    async delete(id: string, name: string, user: UserProfile): Promise<void> {
        if (!user.organizationId) throw new Error("User organization ID is missing");
        if (!canDeleteResource(user, 'Asset')) throw new Error("Permission refusée");

        await FunctionsService.deleteResource('assets', id);

        if (user.organizationId) {
            await AuditLogService.logDelete(
                user.organizationId,
                { id: user.uid, name: user.displayName || user.email, email: user.email },
                'asset',
                id,
                { name },
                name
            );
        }
    },

    /**
     * Delete multiple assets
     */
    async bulkDelete(ids: string[], user: UserProfile): Promise<void> {
        if (!user.organizationId) throw new Error("User organization ID is missing");
        if (!canDeleteResource(user, 'Asset')) throw new Error("Permission refusée");

        // Use sequential execution to prevent overwhelming the function instance
        for (const id of ids) {
            await FunctionsService.deleteResource('assets', id);
        }

        if (user.organizationId) {
            // Using logBatch for bulk logs would be ideal but we don't have individual names here easily without fetching.
            // For now, logging a generic message is acceptable for bulk delete if we don't fetch first.
            // But strict audit might require individual logs.
            // Let's create individual logs with ID as fallback name to be safe.
            const entries = ids.map(id => ({
                organizationId: user.organizationId!,
                userId: user.uid,
                userName: user.displayName || user.email,
                userEmail: user.email,
                action: 'delete' as const,
                entityType: 'asset' as const,
                entityId: id,
                details: 'Suppression en masse',
                before: { id }
            }));
            await AuditLogService.logBatch(entries);
        }
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
