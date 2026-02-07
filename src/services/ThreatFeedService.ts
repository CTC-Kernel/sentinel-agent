import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { sanitizeData } from '../utils/dataSanitizer';
import { Threat, Vulnerability } from '../types';
import { ErrorLogger } from './errorLogger';

const fetchThreatFeed = httpsCallable(functions, 'fetchThreatFeed');

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
 id: string;
 url: string;
 url_status: string;
 threat: string;
 tags: string[];
 date_added: string;
 reporter: string;
}

// Time helpers
const HOUR = 3600000;
const DAY = 86400000;

function buildMockThreats(): Partial<Threat>[] {
 const now = Date.now();
 return [
  // --- Critical / Recent ---
  {
   title: 'Ransomware "BlackCat/ALPHV" Variant Detected',
   type: 'Ransomware',
   severity: 'Critical',
   country: 'United States',
   date: '1h ago',
   votes: 247,
   comments: 58,
   author: 'CISA',
   description: 'New variant of ALPHV/BlackCat ransomware exploiting VMware ESXi vulnerabilities (CVE-2024-37085). Healthcare and critical infrastructure targeted. Triple extortion model confirmed.',
   timestamp: now - 1 * HOUR,
   coordinates: [-95.71, 37.09],
   source: 'CISA',
   verified: true,
   active: true,
  },
  {
   title: 'APT29 (Cozy Bear) Spearphishing Campaign',
   type: 'APT',
   severity: 'Critical',
   country: 'Germany',
   date: '2h ago',
   votes: 412,
   comments: 34,
   author: 'ANSSI',
   description: 'Coordinated spearphishing campaign attributed to APT29 targeting European diplomatic institutions. Utilizes Microsoft Teams as initial vector with ROOTSAW dropper.',
   timestamp: now - 2 * HOUR,
   coordinates: [10.45, 51.17],
   source: 'ANSSI',
   verified: true,
   active: true,
  },
  {
   title: 'Zero-Day RCE in Confluence Server (CVE-2024-21683)',
   type: 'Vulnerability',
   severity: 'Critical',
   country: 'Australia',
   date: '3h ago',
   votes: 189,
   comments: 42,
   author: 'CERT-AU',
   description: 'Critical remote code execution vulnerability in Atlassian Confluence Server. Active exploitation observed in the wild. CVSS 9.8. Immediate patching required.',
   timestamp: now - 3 * HOUR,
   coordinates: [133.77, -25.27],
   source: 'CERT-AU',
   verified: true,
   active: true,
  },
  {
   title: 'LockBit 4.0 Ransomware-as-a-Service Launch',
   type: 'Ransomware',
   severity: 'Critical',
   country: 'Russia',
   date: '4h ago',
   votes: 356,
   comments: 67,
   author: 'Europol',
   description: 'LockBit group has launched version 4.0 of their RaaS platform despite law enforcement disruption. New encryption algorithm and affiliate program detected. Financial sector primary target.',
   timestamp: now - 4 * HOUR,
   coordinates: [37.62, 55.75],
   source: 'Europol',
   verified: true,
   active: true,
  },
  {
   title: 'Volt Typhoon Infrastructure Compromise',
   type: 'APT',
   severity: 'Critical',
   country: 'United States',
   date: '5h ago',
   votes: 523,
   comments: 89,
   author: 'FBI',
   description: 'Ongoing campaign by Volt Typhoon (China-nexus) targeting US critical infrastructure. Living-off-the-land techniques used to maintain persistence in telecom and energy sectors.',
   timestamp: now - 5 * HOUR,
   coordinates: [-77.04, 38.91],
   source: 'FBI',
   verified: true,
   active: true,
  },
  // --- High / Same day ---
  {
   title: 'Supply Chain Attack via PyPI Package "ultrasqlite"',
   type: 'Vulnerability',
   severity: 'High',
   country: 'Netherlands',
   date: '6h ago',
   votes: 167,
   comments: 23,
   author: 'Community',
   description: 'Malicious PyPI package "ultrasqlite" discovered with backdoor targeting CI/CD pipelines. Exfiltrates environment variables and SSH keys. 45,000+ downloads before removal.',
   timestamp: now - 6 * HOUR,
   coordinates: [5.29, 52.13],
   source: 'Community',
   verified: false,
   active: true,
  },
  {
   title: 'DDoS Campaign Against Financial Institutions',
   type: 'DDoS',
   severity: 'High',
   country: 'France',
   date: '8h ago',
   votes: 198,
   comments: 31,
   author: 'CERT-FR',
   description: 'Coordinated DDoS attacks exceeding 1.5 Tbps targeting major French financial institutions. NoName057(16) hacktivist group claimed responsibility. Application-layer attacks with HTTP/2 Rapid Reset.',
   timestamp: now - 8 * HOUR,
   coordinates: [2.35, 48.86],
   source: 'CERT-FR',
   verified: true,
   active: true,
  },
  {
   title: 'Phishing Campaign Targeting Microsoft 365 Admins',
   type: 'Phishing',
   severity: 'High',
   country: 'United Kingdom',
   date: '10h ago',
   votes: 134,
   comments: 19,
   author: 'NCSC-UK',
   description: 'Sophisticated phishing campaign using adversary-in-the-middle (AitM) technique to bypass MFA. Targets Microsoft 365 global administrators via fake Azure AD login pages.',
   timestamp: now - 10 * HOUR,
   coordinates: [-0.12, 51.51],
   source: 'NCSC-UK',
   verified: true,
   active: true,
  },
  {
   title: 'Industrial Control System Malware "FrostyGoop"',
   type: 'Malware',
   severity: 'High',
   country: 'Ukraine',
   date: '12h ago',
   votes: 89,
   comments: 15,
   author: 'ICS-CERT',
   description: 'New ICS-specific malware targeting Modbus TCP/IP devices. Capable of disrupting heating systems and SCADA networks. First deployed against Ukrainian energy infrastructure.',
   timestamp: now - 12 * HOUR,
   coordinates: [30.52, 50.45],
   source: 'ICS-CERT',
   verified: true,
   active: true,
  },
  {
   title: 'Lazarus Group Cryptocurrency Exchange Heist',
   type: 'APT',
   severity: 'Critical',
   country: 'Japan',
   date: '14h ago',
   votes: 278,
   comments: 45,
   author: 'JPCERT',
   description: 'Lazarus Group (DPRK) confirmed behind $235M cryptocurrency exchange breach. Social engineering of exchange employees via fake job offers on LinkedIn led to initial compromise.',
   timestamp: now - 14 * HOUR,
   coordinates: [139.69, 35.69],
   source: 'JPCERT',
   verified: true,
   active: true,
  },
  // --- 1 day ago ---
  {
   title: 'Banking Trojan "Grandoreiro" Global Campaign',
   type: 'Malware',
   severity: 'High',
   country: 'Brazil',
   date: '1d ago',
   votes: 145,
   comments: 22,
   author: 'CERT-BR',
   description: 'Grandoreiro banking trojan resurgence after law enforcement takedown. New variant targets 1,500+ financial institutions across 60 countries. Distributed via tax-themed phishing emails.',
   timestamp: now - 1 * DAY,
   coordinates: [-47.93, -15.78],
   source: 'CERT-BR',
   verified: true,
   active: true,
  },
  {
   title: 'Cloud Storage Misconfiguration Exposing Patient Data',
   type: 'Data Leak',
   severity: 'High',
   country: 'India',
   date: '1d ago',
   votes: 67,
   comments: 8,
   author: 'Community',
   description: 'Exposed Azure Blob Storage containing 12M+ patient records from healthcare provider. Data includes PII, medical records, and insurance details. CERT-In notified.',
   timestamp: now - 1.2 * DAY,
   coordinates: [77.21, 28.61],
   source: 'Community',
   verified: false,
   active: true,
  },
  {
   title: 'Akira Ransomware Targeting VMware ESXi',
   type: 'Ransomware',
   severity: 'Critical',
   country: 'Canada',
   date: '1d ago',
   votes: 198,
   comments: 34,
   author: 'CCCS',
   description: 'Akira ransomware group actively exploiting VMware ESXi hypervisors via compromised VPN credentials. Linux variant encrypts virtual machines directly. $42M in ransoms collected in 2024.',
   timestamp: now - 1.5 * DAY,
   coordinates: [-75.70, 45.42],
   source: 'CCCS',
   verified: true,
   active: true,
  },
  // --- 2 days ago ---
  {
   title: 'Mobile Spyware "Predator" Campaign Against Journalists',
   type: 'Malware',
   severity: 'Critical',
   country: 'Israel',
   date: '2d ago',
   votes: 389,
   comments: 72,
   author: 'CitizenLab',
   description: 'Intellexa "Predator" spyware deployed against journalists and opposition figures across EU member states. Zero-click exploit chain targeting iOS and Android. Circumvents latest OS protections.',
   timestamp: now - 2 * DAY,
   coordinates: [34.78, 32.08],
   source: 'Community',
   verified: true,
   active: true,
  },
  {
   title: 'Credential Stuffing Attack on SaaS Platforms',
   type: 'Phishing',
   severity: 'Medium',
   country: 'United States',
   date: '2d ago',
   votes: 78,
   comments: 12,
   author: 'Community',
   description: 'Massive credential stuffing campaign targeting SaaS platforms using credentials from recent breaches. Over 2M unique credential pairs tested. Snowflake, Okta, and ServiceNow targeted.',
   timestamp: now - 2.3 * DAY,
   coordinates: [-122.42, 37.77],
   source: 'Community',
   verified: false,
   active: true,
  },
  {
   title: 'Espionage Campaign Targeting Energy Sector',
   type: 'APT',
   severity: 'High',
   country: 'Saudi Arabia',
   date: '2d ago',
   votes: 112,
   comments: 9,
   author: 'NCSC-SA',
   description: 'State-sponsored espionage campaign targeting Gulf energy companies. Custom implant "SandStrike" found in OT networks. Initial access via compromised contractor VPN accounts.',
   timestamp: now - 2.5 * DAY,
   coordinates: [46.68, 24.71],
   source: 'NCSC-SA',
   verified: true,
   active: true,
  },
  // --- 3-4 days ago ---
  {
   title: 'QakBot Resurrection via DarkGate Loader',
   type: 'Malware',
   severity: 'High',
   country: 'Germany',
   date: '3d ago',
   votes: 156,
   comments: 28,
   author: 'BSI',
   description: 'QakBot infrastructure resurrected using DarkGate malware loader. Distributed via phishing emails with OneNote and PDF attachments. Initial access broker activity detected.',
   timestamp: now - 3 * DAY,
   coordinates: [13.40, 52.52],
   source: 'BSI',
   verified: true,
   active: true,
  },
  {
   title: 'Telecom Infrastructure SS7 Exploitation',
   type: 'DDoS',
   severity: 'High',
   country: 'South Africa',
   date: '3d ago',
   votes: 67,
   comments: 5,
   author: 'Community',
   description: 'SS7 protocol exploitation detected on Southern African telecom networks. Attackers intercepting SMS-based 2FA codes for banking fraud. Multiple operators affected.',
   timestamp: now - 3.5 * DAY,
   coordinates: [28.03, -26.20],
   source: 'Community',
   verified: false,
   active: true,
  },
  {
   title: 'WordPress Plugin Supply Chain Compromise',
   type: 'Vulnerability',
   severity: 'High',
   country: 'United States',
   date: '4d ago',
   votes: 234,
   comments: 41,
   author: 'Wordfence',
   description: 'Five popular WordPress plugins compromised via developer account takeover. Malicious code injected to create administrator accounts. 35,000+ active installations affected.',
   timestamp: now - 4 * DAY,
   coordinates: [-96.80, 32.78],
   source: 'Community',
   verified: true,
   active: true,
  },
  // --- 5-7 days ago ---
  {
   title: 'IoT Botnet "InfectedSlurs" Targeting Cameras',
   type: 'Botnet',
   severity: 'Medium',
   country: 'China',
   date: '5d ago',
   votes: 89,
   comments: 7,
   author: 'Akamai SIRT',
   description: 'Mirai-based botnet "InfectedSlurs" exploiting zero-day vulnerabilities in network cameras and NVR devices. Used for large-scale DDoS attacks. 60,000+ compromised devices identified.',
   timestamp: now - 5 * DAY,
   coordinates: [116.40, 39.90],
   source: 'Community',
   verified: true,
   active: true,
  },
  {
   title: 'SEO Poisoning Campaign Distributing Gootloader',
   type: 'Malware',
   severity: 'Medium',
   country: 'France',
   date: '5d ago',
   votes: 45,
   comments: 6,
   author: 'CERT-FR',
   description: 'SEO poisoning campaign using compromised WordPress sites to distribute Gootloader malware. Targets French-language legal and financial document searches. Multi-stage JavaScript payload.',
   timestamp: now - 5.5 * DAY,
   coordinates: [4.83, 45.76],
   source: 'CERT-FR',
   verified: true,
   active: true,
  },
  {
   title: 'Cryptojacking Campaign "PurpleFox" Evolution',
   type: 'Malware',
   severity: 'Medium',
   country: 'South Korea',
   date: '6d ago',
   votes: 34,
   comments: 3,
   author: 'KrCERT',
   description: 'PurpleFox rootkit evolved with new cryptojacking module targeting enterprise SQL servers. Worm-like propagation via SMB. Mining Monero on compromised systems.',
   timestamp: now - 6 * DAY,
   coordinates: [126.98, 37.57],
   source: 'KrCERT',
   verified: true,
   active: true,
  },
  {
   title: 'Fake AI Tool Websites Distributing Lumma Stealer',
   type: 'Phishing',
   severity: 'Medium',
   country: 'Italy',
   date: '6d ago',
   votes: 56,
   comments: 11,
   author: 'Community',
   description: 'Network of fake AI tool websites (image generators, chatbots) distributing Lumma information stealer. Steals browser credentials, crypto wallets, and session tokens. 200+ domains identified.',
   timestamp: now - 6.5 * DAY,
   coordinates: [12.50, 41.89],
   source: 'Community',
   verified: false,
   active: true,
  },
  {
   title: 'SQL Injection Targeting Government Portals',
   type: 'Vulnerability',
   severity: 'Medium',
   country: 'Spain',
   date: '1w ago',
   votes: 43,
   comments: 4,
   author: 'CCN-CERT',
   description: 'Automated SQL injection attacks targeting public-facing government web portals. Exploiting unpatched CMS installations. Data exfiltration of citizen records attempted.',
   timestamp: now - 7 * DAY,
   coordinates: [-3.70, 40.42],
   source: 'CCN-CERT',
   verified: true,
   active: true,
  },
  // --- 1-2 weeks ago ---
  {
   title: 'SIM Swapping Ring Targeting Crypto Holders',
   type: 'Phishing',
   severity: 'High',
   country: 'United States',
   date: '1w ago',
   votes: 167,
   comments: 29,
   author: 'FBI',
   description: 'Organized SIM swapping ring targeting high-net-worth cryptocurrency holders. Social engineering telecom employees to port phone numbers. $48M stolen in Q4.',
   timestamp: now - 8 * DAY,
   coordinates: [-118.24, 34.05],
   source: 'FBI',
   verified: true,
   active: true,
  },
  {
   title: 'Ransomware Attack on Port Infrastructure',
   type: 'Ransomware',
   severity: 'Critical',
   country: 'Japan',
   date: '1w ago',
   votes: 201,
   comments: 36,
   author: 'JPCERT',
   description: 'Ransomware attack on major Japanese port disrupted container operations for 72 hours. LockBit variant confirmed. OT/IT convergence exploited via unpatched VPN gateway.',
   timestamp: now - 9 * DAY,
   coordinates: [136.91, 35.18],
   source: 'JPCERT',
   verified: true,
   active: true,
  },
  {
   title: 'Deepfake Voice Fraud Targeting CFOs',
   type: 'Phishing',
   severity: 'High',
   country: 'United Kingdom',
   date: '10d ago',
   votes: 245,
   comments: 53,
   author: 'NCSC-UK',
   description: 'AI-generated deepfake voice calls impersonating CEOs to authorize fraudulent wire transfers. Multiple UK financial firms targeted. $25M aggregate losses reported.',
   timestamp: now - 10 * DAY,
   coordinates: [-0.08, 51.50],
   source: 'NCSC-UK',
   verified: true,
   active: true,
  },
  {
   title: 'Exploitation of Ivanti VPN Zero-Days',
   type: 'Vulnerability',
   severity: 'Critical',
   country: 'Norway',
   date: '12d ago',
   votes: 312,
   comments: 47,
   author: 'NCSC-NO',
   description: 'Chained exploitation of Ivanti Connect Secure VPN zero-days (CVE-2024-21887, CVE-2023-46805). Authentication bypass + command injection. UNC5221 (China-nexus) attributed. Government networks compromised.',
   timestamp: now - 12 * DAY,
   coordinates: [10.75, 59.91],
   source: 'NCSC-NO',
   verified: true,
   active: true,
  },
  {
   title: 'Wiper Malware "BiBi" Targeting Linux Systems',
   type: 'Malware',
   severity: 'High',
   country: 'Israel',
   date: '2w ago',
   votes: 123,
   comments: 18,
   author: 'INCD',
   description: 'Destructive wiper malware "BiBi-Linux" targeting Israeli organizations. Corrupts files and partition tables. No ransom demand - pure destruction. Attributed to Iran-aligned hacktivist group.',
   timestamp: now - 14 * DAY,
   coordinates: [35.21, 31.77],
   source: 'INCD',
   verified: true,
   active: true,
  },
  {
   title: 'BGP Hijacking of Cloud Provider Prefixes',
   type: 'DDoS',
   severity: 'Medium',
   country: 'Singapore',
   date: '2w ago',
   votes: 56,
   comments: 8,
   author: 'Community',
   description: 'Suspicious BGP route announcements redirecting traffic destined for major cloud provider IP ranges through unauthorized ASNs in Southeast Asia. Traffic interception suspected.',
   timestamp: now - 15 * DAY,
   coordinates: [103.85, 1.29],
   source: 'Community',
   verified: false,
   active: true,
  },
  {
   title: 'Container Escape Vulnerability in runc',
   type: 'Vulnerability',
   severity: 'High',
   country: 'United States',
   date: '2w ago',
   votes: 178,
   comments: 25,
   author: 'Community',
   description: 'Critical container escape vulnerability in runc (CVE-2024-21626) affecting Docker and Kubernetes environments. Allows host filesystem access from unprivileged container. Patch immediately.',
   timestamp: now - 16 * DAY,
   coordinates: [-122.08, 37.39],
   source: 'Community',
   verified: true,
   active: true,
  },
 ];
}

