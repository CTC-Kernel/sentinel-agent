/**
 * Certification Tracking Types
 */

export interface Certification {
  id: string;
  organizationId: string;
  name: string;
  standard: string;
  certificationBody: string;
  scope: string;
  status: 'planning' | 'in-progress' | 'certified' | 'expiring-soon' | 'expired' | 'suspended' | 'withdrawn';
  initialCertDate?: string;
  currentCertDate?: string;
  expiryDate?: string;
  nextAuditDate?: string;
  renewalDate?: string;
  certificateNumber?: string;
  certificateUrl?: string;
  version?: string;
  level?: string;
  auditHistory: CertificationAudit[];
  milestones: CertificationMilestone[];
  contacts: CertificationContact[];
  cost?: CertificationCost;
  notes?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CertificationAudit {
  id: string;
  type: 'initial' | 'surveillance-1' | 'surveillance-2' | 'recertification' | 'special';
  date: string;
  auditor: string;
  result: 'pass' | 'conditional' | 'fail' | 'pending';
  findings: number;
  majorNonConformities: number;
  minorNonConformities: number;
  observations: number;
  reportUrl?: string;
  notes?: string;
}

export interface CertificationMilestone {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue';
  assignee?: string;
  assigneeName?: string;
  completedAt?: string;
}

export interface CertificationContact {
  name: string;
  role: 'lead-auditor' | 'certification-manager' | 'account-manager' | 'technical-contact';
  organization: string;
  email?: string;
  phone?: string;
}

export interface CertificationCost {
  initialCost: number;
  annualMaintenanceCost: number;
  auditCost: number;
  currency: string;
  lastUpdated: string;
}

export type CertificationStandard = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  validityYears: number;
  surveillanceFrequency: 'annual' | 'semi-annual';
  category: 'security' | 'privacy' | 'quality' | 'cloud' | 'healthcare' | 'financial';
};

export const CERTIFICATION_STANDARDS: CertificationStandard[] = [
  { id: 'iso27001', name: 'ISO/IEC 27001:2022', shortName: 'ISO 27001', description: "Systeme de management de la securite de l'information", validityYears: 3, surveillanceFrequency: 'annual', category: 'security' },
  { id: 'iso22301', name: 'ISO 22301:2019', shortName: 'ISO 22301', description: "Systeme de management de la continuite d'activite", validityYears: 3, surveillanceFrequency: 'annual', category: 'security' },
  { id: 'soc2type2', name: 'SOC 2 Type II', shortName: 'SOC 2', description: 'Service Organization Control 2', validityYears: 1, surveillanceFrequency: 'annual', category: 'security' },
  { id: 'hds', name: 'HDS (Hebergeur de Donnees de Sante)', shortName: 'HDS', description: 'Certification hebergement donnees de sante', validityYears: 3, surveillanceFrequency: 'annual', category: 'healthcare' },
  { id: 'secnumcloud', name: 'SecNumCloud', shortName: 'SecNumCloud', description: 'Qualification ANSSI pour les prestataires de services cloud', validityYears: 3, surveillanceFrequency: 'annual', category: 'cloud' },
  { id: 'pcidss', name: 'PCI DSS v4.0', shortName: 'PCI DSS', description: 'Payment Card Industry Data Security Standard', validityYears: 1, surveillanceFrequency: 'annual', category: 'financial' },
  { id: 'iso27701', name: 'ISO/IEC 27701:2019', shortName: 'ISO 27701', description: 'Extension vie privee pour ISO 27001', validityYears: 3, surveillanceFrequency: 'annual', category: 'privacy' },
  { id: 'iso9001', name: 'ISO 9001:2015', shortName: 'ISO 9001', description: 'Systeme de management de la qualite', validityYears: 3, surveillanceFrequency: 'annual', category: 'quality' },
];

export interface CertificationFilters {
  status?: Certification['status'] | null;
  standard?: string | null;
  category?: CertificationStandard['category'] | null;
  searchQuery?: string;
}

export interface CertificationStats {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  inProgress: number;
  upcomingAudits: number;
  totalAnnualCost: number;
  byStandard: Record<string, number>;
  byCategory: Record<string, number>;
}
