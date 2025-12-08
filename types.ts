
export enum Criticality {
  LOW = 'Faible',
  MEDIUM = 'Moyenne',
  HIGH = 'Élevée',
  CRITICAL = 'Critique'
}

export type ResourceType = 'Asset' | 'Risk' | 'Project' | 'Audit' | 'Document' | 'Control' | 'Incident' | 'Supplier' | 'BusinessProcess';
export type ActionType = 'read' | 'create' | 'update' | 'delete' | 'manage';



// ... (existing imports, etc)
// import { Timestamp } from 'firebase/firestore'; // Removed unused import

export type Framework = 'ISO27001' | 'ISO27005' | 'NIS2' | 'DORA' | 'GDPR' | 'SOC2' | 'HDS' | 'PCI_DSS' | 'NIST_CSF' | 'OWASP' | 'EBIOS' | 'COBIT' | 'ITIL';


export interface AIAnalysisResult {
  type: string;
  response: Record<string, any>;
  timestamp: string;
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
  scope?: ('NIS2' | 'DORA' | 'PCI_DSS' | 'HDS' | 'ISO27001' | 'SOC2')[];
  supplierId?: string;
  updatedAt?: string;
  // Specialized fields
  ipAddress?: string;
  version?: string;
  licenseExpiry?: string;
  email?: string;
  role?: string;
  department?: string;
  hardwareType?: string;
  hardware?: Record<string, unknown>;
  notes?: string;
  aiAnalysis?: AIAnalysisResult;
}

export interface MaintenanceRecord {
  id: string;
  date: string;
  type: 'Préventive' | 'Corrective' | 'Mise à jour' | 'Inspection';
  description: string;
  technician: string;
  cost?: number;
}

export interface MitreTechnique {
  id: string;
  name: string;
  description: string;
}

export interface CompanySearchResult {
  name: string;
  siren: string;
  address: string;
  activity: string;
}

export interface CyberNewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

export interface Vulnerability {
  cveId: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  score?: number;
  publishedDate: string;
  source: string;
}

export interface Risk {
  id: string;
  organizationId: string;
  assetId: string;
  threat: string;
  scenario?: string; // Scénario de risque (ISO 27005)
  framework?: Framework;
  vulnerability: string;
  probability: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  score: number;
  residualProbability?: 1 | 2 | 3 | 4 | 5;
  residualImpact?: 1 | 2 | 3 | 4 | 5;
  residualScore?: number;
  mitreTechniques?: MitreTechnique[];
  previousScore?: number;
  strategy: 'Accepter' | 'Atténuer' | 'Transférer' | 'Éviter';
  status: 'Ouvert' | 'En cours' | 'Fermé';
  owner: string;
  ownerId?: string;
  mitigationControlIds?: string[];
  lastReviewDate?: string;
  createdAt?: string;
  affectedProcessIds?: string[];
  relatedSupplierIds?: string[];
  relatedProjectIds?: string[];
  history?: RiskHistory[];
  treatment?: RiskTreatment;
  isSecureStorage?: boolean;
  category?: string;
  updatedAt?: string;
  justification?: string;
  aiAnalysis?: AIAnalysisResult;
}

export interface RiskTreatment {
  strategy?: 'Accepter' | 'Atténuer' | 'Transférer' | 'Éviter';
  description?: string;
  ownerId?: string;
  dueDate?: string;
  completedDate?: string;
  status?: 'Planifié' | 'En cours' | 'Terminé' | 'Retard';
  slaStatus?: 'On Track' | 'At Risk' | 'Breached';
  estimatedCost?: number;
}

export interface RiskRecommendation {
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  suggested_actions: { action: string; priority: string }[];
  confidence_score: number;
}

export interface AutomatedEvidence {
  id: string;
  providerId: string;
  resourceType: string;
  resourceId: string;
  status: 'pass' | 'fail' | 'error';
  lastSync: string;
  details?: string;
}

export interface Control {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  framework?: Framework;
  description?: string;
  type?: 'Préventif' | 'Détectif' | 'Correctif';
  status: 'Non commencé' | 'Implémenté' | 'Partiel' | 'Non applicable' | 'Exclu' | 'En revue' | 'Actif' | 'Inactif' | 'En cours' | 'Non appliqué'; // Merged statuses to be safe
  applicability?: 'Applicable' | 'Non applicable';
  justification?: string;
  evidenceIds?: string[];
  automatedEvidence?: AutomatedEvidence[];
  evidenceStrength?: 'Faible' | 'Forte';
  lastUpdated?: string;
  owner?: string; // Added owner for compatibility
  assigneeId?: string;
  relatedAssetIds?: string[];
  relatedRiskIds?: string[]; // Added missing field
  relatedSupplierIds?: string[];
}

