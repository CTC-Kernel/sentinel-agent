
export enum Criticality {
  LOW = 'Faible',
  MEDIUM = 'Moyenne',
  HIGH = 'Élevée',
  CRITICAL = 'Critique'
}

export interface Asset {
  id: string;
  organizationId: string;
  name: string;
  type: 'Matériel' | 'Logiciel' | 'Données' | 'Service' | 'Humain';
  owner: string;
  confidentiality: Criticality;
  integrity: Criticality;
  availability: Criticality;
  location: string;
  createdAt: string;
  purchaseDate?: string;
  purchasePrice?: number; // Valeur d'achat
  currentValue?: number; // Valeur après amortissement
  warrantyEnd?: string;
  nextMaintenance?: string;
  lifecycleStatus?: 'Neuf' | 'En service' | 'En réparation' | 'Fin de vie' | 'Rebut';
  ownerId?: string;
  relatedProjectIds?: string[];
}

export interface MaintenanceRecord {
  id: string;
  date: string;
  type: 'Préventive' | 'Corrective' | 'Mise à jour' | 'Inspection';
  description: string;
  technician: string;
  cost?: number;
}

export interface Risk {
  id: string;
  organizationId: string;
  assetId: string;
  threat: string;
  vulnerability: string;
  probability: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  score: number;
  residualProbability?: 1 | 2 | 3 | 4 | 5;
  residualImpact?: 1 | 2 | 3 | 4 | 5;
  residualScore?: number;
  previousScore?: number;
  strategy: 'Accepter' | 'Atténuer' | 'Transférer' | 'Éviter';
  status: 'Ouvert' | 'En cours' | 'Fermé';
  owner: string;
  ownerId?: string;
  mitigationControlIds?: string[];
  lastReviewDate?: string;
  createdAt?: string;
}

export interface Control {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  framework?: 'ISO27001' | 'NIS2';
  description?: string;
  status: 'Non commencé' | 'Implémenté' | 'Partiel' | 'Non applicable' | 'Exclu' | 'En revue';
  justification?: string;
  evidenceIds?: string[];
  evidenceStrength?: 'Faible' | 'Forte';
  lastUpdated?: string;
}

export interface Document {
  id: string;
  organizationId: string;
  title: string;
  type: 'Politique' | 'Procédure' | 'Preuve' | 'Rapport' | 'Autre';
  version: string;
  status: 'Brouillon' | 'En revue' | 'Approuvé' | 'Rejeté' | 'Publié' | 'Obsolète';
  workflowStatus?: 'Draft' | 'Review' | 'Approved' | 'Rejected';
  reviewers?: string[];
  approvers?: string[];
  signatures?: Array<{ userId: string, date: string, role: string }>;
  url?: string;
  owner: string;
  ownerId?: string;
  readBy?: string[];
  nextReviewDate?: string;
  createdAt: string;
  updatedAt: string;
  relatedControlIds?: string[];
  relatedAssetIds?: string[];
  relatedAuditIds?: string[];
}

export interface Audit {
  id: string;
  organizationId: string;
  name: string;
  type: 'Interne' | 'Externe' | 'Certification';
  auditor: string;
  dateScheduled: string;
  status: 'Planifié' | 'En cours' | 'Terminé' | 'Validé';
  findingsCount: number;
  relatedAssetIds?: string[];
  relatedRiskIds?: string[];
}

export interface Finding {
  id: string;
  organizationId: string;
  auditId: string;
  description: string;
  type: 'Majeure' | 'Mineure' | 'Observation' | 'Opportunité';
  status: 'Ouvert' | 'Fermé';
  relatedControlId?: string;
  evidenceIds?: string[];
  createdAt: string;
}

export interface RiskHistory {
  id: string;
  riskId: string;
  organizationId: string;
  date: string;
  previousScore: number;
  newScore: number;
  previousProbability: number;
  newProbability: number;
  previousImpact: number;
  newImpact: number;
  changedBy: string;
  reason?: string;
}

export interface AuditQuestion {
  id: string;
  controlCode: string;
  question: string;
  response: 'Conforme' | 'Non-conforme' | 'Observation' | 'Non-applicable';
  comment?: string;
}

export interface AuditChecklist {
  id: string;
  auditId: string;
  organizationId: string;
  questions: AuditQuestion[];
  completedBy?: string;
  completedAt?: string;
}

