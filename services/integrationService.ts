

import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

export interface IntegrationProvider {
    id: string;
    name: string;
    description: string;
    icon: string; // URL or icon name
    category: 'cloud' | 'code' | 'security' | 'productivity';
    status: 'connected' | 'disconnected' | 'error';
    lastSync?: Date;
}

export interface IntegrationConnection {
    id: string;
    providerId: string;
    organizationId: string;
    config: Record<string, any>; // Store non-sensitive config here
    status: 'active' | 'inactive' | 'error';
    createdAt: Date;
    updatedAt: Date;
}

const MOCK_PROVIDERS: IntegrationProvider[] = [
    {
        id: 'aws',
        name: 'Amazon Web Services',
        description: 'Collect infrastructure configuration and security hub findings.',
        icon: 'aws',
        category: 'cloud',
        status: 'disconnected'
    },
    {
        id: 'azure',
        name: 'Microsoft Azure',
        description: 'Sync Azure Policy compliance and Defender for Cloud alerts.',
        icon: 'azure',
        category: 'cloud',
        status: 'disconnected'
    },
    {
        id: 'gcp',
        name: 'Google Cloud Platform',
        description: 'Monitor GCP Security Command Center and asset inventory.',
        icon: 'gcp',
        category: 'cloud',
        status: 'disconnected'
    },
    {
        id: 'github',
        name: 'GitHub',
        description: 'Track repository settings, branch protection, and dependabot alerts.',
        icon: 'github',
        category: 'code',
        status: 'disconnected'
    },
    {
        id: 'vanta_agent',
        name: 'Sentinel Agent',
        description: 'Collect local workstation security posture (OS, Disk Encryption).',
        icon: 'shield',
        category: 'security',
        status: 'disconnected'
    }
];

class IntegrationService {
    async getProviders(): Promise<IntegrationProvider[]> {
        // In a real app, we might fetch enabled providers from backend or config
        // For now, we return the static list.
        return MOCK_PROVIDERS;
    }

    async connectProvider(providerId: string, config: any, organizationId: string): Promise<boolean> {
        try {
            const connectIntegration = httpsCallable(functions, 'connectIntegration');
            await connectIntegration({ providerId, credentials: config, organizationId });
            return true;
        } catch (error) {
            console.error('Failed to connect provider', error);
            throw error;
        }
    }

    async disconnectProvider(providerId: string): Promise<boolean> {
        console.log(`Disconnecting ${providerId}`);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        return true;
    }

    async fetchEvidence(providerId: string, resourceId: string, organizationId: string): Promise<{ status: string, details: string, lastSync: string }> {
        try {
            const fetchEvidenceFn = httpsCallable(functions, 'fetchEvidence');
            const result = await fetchEvidenceFn({ providerId, resourceId, organizationId });
            return result.data as any;
        } catch (error) {
            console.error('Failed to fetch evidence', error);
            throw error;
        }
    }

    async syncProvider(providerId: string): Promise<void> {
        console.log(`Syncing ${providerId}`);
        // Legacy method, kept for compatibility if needed, but fetchEvidence is preferred.
    }

    async searchEurLex(query: string): Promise<string> {
        console.log(`Searching EUR-Lex for: ${query}`);
        // Mock response
        await new Promise(resolve => setTimeout(resolve, 1000));
        return `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679&qid=${Date.now()}`;
    }
}

export const integrationService = new IntegrationService();