const MOCK_VULNERABILITIES: Partial<Vulnerability>[] = [
 { title: 'Log4Shell (CVE-2021-44228)', cveId: 'CVE-2021-44228', description: 'Remote code execution in Log4j 2.x', severity: 'Critical', status: 'Open', remediationPlan: 'Upgrade to Log4j 2.17.1', dateDiscovered: new Date().toISOString() },
 { title: 'Spring4Shell (CVE-2022-22965)', cveId: 'CVE-2022-22965', description: 'RCE in Spring Framework', severity: 'High', status: 'In Progress', remediationPlan: 'Patch Spring Framework', dateDiscovered: new Date(Date.now() - 86400000).toISOString() },
 { title: 'PrintNightmare (CVE-2021-34527)', cveId: 'CVE-2021-34527', description: 'Windows Print Spooler RCE', severity: 'Critical', status: 'Resolved', remediationPlan: 'Apply Microsoft Patch', dateDiscovered: new Date(Date.now() - 172800000).toISOString() },
 { title: 'ProxyLogon (CVE-2021-26855)', cveId: 'CVE-2021-26855', description: 'Microsoft Exchange Server SSRF', severity: 'Critical', status: 'Open', remediationPlan: 'Patch Exchange Server', dateDiscovered: new Date(Date.now() - 259200000).toISOString() },
 { title: 'Follina (CVE-2022-30190)', cveId: 'CVE-2022-30190', description: 'MSDT Remote Code Execution', severity: 'High', status: 'Risk Accepted', remediationPlan: 'Disable MSDT URL Protocol', dateDiscovered: new Date(Date.now() - 345600000).toISOString() },
 { title: 'Heartbleed (CVE-2014-0160)', cveId: 'CVE-2014-0160', description: 'OpenSSL Memory Leak', severity: 'Medium', status: 'Resolved', remediationPlan: 'Upgrade OpenSSL', dateDiscovered: new Date(Date.now() - 432000000).toISOString() },
 { title: 'BlueKeep (CVE-2019-0708)', cveId: 'CVE-2019-0708', description: 'RDP Remote Code Execution', severity: 'High', status: 'Open', remediationPlan: 'Disable RDP or Patch', dateDiscovered: new Date(Date.now() - 518400000).toISOString() },
 { title: 'EternalBlue (CVE-2017-0144)', cveId: 'CVE-2017-0144', description: 'SMBv1 Remote Code Execution', severity: 'Critical', status: 'Resolved', remediationPlan: 'Disable SMBv1', dateDiscovered: new Date(Date.now() - 604800000).toISOString() },
 { title: 'Ivanti Connect Secure Auth Bypass (CVE-2024-21887)', cveId: 'CVE-2024-21887', description: 'Authentication bypass in Ivanti Connect Secure VPN', severity: 'Critical', status: 'Open', remediationPlan: 'Apply Ivanti security patch and reset credentials', dateDiscovered: new Date(Date.now() - DAY * 5).toISOString() },
 { title: 'Confluence RCE (CVE-2024-21683)', cveId: 'CVE-2024-21683', description: 'Remote code execution in Atlassian Confluence Server', severity: 'Critical', status: 'Open', remediationPlan: 'Update Confluence to latest version', dateDiscovered: new Date(Date.now() - DAY * 3).toISOString() },
 { title: 'runc Container Escape (CVE-2024-21626)', cveId: 'CVE-2024-21626', description: 'Container escape vulnerability in runc affecting Docker/Kubernetes', severity: 'High', status: 'In Progress', remediationPlan: 'Update runc to v1.1.12 or later', dateDiscovered: new Date(Date.now() - DAY * 7).toISOString() },
 { title: 'VMware ESXi Auth Bypass (CVE-2024-37085)', cveId: 'CVE-2024-37085', description: 'Authentication bypass in VMware ESXi allowing domain group manipulation', severity: 'High', status: 'Open', remediationPlan: 'Apply VMware ESXi patch and audit domain group memberships', dateDiscovered: new Date(Date.now() - DAY * 2).toISOString() },
];

