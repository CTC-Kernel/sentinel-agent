
import { functions, db } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { ErrorLogger } from './errorLogger';
import { MitreTechnique, Vulnerability, CyberNewsItem, CompanySearchResult } from '../types';
export type { CyberNewsItem, CompanySearchResult } from '../types';

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
        id: 'website_check',
        name: 'Website Availability',
        description: 'Check if your public websites are accessible (Uptime).',
        icon: 'globe',
        category: 'productivity',
        status: 'disconnected'
    },
    {
        id: 'shodan',
        name: 'Shodan',
        description: 'Scan public IPs for open ports and vulnerabilities.',
        icon: 'search',
        category: 'security',
        status: 'disconnected'
    },
    {
        id: 'hibp',
        name: 'Have I Been Pwned',
        description: 'Check if email addresses have been compromised in data breaches.',
        icon: 'shield-alert',
        category: 'security',
        status: 'disconnected'
    }
];

class IntegrationService {
    async getProviders(organizationId?: string): Promise<IntegrationProvider[]> {
        if (!organizationId) {
            return [];
        }

        try {
            // Fetch real connections from Firestore
            const integrationsRef = collection(db, 'organizations', organizationId, 'integrations');
            const snapshot = await getDocs(integrationsRef);

            const connectedIntegrations = new Map<string, any>();
            snapshot.forEach(doc => {
                connectedIntegrations.set(doc.id, doc.data());
            });

            // Merge with static list
            return MOCK_PROVIDERS.map(provider => {
                const connection = connectedIntegrations.get(provider.id);
                if (connection) {
                    return {
                        ...provider,
                        status: connection.status === 'active' ? 'connected' : 'error',
                        lastSync: connection.lastSync ? new Date(connection.lastSync) : undefined
                    };
                }
                return provider;
            });
        } catch (error) {
            ErrorLogger.error(error, "IntegrationService.getProviders");
            return [];
        }
    }

    async connectProvider(providerId: string, config: Record<string, unknown>, organizationId: string, isDemoMode: boolean = false): Promise<boolean> {
        if (isDemoMode) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return true;
        }

        try {
            // 1. Call Cloud Function for actual connection/validation (if needed)
            // const connectIntegration = httpsCallable(functions, 'connectIntegration');
            // await connectIntegration({ providerId, credentials: config, organizationId });

            // 2. Persist status to Firestore
            const integrationRef = doc(db, 'organizations', organizationId, 'integrations', providerId);
            await setDoc(integrationRef, {
                id: providerId,
                providerId,
                organizationId,
                config: { ...config, apiKey: '***' }, // Don't store actual secrets in plain text if possible
                status: 'active',
                connectedAt: new Date().toISOString(),
                lastSync: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            return true;
        } catch (error) {
            ErrorLogger.error(error, "IntegrationService.connectProvider");
            throw error;
        }
    }

    async disconnectProvider(providerId: string, organizationId?: string, isDemoMode: boolean = false): Promise<void> {
        if (isDemoMode) {
            await new Promise(resolve => setTimeout(resolve, 500));
            return;
        }

        if (!organizationId) {
            throw new Error('Organization ID is required to disconnect.');
        }

        try {
            // Delete from Firestore
            const integrationRef = doc(db, 'organizations', organizationId, 'integrations', providerId);
            await deleteDoc(integrationRef);
        } catch (error) {
            ErrorLogger.error(error, "IntegrationService.disconnectProvider");
            throw error;
        }
    }

    async fetchEvidence(providerId: string, resourceId: string, organizationId: string, isDemoMode: boolean = false): Promise<{ status: string, details: string, lastSync: string }> {
        const fetchEvidenceFn = httpsCallable(functions, 'fetchEvidence');
        const result = await fetchEvidenceFn({ providerId, resourceId, organizationId, isDemoMode });
        return result.data as { status: string, details: string, lastSync: string };
    }

    async syncProvider(_providerId: string, isDemoMode: boolean = false): Promise<void> {
        if (isDemoMode) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return;
        }
        // Deprecated in favor of fetchEvidence, but kept for compatibility
        throw new Error('Sync not implemented for production yet.');
    }

