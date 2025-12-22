
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { Threat, Vulnerability } from '../types';


interface CisaVulnerability {
    cveID: string;
    vendorProject: string;
    product: string;
    vulnerabilityName: string;
    dateAdded: string;
    shortDescription: string;
    requiredAction: string;
    dueDate: string;
    notes: string;
}

interface UrlHausEntry {
    id: string; // urlhaus_reference
    url: string;
    url_status: string;
    threat: string;
    tags: string[];
    date_added: string;
    reporter: string;
}

// MOCK DATA FOR ROBUST DEMO
const MOCK_THREATS: Partial<Threat>[] = [
    { title: 'Ransomware "BlackCat" Variant Detected', type: 'Ransomware', severity: 'Critical', country: 'United States', date: '2h ago', votes: 124, comments: 45, author: 'Sentinel Team', timestamp: Date.now(), coordinates: [-95.7129, 37.0902] },
    { title: 'Zero-day in popular CI/CD tool', type: 'Vulnerability', severity: 'High', country: 'Germany', date: '5h ago', votes: 89, comments: 12, author: 'Community', timestamp: Date.now() - 18000000, coordinates: [10.4515, 51.1657] },
    { title: 'Phishing Campaign targeting Finance', type: 'Phishing', severity: 'Medium', country: 'France', date: '1d ago', votes: 56, comments: 8, author: 'CyberAlliance', timestamp: Date.now() - 86400000, coordinates: [2.2137, 46.2276] },
    { title: 'DDoS attacks on Healthcare sector', type: 'DDoS', severity: 'High', country: 'India', date: '1d ago', votes: 230, comments: 67, author: 'Sentinel Team', timestamp: Date.now() - 90000000, coordinates: [78.9629, 20.5937] },
    { title: 'APT29 Spearphishing Campaign', type: 'APT', severity: 'Critical', country: 'Russia', date: '2d ago', votes: 412, comments: 12, author: 'ThreatHunter', timestamp: Date.now() - 172800000, coordinates: [105.3, 61.5] },
    { title: 'Lazarus Group Crypto Heist', type: 'APT', severity: 'Critical', country: 'North Korea', date: '3d ago', votes: 89, comments: 5, author: 'CryptoDef', timestamp: Date.now() - 259200000, coordinates: [127.5, 40.3] },
    { title: 'Industrial Control System Malware', type: 'Malware', severity: 'High', country: 'Iran', date: '4d ago', votes: 67, comments: 9, author: 'ICS-CERT', timestamp: Date.now() - 345600000, coordinates: [53.6, 32.4] },
    { title: 'Banking Trojan "Dridex" Resurgence', type: 'Malware', severity: 'High', country: 'United Kingdom', date: '5d ago', votes: 34, comments: 2, author: 'FinSec', timestamp: Date.now() - 432000000, coordinates: [-3.4, 55.3] },
    { title: 'Supply Chain Attack via NPM', type: 'Vulnerability', severity: 'Critical', country: 'Netherlands', date: '6d ago', votes: 156, comments: 23, author: 'AppSec', timestamp: Date.now() - 518400000, coordinates: [5.2, 52.1] },
    { title: 'Cloud Bucket Data Leak', type: 'Data Leak', severity: 'Medium', country: 'Brazil', date: '1w ago', votes: 21, comments: 1, author: 'CloudWatch', timestamp: Date.now() - 604800000, coordinates: [-51.9, -14.2] },
    { title: 'Espionage targeting Energy Sector', type: 'APT', severity: 'High', country: 'Saudi Arabia', date: '1w ago', votes: 78, comments: 4, author: 'EnergyShield', timestamp: Date.now() - 650000000, coordinates: [45.0, 23.8] },
    { title: 'Mobile Spyware "Pegasus" Indicators', type: 'Malware', severity: 'Critical', country: 'Israel', date: '1w ago', votes: 345, comments: 89, author: 'CitizenLab', timestamp: Date.now() - 700000000, coordinates: [34.8, 31.0] },
    { title: 'Ransomware "LockBit 3.0" New TTPs', type: 'Ransomware', severity: 'Critical', country: 'China', date: '2w ago', votes: 231, comments: 15, author: 'MalwareAnalysis', timestamp: Date.now() - 1209600000, coordinates: [104.1, 35.8] },
    { title: 'SQL Injection in popular CMS', type: 'Vulnerability', severity: 'Medium', country: 'United States', date: '2w ago', votes: 45, comments: 3, author: 'WebSec', timestamp: Date.now() - 1250000000, coordinates: [-98.0, 38.0] },
    { title: 'IoT Botnet "Mirai" activity spike', type: 'Botnet', severity: 'Medium', country: 'Japan', date: '3w ago', votes: 12, comments: 0, author: 'NetOps', timestamp: Date.now() - 1814400000, coordinates: [138.2, 36.2] },
    { title: 'Telecom Infrastructure Attack', type: 'DDoS', severity: 'High', country: 'Australia', date: '3w ago', votes: 56, comments: 7, author: 'TelcoDef', timestamp: Date.now() - 1900000000, coordinates: [133.7, -25.2] },
    { title: 'Fake Windows Update Malware', type: 'Malware', severity: 'Medium', country: 'Canada', date: '1mo ago', votes: 23, comments: 1, author: 'SysAdmin', timestamp: Date.now() - 2592000000, coordinates: [-106.3, 56.1] },
    { title: 'Cryptojacking Campaign "LemonDuck"', type: 'Malware', severity: 'Low', country: 'South Korea', date: '1mo ago', votes: 11, comments: 0, author: 'MinerFind', timestamp: Date.now() - 2650000000, coordinates: [127.7, 35.9] }
];

