import { DocumentData } from 'firebase/firestore';

export const MockDataService = {
 getCollection: (collectionName: string): (DocumentData & { id: string })[] => {
 const now = new Date();
 const oneHour = 3600000;
 const oneDay = 86400000;
 const oneWeek = 604800000;

 switch (collectionName) {
 case 'risks':
 return [
  {
  id: 'risk-1',
  threat: 'Attaque par Phishing',
  description: 'Compromission des identifiants via email frauduleux ciblant le service financier',
  probability: 4,
  impact: 4,
  score: 16,
  status: 'Ouvert',
  owner: 'user-1',
  organizationId: 'org_default',
  createdAt: new Date(now.getTime() - oneWeek * 2).toISOString(),
  updatedAt: new Date(now.getTime() - oneDay).toISOString(),
  assetId: 'asset-1',
  category: 'Cybercriminalité',
  strategy: 'Atténuer'
  },
  {
  id: 'risk-2',
  threat: 'Panne Serveur Critique',
  description: 'Interruption de service due à une défaillance matérielle sur les serveurs de production',
  probability: 2,
  impact: 5,
  score: 10,
  status: 'Traité',
  owner: 'user-2',
  organizationId: 'org_default',
  createdAt: new Date(now.getTime() - oneWeek * 4).toISOString(),
  updatedAt: new Date(now.getTime() - oneWeek).toISOString(),
  assetId: 'asset-2',
  category: 'Disponibilité',
  strategy: 'Transférer'
  },
  {
  id: 'risk-3',
  threat: 'Fuite de données Clients',
  description: 'Exposition non autorisée de la base de données clients sur internet',
  probability: 3,
  impact: 5,
  score: 15,
  status: 'Ouvert',
  owner: 'user-1',
  organizationId: 'org_default',
  createdAt: new Date(now.getTime() - oneDay * 3).toISOString(),
  updatedAt: new Date(now.getTime() - oneDay).toISOString(),
  assetId: 'asset-2',
  category: 'Confidentialité',
  strategy: 'Éviter'
  },
  {
  id: 'risk-4',
  threat: 'Malware interne (Ransomware)',
  description: 'Infection par ransomware via clé USB infectée',
  probability: 2,
  impact: 5,
  score: 10,
  status: 'Ouvert',
  owner: 'user-3',
  organizationId: 'org_default',
  createdAt: new Date(now.getTime() - oneWeek).toISOString(),
  updatedAt: new Date(now.getTime() - oneDay * 2).toISOString(),
  assetId: 'asset-4',
  category: 'Malware',
  strategy: 'Atténuer'
  },
  {
  id: 'risk-5',
  threat: 'Perte de personnel clé',
  description: 'Départ simultané de plusieurs administrateurs système',
  probability: 2,
  impact: 3,
  score: 6,
  status: 'Accepté',
  owner: 'user-4',
  organizationId: 'org_default',
  createdAt: new Date(now.getTime() - oneWeek * 8).toISOString(),
  updatedAt: new Date(now.getTime() - oneWeek * 4).toISOString(),
  category: 'Organisationnel',
  strategy: 'Accepter'
  },
  {
  id: 'risk-6',
  threat: 'Attaque DDoS',
  description: 'Saturation de la bande passante rendant le site inaccessible',
  probability: 3,
  impact: 4,
  score: 12,
  status: 'En cours de traitement',
  owner: 'user-2',
  organizationId: 'org_default',
  createdAt: new Date(now.getTime() - oneDay * 5).toISOString(),
  updatedAt: new Date(now.getTime() - oneDay).toISOString(),
  assetId: 'asset-3',
  category: 'Disponibilité',
  strategy: 'Atténuer'
  },
  {
  id: 'risk-7',
  threat: 'Vol de matériel',
  description: 'Vol d\'ordinateurs portables contenant des données sensibles',
  probability: 3,
  impact: 3,
  score: 9,
  status: 'Ouvert',
  owner: 'user-1',
  organizationId: 'org_default',
  createdAt: new Date(now.getTime() - oneWeek * 3).toISOString(),
  updatedAt: new Date(now.getTime() - oneWeek).toISOString(),
  assetId: 'asset-5',
  category: 'Physique',
  strategy: 'Atténuer'
  }
 ];
 case 'assets':
 return [
  {
  id: 'asset-1',
  name: 'Serveur Principal (Prod)',
  type: 'Server',
  confidentiality: 'High',
  integrity: 'High',
  availability: 'Critical',
  owner: 'user-2',
  lifecycleStatus: 'Active',
  createdAt: new Date(now.getTime() - oneWeek * 50).toISOString(),
  purchasePrice: 50000,
  purchaseDate: '2024-01-15',
  warrantyEnd: '2027-01-15',
  location: 'Data Center Paris'
  },
  {
  id: 'asset-2',
  name: 'Base de Données Clients (SQL)',
  type: 'Database',
  confidentiality: 'Critical',
  integrity: 'Critical',
  availability: 'High',
  owner: 'user-1',
  lifecycleStatus: 'Active',
  createdAt: new Date(now.getTime() - oneWeek * 40).toISOString(),
  purchasePrice: 15000, // License cost maybe
  purchaseDate: '2024-03-01',
  warrantyEnd: '2027-03-01',
  location: 'Cloud AWS'
  },
  {
  id: 'asset-3',
  name: 'Infrastructure Cloud (AWS)',
  type: 'Cloud',
  confidentiality: 'Critical',
  integrity: 'High',
  availability: 'Critical',
  owner: 'user-2',
  lifecycleStatus: 'Active',
  createdAt: new Date(now.getTime() - oneWeek * 60).toISOString(),
  purchasePrice: 120000, // Yearly cost projected
  purchaseDate: '2023-01-01',
  warrantyEnd: '2026-12-31',
  location: 'Global'
  },
  {
  id: 'asset-4',
  name: 'Postes de Travail (Flotte)',
  type: 'Hardware',
  confidentiality: 'Medium',
  integrity: 'Medium',
  availability: 'Medium',
  owner: 'user-3',
  lifecycleStatus: 'Active',
  createdAt: new Date(now.getTime() - oneWeek * 100).toISOString(),
  purchasePrice: 200000,
  purchaseDate: '2023-06-01',
  warrantyEnd: '2026-06-01',
  location: 'Paris HQ'
  },
  {
  id: 'asset-5',
  name: 'Site Web Corporatif',
  type: 'Application',
  confidentiality: 'Public',
  integrity: 'High',
  availability: 'High',
  owner: 'user-4',
  lifecycleStatus: 'Active',
  createdAt: new Date(now.getTime() - oneWeek * 20).toISOString(),
  purchasePrice: 25000,
  purchaseDate: '2024-09-01',
  location: 'Cloud AWS'
  }
 ];
 case 'incidents':
 return [
  {
  id: 'incident-1',
  title: 'Ransomware detected on HR',
  description: 'Ransomware detected on HR server. Several files encrypted with .lock extension.',
  severity: 'Critical',
  status: 'En cours',
  reporter: 'user-3',
  dateReported: new Date(now.getTime() - oneDay * 0.5).toISOString(),
  organizationId: 'org_default',
  impact: 'Major',
  isSignificant: true,
  category: 'Ransomware',
  affectedAssets: ['asset-4']
  },
  {
  id: 'incident-2',
  title: 'Tentative d\'intrusion FW',
  description: 'Multiple failed login attempts detected on firewall external interface.',
  severity: 'High',
  status: 'Analyse',
  reporter: 'System',
  dateReported: new Date(now.getTime() - oneDay * 2).toISOString(),
  organizationId: 'org_default',
  impact: 'None',
  isSignificant: false,
  category: 'Network',
  affectedAssets: ['asset-3']
  },
  {
  id: 'incident-3',
  title: 'Panne Disque Serveur Backup',
  description: 'RAID Controller reported failure on Drive 2.',
  severity: 'Medium',
  status: 'Résolu',
  reporter: 'user-2',
  dateReported: new Date(now.getTime() - oneWeek).toISOString(),
  dateResolved: new Date(now.getTime() - oneWeek + oneDay).toISOString(),
  organizationId: 'org_default',
  impact: 'Minor',
  isSignificant: false,
  category: 'Hardware',
  affectedAssets: ['asset-1']
  },
  {
  id: 'incident-4',
  title: 'Perte PC Portable',
  description: 'Un commercial a déclaré le vol de son ordinateur portable.',
  severity: 'Medium',
  status: 'Fermé',
  reporter: 'user-4',
  dateReported: new Date(now.getTime() - oneWeek * 3).toISOString(),
  dateResolved: new Date(now.getTime() - oneWeek * 3 + oneDay * 2).toISOString(),
  organizationId: 'org_default',
  impact: 'Medium',
  isSignificant: false,
  category: 'Physique'
  }
 ];
 case 'controls':
 return [
  {
  id: 'ctrl-1',
  code: 'A.5.1',
  name: 'Politiques de sécurité de l\'information',
  status: 'Implémenté',
  type: 'Préventif',
  description: 'Un ensemble de politiques de sécurité de l\'information doit être défini, approuvé par la direction, publié et communiqué aux salariés et aux parties prenantes externes concernées.',
  organizationId: 'org_default',
  framework: 'ISO27001',
  applicability: 'Applicable',
  maturity: 4,
  implementationRate: 100
  },
  {
  id: 'ctrl-2',
  code: 'A.8.1',
  name: 'Contrôle d\'accès',
  status: 'Partiel',
  type: 'Préventif',
  description: 'Les accès aux systèmes d\'information doivent être limités aux utilisateurs autorisés.',
  organizationId: 'org_default',
  framework: 'ISO27001',
  applicability: 'Applicable',
  maturity: 2,
  implementationRate: 60
  },
  {
  id: 'ctrl-3',
  code: 'A.6.3',
  name: 'Sauvegardes',
  status: 'Implémenté',
  type: 'Correctif',
  description: 'Des copies de sauvegarde des informations, des logiciels et des images des systèmes doivent être prises et testées régulièrement.',
  organizationId: 'org_default',
  framework: 'ISO27001',
  applicability: 'Applicable',
  maturity: 5,
  implementationRate: 100
  },
  {
  id: 'ctrl-4',
  code: 'A.7.2',
  name: 'Sensibilisation, apprentissage et formation',
  status: 'En retard',
  type: 'Préventif',
  description: 'Tous les salariés de l\'organisation et, le cas échéant, les prestataires doivent recevoir une formation sensibilisation appropriée.',
  organizationId: 'org_default',
  framework: 'ISO27001',
  applicability: 'Applicable',
  maturity: 1,
  implementationRate: 20
  }
 ];
 case 'documents':
 return [
  {
  id: 'doc-1',
  title: 'Politique de Sécurité (PSSI).pdf',
  type: 'policy',
  status: 'Publié',
  organizationId: 'org_default',
  createdAt: new Date(now.getTime() - oneWeek * 10).toISOString(),
  updatedAt: new Date(now.getTime() - oneWeek * 2).toISOString(),
  version: '2.1',
  size: 2048,
  ownerId: 'user-1',
  classification: 'Interne'
  },
  {
  id: 'doc-2',
  title: 'Plan de Continuité (PCA).pdf',
  type: 'procedure',
  status: 'En revue',
  organizationId: 'org_default',
  createdAt: new Date(now.getTime() - oneDay * 3).toISOString(),
  updatedAt: new Date(now.getTime() - oneDay).toISOString(),
  version: '1.0-draft',
  size: 512,
  ownerId: 'user-1',
  classification: 'Confidentiel',
  reviewers: ['user-2']
  },
  {
  id: 'doc-3',
  title: 'Charte Informatique.pdf',
  type: 'policy',
  status: 'Publié',
  organizationId: 'org_default',
  createdAt: new Date(now.getTime() - oneWeek * 12).toISOString(),
  updatedAt: new Date(now.getTime() - oneWeek * 12).toISOString(),
  version: '1.0',
  size: 1024,
  ownerId: 'user-4',
  classification: 'Public'
  }
 ];
 case 'projects':
 return [
  {
  id: 'proj-1',
  name: 'Migration Cloud AWS',
  description: 'Migration complète des serveurs on-premise vers AWS',
  status: 'En cours',
  organizationId: 'org_default',
  progress: 65,
  managerId: 'user-1',
  manager: 'Demo User',
  tasks: [],
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  dueDate: '2024-12-31',
  budget: 50000
  },
  {
  id: 'proj-2',
  name: 'Certification ISO 27001',
  description: 'Préparation et passage de la certification',
  status: 'En cours',
  organizationId: 'org_default',
  progress: 30,
  managerId: 'user-2',
  manager: 'Sophie Martin',
  tasks: [],
  startDate: '2024-03-01',
  endDate: '2025-03-01',
  dueDate: '2025-03-01',
  budget: 25000
  }
 ];
 case 'suppliers':
 return [
  {
  id: 'sup-1',
  name: 'Amazon Web Services (AWS)',
  serviceType: 'Cloud Provider',
  criticality: 'Critical',
  status: 'Active',
  organizationId: 'org_default',
  contactName: 'Support AWS',
  riskScore: 2
  },
  {
  id: 'sup-2',
  name: 'Microsoft (Office 365)',
  serviceType: 'SaaS',
  criticality: 'High',
  status: 'Active',
  organizationId: 'org_default',
  contactName: 'Support Microsoft',
  riskScore: 1
  },
  {
  id: 'sup-3',
  name: 'Securitas',
  serviceType: 'Physical Security',
  criticality: 'Medium',
  status: 'Active',
  organizationId: 'org_default',
  contactName: 'Jean Agent',
  riskScore: 1
  }
 ];
 case 'business_processes':
 return [
  {
  id: 'proc-1',
  name: 'Gestion de la Paie',
  criticality: 'High',
  owner: 'user-4',
  organizationId: 'org_default',
  status: 'Active',
  description: 'Traitement mensuel des salaires'
  },
  {
  id: 'proc-2',
  name: 'Développement Logiciel',
  criticality: 'Critical',
  owner: 'user-2',
  organizationId: 'org_default',
  status: 'Active',
  description: 'Cycle de vie du développement des applications'
  }
 ];
 case 'audits':
 return [
  {
  id: 'audit-1',
  name: 'Audit Interne ISO 27001 - Q1',
  type: 'Interne',
  status: 'Planifié',
  dateScheduled: new Date(now.getTime() + oneWeek * 2).toISOString(),
  auditor: 'Jean Dupont',
  organizationId: 'org_default',
  findingsCount: 0,
  scope: 'Périmètre Sécurité Physique'
  },
  {
  id: 'audit-2',
  name: 'Audit Fournisseur AWS',
  type: 'Externe',
  status: 'En cours',
  dateScheduled: new Date(now.getTime() - oneDay).toISOString(),
  auditor: 'Alice Security',
  organizationId: 'org_default',
  findingsCount: 2,
  scope: 'Conformité GDPR'
  },
  {
  id: 'audit-3',
  name: 'Audit de Code',
  type: 'Technique',
  status: 'Terminé',
  dateScheduled: new Date(now.getTime() - oneWeek * 4).toISOString(),
  auditor: 'SonarQube',
  organizationId: 'org_default',
  findingsCount: 15,
  scope: 'Codebase v2.0'
  }
 ];
 case 'system_logs':
 return [
  { id: 'log-1', timestamp: new Date(now.getTime() - 1000 * 60 * 5).toISOString(), action: 'LOGIN_SUCCESS', user: 'Demo User', details: 'Connexion réussie', organizationId: 'org_default', severity: 'info' },
  { id: 'log-2', timestamp: new Date(now.getTime() - 1000 * 60 * 60).toISOString(), action: 'DOCUMENT_UPLOAD', user: 'Demo User', details: 'Upload de "Plan.pdf"', organizationId: 'org_default', severity: 'info' },
  { id: 'log-3', timestamp: new Date(now.getTime() - 1000 * 60 * 120).toISOString(), action: 'RISK_CREATED', user: 'Sophie Martin', details: 'Nouveau risque identifié', organizationId: 'org_default', severity: 'info' },
  { id: 'log-4', timestamp: new Date(now.getTime() - 1000 * 60 * 200).toISOString(), action: 'LOGIN_FAILED', user: 'Unknown', details: 'Tentative échouée IP 192.168.1.1', organizationId: 'org_default', severity: 'warning' },
  { id: 'log-5', timestamp: new Date(now.getTime() - 1000 * 60 * 300).toISOString(), action: 'SETTINGS_UPDATE', user: 'Admin', details: 'Mise à jour politique mot de passe', organizationId: 'org_default', severity: 'info' }
 ];
 case 'vulnerabilities':
 return [
  {
  id: 'vuln-1',
  cveId: 'CVE-2024-1234',
  severity: 'High',
  description: 'Remote Code Execution in WebFrame 2.0',
  status: 'Open',
  affectedAssets: ['asset-5'],
  remediation: 'Update to version 2.1',
  publishedDate: new Date(now.getTime() - oneWeek).toISOString()
  }
 ];
 case 'threat_library':
 return [
  {
  id: 'threat-lib-1',
  name: 'APT-29 (Cozy Bear)',
  type: 'APT',
  description: 'Advanced Persistent Threat group suspected of being attributed to the Russian Foreign Intelligence Service.',
  severity: 'Critical',
  source: 'CISA',
  indicators: ['1.2.3.4', 'malicious-domain.com']
  },
  {
  id: 'threat-lib-2',
  name: 'Lazarus Group',
  type: 'APT',
  description: 'State-sponsored cyber threat group.',
  severity: 'High',
  source: 'FBI',
  indicators: ['5.6.7.8']
  }
 ];
 case 'threats':
 return [
  {
  id: 'threat-1',
  title: 'Ransomware "BlackCat/ALPHV" Variant Detected',
  type: 'Ransomware',
  severity: 'Critical',
  country: 'United States',
  date: '1h ago',
  votes: 247,
  comments: 58,
  author: 'CISA',
  description: 'New variant of ALPHV/BlackCat ransomware exploiting VMware ESXi vulnerabilities (CVE-2024-37085). Healthcare and critical infrastructure targeted. Triple extortion model confirmed.',
  timestamp: now.getTime() - oneHour,
  coordinates: [-95.71, 37.09],
  active: true,
  verified: true,
  source: 'CISA'
  },
  {
  id: 'threat-2',
  title: 'APT29 (Cozy Bear) Spearphishing Campaign',
  type: 'APT',
  severity: 'Critical',
  country: 'Germany',
  date: '2h ago',
  votes: 412,
  comments: 34,
  author: 'ANSSI',
  description: 'Coordinated spearphishing campaign attributed to APT29 targeting European diplomatic institutions. Utilizes Microsoft Teams as initial vector with ROOTSAW dropper.',
  timestamp: now.getTime() - oneHour * 2,
  coordinates: [10.45, 51.17],
  active: true,
  verified: true,
  source: 'ANSSI'
  },
  {
  id: 'threat-3',
  title: 'Zero-Day RCE in Confluence Server (CVE-2024-21683)',
  type: 'Vulnerability',
  severity: 'Critical',
  country: 'Australia',
  date: '3h ago',
  votes: 189,
  comments: 42,
  author: 'CERT-AU',
  description: 'Critical remote code execution vulnerability in Atlassian Confluence Server. Active exploitation observed in the wild. CVSS 9.8.',
  timestamp: now.getTime() - oneHour * 3,
  coordinates: [133.77, -25.27],
  active: true,
  verified: true,
  source: 'CERT-AU'
  },
  {
  id: 'threat-4',
  title: 'LockBit 4.0 Ransomware-as-a-Service Launch',
  type: 'Ransomware',
  severity: 'Critical',
  country: 'Russia',
  date: '4h ago',
  votes: 356,
  comments: 67,
  author: 'Europol',
  description: 'LockBit group has launched version 4.0 of their RaaS platform despite law enforcement disruption. New encryption algorithm and affiliate program detected.',
  timestamp: now.getTime() - oneHour * 4,
  coordinates: [37.62, 55.75],
  active: true,
  verified: true,
  source: 'Europol'
  },
  {
  id: 'threat-5',
  title: 'Volt Typhoon Infrastructure Compromise',
  type: 'APT',
  severity: 'Critical',
  country: 'United States',
  date: '5h ago',
  votes: 523,
  comments: 89,
  author: 'FBI',
  description: 'Ongoing campaign by Volt Typhoon (China-nexus) targeting US critical infrastructure. Living-off-the-land techniques used to maintain persistence in telecom and energy sectors.',
  timestamp: now.getTime() - oneHour * 5,
  coordinates: [-77.04, 38.91],
  active: true,
  verified: true,
  source: 'FBI'
  },
  {
  id: 'threat-6',
  title: 'DDoS Campaign Against Financial Institutions',
  type: 'DDoS',
  severity: 'High',
  country: 'France',
  date: '8h ago',
  votes: 198,
  comments: 31,
  author: 'CERT-FR',
  description: 'Coordinated DDoS attacks exceeding 1.5 Tbps targeting major French financial institutions. NoName057(16) hacktivist group claimed responsibility.',
  timestamp: now.getTime() - oneHour * 8,
  coordinates: [2.35, 48.86],
  active: true,
  verified: true,
  source: 'CERT-FR'
  },
  {
  id: 'threat-7',
  title: 'Phishing Campaign Targeting Microsoft 365 Admins',
  type: 'Phishing',
  severity: 'High',
  country: 'United Kingdom',
  date: '10h ago',
  votes: 134,
  comments: 19,
  author: 'NCSC-UK',
  description: 'Sophisticated phishing campaign using adversary-in-the-middle (AitM) technique to bypass MFA. Targets Microsoft 365 global administrators.',
  timestamp: now.getTime() - oneHour * 10,
  coordinates: [-0.12, 51.51],
  active: true,
  verified: true,
  source: 'NCSC-UK'
  },
  {
  id: 'threat-8',
  title: 'Industrial Control System Malware "FrostyGoop"',
  type: 'Malware',
  severity: 'High',
  country: 'Ukraine',
  date: '12h ago',
  votes: 89,
  comments: 15,
  author: 'ICS-CERT',
  description: 'New ICS-specific malware targeting Modbus TCP/IP devices. Capable of disrupting heating systems and SCADA networks.',
  timestamp: now.getTime() - oneHour * 12,
  coordinates: [30.52, 50.45],
  active: true,
  verified: true,
  source: 'ICS-CERT'
  },
  {
  id: 'threat-9',
  title: 'Lazarus Group Cryptocurrency Exchange Heist',
  type: 'APT',
  severity: 'Critical',
  country: 'Japan',
  date: '14h ago',
  votes: 278,
  comments: 45,
  author: 'JPCERT',
  description: 'Lazarus Group (DPRK) confirmed behind $235M cryptocurrency exchange breach. Social engineering via fake job offers on LinkedIn.',
  timestamp: now.getTime() - oneHour * 14,
  coordinates: [139.69, 35.69],
  active: true,
  verified: true,
  source: 'JPCERT'
  },
  {
  id: 'threat-10',
  title: 'Banking Trojan "Grandoreiro" Global Campaign',
  type: 'Malware',
  severity: 'High',
  country: 'Brazil',
  date: '1d ago',
  votes: 145,
  comments: 22,
  author: 'CERT-BR',
  description: 'Grandoreiro banking trojan resurgence. New variant targets 1,500+ financial institutions across 60 countries. Distributed via tax-themed phishing emails.',
  timestamp: now.getTime() - oneDay,
  coordinates: [-47.93, -15.78],
  active: true,
  verified: true,
  source: 'CERT-BR'
  },
  {
  id: 'threat-11',
  title: 'Cloud Storage Misconfiguration Exposing Patient Data',
  type: 'Data Leak',
  severity: 'High',
  country: 'India',
  date: '1d ago',
  votes: 67,
  comments: 8,
  author: 'Community',
  description: 'Exposed Azure Blob Storage containing 12M+ patient records from healthcare provider. Data includes PII, medical records, and insurance details.',
  timestamp: now.getTime() - oneDay - oneHour * 5,
  coordinates: [77.21, 28.61],
  active: true,
  verified: false,
  source: 'Community'
  },
  {
  id: 'threat-12',
  title: 'Akira Ransomware Targeting VMware ESXi',
  type: 'Ransomware',
  severity: 'Critical',
  country: 'Canada',
  date: '1d ago',
  votes: 198,
  comments: 34,
  author: 'CCCS',
  description: 'Akira ransomware group actively exploiting VMware ESXi hypervisors via compromised VPN credentials. Linux variant encrypts virtual machines directly.',
  timestamp: now.getTime() - oneDay - oneHour * 12,
  coordinates: [-75.70, 45.42],
  active: true,
  verified: true,
  source: 'CCCS'
  },
  {
  id: 'threat-13',
  title: 'Mobile Spyware "Predator" Campaign Against Journalists',
  type: 'Malware',
  severity: 'Critical',
  country: 'Israel',
  date: '2d ago',
  votes: 389,
  comments: 72,
  author: 'CitizenLab',
  description: 'Intellexa "Predator" spyware deployed against journalists across EU member states. Zero-click exploit chain targeting iOS and Android.',
  timestamp: now.getTime() - oneDay * 2,
  coordinates: [34.78, 32.08],
  active: true,
  verified: true,
  source: 'Community'
  },
  {
  id: 'threat-14',
  title: 'Espionage Campaign Targeting Energy Sector',
  type: 'APT',
  severity: 'High',
  country: 'Saudi Arabia',
  date: '2d ago',
  votes: 112,
  comments: 9,
  author: 'NCSC-SA',
  description: 'State-sponsored espionage campaign targeting Gulf energy companies. Custom implant "SandStrike" found in OT networks.',
  timestamp: now.getTime() - oneDay * 2 - oneHour * 12,
  coordinates: [46.68, 24.71],
  active: true,
  verified: true,
  source: 'NCSC-SA'
  },
  {
  id: 'threat-15',
  title: 'Supply Chain Attack via PyPI Package',
  type: 'Vulnerability',
  severity: 'High',
  country: 'Netherlands',
  date: '6h ago',
  votes: 167,
  comments: 23,
  author: 'Community',
  description: 'Malicious PyPI package "ultrasqlite" discovered with backdoor targeting CI/CD pipelines. Exfiltrates environment variables and SSH keys. 45,000+ downloads.',
  timestamp: now.getTime() - oneHour * 6,
  coordinates: [5.29, 52.13],
  active: true,
  verified: false,
  source: 'Community'
  },
  {
  id: 'threat-16',
  title: 'QakBot Resurrection via DarkGate Loader',
  type: 'Malware',
  severity: 'High',
  country: 'Germany',
  date: '3d ago',
  votes: 156,
  comments: 28,
  author: 'BSI',
  description: 'QakBot infrastructure resurrected using DarkGate malware loader. Distributed via phishing emails with OneNote and PDF attachments.',
  timestamp: now.getTime() - oneDay * 3,
  coordinates: [13.40, 52.52],
  active: true,
  verified: true,
  source: 'BSI'
  },
  {
  id: 'threat-17',
  title: 'WordPress Plugin Supply Chain Compromise',
  type: 'Vulnerability',
  severity: 'High',
  country: 'United States',
  date: '4d ago',
  votes: 234,
  comments: 41,
  author: 'Wordfence',
  description: 'Five popular WordPress plugins compromised via developer account takeover. Malicious code injected to create administrator accounts. 35,000+ active installations.',
  timestamp: now.getTime() - oneDay * 4,
  coordinates: [-96.80, 32.78],
  active: true,
  verified: true,
  source: 'Community'
  },
  {
  id: 'threat-18',
  title: 'IoT Botnet "InfectedSlurs" Targeting Cameras',
  type: 'Botnet',
  severity: 'Medium',
  country: 'China',
  date: '5d ago',
  votes: 89,
  comments: 7,
  author: 'Akamai SIRT',
  description: 'Mirai-based botnet exploiting zero-day vulnerabilities in network cameras and NVR devices. 60,000+ compromised devices identified.',
  timestamp: now.getTime() - oneDay * 5,
  coordinates: [116.40, 39.90],
  active: true,
  verified: true,
  source: 'Community'
  },
  {
  id: 'threat-19',
  title: 'Deepfake Voice Fraud Targeting CFOs',
  type: 'Phishing',
  severity: 'High',
  country: 'United Kingdom',
  date: '10d ago',
  votes: 245,
  comments: 53,
  author: 'NCSC-UK',
  description: 'AI-generated deepfake voice calls impersonating CEOs to authorize fraudulent wire transfers. Multiple UK financial firms targeted. $25M aggregate losses.',
  timestamp: now.getTime() - oneDay * 10,
  coordinates: [-0.08, 51.50],
  active: true,
  verified: true,
  source: 'NCSC-UK'
  },
  {
  id: 'threat-20',
  title: 'Exploitation of Ivanti VPN Zero-Days',
  type: 'Vulnerability',
  severity: 'Critical',
  country: 'Norway',
  date: '12d ago',
  votes: 312,
  comments: 47,
  author: 'NCSC-NO',
  description: 'Chained exploitation of Ivanti Connect Secure VPN zero-days. Authentication bypass + command injection. UNC5221 (China-nexus) attributed.',
  timestamp: now.getTime() - oneDay * 12,
  coordinates: [10.75, 59.91],
  active: true,
  verified: true,
  source: 'NCSC-NO'
  },
  {
  id: 'threat-21',
  title: 'Fake AI Tool Websites Distributing Lumma Stealer',
  type: 'Phishing',
  severity: 'Medium',
  country: 'Italy',
  date: '6d ago',
  votes: 56,
  comments: 11,
  author: 'Community',
  description: 'Network of fake AI tool websites distributing Lumma information stealer. Steals browser credentials, crypto wallets, and session tokens. 200+ domains.',
  timestamp: now.getTime() - oneDay * 6 - oneHour * 12,
  coordinates: [12.50, 41.89],
  active: true,
  verified: false,
  source: 'Community'
  },
  {
  id: 'threat-22',
  title: 'Ransomware Attack on Port Infrastructure',
  type: 'Ransomware',
  severity: 'Critical',
  country: 'Japan',
  date: '1w ago',
  votes: 201,
  comments: 36,
  author: 'JPCERT',
  description: 'Ransomware attack on major Japanese port disrupted container operations for 72 hours. LockBit variant confirmed. OT/IT convergence exploited.',
  timestamp: now.getTime() - oneWeek - oneDay * 2,
  coordinates: [136.91, 35.18],
  active: true,
  verified: true,
  source: 'JPCERT'
  },
  {
  id: 'threat-23',
  title: 'SIM Swapping Ring Targeting Crypto Holders',
  type: 'Phishing',
  severity: 'High',
  country: 'United States',
  date: '1w ago',
  votes: 167,
  comments: 29,
  author: 'FBI',
  description: 'Organized SIM swapping ring targeting high-net-worth cryptocurrency holders. Social engineering telecom employees. $48M stolen in Q4.',
  timestamp: now.getTime() - oneWeek - oneDay,
  coordinates: [-118.24, 34.05],
  active: true,
  verified: true,
  source: 'FBI'
  },
  {
  id: 'threat-24',
  title: 'SEO Poisoning Campaign Distributing Gootloader',
  type: 'Malware',
  severity: 'Medium',
  country: 'France',
  date: '5d ago',
  votes: 45,
  comments: 6,
  author: 'CERT-FR',
  description: 'SEO poisoning campaign using compromised WordPress sites to distribute Gootloader malware. Targets French-language legal and financial document searches.',
  timestamp: now.getTime() - oneDay * 5 - oneHour * 12,
  coordinates: [4.83, 45.76],
  active: true,
  verified: true,
  source: 'CERT-FR'
  },
  {
  id: 'threat-25',
  title: 'SQL Injection Targeting Government Portals',
  type: 'Vulnerability',
  severity: 'Medium',
  country: 'Spain',
  date: '1w ago',
  votes: 43,
  comments: 4,
  author: 'CCN-CERT',
  description: 'Automated SQL injection attacks targeting public-facing government web portals. Exploiting unpatched CMS installations.',
  timestamp: now.getTime() - oneWeek,
  coordinates: [-3.70, 40.42],
  active: true,
  verified: true,
  source: 'CCN-CERT'
  }
 ];
 case 'users':
 return [
  {
  id: 'user-1',
  uid: 'demo-user-123',
  email: 'demo@sentinel-grc.com',
  displayName: 'Demo User',
  role: 'admin',
  organizationId: 'org_default',
  department: 'IT',
  isPending: false,
  photoURL: 'https://i.pravatar.cc/150?u=demo'
  },
  {
  id: 'user-2',
  uid: 'user-2',
  email: 'sophie@sentinel-grc.com',
  displayName: 'Sophie Martin',
  role: 'rssi',
  organizationId: 'org_default',
  department: 'Security',
  isPending: false,
  photoURL: 'https://i.pravatar.cc/150?u=sophie'
  },
  {
  id: 'user-3',
  uid: 'user-3',
  email: 'thomas@sentinel-grc.com',
  displayName: 'Thomas Dubois',
  role: 'user',
  organizationId: 'org_default',
  department: 'HR',
  isPending: false,
  photoURL: 'https://i.pravatar.cc/150?u=thomas'
  },
  {
  id: 'user-4',
  uid: 'user-4',
  email: 'marie@sentinel-grc.com',
  displayName: 'Marie Leroy',
  role: 'direction',
  organizationId: 'org_default',
  department: 'Management',
  isPending: false,
  photoURL: 'https://i.pravatar.cc/150?u=marie'
  }
 ];
 case 'bcp_drills':
 return [
  {
  id: 'drill-1',
  name: 'Simulation Panne Datacenter',
  date: new Date(now.getTime() - oneWeek * 8).toISOString(),
  type: 'Simulation',
  status: 'Completed',
  organizationId: 'org_default',
  score: 85,
  participants: ['user-1', 'user-2'],
  findings: ['RTO respecté', 'Documentation à jour']
  },
  {
  id: 'drill-2',
  name: 'Test Restauration Backup',
  date: new Date(now.getTime() - oneWeek * 2).toISOString(),
  type: 'Test Technique',
  status: 'Completed',
  organizationId: 'org_default',
  score: 100,
  participants: ['user-2'],
  findings: ['Restauration OK']
  }
 ];
 case 'threat_intelligence':
 return [
  {
  id: 'ti-1',
  title: 'Nouveau Ransomware "DarkCrypt"',
  description: 'Une nouvelle variante de ransomware cible les PME européennes.',
  severity: 'Critical',
  source: 'CERT-FR',
  publishedDate: new Date(now.getTime() - oneDay).toISOString(),
  indicators: ['hash123', 'ip1.2.3.4'],
  organizationId: 'org_default',
  tags: ['Ransomware', 'Europe']
  },
  {
  id: 'ti-2',
  title: 'Vulnérabilité Zero-Day Exchange',
  description: 'Exploitation active de CVE-2024-XXXX.',
  severity: 'High',
  source: 'Microsoft',
  publishedDate: new Date(now.getTime() - oneWeek).toISOString(),
  indicators: [],
  organizationId: 'org_default',
  tags: ['Zero-Day', 'Microsoft']
  }
 ];
 case 'backups':
 return [
  {
  id: 'backup-1',
  organizationId: 'org_default',
  createdAt: new Date(now.getTime() - oneDay).toISOString(),
  createdBy: 'demo@sentinel-grc.com',
  config: {
  includeDocuments: true,
  includeAssets: true,
  includeRisks: true,
  includeControls: true,
  includeAudits: true,
  includeProjects: true,
  includeSuppliers: true,
  includeIncidents: true,
  includeUsers: true,
  includeComments: true
  },
  size: 1024 * 1024 * 5, // 5MB
  collections: ['documents', 'assets', 'risks'],
  status: 'completed',
  downloadUrl: 'https://example.com/backup.json'
  },
  {
  id: 'backup-2',
  organizationId: 'org_default',
  createdAt: new Date(now.getTime() - oneWeek).toISOString(),
  createdBy: 'admin@sentinel-grc.com',
  config: {
  includeDocuments: true,
  includeAssets: true,
  includeRisks: true,
  includeControls: true,
  includeAudits: true,
  includeProjects: true,
  includeSuppliers: true,
  includeIncidents: true,
  includeUsers: true,
  includeComments: true
  },
  size: 1024 * 1024 * 12, // 12MB
  collections: ['documents', 'assets', 'risks', 'incidents'],
  status: 'completed',
  downloadUrl: 'https://example.com/backup2.json'
  }
 ];
 default:
 return [];
 }
 },

 getDocument: (collectionName: string, id: string): (DocumentData & { id: string }) | null => {
 const list = MockDataService.getCollection(collectionName);
 return list.find(d => d.id === id) || null;
 }
};