export interface Document {
  id: string;
  organizationId: string;
  title: string;
  type: 'Politique' | 'Procédure' | 'Preuve' | 'Rapport' | 'Autre';
  description?: string;
  version: string;
  status: 'Brouillon' | 'En revue' | 'Approuvé' | 'Rejeté' | 'Publié' | 'Obsolète';
  workflowStatus?: 'Draft' | 'Review' | 'Approved' | 'Rejected';
  reviewers?: string[];
  approvers?: string[];
  signatures?: Array<{ userId: string, date: string, role: string, signatureImage?: string }>;
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
  // Security & Integrity
  isSecure?: boolean;
  hash?: string; // SHA-256
  watermarkEnabled?: boolean;
  storageProvider?: 'firebase' | 'google_drive' | 'onedrive' | 'sharepoint';
  externalUrl?: string;
  externalId?: string; // ID of the file in the external provider
  folderId?: string;
  content?: string; // HTML content for rich text policies
}

export interface DocumentFolder {
  id: string;
  organizationId: string;
  name: string;
  parentId?: string; // For nested folders
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: string;
  url: string;
  hash?: string;
  uploadedBy: string; // User ID
  uploadedAt: string;
  changeLog?: string;
}

export interface Audit {
  id: string;
  organizationId: string;
  name: string;
  type: 'Interne' | 'Externe' | 'Certification' | 'Fournisseur';
  auditor: string;
  dateScheduled: string;
  status: 'Planifié' | 'En cours' | 'Terminé' | 'Validé';
  findingsCount: number;
  scope?: string;
  framework?: Framework;
  relatedAssetIds?: string[];
  relatedRiskIds?: string[];
  relatedProjectIds?: string[];
  relatedControlIds?: string[];
  findings?: Finding[];
  collaborators?: string[]; // User IDs of internal collaborators
  externalAuditors?: string[]; // Emails of external auditors
  createdBy?: string; // User ID of the creator (for Segregation of Duties)
  updatedAt?: string;
}

export interface EvidenceRequest {
  id: string;
  auditId: string;
  organizationId: string;
  title: string;
  description: string;
  status: 'Pending' | 'Provided' | 'Accepted' | 'Rejected';
  requestedBy: string; // User ID
  assignedTo?: string; // User ID
  dueDate?: string;
  documentIds?: string[]; // Linked evidence documents
  createdAt: string;
  updatedAt: string;
  relatedControlId?: string;
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
  id?: string;
  riskId?: string;
  organizationId?: string;
  date: string;
  previousScore: number;
  newScore: number;
  previousProbability?: number;
  newProbability?: number;
  previousImpact?: number;
  newImpact?: number;
  residualProbability?: number;
  residualImpact?: number;
  residualScore?: number;
  mitreTechniques?: MitreTechnique[];
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

export type QuestionType = 'text' | 'yes_no' | 'choice' | 'multiple_choice' | 'rating';

export interface QuestionnaireQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[]; // For choice/multiple_choice
  required: boolean;
  description?: string;
}

export interface Questionnaire {
  id: string;
  organizationId: string;
  auditId: string;
  title: string;
  description?: string;
  questions: QuestionnaireQuestion[];
  status: 'Draft' | 'Published' | 'Closed';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  targetAudience?: string[]; // User IDs or Emails
}

export interface QuestionnaireResponse {
  id: string;
  questionnaireId: string;
  organizationId: string;
  auditId: string;
  respondentId: string; // User ID
  respondentEmail?: string; // For external
  answers: Record<string, string | string[] | number>; // questionId -> answer
  status: 'In Progress' | 'Submitted';
  submittedAt?: string;
  startedAt: string;
  updatedAt: string;
}