export class ThreatFeedService {

    /**
     * Helper to fetch with proxy failover
     */
    private static async fetchWithFailover(targetUrl: string): Promise<any> {
        const proxies = [
            (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
            (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
            (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`
        ];

        for (const proxy of proxies) {
            try {
                const url = proxy(targetUrl);
                const response = await fetch(url);
                if (response.ok) return await response.json();
            } catch (e) {
                console.warn(`Proxy failed, trying next...`);
            }
        }
        throw new Error("All proxies failed");
    }

    /**
     * Fetch CISA Known Exploited Vulnerabilities
     * Returns a list of Vulnerability objects mapped from the feed
     */
    static async fetchCisaKev(): Promise<Vulnerability[]> {
        try {
            const data = await this.fetchWithFailover('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
            const vulnerabilities: CisaVulnerability[] = data.vulnerabilities || [];

            return vulnerabilities.slice(0, 50).map(v => ({
                cveId: v.cveID,
                title: `${v.vendorProject} ${v.product}: ${v.vulnerabilityName}`,
                description: v.shortDescription,
                severity: 'High',
                source: 'CISA KEV',
                publishedDate: v.dateAdded,
                status: 'Open',
                remediationPlan: v.requiredAction
            }));

        } catch (error) {
            console.warn("Failed to fetch CISA KEV:", error);
            return [];
        }
    }

    /**
     * Fetch URLhaus Recent Malicious URLs
     * Returns a list of Threat objects mapped from the feed
     */
    static async fetchUrlHaus(): Promise<Threat[]> {
        try {
            const data = await this.fetchWithFailover('https://urlhaus-api.abuse.ch/v1/urls/recent/');
            const urls: UrlHausEntry[] = data.urls || [];

            return urls.slice(0, 50).map(u => ({
                id: `urlhaus-${u.id}`,
                title: `Malicious URL: ${u.threat} (${u.tags?.[0] || 'Malware'})`,
                type: 'Malicious URL',
                severity: 'Medium',
                country: 'Unknown',
                date: u.date_added,
                votes: 0,
                comments: 0,
                author: 'URLhaus',
                active: u.url_status === 'online',
                timestamp: new Date(u.date_added).getTime(),
                coordinates: [(Math.random() * 360) - 180, (Math.random() * 160) - 80]
            }));

        } catch (error) {
            console.warn("Failed to fetch URLhaus:", error);
            return [];
        }
    }

    /**
     * Seed the database with LIVE data only.
     * STRICT PRODUCTION BEHAVIOR: No mock fallbacks.
     */
    static async seedLiveThreats(organizationId: string): Promise<{ threats: number, vulns: number }> {
        let liveThreats: Threat[] = [];
        let liveVulns: Vulnerability[] = [];

        try {
            [liveThreats, liveVulns] = await Promise.all([
                this.fetchUrlHaus(),
                this.fetchCisaKev()
            ]);
        } catch (e) {
            console.error("Critical failure fetching live feeds:", e);
            throw new Error("Impossible de récupérer les flux de menaces en temps réel.");
        }

        let threatsAdded = 0;
        let vulnsAdded = 0;

        // Process Vulnerabilities
        for (const v of liveVulns) {
            const q = query(collection(db, 'vulnerabilities'),
                where('cveId', '==', v.cveId),
                where('organizationId', '==', organizationId)
            );
            const snap = await getDocs(q);

            if (snap.empty) {
                await addDoc(collection(db, 'vulnerabilities'), {
                    ...v,
                    organizationId,
                    createdAt: new Date().toISOString()
                });
                vulnsAdded++;
            }
        }

        // Process Threats
        for (const t of liveThreats) {
            // Check based on unique ID from source
            const q = query(collection(db, 'threats'), where('id', '==', t.id));
            const snap = await getDocs(q);

            if (snap.empty) {
                await addDoc(collection(db, 'threats'), {
                    ...t,
                    votes: 0,
                    comments: 0,
                    createdAt: new Date().toISOString()
                });
                threatsAdded++;
            }
        }

        return { threats: threatsAdded, vulns: vulnsAdded };
    }

    /**
     * Inject Demo Data MANUALLY.
     * This is strictly for demonstration/testing purposes.
     */
    static async seedSimulatedData(organizationId: string): Promise<{ threats: number }> {
        const mockThreats = MOCK_THREATS.map((t, index) => ({
            id: `simulated-${index}-${Date.now()}`,
            ...t,
            active: true,
            organizationId: organizationId || 'demo-system' // Use the passed ID or fallback
        } as Threat));

        let threatsAdded = 0;

        for (const t of mockThreats) {
            await addDoc(collection(db, 'threats'), {
                ...t,
                createdAt: new Date().toISOString()
            });
            threatsAdded++;
        }

        return { threats: threatsAdded };
    }
}