export class ThreatFeedService {

 /**
  * Helper to fetch with proxy failover
  */
 private static async fetchViaProxy(targetUrl: string): Promise<unknown> {
  if (!targetUrl || !targetUrl.startsWith('http')) {
   ErrorLogger.warn('Invalid URL provided', 'ThreatFeedService.fetchViaProxy', { metadata: { targetUrl } });
   return { vulnerabilities: [], urls: [] };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
   ErrorLogger.warn('Offline detected, skipping fetch', 'ThreatFeedService.fetchViaProxy');
   return { vulnerabilities: [], urls: [] };
  }

  // 0. Try Firebase proxy first (most reliable)
  try {
   const result = await fetchThreatFeed({ url: targetUrl });
   const data = result.data as { vulnerabilities?: unknown[]; urls?: unknown[] };
   if (data) {
    return data;
   }
  } catch (error) {
   ErrorLogger.warn('Firebase proxy failed', 'ThreatFeedService.fetchViaProxy', { metadata: { error: error instanceof Error ? error.message : String(error) } });
  }

  // List of proxy services to try in order
  const proxies = [
   (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
   ErrorLogger.warn('Offline detected, skipping fetch', 'ThreatFeedService.fetchViaProxy');
   return { vulnerabilities: [], urls: [] };
  }

  // 1. Try direct fetch
  try {
   const controller = new AbortController();
   const timeoutId = setTimeout(() => controller.abort(), 3000);

   const response = await fetch(targetUrl, {
    signal: controller.signal,
    mode: 'cors',
    headers: {
     'Accept': 'application/json, text/plain, */*'
    }
   });
   clearTimeout(timeoutId);

   if (response.ok) {
    const text = await response.text();
    try {
     const data = JSON.parse(text);
     return data;
    } catch {
     return { vulnerabilities: [], urls: [] };
    }
   }
  } catch (error) {
   ErrorLogger.warn('Direct fetch failed', 'ThreatFeedService.fetchViaProxy', { metadata: { error: error instanceof Error ? error.message : String(error) } });
  }

  // 2. Try proxies
  for (const proxy of proxies) {
   try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const url = proxy(targetUrl);
    const response = await fetch(url, {
     signal: controller.signal,
     headers: {
      'Accept': 'application/json, text/plain, */*'
     }
    });
    clearTimeout(timeoutId);

    if (response.ok) {
     const text = await response.text();
     try {
      const data = JSON.parse(text);
      return data;
     } catch {
      continue;
     }
    }
   } catch (error) {
    ErrorLogger.warn('Proxy failed', 'ThreatFeedService.fetchViaProxy', { metadata: { error: error instanceof Error ? error.message : String(error) } });
    continue;
   }
  }

  ErrorLogger.warn('All fetch methods failed', 'ThreatFeedService.fetchViaProxy', { metadata: { targetUrl } });
  return { vulnerabilities: [], urls: [] };
 }