export interface ProjectTask {
  id: string;
  title: string;
  description?: string;
  status: 'A faire' | 'En cours' | 'Terminé' | 'Bloqué';
  assignee?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
  estimatedHours?: number;
  actualHours?: number;
  dependencies?: string[]; // IDs of tasks this depends on
  progress?: number; // 0-100 percentage
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  targetDate: string;
  status: 'pending' | 'achieved' | 'missed';
  linkedTaskIds: string[];
  createdAt: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: 'ISO27001' | 'Audit' | 'Incident' | 'Deployment' | 'Training' | 'Custom';
  defaultTasks: Omit<ProjectTask, 'id'>[];
  defaultMilestones: Omit<ProjectMilestone, 'id' | 'projectId'>[];
  estimatedDuration: number; // days
  icon: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  manager: string;
  status: 'Planifié' | 'En cours' | 'Terminé' | 'Suspendu';
  dueDate: string;
  progress: number;
  tasks: ProjectTask[];
  relatedRiskIds?: string[];
  relatedControlIds?: string[];
  relatedAssetIds?: string[];
  createdAt: string;
}

export interface Incident {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  severity: Criticality;
  status: 'Nouveau' | 'Analyse' | 'Contenu' | 'Résolu' | 'Fermé';
  category?: 'Ransomware' | 'Phishing' | 'Vol Matériel' | 'Indisponibilité' | 'Fuite de Données' | 'Autre';
  playbookStepsCompleted?: string[];
  affectedAssetId?: string;
  relatedRiskId?: string;
  financialImpact?: number; // Coût estimé de l'incident
  reporter: string;
  dateReported: string;
  dateAnalysis?: string;
  dateContained?: string;
  dateResolved?: string;
  lessonsLearned?: string;
}

export interface Supplier {
  id: string;
  organizationId: string;
  name: string;
  category: 'Software' | 'Hardware' | 'Services' | 'Cloud' | 'Consulting' | 'Other' | 'Matériel';
  contact: {
    email: string;
    phone: string;
    address: string;
    website?: string;
    contactName?: string;
  };
  contactName?: string; // Added for compatibility
  contactEmail?: string; // Added for compatibility
  contract: {
    startDate: string;
    endDate?: string;
    value: number;
    currency: string;
    renewalTerms?: string;
    contractDocumentId?: string;
  };
  contractEnd?: string; // Added for compatibility
  contractDocumentId?: string; // Added for compatibility
  compliance: {
    iso27001: boolean;
    gdpr: boolean;
    soc2: boolean;
    hipaa: boolean;
    otherCertifications: string[];
  };
  riskAssessment: {
    overallScore: 1 | 2 | 3 | 4 | 5;
    dataAccess: 'Low' | 'Medium' | 'High' | 'Critical';
    dependencyLevel: 'Low' | 'Medium' | 'High' | 'Critical';
    geographicRisk: 'Low' | 'Medium' | 'High';
    financialStability: 1 | 2 | 3 | 4 | 5;
    securityMaturity: 1 | 2 | 3 | 4 | 5;
    lastAssessment: string;
    nextAssessment: string;
  };
  assessment?: { // Added for compatibility
    hasIso27001: boolean;
    hasGdprPolicy: boolean;
    hasEncryption: boolean;
    hasBcp: boolean;
    hasIncidentProcess: boolean;
    lastAssessmentDate?: string;
  };
  documents: {
    contractUrl?: string;
    complianceReportUrl?: string;
    auditReportUrl?: string;
    securityQuestionnaireUrl?: string;
  };
  status: 'Active' | 'Under Review' | 'Suspended' | 'Terminated' | 'Actif' | 'En cours' | 'Terminé';
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  criticality?: Criticality; // Added for compatibility
  securityScore?: number; // Added for compatibility
  owner: string;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
  reviewDates: {
    contractReview: string;
    securityReview: string;
    complianceReview: string;
    contractEnd?: string;
  };
  description?: string;
}

export interface SupplierAssessment {
  id: string;
  supplierId: string;
  organizationId: string;
  assessmentDate: string;
  assessorId: string;
  assessorName: string;
  categories: {
    security: {
      score: 1 | 2 | 3 | 4 | 5;
      findings: string[];
      evidence: string[];
    };
    compliance: {
      score: 1 | 2 | 3 | 4 | 5;
      findings: string[];
      evidence: string[];
    };
    operational: {
      score: 1 | 2 | 3 | 4 | 5;
      findings: string[];
      evidence: string[];
    };
    financial: {
      score: 1 | 2 | 3 | 4 | 5;
      findings: string[];
      evidence: string[];
    };
  };
  overallScore: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  recommendations: string[];
  requiredActions: string[];
  followUpDate: string;
  status: 'Draft' | 'In Review' | 'Approved' | 'Rejected';
  approvedBy?: string;
  approvedDate?: string;
}