export interface ProjectTask {
  id: string;
  title: string;
  description?: string;
  status: 'A faire' | 'En cours' | 'Terminé' | 'Bloqué';
  assignee?: string;
  assigneeId?: string;
  startDate?: string; // Added for Gantt chart
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
  framework?: Framework;
  status: 'Planifié' | 'En cours' | 'Terminé' | 'Suspendu';
  startDate?: string; // Added for Gantt chart
  dueDate: string;
  progress: number;
  tasks: ProjectTask[];
  relatedRiskIds?: string[];
  relatedControlIds?: string[];
  relatedAssetIds?: string[];
  milestones?: ProjectMilestone[];
  createdAt: string;
  updatedAt?: string;
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
  affectedProcessId?: string;
  relatedRiskId?: string;
  financialImpact?: number; // Coût estimé de l'incident
  reporter: string;
  dateReported: string;
  dateAnalysis?: string;
  dateContained?: string;
  dateResolved?: string;
  lessonsLearned?: string;
  // NIS 2 Specific Fields
  isSignificant?: boolean;
  notificationStatus?: 'Not Required' | 'Pending' | 'Reported';
  relevantAuthorities?: string[];
  responseOwner?: string;
  detectedAt?: string;
  impact?: string;
  updatedAt?: string;
}

export interface Supplier {
  id: string;
  organizationId: string;
  name: string;
  category: 'SaaS' | 'Hébergement' | 'Matériel' | 'Consulting' | 'Autre';
  criticality: Criticality;
  contactName?: string;
  contactEmail?: string;
  status: 'Actif' | 'En cours' | 'Terminé';
  owner?: string;
  ownerId?: string;
  description?: string;
  supportedProcessIds?: string[];
  contractDocumentId?: string;
  contractEnd?: string;
  securityScore?: number;
  assessment?: {
    hasIso27001?: boolean;
    hasGdprPolicy?: boolean;
    hasEncryption?: boolean;
    hasBcp?: boolean;
    hasIncidentProcess?: boolean;
    lastAssessmentDate?: string;
  };
  // DORA Specific Fields
  isICTProvider?: boolean;
  supportsCriticalFunction?: boolean;
  doraCriticality?: 'Critical' | 'Important' | 'None';
  serviceType?: 'SaaS' | 'Cloud' | 'Software' | 'Hardware' | 'Consulting' | 'Network' | 'Security';
  relatedAssetIds?: string[];
  relatedRiskIds?: string[];
  relatedProjectIds?: string[];

  riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
  riskAssessment: {
    overallScore: number;
  };
  contract: {
    endDate?: string;
  };
  createdAt: string;
  updatedAt: string;
  reviewDates: {
    contractReview: string;
    securityReview: string;
    complianceReview: string;
    contractEnd?: string;
  };
  serviceCatalog?: string[];
  sla?: string;
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
  relatedRiskIds?: string[]; // Scenarios
  supplierIds?: string[]; // Outsourcing
  recoveryTasks?: {
    id: string;
    title: string;
    description?: string;
    owner: string;
    duration: string; // e.g. "30m", "2h"
    order: number;
  }[];
}

export interface BcpDrill {
  id: string;
  organizationId: string;
  processId: string;
  date: string;
  type: 'Tabletop' | 'Simulation' | 'Bascule réelle';
  result: 'Succès' | 'Succès partiel' | 'Échec';
  notes?: string;
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
  createdAt?: string;

  hasGeminiKey?: boolean;
  hasShodanKey?: boolean;
  hasHibpKey?: boolean;
  hasSafeBrowsingKey?: boolean;
}

export interface CustomRole {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  permissions: Partial<Record<string, ('create' | 'read' | 'update' | 'delete' | 'manage')[]>>;
  createdAt: string;
  updatedAt: string;
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
  storageUsed?: number; // in bytes
  settings?: {
    theme?: 'light' | 'dark' | 'system';
    language?: 'fr' | 'en';
    enableSecNumCloudStorage?: boolean;
  };
}

export interface JoinRequest {
  id: string;
  userId: string;
  displayName: string;
  userEmail: string;
  organizationId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
}

export type DataNode =
  | { id: string; type: 'asset'; data: Asset }
  | { id: string; type: 'risk'; data: Risk }
  | { id: string; type: 'project'; data: Project }
  | { id: string; type: 'audit'; data: Audit }
  | { id: string; type: 'incident'; data: Incident }
  | { id: string; type: 'supplier'; data: Supplier }
  | { id: string; type: 'control'; data: Control };

export type VoxelNode = DataNode & {
  position: [number, number, number];
  color: string;
  size: number;
  connections: string[];
};

export interface ContinuitySuggestion {
  rto: string;
  rpo: string;
  priority: 'Critique' | 'Élevée' | 'Moyenne' | 'Faible';
  recoveryTasks: Array<{
    title: string;
    owner: string;
    duration: string;
    description?: string;
  }>;
  reasoning: string;
}

