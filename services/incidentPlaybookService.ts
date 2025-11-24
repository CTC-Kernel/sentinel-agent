import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Incident } from '../types';
import { logAction } from './logger';

export interface IncidentPlaybook {
  id: string;
  category: Incident['category'];
  title: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  estimatedDuration: string; // e.g., "2-4 hours", "1-2 days"
  requiredResources: string[];
  steps: PlaybookStep[];
  communicationTemplate: {
    internal: string;
    external?: string;
    management: string;
  };
  checklist: ChecklistItem[];
  postIncidentActions: PostIncidentAction[];
  escalationCriteria: EscalationCriteria[];
}

export interface PlaybookStep {
  id: string;
  order: number;
  title: string;
  description: string;
  type: 'detection' | 'containment' | 'eradication' | 'recovery' | 'communication';
  estimatedTime: string;
  requiredRole: string;
  dependencies?: string[]; // IDs of previous steps
  evidenceRequired?: string[];
  automation?: {
    enabled: boolean;
    script?: string;
    conditions?: string[];
  };
}

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  required: boolean;
  category: 'preparation' | 'detection' | 'response' | 'recovery' | 'communication';
}

export interface PostIncidentAction {
  id: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High';
  dueDate: string; // relative to incident resolution, e.g., "+7 days"
  assignedRole?: string;
}

export interface EscalationCriteria {
  id: string;
  condition: string;
  action: string;
  threshold: number;
  timeframe: string;
}

export interface IncidentResponse {
  id: string;
  incidentId: string;
  playbookId: string;
  status: 'initiated' | 'in_progress' | 'completed' | 'abandoned';
  startedAt: string;
  completedAt?: string;
  assignedTo: string[];
  currentStepIndex: number;
  completedSteps: string[];
  evidence: Record<string, any>;
  notes: ResponseNote[];
  timeline: TimelineEvent[];
}

export interface ResponseNote {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
  category: 'observation' | 'action' | 'decision' | 'evidence';
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'step_started' | 'step_completed' | 'escalation' | 'communication' | 'status_change';
  description: string;
  userId?: string;
  userName?: string;
  metadata?: Record<string, any>;
}

export class IncidentPlaybookService {
  private static readonly PLAYBOOKS_COLLECTION = 'incidentPlaybooks';
  private static readonly RESPONSES_COLLECTION = 'incidentResponses';

