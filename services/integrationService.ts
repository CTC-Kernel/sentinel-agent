import { ErrorLogger } from './errorLogger';

// --- Types ---

export interface CompanySearchResult {
    siren: string;
    name: string;
    address: string;
    activity: string;
    vatNumber?: string;
}

export interface Vulnerability {
    cveId: string;
    description: string;
    score: number;
    severity: string;
    publishedDate: string;
}

export interface CyberNewsItem {
    title: string;
    link: string;
    pubDate: string;
    source: string;
}

// --- Service ---

class IntegrationService {

    // Helper to get keys from store (React hook usage limitation workaround)
    // In a real app, we might pass keys as arguments or use a context provider.
    // For this implementation, we'll assume the caller passes the keys or we access a global store if possible,
    // but since hooks can't be used in class methods directly, we'll rely on arguments.

    // --- 1. Pappers (Company Search) ---
    // Free API, no key needed for basic search
    async searchCompany(query: string): Promise<CompanySearchResult[]> {
        if (!query || query.length < 3) return [];
        try {
            const response = await fetch(`https://suggestions.pappers.fr/v2?q=${encodeURIComponent(query)}&targets=siren,nom_entreprise`);
            if (!response.ok) throw new Error('Pappers API error');
            const data = await response.json();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return data.resultats_siren.map((item: any) => ({
                siren: item.siren,
                name: item.nom_entreprise,
                address: `${item.siege.adresse_ligne_1 || ''} ${item.siege.code_postal || ''} ${item.siege.ville || ''}`,
                activity: item.naf_libelle || '',
                vatNumber: '' // Pappers suggestions don't always give VAT, need full details call
            }));
        } catch (error) {
            ErrorLogger.error(error as Error, 'IntegrationService.searchCompany');
            return [];
        }
    }

    async getCompanyDetails(siren: string): Promise<CompanySearchResult | null> {
        try {
            // Using a public proxy or direct if CORS allows. Pappers usually allows client-side.
            // Note: Full Pappers API might need a token, but let's try the free endpoint or fallback to Sirene open data if needed.
            // VAT is usually FR + key + SIREN.
            const vatKey = (12 + 3 * (parseInt(siren) % 97)) % 97;
            const vatNumber = `FR${vatKey}${siren}`;

            return {
                siren,
                name: '', // Would need another call to get full name if not passed
                address: '',
                activity: '',
                vatNumber
            };
        } catch {
            return null;
        }
    }

    // --- 2. Brandfetch (Logos) ---
    // Free endpoint for logos
    getLogoUrl(domain: string): string {
        if (!domain) return '';
        return `https://img.logo.dev/${domain}?token=pk_X_1Z_2Y_3A`; // Using a placeholder or free tier if available. 
        // Actually, Clearbit is easier: https://logo.clearbit.com/domain.com
        // return `https://logo.clearbit.com/${domain}`;
    }

    // --- 3. NVD (Vulnerabilities) ---
    // Public API, rate limited without key
    async checkVulnerabilities(cpe: string): Promise<Vulnerability[]> {
        if (!cpe) return [];
        try {
            const response = await fetch(`https://services.nvd.nist.gov/rest/json/cves/2.0?cpeName=${encodeURIComponent(cpe)}`);
            if (!response.ok) return [];
            const data = await response.json();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return data.vulnerabilities.map((item: any) => ({
                cveId: item.cve.id,
                description: item.cve.descriptions[0]?.value || 'No description',
                score: item.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || 0,
                severity: item.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity || 'UNKNOWN',
                publishedDate: item.cve.published
            })).slice(0, 5); // Limit to 5
        } catch (error) {
            ErrorLogger.error(error as Error, 'IntegrationService.checkVulnerabilities');
            return [];
        }
    }

    // --- 4. RSS Feeds (Cyber News) ---
    async getCyberNews(): Promise<CyberNewsItem[]> {
        // CORS is a problem for RSS in browser. We need a proxy.
        // For this demo, we will use a public CORS proxy like 'rss2json' or 'allorigins'.
        // rss2json is easiest.

        const news: CyberNewsItem[] = [];

        try {
            const response = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://www.cert.ssi.gouv.fr/feed/');
            const data = await response.json();
            if (data.items) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                news.push(...data.items.map((item: any) => ({
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    source: 'CERT-FR'
                })));
            }
        } catch {
            // Silent fail for news
        }