 /**
  * Fetch CISA Known Exploited Vulnerabilities
  */
 static async fetchCisaKev(): Promise<Vulnerability[]> {
  try {
   const data = await this.fetchViaProxy('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json') as { vulnerabilities?: CisaVulnerability[] };
   const vulnerabilities: CisaVulnerability[] = data.vulnerabilities || [];

   if (vulnerabilities.length === 0) {
    return [];
   }

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
   ErrorLogger.error(error, 'ThreatFeedService.fetchCisaKev');
   return [];
  }
 }

 /**
  * Fetch URLhaus Recent Malicious URLs
  */
 static async fetchUrlHaus(): Promise<Threat[]> {
  try {
   const data = await this.fetchViaProxy('https://urlhaus-api.abuse.ch/v1/urls/recent/') as { urls?: UrlHausEntry[] };
   const urls: UrlHausEntry[] = data.urls || [];

   if (urls.length === 0) {
    return [];
   }

   return urls.slice(0, 50).map(u => ({
    id: `urlhaus-${u.id}`,
    title: `Malicious URL: ${u.threat} (${u.tags?.[0] || 'Malware'})`,
    type: 'Malicious URL',
    severity: 'Medium' as const,
    country: 'Unknown',
    date: u.date_added,
    votes: 0,
    comments: 0,
    author: 'URLhaus',
    active: u.url_status === 'online',
    timestamp: new Date(u.date_added).getTime(),
    coordinates: [0, 0] as [number, number]
   }));

  } catch (error) {
   ErrorLogger.error(error, 'ThreatFeedService.fetchUrlHaus');
   return [];
  }
 }

