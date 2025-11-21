
export enum Criticality {
  LOW = 'Faible',
  MEDIUM = 'Moyenne',
  HIGH = 'Élevée',
  CRITICAL = 'Critique'
}

export interface Asset {
  id: string;
  name: string;
  type: 'Matériel' | 'Logiciel' | 'Données' | 'Service' | 'Humain';
  owner: string;
  confidentiality: Criticality;
  integrity: Criticality;
  availability: Criticality;
  location: string;
  createdAt: string;
}

export interface Risk {
  id: string;
  assetId: string;
  threat: string;
  vulnerability: string;
  probability: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  score: number; // Inherent Risk Score
  
  // Residual Risk (After mitigation)
  residualProbability?: 1 | 2 | 3 | 4 | 5;
  residualImpact?: 1 | 2 | 3 | 4 | 5;
  residualScore?: number;

  previousScore?: number; // To track trends
  strategy: 'Accepter' | 'Atténuer' | 'Transférer' | 'Éviter';
  status: 'Ouvert' | 'En cours' | 'Fermé';
  owner: string;
  mitigationControlIds?: string[]; 
  createdAt?: string;
}

export interface Control {
  id: string;
  code: string; // e.g., A.5.1
  name: string;
  description?: string;
  status: 'Non commencé' | 'Implémenté' | 'Partiel' | 'Non applicable' | 'Exclu';
  evidenceIds?: string[]; // IDs of linked documents
  lastUpdated?: string;
}

export interface Document {
  id: string;
  title: string;
  type: 'Politique' | 'Procédure' | 'Preuve' | 'Rapport' | 'Autre';
  version: string;
  status: 'Brouillon' | 'Publié' | 'Obsolète';
  url?: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
}

export interface Audit {
  id: string;
  name: string;
  type: 'Interne' | 'Externe' | 'Certification';
  auditor: string;
  dateScheduled: string;
  status: 'Planifié' | 'En cours' | 'Terminé' | 'Validé';
  findingsCount: number; // Computed or cached count
}

export interface Finding {
  id: string;
  auditId: string;
  description: string;
  type: 'Majeure' | 'Mineure' | 'Observation' | 'Opportunité';
  status: 'Ouvert' | 'Fermé';
  relatedControlId?: string; // LINK: Finding linked to a specific ISO control failure
  createdAt: string;
}

export interface ProjectTask {
  id: string;
  title: string;
  status: 'A faire' | 'En cours' | 'Terminé';
  assignee?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  manager: string;
  status: 'Planifié' | 'En cours' | 'Terminé' | 'Suspendu';
  dueDate: string;
  progress: number; // 0-100
  tasks: ProjectTask[];
  relatedRiskIds?: string[]; // LINK: Projects treating specific risks
  createdAt: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: Criticality;
  status: 'Nouveau' | 'Analyse' | 'Contenu' | 'Résolu' | 'Fermé';
  affectedAssetId?: string;
  reporter: string;
  dateReported: string;
  dateResolved?: string;
}

export interface SystemLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  timestamp: string;
  details?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'auditor' | 'user';
  displayName: string;
  department?: string;
}
