
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { Threat, Vulnerability } from '../types';

const CISA_KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const URLHAUS_API_URL = 'https://urlhaus-api.abuse.ch/v1/urls/recent/';

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

export class ThreatFeedService {

    /**
     * Fetch CISA Known Exploited Vulnerabilities
     * Returns a list of Vulnerability objects mapped from the feed
     */
    static async fetchCisaKev(): Promise<Vulnerability[]> {
        try {
            const response = await fetch(CISA_KEV_URL);
            if (!response.ok) throw new Error(`CISA Feed Error: ${response.statusText}`);

            const data = await response.json();
            const vulnerabilities: CisaVulnerability[] = data.vulnerabilities || [];

            // Return top 20 most recent to avoid spam
            return vulnerabilities.slice(0, 50).map(v => ({
                cveId: v.cveID,
                title: `${v.vendorProject} ${v.product}: ${v.vulnerabilityName}`,
                description: v.shortDescription,
                severity: 'High', // CISA KEV are by definition exploited, so High/Critical
                source: 'CISA KEV',
                publishedDate: v.dateAdded,
                status: 'Open',
                remediationPlan: v.requiredAction
            }));

        } catch (error) {
            console.error("Failed to fetch CISA KEV:", error);
            return [];
        }
    }

    /**
     * Fetch URLhaus Recent Malicious URLs
     * Returns a list of Threat objects mapped from the feed
     */
    static async fetchUrlHaus(): Promise<Threat[]> {
        try {
            // URLHaus doesn't always support CORS for browser fetch directly, 
            // but we'll try or assume a proxy is available in production.
            // If CORS fails, we might need a workaround or backend function.
            // For now, implementing standard fetch.
            const response = await fetch(URLHAUS_API_URL, {
                method: 'GET',
                // mode: 'cors' // Implicit
            });

            if (!response.ok) throw new Error(`URLhaus Error: ${response.statusText}`);

            const data = await response.json();
            const urls: UrlHausEntry[] = data.urls || [];

            return urls.slice(0, 50).map(u => ({
                id: `urlhaus-${u.id}`,
                title: `Malicious URL: ${u.threat} (${u.tags?.[0] || 'Malware'})`,
                type: 'Malicious URL',
                severity: 'Medium',
                country: 'Unknown', // URLhaus has distinct geo API, base list might not have it
                date: u.date_added,
                votes: 0,
                comments: 0,
                author: 'URLhaus',
                active: u.url_status === 'online',
                timestamp: new Date(u.date_added).getTime(),
                coordinates: [0, 0] // No geo in simple list
            }));

        } catch (error) {
            console.error("Failed to fetch URLhaus:", error);
            return [];
        }
    }

    /**
     * Seed the database with fetched data
     * Checks for duplicates before inserting
     */
    static async seedThreatsAndVulnerabilities(organizationId: string): Promise<{ threats: number, vulns: number }> {
        const vulns = await this.fetchCisaKev();
        let threats = await this.fetchUrlHaus();

        // Fallback or Baseline Data (Moved from View)
        const INITIAL_THREATS: Partial<Threat>[] = [
            { title: 'Ransomware "BlackCat" Variant Detected', type: 'Ransomware', severity: 'Critical', country: 'United States', date: '2h ago', votes: 124, comments: 45, author: 'Sentinel Team', timestamp: Date.now() },
            { title: 'Zero-day in popular CI/CD tool', type: 'Vulnerability', severity: 'High', country: 'Germany', date: '5h ago', votes: 89, comments: 12, author: 'Community', timestamp: Date.now() - 18000000 },
            { title: 'Phishing Campaign targeting Finance', type: 'Phishing', severity: 'Medium', country: 'France', date: '1d ago', votes: 56, comments: 8, author: 'CyberAlliance', timestamp: Date.now() - 86400000 },
            { title: 'DDoS attacks on Healthcare sector', type: 'DDoS', severity: 'High', country: 'India', date: '1d ago', votes: 230, comments: 67, author: 'Sentinel Team', timestamp: Date.now() - 90000000 },
        ];

        // Combine fetched threats with initial baseline if needed
        // For demo stability, we always want the baseline 4 to appear
        const baselineThreats = INITIAL_THREATS.map((t, index) => ({
            id: `baseline-${index}`,
            ...t,
            active: true,
            coordinates: [0, 0] // Will be enriched below
        } as Threat));

        threats = [...baselineThreats, ...threats];

        let threatsAdded = 0;
        let vulnsAdded = 0;

        // 1. Process Vulnerabilities
        // Strategy: We want global vulnerabilities potentially, but here we attach them to the org
        // allowing the org to see them.
        for (const v of vulns) {
            // Check existence
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

        // 2. Process Threats
        for (const t of threats) {
            const q = query(collection(db, 'threats'),
                where('title', '==', t.title),
                where('author', '==', t.author) // rudimentary duplication check
            );
            const snap = await getDocs(q);

            if (snap.empty) {
                // Geo enrichment (basic random for visualization if missing)
                if (t.coordinates && t.coordinates[0] === 0) {
                    // deterministic "random" based on title length for stability? 
                    // No, random is fine for coverage in demo.
                    t.coordinates = [
                        (Math.random() * 360) - 180, // Long
                        (Math.random() * 160) - 80   // Lat
                    ];
                }

                await addDoc(collection(db, 'threats'), {
                    ...t,
                    // Ensure all required fields
                    votes: t.votes || 0,
                    comments: t.comments || 0,
                    createdAt: new Date().toISOString()
                });
                threatsAdded++;
            }
        }

        return { threats: threatsAdded, vulns: vulnsAdded };
    }
}