 private static _useSimulation = false;

 static get useSimulation(): boolean {
  return this._useSimulation;
 }

 static enableSimulation(): void {
  this._useSimulation = true;
 }

 static disableSimulation(): void {
  this._useSimulation = false;
 }

 /**
  * Seed the database with LIVE data.
  * Falls back to simulated data if live feeds return empty.
  */
 static async seedLiveThreats(organizationId: string): Promise<{ threats: number, vulns: number, simulated: boolean }> {
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  if (this.useSimulation || isOffline) {
   const result = await this.seedSimulatedData(organizationId);
   return { ...result, simulated: true };
  }

  let liveThreats: Threat[] = [];
  let liveVulns: Vulnerability[] = [];

  try {
   [liveThreats, liveVulns] = await Promise.all([
    this.fetchUrlHaus(),
    this.fetchCisaKev()
   ]);
  } catch (_e) {
   ErrorLogger.error(_e, 'ThreatFeedService.seedLiveThreats');
  }

  // If live feeds returned no data, fall back to simulated data
  if (liveThreats.length === 0 && liveVulns.length === 0) {
   ErrorLogger.warn('Live feeds returned empty, falling back to simulated data', 'ThreatFeedService.seedLiveThreats');
   const result = await this.seedSimulatedData(organizationId);
   return { ...result, simulated: true };
  }

  let threatsAdded = 0;
  let vulnsAdded = 0;

  try {
   // Process Vulnerabilities
   for (const v of liveVulns) {
    const q = query(collection(db, 'vulnerabilities'),
     where('cveId', '==', v.cveId),
     where('organizationId', '==', organizationId)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
     await addDoc(collection(db, 'vulnerabilities'), sanitizeData({
      ...v,
      organizationId,
      createdAt: serverTimestamp()
     }));
     vulnsAdded++;
    }
   }

   // Process Threats
   for (const t of liveThreats) {
    const q = query(collection(db, 'threats'),
     where('title', '==', t.title),
     where('organizationId', '==', organizationId)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
     await addDoc(collection(db, 'threats'), sanitizeData({
      ...t,
      organizationId,
      votes: 0,
      comments: 0,
      createdAt: serverTimestamp()
     }));
     threatsAdded++;
    }
   }
  } catch (_error) {
   ErrorLogger.error(_error, 'ThreatFeedService.processLiveFeeds');
  }

  return { threats: threatsAdded, vulns: vulnsAdded, simulated: false };
 }

