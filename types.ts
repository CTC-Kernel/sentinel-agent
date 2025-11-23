
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
  mitigationControlIds?: string[];
  lastReviewDate?: string;
  createdAt?: string;
}

export interface Control {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description?: string;
  status: 'Non commencé' | 'Implémenté' | 'Partiel' | 'Non applicable' | 'Exclu';
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
  status: 'A faire' | 'En cours' | 'Terminé';
  assignee?: string;
  dueDate?: string;
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
  dateResolved?: string;
  lessonsLearned?: string;
}

export interface Supplier {
  id: string;
  organizationId: string;
  name: string;
  category: 'SaaS' | 'Hébergement' | 'Matériel' | 'Consulting' | 'Autre';
  criticality: Criticality;
  contactName: string;
  contactEmail: string;
  contractEnd?: string;
  contractDocumentId?: string;
  status: 'Actif' | 'En cours' | 'Terminé';
  securityScore?: number;
  assessment?: {
    hasIso27001: boolean;
    hasGdprPolicy: boolean;
    hasEncryption: boolean;
    hasBcp: boolean;
    hasIncidentProcess: boolean;
    lastAssessmentDate: string;
  };
  description?: string;
  createdAt: string;
}

export interface ProcessingActivity {
  id: string;
  organizationId: string;
  name: string;
  purpose: string;
  manager: string;
  legalBasis: 'Consentement' | 'Contrat' | 'Obligation Légale' | 'Intérêt Légitime';
  dataCategories: string[];
  dataSubjects: string[];
  retentionPeriod: string;
  hasDPIA: boolean;
  status: 'Actif' | 'Archivé' | 'En projet';
  createdAt: string;
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

export interface AlertNotification {
  id: string;
  type: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  date: string;
  link?: string;
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