  // Playbook Management
  static async createPlaybook(playbook: Omit<IncidentPlaybook, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.PLAYBOOKS_COLLECTION), {
        ...playbook,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      await logAction({
        uid: 'system',
        email: 'system@sentinel-grc.com',
        organizationId: 'system'
      }, 'CREATE', 'IncidentPlaybook', `Playbook créé: ${playbook.title}`);

      return docRef.id;
    } catch (error) {
      console.error('Erreur création playbook:', error);
      throw error;
    }
  }

  static async getPlaybooks(category?: Incident['category']): Promise<IncidentPlaybook[]> {
    try {
      const collectionRef = collection(db, this.PLAYBOOKS_COLLECTION);

      if (category) {
        const q = query(collectionRef, where('category', '==', category));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as IncidentPlaybook));
      }

      const snapshot = await getDocs(collectionRef);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as IncidentPlaybook));
    } catch (error) {
      console.error('Erreur récupération playbooks:', error);
      return [];
    }
  }

  static async getPlaybook(id: string): Promise<IncidentPlaybook | null> {
    try {
      const docRef = doc(db, this.PLAYBOOKS_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as IncidentPlaybook;
      }

      return null;
    } catch (error) {
      console.error('Erreur récupération playbook:', error);
      return null;
    }
  }

  static async updatePlaybook(id: string, updates: Partial<IncidentPlaybook>): Promise<void> {
    try {
      const docRef = doc(db, this.PLAYBOOKS_COLLECTION, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });

      await logAction({
        uid: 'system',
        email: 'system@sentinel-grc.com',
        organizationId: 'system'
      }, 'UPDATE', 'IncidentPlaybook', `Playbook mis à jour: ${id}`);
    } catch (error) {
      console.error('Erreur mise à jour playbook:', error);
      throw error;
    }
  }

  static async deletePlaybook(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.PLAYBOOKS_COLLECTION, id));

      await logAction({
        uid: 'system',
        email: 'system@sentinel-grc.com',
        organizationId: 'system'
      }, 'DELETE', 'IncidentPlaybook', `Playbook supprimé: ${id}`);
    } catch (error) {
      console.error('Erreur suppression playbook:', error);
      throw error;
    }
  }

  // Incident Response Management
  static async initiateResponse(
    incidentId: string,
    playbookId: string,
    assignedTo: string[]
  ): Promise<string> {
    try {
      const playbook = await this.getPlaybook(playbookId);
      if (!playbook) {
        throw new Error('Playbook introuvable');
      }

      const response: Omit<IncidentResponse, 'id'> = {
        incidentId,
        playbookId,
        status: 'initiated',
        startedAt: new Date().toISOString(),
        assignedTo,
        currentStepIndex: 0,
        completedSteps: [],
        evidence: {},
        notes: [],
        timeline: [{
          id: 'start',
          timestamp: new Date().toISOString(),
          type: 'step_started',
          description: 'Response initiated',
          metadata: { playbookId, assignedTo }
        }]
      };

      const docRef = await addDoc(collection(db, this.RESPONSES_COLLECTION), response);

      // Update incident status
      await updateDoc(doc(db, 'incidents', incidentId), {
        status: 'Analyse',
        playbookStepsCompleted: []
      });

      await logAction({
        uid: 'system',
        email: 'system@sentinel-grc.com',
        organizationId: 'system'
      }, 'CREATE', 'IncidentResponse', `Response initiée: ${incidentId}`);

      return docRef.id;
    } catch (error) {
      console.error('Erreur initiation response:', error);
      throw error;
    }
  }

  static async getResponse(incidentId: string): Promise<IncidentResponse | null> {
    try {
      const q = query(
        collection(db, this.RESPONSES_COLLECTION),
        where('incidentId', '==', incidentId)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return {
          id: doc.id,
          ...doc.data()
        } as IncidentResponse;
      }

      return null;
    } catch (error) {
      console.error('Erreur récupération response:', error);
      return null;
    }
  }

  static async updateStepProgress(
    responseId: string,
    stepId: string,
    completed: boolean,
    evidence?: Record<string, any>,
    note?: string
  ): Promise<void> {
    try {
      const response = await this.getResponseByDocId(responseId);
      if (!response) throw new Error('Response introuvable');

      const updates: Partial<IncidentResponse> = {};

      if (completed) {
        updates.completedSteps = [...response.completedSteps, stepId];
        updates.currentStepIndex = Math.min(response.currentStepIndex + 1, 100);

        // Add timeline event
        updates.timeline = [
          ...response.timeline,
          {
            id: `step_${stepId}_completed`,
            timestamp: new Date().toISOString(),
            type: 'step_completed',
            description: `Step ${stepId} completed`,
            metadata: { evidence, note }
          }
        ];
      }

      if (evidence) {
        updates.evidence = { ...response.evidence, ...evidence };
      }

      if (note) {
        updates.notes = [
          ...response.notes,
          {
            id: `note_${Date.now()}`,
            userId: 'current_user', // Should be passed as parameter
            userName: 'Current User',
            content: note,
            createdAt: new Date().toISOString(),
            category: 'action'
          }
        ];
      }

      await updateDoc(doc(db, this.RESPONSES_COLLECTION, responseId), updates);

      // Update incident playbook steps
      const incidentRef = doc(db, 'incidents', response.incidentId);
      await updateDoc(incidentRef, {
        playbookStepsCompleted: updates.completedSteps || response.completedSteps
      });

    } catch (error) {
      console.error('Erreur mise à jour step:', error);
      throw error;
    }
  }

  static async escalateIncident(
    responseId: string,
    reason: string,
    escalatedTo: string[]
  ): Promise<void> {
    try {
      const response = await this.getResponseByDocId(responseId);
      if (!response) throw new Error('Response introuvable');

      const updates: Partial<IncidentResponse> = {
        assignedTo: [...response.assignedTo, ...escalatedTo],
        timeline: [
          ...response.timeline,
          {
            id: `escalation_${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: 'escalation',
            description: `Incident escalated: ${reason}`,
            metadata: { escalatedTo, reason }
          }
        ]
      };

      await updateDoc(doc(db, this.RESPONSES_COLLECTION, responseId), updates);

      // Update incident severity if needed
      await updateDoc(doc(db, 'incidents', response.incidentId), {
        status: 'Contenu'
      });

    } catch (error) {
      console.error('Erreur escalation:', error);
      throw error;
    }
  }

  static async completeResponse(responseId: string, lessonsLearned?: string): Promise<void> {
    try {
      const response = await this.getResponseByDocId(responseId);
      if (!response) throw new Error('Response introuvable');

      const updates: Partial<IncidentResponse> = {
        status: 'completed',
        completedAt: new Date().toISOString(),
        timeline: [
          ...response.timeline,
          {
            id: 'response_completed',
            timestamp: new Date().toISOString(),
            type: 'status_change',
            description: 'Response completed',
            metadata: { lessonsLearned }
          }
        ]
      };

      await updateDoc(doc(db, this.RESPONSES_COLLECTION, responseId), updates);

      // Update incident status
      await updateDoc(doc(db, 'incidents', response.incidentId), {
        status: 'Résolu',
        dateResolved: new Date().toISOString(),
        lessonsLearned
      });

    } catch (error) {
      console.error('Erreur completion response:', error);
      throw error;
    }
  }

  // Default Playbooks
  static async initializeDefaultPlaybooks(): Promise<void> {
    const defaultPlaybooks: Omit<IncidentPlaybook, 'id'>[] = [
      {
        category: 'Ransomware',
        title: 'Ransomware Response Playbook',
        description: 'Procédure de réponse à une attaque ransomware',
        severity: 'Critical',
        estimatedDuration: '4-8 hours',
        requiredResources: ['Security Team', 'IT Team', 'Legal', 'Communications'],
        steps: [
          {
            id: 'detect',
            order: 1,
            title: 'Detection and Assessment',
            description: 'Confirmer l\'attaque et évaluer l\'étendue',
            type: 'detection',
            estimatedTime: '30-60 minutes',
            requiredRole: 'Security Analyst',
            evidenceRequired: ['ransom_note', 'encrypted_files_list', 'network_logs']
          },
          {
            id: 'contain',
            order: 2,
            title: 'Containment',
            description: 'Isoler les systèmes affectés',
            type: 'containment',
            estimatedTime: '1-2 hours',
            requiredRole: 'IT Administrator',
            dependencies: ['detect']
          },
          {
            id: 'communicate',
            order: 3,
            title: 'Communication',
            description: 'Notifier les parties prenantes',
            type: 'communication',
            estimatedTime: '30 minutes',
            requiredRole: 'Crisis Manager'
          }
        ],
        communicationTemplate: {
          internal: 'Incident ransomware en cours - Équipe de sécurité mobilisée',
          external: 'Nous investiguons un incident de sécurité - Mesures prises',
          management: 'ATTENTION: Incident ransomware confirmé - Impact potentiel élevé'
        },
        checklist: [
          {
            id: 'backup_check',
            title: 'Vérifier la disponibilité des backups',
            description: 'Confirmer que les backups sont accessibles et non infectés',
            required: true,
            category: 'preparation'
          }
        ],
        postIncidentActions: [
          {
            id: 'forensic_analysis',
            title: 'Analyse forensique complète',
            description: 'Analyser les vecteurs d\'attaque et les compromissions',
            priority: 'High',
            dueDate: '+3 days'
          }
        ],
        escalationCriteria: [
          {
            id: 'critical_systems',
            condition: 'Systèmes critiques affectés',
            action: 'Escalade vers C-level',
            threshold: 1,
            timeframe: 'immediate'
          }
        ]
      },
      {
        category: 'Phishing',
        title: 'Phishing Response Playbook',
        description: 'Procédure de réponse à une campagne de phishing',
        severity: 'Medium',
        estimatedDuration: '2-4 hours',
        requiredResources: ['Security Team', 'Communications'],
        steps: [
          {
            id: 'identify',
            order: 1,
            title: 'Identification',
            description: 'Analyser l\'email de phishing',
            type: 'detection',
            estimatedTime: '15-30 minutes',
            requiredRole: 'Security Analyst'
          },
          {
            id: 'block',
            order: 2,
            title: 'Blocking',
            description: 'Bloquer l\'expéditeur et les URLs malveillantes',
            type: 'containment',
            estimatedTime: '30 minutes',
            requiredRole: 'Security Engineer'
          }
        ],
        communicationTemplate: {
          internal: 'Campagne de phishing détectée - Mesures de protection en place',
          management: 'Campaigne phishing identifiée - Impact limité'
        },
        checklist: [
          {
            id: 'user_awareness',
            title: 'Sensibilisation des utilisateurs',
            description: 'Informer les utilisateurs de la campagne',
            required: true,
            category: 'communication'
          }
        ],
        postIncidentActions: [
          {
            id: 'training_update',
            title: 'Mise à jour de la formation',
            description: 'Ajouter des exemples récents à la formation',
            priority: 'Medium',
            dueDate: '+7 days'
          }
        ],
        escalationCriteria: []
      }
    ];

    for (const playbook of defaultPlaybooks) {
      const existing = await this.getPlaybooks(playbook.category);
      if (existing.length === 0) {
        await this.createPlaybook(playbook);
      }
    }
  }

  private static async getResponseByDocId(responseId: string): Promise<IncidentResponse | null> {
    try {
      const docRef = doc(db, this.RESPONSES_COLLECTION, responseId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as IncidentResponse;
      }

      return null;
    } catch (error) {
      console.error('Erreur récupération response par ID:', error);
      return null;
    }
  }

  // Analytics and Reporting
  static async getResponseStats(timeframe: 'week' | 'month' | 'quarter'): Promise<any> {
    try {
      // Implementation for response statistics
      const now = new Date();
      const startDate = new Date();

      switch (timeframe) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(now.getMonth() - 3);
          break;
      }

      const q = query(
        collection(db, this.RESPONSES_COLLECTION),
        where('startedAt', '>=', startDate.toISOString())
      );

      const snapshot = await getDocs(q);
      const responses = snapshot.docs.map(doc => doc.data() as IncidentResponse);

      return {
        total: responses.length,
        completed: responses.filter(r => r.status === 'completed').length,
        averageDuration: this.calculateAverageDuration(responses),
        commonCategories: await this.getCommonCategories(responses),
        escalationRate: this.calculateEscalationRate(responses)
      };
    } catch (error) {
      console.error('Erreur statistiques response:', error);
      return null;
    }
  }

  private static calculateAverageDuration(responses: IncidentResponse[]): string {
    const completed = responses.filter(r => r.completedAt);
    if (completed.length === 0) return 'N/A';

    const totalMinutes = completed.reduce((sum, r) => {
      const start = new Date(r.startedAt);
      const end = new Date(r.completedAt!);
      return sum + (end.getTime() - start.getTime()) / (1000 * 60);
    }, 0);

    const avgMinutes = totalMinutes / completed.length;
    const hours = Math.floor(avgMinutes / 60);
    const minutes = Math.round(avgMinutes % 60);

    return `${hours}h ${minutes}m`;
  }

  private static async getCommonCategories(responses: IncidentResponse[]): Promise<any> {
    // Implementation to get most common incident categories
    return {};
  }

  private static calculateEscalationRate(responses: IncidentResponse[]): number {
    // Implementation to calculate escalation rate
    return 0;
  }
}