export interface SupplierIncident {
  id: string;
  supplierId: string;
  organizationId: string;
  title: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  category: 'Security' | 'Availability' | 'Data' | 'Compliance' | 'Other';
  impact: {
    operational: 'None' | 'Minor' | 'Moderate' | 'Major' | 'Critical';
    financial: number;
    reputational: 'None' | 'Minor' | 'Moderate' | 'Major' | 'Critical';
  };
  timeline: {
    detected: string;
    reported: string;
    contained?: string;
    resolved?: string;
    rootCauseIdentified?: string;
  };
  rootCause: string;
  lessonsLearned: string[];
  preventiveActions: string[];
  status: 'Open' | 'Investigating' | 'Contained' | 'Resolved' | 'Closed';
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessingActivity {
  id: string;
  organizationId: string;
  name: string;
  purpose: string;
  manager: string;
  managerId?: string;
  legalBasis: 'Consentement' | 'Contrat' | 'Obligation Légale' | 'Intérêt Légitime' | 'Sauvegarde Intérêts' | 'Mission Publique';
  dataCategories: string[];
  dataSubjects: string[];
  retentionPeriod: string;
  hasDPIA: boolean;
  status: 'Actif' | 'En projet' | 'Archivé';
  createdAt?: string;
  updatedAt?: string;
}

export interface BusinessProcess {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  owner: string;
  rto: string;
  rpo: string;
  priority: 'Critique' | 'Élevée' | 'Moyenne' | 'Faible';
  supportingAssetIds: string[];
  drpDocumentId?: string;
  lastTestDate?: string;
}

export interface BcpDrill {
  id: string;
  organizationId: string;
  processId: string;
  date: string;
  type: 'Tabletop' | 'Simulation' | 'Bascule réelle';
  result: 'Succès' | 'Succès partiel' | 'Échec';
  notes: string;
  createdAt: string;
}

export interface DailyStat {
  organizationId: string;
  date: string;
  risks: number;
  compliance: number;
  incidents: number;
  timestamp: string;
}

export interface SystemLog {
  id: string;
  organizationId: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  details?: string;
  timestamp: string;
}

export interface UserProfile {
  uid: string;
  organizationId?: string;
  organizationName?: string;
  email: string;
  role: 'admin' | 'auditor' | 'user' | 'rssi' | 'project_manager' | 'direction';
  displayName: string;
  department?: string;
  photoURL?: string | null;
  onboardingCompleted?: boolean;
  lastLogin?: string;
  theme?: 'light' | 'dark';
  isPending?: boolean;
}

export interface Invitation {
  id: string;
  email: string;
  role: 'admin' | 'auditor' | 'user';
  department: string;
  organizationId: string;
  organizationName: string;
  invitedBy: string;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  organizationId: string;
  userId: string;
  type: 'warning' | 'danger' | 'info' | 'success';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface Comment {
  id: string;
  organizationId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

export interface AISuggestedLink {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'risk_factor' | 'dependency' | 'impact' | 'mitigation';
  confidence: number;
  reasoning: string;
}

export interface AIInsight {
  id: string;
  type: 'critical_path' | 'cluster' | 'anomaly' | 'recommendation';
  title: string;
  description: string;
  relatedIds: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// --- SAAS & MULTI-TENANCY ---

export type PlanType = 'discovery' | 'professional' | 'enterprise';

export interface PlanLimits {
  maxUsers: number;
  maxProjects: number;
  maxAssets: number;
  maxStorageGB: number;
  features: {
    apiAccess: boolean;
    sso: boolean;
    whiteLabelReports: boolean;
    customTemplates: boolean;
    aiAssistant: boolean;
  };
}

export interface Subscription {
  planId: PlanType;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';
  currentPeriodEnd: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  cancelAtPeriodEnd: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string; // unique identifier for urls e.g. app.sentinel.com/org-slug
  domain?: string; // for auto-joining
  ownerId: string; // the user who created the org (billing contact)
  subscription: Subscription;
  logoUrl?: string;
  address?: string;
  vatNumber?: string;
  contactEmail?: string;
  createdAt: string;
  updatedAt: string;
  settings?: {
    theme?: 'light' | 'dark' | 'system';
    language?: 'fr' | 'en';
  };
}
