import { auth, db } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';

// Base URL for the OVH-hosted Secure Backend
const OVH_API_BASE_URL = import.meta.env.VITE_OVH_API_BASE_URL || '/api';

interface HybridRequestOptions extends RequestInit {
    requiresAuth?: boolean;
    silent?: boolean;
}

interface HybridResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

class HybridService {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    /**
     * Get the current user's ID token for authentication
     */
    private async getAuthToken(): Promise<string | null> {
        const user = auth.currentUser;
        if (!user) return null;
        return user.getIdToken();
    }

    /**
     * Generic request handler
     */
    private async request<T>(endpoint: string, options: HybridRequestOptions = {}): Promise<HybridResponse<T>> {
        try {
            const url = `${this.baseUrl}${endpoint}`;
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                ...(options.headers as Record<string, string>),
            };

            if (options.requiresAuth !== false) {
                const token = await this.getAuthToken();
                if (!token) {
                    return { success: false, error: 'Unauthorized' };
                }
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(url, {
                ...options,
                headers,
            });

            if (!response.ok) {
                const errorText = await response.text().catch((e) => {
                    ErrorLogger.warn('Failed to read error text', 'HybridService.request', { metadata: { error: e } });
                    return '';
                });
                const message = errorText || `Request failed with status ${response.status}`;
                throw new Error(message);
            }

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                return { success: true, data: (undefined as unknown as T) };
            }

            const data = (await response.json()) as T;
            return { success: true, data };
        } catch (error) {
            if (!options.silent) {
                ErrorLogger.error(error, 'HybridService.request');
            }
            const message = error instanceof Error ? error.message : 'Unknown error occurred';
            return { success: false, error: message };
        }
    }

    /**
     * Securely store data in Firestore (simulating OVH Secure Storage)
     */
    /**
     * Securely store data in Firestore (simulating OVH Secure Storage)
     */
    async storeSecureData(dataType: string, payload: Record<string, unknown>): Promise<HybridResponse> {
        try {
            // In a real scenario, we might encrypt this data before storing
            // For now, we store it in a specific 'secure_storage' collection
            const { id, ...data } = payload;
            const docId = (id as string) || crypto.randomUUID();

            // Use Firestore directly
            const { doc, setDoc } = await import('firebase/firestore');

            // Get organizationId from auth
            const user = auth.currentUser;
            let organizationId = (data as { organizationId?: string }).organizationId;

            if (!organizationId && user) {
                const tokenResult = await user.getIdTokenResult();
                organizationId = tokenResult.claims.organizationId as string;
            }

            if (!organizationId) {
                return { success: false, error: 'Missing organizationId' };
            }

            await setDoc(doc(db, 'secure_storage', `${dataType}_${docId}`), sanitizeData({
                ...data,
                organizationId, // Ensure organizationId is stored
                dataType,
                originalId: docId,
                storedAt: new Date().toISOString(),
                secured: true
            }));

            return { success: true, data: { id: docId } };
        } catch (error) {
            ErrorLogger.error(error, 'HybridService.storeSecureData');
            return { success: false, error: 'Failed to store secure data' };
        }
    }

    /**
     * Retrieve secure data from Firestore
     */
    async getSecureData(dataType: string, id: string): Promise<HybridResponse> {
        try {
            const { doc, getDoc } = await import('firebase/firestore');
            const docRef = doc(db, 'secure_storage', `${dataType}_${id}`);
            const snapshot = await getDoc(docRef);

            if (snapshot.exists()) {
                return { success: true, data: snapshot.data() };
            }
            return { success: false, error: 'Data not found' };
        } catch (error) {
            ErrorLogger.error(error, 'HybridService.getSecureData');
            return { success: false, error: 'Failed to retrieve secure data' };
        }
    }

    /**
     * Log a critical audit event to the SecNumCloud immutable log
     */
    async logCriticalEvent(event: unknown): Promise<HybridResponse> {
        return this.request('/v1/audit/log', {
            method: 'POST',
            body: JSON.stringify(event),
            silent: true // Background logging should not block or spam errors
        });
    }

    /**
     * Log user consent for GDPR compliance
     */
    async logConsent(documentType: string, accepted: boolean = true): Promise<HybridResponse> {
        return this.request('/v1/consent/log', {
            method: 'POST',
            body: JSON.stringify({
                document_type: documentType,
                accepted,
                version: '1.0' // Should be dynamic in production
            }),
            silent: true // Background logging should not block or spam errors
        });
    }

    /**
     * Delete secure data (Right to Erasure)
     */
    async deleteSecureData(dataType: string, id: string): Promise<HybridResponse> {
        try {
            const { doc, deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'secure_storage', `${dataType}_${id}`));
            return { success: true };
        } catch (error) {
            ErrorLogger.error(error, 'HybridService.deleteSecureData');
            return { success: false, error: 'Failed to delete secure data' };
        }
    }

    /**
     * Wipe all secure data for the organization
     */
    async wipeOrganizationSecureData(): Promise<HybridResponse> {
        try {
            const { collection, query, where, getDocs, deleteDoc } = await import('firebase/firestore');
            const user = auth.currentUser;
            if (!user) throw new Error("No user logged in");

            const tokenResult = await user.getIdTokenResult();
            const organizationId = tokenResult.claims.organizationId;

            if (!organizationId) {
                throw new Error("User has no organization ID");
            }

            const q = query(collection(db, 'secure_storage'), where('organizationId', '==', organizationId));
            const snapshot = await getDocs(q);

            const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);

            return { success: true, message: `Organization data wiped (${snapshot.size} records deleted)` };
        } catch (error) {
            ErrorLogger.error(error, 'HybridService.wipeOrganizationSecureData');
            return { success: false, error: 'Failed to wipe data' };
        }
    }

    /**
     * Export all secure data for the organization (Data Portability)
     */
    async exportOrganizationSecureData(): Promise<HybridResponse> {
        try {
            const { collection, query, where, getDocs } = await import('firebase/firestore');

            const user = auth.currentUser;
            let organizationId: string | undefined;

            if (user) {
                const tokenResult = await user.getIdTokenResult();
                organizationId = tokenResult.claims.organizationId as string;
            }

            if (!organizationId) {
                // Fallback: try to get it from the user profile if claims are not set (though claims are preferred for security)
                // For now, if we can't determine org ID, we return empty or throw
                throw new Error("Organization ID not found for export");
            }

            const q = query(collection(db, 'secure_storage'), where('organizationId', '==', organizationId));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(d => d.data());
            return { success: true, data: { export: data } };
        } catch (error) {
            ErrorLogger.error(error, 'HybridService.exportOrganizationSecureData');
            return { success: false, error: 'Failed to export data' };
        }
    }

    /**
     * Fetch Risks from the dedicated V2 Backend Adapter
     * Uses the new /api/v2/risks endpoint
     */
    async getRisksFromBackend(): Promise<HybridResponse<unknown[]>> {
        return this.request<unknown[]>('/v2/risks/');
    }
}

export const hybridService = new HybridService(OVH_API_BASE_URL);