    async searchEurLex(query: string, isDemoMode: boolean = false): Promise<string> {
        if (isDemoMode) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679&qid=${Date.now()}`;
        }
        // Return a direct search URL for the user to view results
        return `https://eur-lex.europa.eu/search.html?scope=EURLEX&text=${encodeURIComponent(query)}&lang=fr&type=quick&qid=${Date.now()}`;
    }

    async getCommonMitreTechniques(_query: string, isDemoMode: boolean = false): Promise<MitreTechnique[]> {
        if (isDemoMode) {
            await new Promise(resolve => setTimeout(resolve, 500));
            return [
                { id: 'T1566', name: 'Phishing', description: 'Phishing' },
                { id: 'T1190', name: 'Exploit Public-Facing Application', description: 'Exploitation' }
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
    async getCyberNews(isDemoMode: boolean = false): Promise<CyberNewsItem[]> {
        if (isDemoMode) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return [
                {
                    title: "Alerte de sécurité : Vulnérabilité critique dans OpenSSL",
                    link: "https://www.cert.ssi.gouv.fr/alerte/CERTFR-2023-ALE-001/",
                    pubDate: new Date().toISOString(),
                    source: "CERT-FR"
                },
                {
                    title: "Campagne de phishing ciblant les établissements de santé",
                    link: "https://www.cert.ssi.gouv.fr/actualite/CERTFR-2023-ACT-002/",
                    pubDate: new Date(Date.now() - 86400000).toISOString(),
                    source: "CERT-FR"
                }
            ];
        }

        try {
            const fetchRssFeed = httpsCallable(functions, 'fetchRssFeed');
            const result = await fetchRssFeed({ url: 'https://www.cert.ssi.gouv.fr/feed/' });
            const xmlText = (result.data as { content: string }).content;

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            const items = xmlDoc.querySelectorAll("item");

            return Array.from(items).slice(0, 5).map(item => ({
                title: item.querySelector("title")?.textContent || "Sans titre",
                link: item.querySelector("link")?.textContent || "#",
                pubDate: item.querySelector("pubDate")?.textContent || new Date().toISOString(),
                source: "CERT-FR"
            }));
        } catch (error) {
            ErrorLogger.error(error, "IntegrationService.getCyberNews");
            return [];
        }
    }

    async getCnilNews(isDemoMode: boolean = false): Promise<CyberNewsItem[]> {
        if (isDemoMode) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return [
                {
                    title: "Sanction de 10 millions d'euros à l'encontre de la société X",
                    link: "https://www.cnil.fr/fr/sanction-10-millions-euros",
                    pubDate: new Date(Date.now() - 172800000).toISOString(),
                    source: "CNIL"
                }
            ];
        }

        try {
            const fetchRssFeed = httpsCallable(functions, 'fetchRssFeed');
            const result = await fetchRssFeed({ url: 'https://www.cnil.fr/fr/rss.xml' });
            const xmlText = (result.data as { content: string }).content;

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            const items = xmlDoc.querySelectorAll("item");

            return Array.from(items).slice(0, 5).map(item => ({
                title: item.querySelector("title")?.textContent || "Sans titre",
                link: item.querySelector("link")?.textContent || "#",
                pubDate: item.querySelector("pubDate")?.textContent || new Date().toISOString(),
                source: "CNIL"
            }));
        } catch (error) {
            ErrorLogger.error(error, "IntegrationService.getCnilNews");
            return [];
        }
    }

    // --- Added for SupplierForm compatibility ---

    async searchCompany(query: string): Promise<CompanySearchResult[]> {
        // Mock implementation for demo/build
        // In production, integrate with Pappers or Sirene API
        if (query.length < 3) return [];

        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate net lag

        return [
            {
                name: `${query.toUpperCase()} SOLUTIONS`,
                siren: '123456789',
                address: '10 Avenue des Champs-Élysées, 75008 Paris',
                activity: 'Conseil en systèmes et logiciels informatiques'
            },
            {
                name: `${query.toUpperCase()} TECH`,
                siren: '987654321',
                address: 'Station F, 75013 Paris',
                activity: 'Édition de logiciels applicatifs'
            }
        ];
    }

    async fetchSecurityEvents(source: 'splunk' | 'crowdstrike' | 'sentinelone' | 'microsoft', isDemoMode: boolean = false): Promise<SecurityEvent[]> {
        if (isDemoMode) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            const now = new Date();
            if (source === 'splunk') {
                return [
                    {
                        id: `splunk-${Date.now()}-1`,
                        source: 'Splunk',
                        title: 'Multiple Failed Login Attempts (Admin)',
                        description: 'Detected 15 failed login attempts from IP 192.168.1.50 in 5 minutes.',
                        severity: 'High',
                        timestamp: new Date(now.getTime() - 1000 * 60 * 30).toISOString(), // 30 mins ago
                        rawData: { ip: '192.168.1.50', count: 15, user: 'admin' }
                    },
                    {
                        id: `splunk-${Date.now()}-2`,
                        source: 'Splunk',
                        title: 'Unusual Data Egress',
                        description: 'Large file transfer (2GB) detected to unknown external IP.',
                        severity: 'Medium',
                        timestamp: new Date(now.getTime() - 1000 * 60 * 120).toISOString(), // 2 hours ago
                        rawData: { dest_ip: '45.33.22.11', size: '2GB' }
                    }
                ];
            } else if (source === 'microsoft') {
                return [
                    {
                        id: `ms-${Date.now()}-1`,
                        source: 'Microsoft Sentinel',
                        title: 'Suspicious PowerShell Execution',
                        description: 'Defender for Endpoint detected obfuscated PowerShell command.',
                        severity: 'High',
                        timestamp: new Date(now.getTime() - 1000 * 60 * 60).toISOString(),
                        rawData: { device: 'Workstation-HR-04', user: 'jdoe' }
                    },
                    {
                        id: `ms-${Date.now()}-2`,
                        source: 'Microsoft Sentinel',
                        title: 'Impossible Travel Detected',
                        description: 'User login from New York and Tokyo within 10 minutes.',
                        severity: 'Medium',
                        timestamp: new Date(now.getTime() - 1000 * 60 * 10).toISOString(),
                        rawData: { user: 'admin', locations: ['US', 'JP'] }
                    }
                ];
            } else if (source === 'crowdstrike') {
                return [
                    {
                        id: `cs-${Date.now()}-1`,
                        source: 'CrowdStrike',
                        title: 'Malware Detected: Ransom.Wannacry',
                        description: 'Falcon sensor blocked execution of known ransomware signature.',
                        severity: 'Critical',
                        timestamp: new Date(now.getTime() - 1000 * 60 * 15).toISOString(),
                        rawData: { file: 'invoice.exe', path: 'C:\\Users\\JohnDoe\\Downloads\\' }
                    }
                ];
            }
            else if (source === 'sentinelone') {
                return [
                    {
                        id: `s1-${Date.now()}-1`,
                        source: 'SentinelOne',
                        title: 'Scripting Attack Blocked',
                        description: 'PowerShell script attempted to download unknown payload.',
                        severity: 'High',
                        timestamp: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
                        rawData: { cmd: 'Invoke-WebRequest ...' }
                    }
                ];
            }
            return [];
        } else {
            // Production Mode - Call Cloud Function
            try {
                const fetchExternalSecurityEvents = httpsCallable<{ source: string }, SecurityEvent[]>(functions, 'fetchExternalSecurityEvents');
                const result = await fetchExternalSecurityEvents({ source });
                return result.data;
            } catch (error) {
                console.error("Error fetching external security events:", error);
                throw error;
            }
        }
    }

    getLogoUrl(domain: string): string {
        // Use Clearbit's free logo API as a robust placeholder
        if (!domain) return '';
        return `https://logo.clearbit.com/${domain}`;
    }

    async validateVat(vatNumber: string): Promise<{ valid: boolean, message: string }> {
        // Basic Regex Validation for common EU formats (Simplified)
        // In prod, call VIES API
        const vatRegex = /^[A-Z]{2}[0-9A-Z]+$/;

        if (!vatRegex.test(vatNumber)) {
            return { valid: false, message: 'Format de TVA invalide' };
        }

        // Mock async check
        await new Promise(resolve => setTimeout(resolve, 300));
        return { valid: true, message: 'Numéro de TVA valide (Simulé)' };
    }
}

export const integrationService = new IntegrationService();

export interface SecurityEvent {
    id: string;
    source: string;
    title: string;
    description: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    timestamp: string;
    rawData?: any;
}
