import { auth } from '../firebase';
import { ErrorLogger } from './errorLogger';

// Base URL for the OVH-hosted Secure Backend
const OVH_API_BASE_URL = import.meta.env.VITE_OVH_API_BASE_URL || 'https://cyber-threat-consulting.com/api/v1';

interface HybridRequestOptions extends RequestInit {
    requiresAuth?: boolean;
}

interface HybridResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
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
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
            }

            const response = await fetch(url, {
                ...options,
                headers,
            });

            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error: any) {
            ErrorLogger.error(error, 'HybridService.request');
            return { success: false, error: error.message || 'Unknown error occurred' };
        }
    }

    /**
     * Securely store data in the OVH backend
     */
    async storeSecureData(dataType: string, payload: any): Promise<HybridResponse> {
        return this.request('/secure-storage/store', {
            method: 'POST',
            body: JSON.stringify({ type: dataType, data: payload }),
        });
    }

    /**
     * Retrieve secure data from the OVH backend
     */
    async getSecureData(dataType: string, id: string): Promise<HybridResponse> {
        return this.request(`/secure-storage/${dataType}/${id}`, {
            method: 'GET',
        });
    }

    /**
     * Log a critical audit event to the SecNumCloud immutable log
     */
    async logCriticalEvent(event: any): Promise<HybridResponse> {
        return this.request('/audit/log', {
            method: 'POST',
            body: JSON.stringify(event),
        });
    }

    /**
     * Log user consent for GDPR compliance
     */
    async logConsent(documentType: string, accepted: boolean = true): Promise<HybridResponse> {
        return this.request('/consent/log', {
            method: 'POST',
            body: JSON.stringify({
                document_type: documentType,
                accepted,
                version: '1.0' // Should be dynamic in production
            }),
        });
    }

    /**
     * Delete secure data (Right to Erasure)
     */
    async deleteSecureData(dataType: string, id: string): Promise<HybridResponse> {
        return this.request(`/secure-storage/${dataType}/${id}`, {
            method: 'DELETE',
        });
    }

    /**
     * Wipe all secure data for the organization
     */
    async wipeOrganizationSecureData(): Promise<HybridResponse> {
        return this.request('/secure-storage/organization/wipe', {
            method: 'DELETE',
        });
    }

    /**
     * Export all secure data for the organization (Data Portability)
     */
    async exportOrganizationSecureData(): Promise<HybridResponse> {
        return this.request('/secure-storage/organization/export', {
            method: 'GET',
        });
    }

    /**
     * Generate a PDF report using the backend's reporting engine
     */
    async generateReport(reportType: 'risks' | 'compliance' | 'audit'): Promise<Blob | null> {
        try {
            const token = await this.getAuthToken();
            const response = await fetch(`${this.baseUrl}/hybrid-features/generate-report/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
                body: JSON.stringify({ type: reportType })
            });

            if (!response.ok) throw new Error('Report generation failed');
            return await response.blob();
        } catch (error) {
            ErrorLogger.error(error, 'HybridService.generateReport');
            return null;
        }
    }

    /**
     * Analyze risks using the backend's AI engine
     */
    async analyzeRisk(): Promise<HybridResponse> {
        return this.request('/hybrid-features/analyze-risks', {
            method: 'POST',
        });
    }
}

export const hybridService = new HybridService(OVH_API_BASE_URL);