 /**
  * Seed simulated data with duplicate prevention.
  */
 static async seedSimulatedData(organizationId: string): Promise<{ threats: number, vulns: number }> {
  const orgId = organizationId || 'demo-system';

  // Check if simulated threats already exist for this org
  try {
   const existingQuery = query(
    collection(db, 'threats'),
    where('organizationId', '==', orgId),
    where('source', '==', 'CISA') // Check for one of our seeded sources
   );
   const existingSnap = await getDocs(existingQuery);
   if (!existingSnap.empty && existingSnap.size >= 10) {
    // Already seeded - skip to avoid duplicates
    return { threats: 0, vulns: 0 };
   }
  } catch {
   // If the check fails, proceed with seeding
  }

  const mockThreats = buildMockThreats().map((t, index) => ({
   ...t,
   id: `baseline-${index}`,
   active: true,
   organizationId: orgId,
  } as Threat));

  const mockVulns = MOCK_VULNERABILITIES.map((v, index) => ({
   ...v,
   id: `baseline-vuln-${index}`,
   organizationId: orgId,
  } as Vulnerability));

  let threatsAdded = 0;
  let vulnsAdded = 0;

  try {
   // Seed Threats with duplicate check by title
   for (const t of mockThreats) {
    const q = query(collection(db, 'threats'),
     where('title', '==', t.title),
     where('organizationId', '==', orgId)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
     await addDoc(collection(db, 'threats'), sanitizeData({
      ...t,
      createdAt: serverTimestamp()
     }));
     threatsAdded++;
    }
   }

   // Seed Vulnerabilities with duplicate check by cveId
   for (const v of mockVulns) {
    const q = query(collection(db, 'vulnerabilities'),
     where('cveId', '==', v.cveId),
     where('organizationId', '==', orgId)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
     await addDoc(collection(db, 'vulnerabilities'), sanitizeData({
      ...v,
      createdAt: serverTimestamp()
     }));
     vulnsAdded++;
    }
   }
  } catch (_error) {
   ErrorLogger.error(_error, 'ThreatFeedService.seedSimulatedData');
  }

  return { threats: threatsAdded, vulns: vulnsAdded };
 }
}
