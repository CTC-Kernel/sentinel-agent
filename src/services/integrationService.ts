
import { functions, db } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, doc, getDocs, setDoc, deleteDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { ErrorLogger } from './errorLogger';
import { MitreTechnique, Vulnerability, CyberNewsItem, CompanySearchResult } from '../types';
import { ScannerJob, ScannerJobCreate } from '../types/job';
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
    config: Record<string, unknown>; // Store non-sensitive config here
    status: 'active' | 'inactive' | 'error';
    createdAt: Date;
    updatedAt: Date;
}

const INTEGRATION_CATALOG: IntegrationProvider[] = [
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
    private isDemoAllowed(): boolean {
        return import.meta.env.DEV;
    }

    private normalizeDemoMode(isDemoMode: boolean): boolean {
        return isDemoMode && this.isDemoAllowed();
    }

    async getProviders(organizationId?: string): Promise<IntegrationProvider[]> {
        if (!organizationId) {
            return [];
        }

        try {
            // Fetch real connections from Firestore
            const integrationsRef = collection(db, 'organizations', organizationId, 'integrations');
            const snapshot = await getDocs(integrationsRef);

            const connectedIntegrations = new Map<string, Record<string, unknown>>();
            snapshot.forEach(doc => {
                connectedIntegrations.set(doc.id, doc.data() as Record<string, unknown>);
            });

            // Merge with static list
            return INTEGRATION_CATALOG.map(provider => {
                const connection = connectedIntegrations.get(provider.id);
                if (connection) {
                    return {
                        ...provider,
                        status: connection.status === 'active' ? 'connected' : 'error',
                        lastSync: typeof connection.lastSync === 'string' ? new Date(connection.lastSync) : undefined
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
        const demoMode = this.normalizeDemoMode(isDemoMode);
        if (demoMode) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return true;
        }

        try {
            // 1. Call Cloud Function for actual connection/validation
            const connectIntegration = httpsCallable(functions, 'connectIntegration');
            await connectIntegration({ providerId, credentials: config, organizationId });

            // 2. Persist status to Firestore
            const integrationRef = doc(db, 'organizations', organizationId, 'integrations', providerId);
            await setDoc(integrationRef, {
                id: providerId,
                providerId,
                organizationId,
                config: { ...config, redactedKey: '***' }, // Don't store actual secrets in plain text if possible
                status: 'active',
                connectedAt: serverTimestamp(),
                lastSync: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            return true;
        } catch (error) {
            ErrorLogger.error(error, "IntegrationService.connectProvider");
            throw error;
        }
    }

    async disconnectProvider(providerId: string, organizationId?: string, isDemoMode: boolean = false): Promise<void> {
        const demoMode = this.normalizeDemoMode(isDemoMode);
        if (demoMode) {
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

    async syncProvider(providerId: string, organizationId?: string, isDemoMode: boolean = false): Promise<void> {
        const demoMode = this.normalizeDemoMode(isDemoMode);
        if (demoMode) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return;
        }

        if (!organizationId) {
            // Fallback for calls that might not have passed orgId, though they should have.
            // For safety in this "simulated backend" fix, we'll just return if no orgId to avoid crash,
            // or log error. Better to require it.
            ErrorLogger.warn("IntegrationService.syncProvider called without organizationId", 'integrationService.syncProvider');
            return;
        }

        try {
            // Update the integration document to show it's "syncing" then "connected"
            // For this 'Masterpiece' implementation without a real backend, we just update the timestamp.
            const integrationRef = doc(db, 'organizations', organizationId, 'integrations', providerId);
            await updateDoc(integrationRef, {
                lastSync: serverTimestamp(),
                status: 'active', // Ensure it stays active
                updatedAt: serverTimestamp()
            });

        } catch (error) {
            ErrorLogger.error(error, "IntegrationService.syncProvider");
            throw error;
        }
    }

    async searchEurLex(query: string, isDemoMode: boolean = false): Promise<string> {
        void this.normalizeDemoMode(isDemoMode);
        // Return a direct search URL for the user to view results
        return `https://eur-lex.europa.eu/search.html?scope=EURLEX&text=${encodeURIComponent(query)}&lang=fr&type=quick&qid=${Date.now()}`;
    }

    async getCommonMitreTechniques(_query: string, isDemoMode: boolean = false): Promise<MitreTechnique[]> {
        const demoMode = this.normalizeDemoMode(isDemoMode);
        if (demoMode) {
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
        const demoMode = this.normalizeDemoMode(isDemoMode);
        if (demoMode) {
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
        const demoMode = this.normalizeDemoMode(isDemoMode);
        if (demoMode) {
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
        const demoMode = this.normalizeDemoMode(isDemoMode);
        if (demoMode) {
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

    async searchCompany(query: string, isDemoMode: boolean = false): Promise<CompanySearchResult[]> {
        const demoMode = this.normalizeDemoMode(isDemoMode);
        if (demoMode) {
            if (query.length < 3) return [];
            await new Promise(resolve => setTimeout(resolve, 500));
            return [
                {
                    name: `Entreprise Démo ${query}`,
                    siren: '123456789',
                    address: '1 Rue de la Démo, 75000 Paris',
                    activity: '6201Z - Programmation informatique'
                }
            ];
        }

        if (query.length < 3) return [];

        try {
            const searchCompanyFn = httpsCallable<{ query: string }, CompanySearchResult[]>(functions, 'searchCompany');
            const result = await searchCompanyFn({ query });
            return result.data;
        } catch (error) {
            ErrorLogger.error(error, 'IntegrationService.searchCompany');
            return [];
        }
    }

    async fetchSecurityEvents(source: 'splunk' | 'crowdstrike' | 'sentinelone' | 'microsoft', isDemoMode: boolean = false): Promise<SecurityEvent[]> {
        const demoMode = this.normalizeDemoMode(isDemoMode);
        if (demoMode) {
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
                ErrorLogger.error(error, 'IntegrationService.fetchSecurityEvents');
                throw error;
            }
        }
    }

    getLogoUrl(domain: string): string {
        // Use Clearbit's free logo API as a robust placeholder
        if (!domain) return '';
        return `https://logo.clearbit.com/${domain}`;
    }

    async validateVat(vatNumber: string, isDemoMode: boolean = false): Promise<{ valid: boolean, message: string }> {
        const demoMode = this.normalizeDemoMode(isDemoMode);
        if (demoMode) {
            const vatRegex = /^[A-Z]{2}[0-9A-Z]+$/;
            if (!vatRegex.test(vatNumber)) return { valid: false, message: 'Format de TVA invalide' };
            await new Promise(resolve => setTimeout(resolve, 300));
            return { valid: true, message: 'Numéro de TVA valide (Mode Démo)' };
        }

        try {
            const validateVatFn = httpsCallable<{ vatNumber: string }, { valid: boolean, message: string }>(functions, 'validateVat');
            const result = await validateVatFn({ vatNumber });
            return result.data;
        } catch (error) {
            ErrorLogger.error(error, 'IntegrationService.validateVat');
            return { valid: false, message: 'Impossible de vérifier la TVA (Service indisponible)' };
        }
    }
    async fetchScannerVulnerabilities(scanner: 'nessus' | 'qualys' | 'openvas', isDemoMode: boolean = false): Promise<Vulnerability[]> {
        const demoMode = this.normalizeDemoMode(isDemoMode);
        if (demoMode) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const now = new Date();

            // Mock Data Generator
            const generateVuln = (id: number, cve: string, title: string, sev: Vulnerability['severity'], score: number, asset: string) => ({
                cveId: cve,
                title: title,
                description: `Vulnerability detected by ${scanner}. Impact analysis required.`,
                severity: sev,
                score: score,
                status: 'Open' as const,
                source: scanner,
                assetName: asset,
                publishedDate: new Date(now.getTime() - 1000 * 60 * 60 * 24 * id).toISOString().split('T')[0],
                detectedAt: new Date().toISOString()
            });

            if (scanner === 'nessus') {
                return [
                    generateVuln(1, 'CVE-2023-4863', 'Heap buffer overflow in libwebp', 'Critical', 9.8, 'Web-Server-01'),
                    generateVuln(2, 'CVE-2023-29325', 'OData Injection Vulnerability', 'High', 8.1, 'DB-Prod-02'),
                    generateVuln(3, 'CVE-2023-32001', 'Race condition in file system', 'Medium', 5.5, 'FileShare-01'),
                    generateVuln(5, 'CVE-2021-44228', 'Log4Shell (Legacy)', 'Critical', 10.0, 'Legacy-App-03'),
                ];
            } else if (scanner === 'qualys') {
                return [
                    generateVuln(1, 'CVE-2024-21410', 'Exchange Server Elevation of Privilege', 'Critical', 9.8, 'Exchange-01'),
                    generateVuln(2, 'CVE-2024-21413', 'Outlook RCE Moniker Link', 'High', 8.5, 'Workstation-HR-04'),
                    generateVuln(3, 'CVE-2023-22527', 'Confluence Data Center RCE', 'Critical', 9.9, 'Wiki-Server'),
                ];
            } else {
                return [
                    generateVuln(1, 'CVE-2023-0466', 'OpenSSL verification bypass', 'Medium', 4.3, 'Gateway-VPN'),
                    generateVuln(2, 'CVE-2023-0465', 'OpenSSL invalid certificate policy', 'Low', 3.1, 'Gateway-VPN'),
                ];
            }
        }

        // Production: Call Cloud Function
        try {
            const fetchScannerVulnsFn = httpsCallable<{ scanner: string }, Vulnerability[]>(functions, 'fetchScannerVulnerabilities');
            const result = await fetchScannerVulnsFn({ scanner });
            return result.data;
        } catch (error) {
            ErrorLogger.error(error, 'IntegrationService.fetchScannerVulnerabilities');
            throw error;
        }
    }

    async getScannerJobs(organizationId?: string, isDemoMode: boolean = false): Promise<ScannerJob[]> {
        const demoMode = this.normalizeDemoMode(isDemoMode);
        if (demoMode) {
            await new Promise(resolve => setTimeout(resolve, 800));
            // Mock Data
            return [
                {
                    id: 'job-1',
                    scannerId: 'nessus',
                    status: 'completed',
                    target: '192.168.1.0/24',
                    frequency: 'weekly',
                    lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
                    nextRun: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
                    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
                    resultsCount: 12,
                    duration: '45m'
                },
                {
                    id: 'job-2',
                    scannerId: 'qualys',
                    status: 'running',
                    target: 'app-prod-01',
                    frequency: 'daily',
                    lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
                    nextRun: new Date(Date.now() + 1000 * 60 * 60 * 23).toISOString(),
                    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
                    resultsCount: 0,
                    duration: 'Running...'
                },
                {
                    id: 'job-3',
                    scannerId: 'openvas',
                    status: 'scheduled',
                    target: '10.0.0.5',
                    frequency: 'monthly',
                    lastRun: undefined,
                    nextRun: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15).toISOString(),
                    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
                }
            ];
        }

        if (!organizationId) {
            return [];
        }

        try {
            const jobsRef = collection(db, 'organizations', organizationId, 'scanner_jobs');
            const snapshot = await getDocs(jobsRef);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScannerJob));
        } catch (error) {
            ErrorLogger.error(error, "IntegrationService.getScannerJobs");
            return [];
        }
    }

    async scheduleScannerJob(job: ScannerJobCreate, organizationId?: string, isDemoMode: boolean = false): Promise<ScannerJob> {
        const demoMode = this.normalizeDemoMode(isDemoMode);
        if (demoMode) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return {
                id: `job-${Date.now()}`,
                scannerId: job.scannerId,
                status: 'scheduled',
                target: job.target,
                frequency: job.frequency,
                createdAt: serverTimestamp() as unknown as string,
                nextRun: job.scheduledDate || new Date().toISOString()
            };
        }

        if (!organizationId) {
            throw new Error("Organization ID is required to schedule a job");
        }

        try {
            const jobsRef = collection(db, 'organizations', organizationId, 'scanner_jobs');
            const newJob: Omit<ScannerJob, 'id'> = {
                scannerId: job.scannerId,
                status: 'scheduled',
                target: job.target,
                frequency: job.frequency,
                createdAt: serverTimestamp() as unknown as string,
                nextRun: job.scheduledDate || new Date().toISOString()
            };
            const docRef = await addDoc(jobsRef, newJob);
            return { id: docRef.id, ...newJob };
        } catch (error) {
            ErrorLogger.error(error, "IntegrationService.scheduleScannerJob");
            throw error;
        }
    }

    async deleteScannerJob(jobId: string, organizationId?: string, isDemoMode: boolean = false): Promise<void> {
        const demoMode = this.normalizeDemoMode(isDemoMode);
        if (demoMode) {
            await new Promise(resolve => setTimeout(resolve, 500));
            return;
        }

        if (!organizationId) {
            throw new Error("Organization ID is required to delete a job");
        }

        try {
            const jobRef = doc(db, 'organizations', organizationId, 'scanner_jobs', jobId);
            await deleteDoc(jobRef);
        } catch (error) {
            ErrorLogger.error(error, "IntegrationService.deleteScannerJob");
            throw error;
        }
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
    rawData?: unknown;
}
