

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

    async connectProvider(providerId: string, config: any, organizationId: string, isDemoMode: boolean = false): Promise<boolean> {
        try {
            const connectIntegration = httpsCallable(functions, 'connectIntegration');
            await connectIntegration({ providerId, credentials: config, organizationId, isDemoMode });
            return true;
        } catch (error) {
            console.error('Failed to connect provider', error);
            throw error;
        }
    }

    async disconnectProvider(_providerId: string, isDemoMode: boolean = false): Promise<void> {
        if (isDemoMode) {
            // Mock disconnect
            await new Promise(resolve => setTimeout(resolve, 500));
            return;
        }
        // Real implementation would go here
        throw new Error('Disconnect not implemented for production yet.');
    }

    async fetchEvidence(providerId: string, resourceId: string, organizationId: string, isDemoMode: boolean = false): Promise<{ status: string, details: string, lastSync: string }> {
        try {
            const fetchEvidenceFn = httpsCallable(functions, 'fetchEvidence');
            const result = await fetchEvidenceFn({ providerId, resourceId, organizationId, isDemoMode });
            return result.data as any;
        } catch (error) {
            throw error;
        }
    }

    async syncProvider(_providerId: string, isDemoMode: boolean = false): Promise<void> {
        if (isDemoMode) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return;
        }
        // Deprecated in favor of fetchEvidence, but kept for compatibility
        throw new Error('Sync not implemented for production yet.');
    }

    async searchEurLex(_query: string, isDemoMode: boolean = false): Promise<string> {
        if (isDemoMode) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679&qid=${Date.now()}`;
        }
        // Real implementation would call EUR-Lex API
        return '';
    }

    async getCommonMitreTechniques(_query: string, isDemoMode: boolean = false): Promise<any[]> {
        if (isDemoMode) {
            await new Promise(resolve => setTimeout(resolve, 500));
            return [
                { id: 'T1566', name: 'Phishing', url: 'https://attack.mitre.org/techniques/T1566/' },
                { id: 'T1190', name: 'Exploit Public-Facing Application', url: 'https://attack.mitre.org/techniques/T1190/' }
            ];
        }
        // Real implementation would call MITRE ATT&CK API
        return [];
    }

    async checkVulnerabilities(assetName: string, isDemoMode: boolean = false): Promise<Vulnerability[]> {
        if (isDemoMode) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            // Mock vulnerabilities based on asset name hash or random
            if (assetName.toLowerCase().includes('server') || assetName.toLowerCase().includes('db')) {
                return [
                    {
                        cveId: 'CVE-2023-1234',
                        description: 'Remote Code Execution vulnerability in server component.',
                        severity: 'High',
                        score: 8.5,
                        publishedDate: '2023-05-10',
                        source: 'NVD'
                    },
                    {
                        cveId: 'CVE-2023-5678',
                        description: 'Privilege Escalation due to improper input validation.',
                        severity: 'Medium',
                        score: 5.5,
                        publishedDate: '2023-06-15',
                        source: 'NVD'
                    }
                ];
            }
            return [];
        }
        // Real implementation would call NVD API or similar
        return [];
    }
}

export interface Vulnerability {
    cveId: string;
    description: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    score?: number;
    publishedDate: string;
    source: string;
}

export const integrationService = new IntegrationService();