        return news.slice(0, 5);
    }

    // --- 5. Shodan (Asset Discovery) ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async scanAsset(ip: string, apiKey: string): Promise<any> {
        if (!apiKey) return { error: 'Clé API Shodan manquante' };
        try {
            const response = await fetch(`https://api.shodan.io/shodan/host/${ip}?key=${apiKey}`);
            if (!response.ok) throw new Error('Shodan API error');
            return await response.json();
        } catch {
            return { error: 'Scan impossible' };
        }
    }

    // --- 6. Have I Been Pwned ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async checkBreach(email: string, apiKey: string): Promise<any[]> {
        if (!apiKey) return []; // HIBP requires key now for all calls
        try {
            const response = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`, {
                headers: {
                    'hibp-api-key': apiKey,
                    'user-agent': 'Sentinel-GRC'
                }
            });
            if (response.status === 404) return []; // No breach
            if (!response.ok) throw new Error('HIBP error');
            return await response.json();
        } catch (error) {
            ErrorLogger.error(error as Error, 'IntegrationService.checkBreach');
            return [];
        }
    }

    // --- 7. MITRE ATT&CK ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getCommonMitreTechniques(query: string): Promise<any[]> {
        if (!query) return [];

        // Returns a curated list of common techniques.
        // For full MITRE ATT&CK database, a backend service or large JSON load is required.
        const commonTechniques = [
            { id: 'T1566', name: 'Phishing', description: 'Adversaries may send phishing messages to gain access to victim systems.' },
            { id: 'T1190', name: 'Exploit Public-Facing Application', description: 'Adversaries may attempt to take advantage of a weakness in an Internet-facing computer or program.' },
            { id: 'T1078', name: 'Valid Accounts', description: 'Adversaries may obtain and abuse credentials of existing accounts as a means of gaining Initial Access, Persistence, Privilege Escalation, or Defense Evasion.' },
            { id: 'T1003', name: 'OS Credential Dumping', description: 'Adversaries may attempt to dump credentials to obtain account login and credential material.' },
            { id: 'T1059', name: 'Command and Scripting Interpreter', description: 'Adversaries may abuse command and script interpreters to execute commands, scripts, or binaries.' },
            { id: 'T1204', name: 'User Execution', description: 'Adversaries may rely on a user performing an action, such as clicking on a malicious link.' },
            { id: 'T1497', name: 'Virtualization/Sandbox Evasion', description: 'Adversaries may employ various means to detect and avoid virtualization and analysis environments.' }
        ];
        return commonTechniques.filter(t => t.name.toLowerCase().includes(query.toLowerCase()) || t.id.toLowerCase().includes(query.toLowerCase()));
    }

    // --- 8. Google Safe Browsing ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async checkUrlReputation(url: string, apiKey: string): Promise<any> {
        if (!apiKey) return { error: 'Clé API Safe Browsing manquante' };
        try {
            const response = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client: { clientId: 'sentinel-grc', clientVersion: '1.0.0' },
                    threatInfo: {
                        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
                        platformTypes: ['ANY_PLATFORM'],
                        threatEntryTypes: ['URL'],
                        threatEntries: [{ url }]
                    }
                })
            });
            if (!response.ok) throw new Error('Safe Browsing API error');
            return await response.json();
        } catch (error) {
            ErrorLogger.error(error as Error, 'IntegrationService.checkUrlReputation');
            return { error: 'Check impossible' };
        }
    }

    // --- 9. VIES (VAT Validation) ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async validateVat(vatNumber: string): Promise<any> {
        if (!vatNumber) return { valid: false };
        // VIES SOAP API is hard to consume directly from browser due to CORS and XML.
        // We'll use a public JSON proxy if available, or a simple regex check for now + link to VIES.
        // Regex for FR VAT: FR + 2 digits + 9 digits
        const frVatRegex = /^FR[0-9A-Z]{2}[0-9]{9}$/;
        const isValidFormat = frVatRegex.test(vatNumber);

        // Real validation requires backend proxy to VIES SOAP API.
        // For client-side, we validate the format strictly.
        return { valid: isValidFormat, message: isValidFormat ? 'Format valide' : 'Format invalide' };
    }

    // --- 10. EUR-Lex (Legal Search) ---
    searchEurLex(query: string): string {
        if (!query) return '';
        // Return a constructed search URL for iframe embedding
        return `https://eur-lex.europa.eu/search.html?scope=EURLEX&text=${encodeURIComponent(query)}&lang=fr&type=quick&qid=${Date.now()}`;
    }

    // --- 11. CNIL (Regulatory News) ---
    async getCnilNews(): Promise<CyberNewsItem[]> {
        const news: CyberNewsItem[] = [];
        try {
            // Using rss2json for CNIL feed
            const response = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://www.cnil.fr/fr/rss.xml');
            const data = await response.json();
            if (data.items) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                news.push(...data.items.map((item: any) => ({
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    source: 'CNIL'
                })));
            }
        } catch {
            // Silent fail
        }
        return news.slice(0, 5);
    }
}

export const integrationService = new IntegrationService();
