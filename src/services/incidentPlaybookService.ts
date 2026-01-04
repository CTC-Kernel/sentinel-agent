import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, Timestamp, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Incident } from '../types';
import { logAction } from './logger';
import { ErrorLogger } from './errorLogger';
import { PLAYBOOK_TEMPLATES } from '../data/playbookTemplates';
import { sanitizeData } from '../utils/dataSanitizer';

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
  organizationId: string;
  incidentId: string;
  playbookId: string;
  status: 'initiated' | 'in_progress' | 'completed' | 'abandoned';
  startedAt: string;
  completedAt?: string;
  assignedTo: string[];
  currentStepIndex: number;
  completedSteps: string[];
  evidence: Record<string, unknown>;
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
  metadata?: Record<string, unknown>;
}

export class IncidentPlaybookService {
  private static readonly PLAYBOOKS_COLLECTION = 'incidentPlaybooks';
  private static readonly RESPONSES_COLLECTION = 'incidentResponses';

  // Playbook Management
  static async createPlaybook(playbook: Omit<IncidentPlaybook, 'id'>, organizationId: string): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.PLAYBOOKS_COLLECTION), sanitizeData({
        ...playbook,
        organizationId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      }));

      await logAction({
        uid: 'user',
        email: 'user@app',
        organizationId: organizationId
      }, 'CREATE', 'IncidentPlaybook', `Playbook créé: ${playbook.title}`);

      return docRef.id;
    } catch (error) {
      ErrorLogger.error(error, 'IncidentPlaybookService.createPlaybook');
      throw error;
    }
  }

  static async getPlaybooks(organizationId: string, category?: Incident['category']): Promise<IncidentPlaybook[]> {
    try {
      const collectionRef = collection(db, this.PLAYBOOKS_COLLECTION);
      const orgQuery = query(collectionRef, where('organizationId', '==', organizationId));

      if (category) {
        const q = query(orgQuery, where('category', '==', category));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as IncidentPlaybook));
      }

      const snapshot = await getDocs(orgQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as IncidentPlaybook));
    } catch (error) {
      ErrorLogger.error(error, 'IncidentPlaybookService.getPlaybooks');
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
      ErrorLogger.error(error, 'IncidentPlaybookService.getPlaybook');
      return null;
    }
  }

  static async updatePlaybook(id: string, updates: Partial<IncidentPlaybook>): Promise<void> {
    try {
      const docRef = doc(db, this.PLAYBOOKS_COLLECTION, id);
      await updateDoc(docRef, sanitizeData({
        ...updates,
        updatedAt: Timestamp.now()
      }));

      await logAction({
        uid: 'system',
        email: 'system@sentinel-grc.com',
        organizationId: 'system'
      }, 'UPDATE', 'IncidentPlaybook', `Playbook mis à jour: ${id} `);
    } catch (error) {
      ErrorLogger.error(error, 'IncidentPlaybookService.updatePlaybook');
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
      }, 'DELETE', 'IncidentPlaybook', `Playbook supprimé: ${id} `);
    } catch (error) {
      ErrorLogger.error(error, 'IncidentPlaybookService.deletePlaybook');
      throw error;
    }
  }

  // Incident Response Management
  static async initiateResponse(
    incidentId: string,
    playbookId: string,
    assignedTo: string[],
    organizationId: string
  ): Promise<string> {
    try {
      const playbook = await this.getPlaybook(playbookId);
      if (!playbook) {
        throw new Error('Playbook introuvable');
      }

      const response: Omit<IncidentResponse, 'id'> = {
        incidentId,
        organizationId,
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

      const docRef = await addDoc(collection(db, this.RESPONSES_COLLECTION), sanitizeData(response));

      // Update incident status
      await updateDoc(doc(db, 'incidents', incidentId), {
        status: 'Analyse',
        playbookStepsCompleted: []
      });

      await logAction({
        uid: 'user', // conceptual, will be overridden by auth context in logEvent usually or just unused for auth check if orgId matches
        email: 'user@app',
        organizationId: organizationId
      }, 'CREATE', 'IncidentResponse', `Response initiée: ${incidentId} `);

      return docRef.id;
    } catch (error) {
      ErrorLogger.error(error, 'IncidentPlaybookService.initiateResponse');
      throw error;
    }
  }

  static async getResponse(incidentId: string, organizationId: string): Promise<IncidentResponse | null> {
    try {
      const q = query(
        collection(db, this.RESPONSES_COLLECTION),
        where('incidentId', '==', incidentId),
        where('organizationId', '==', organizationId)
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
      ErrorLogger.error(error, 'IncidentPlaybookService.getResponse');
      return null;
    }
  }

  static async updateStepProgress(
    responseId: string,
    stepId: string,
    completed: boolean,
    evidence?: Record<string, unknown>,
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
            id: `step_${stepId} _completed`,
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
            id: `note_${Date.now()} `,
            userId: 'current_user', // Should be passed as parameter
            userName: 'Current User',
            content: note,
            createdAt: serverTimestamp() as unknown as string,
            category: 'action'
          }
        ];
      }

      await updateDoc(doc(db, this.RESPONSES_COLLECTION, responseId), sanitizeData(updates));

      // Update incident playbook steps
      const incidentRef = doc(db, 'incidents', response.incidentId);
      await updateDoc(incidentRef, {
        playbookStepsCompleted: updates.completedSteps || response.completedSteps
      });

    } catch (error) {
      ErrorLogger.error(error, 'IncidentPlaybookService.updateStepProgress');
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
            id: `escalation_${Date.now()} `,
            timestamp: new Date().toISOString(),
            type: 'escalation',
            description: `Incident escalated: ${reason} `,
            metadata: { escalatedTo, reason }
          }
        ]
      };

      await updateDoc(doc(db, this.RESPONSES_COLLECTION, responseId), sanitizeData(updates));

      // Update incident severity if needed
      await updateDoc(doc(db, 'incidents', response.incidentId), {
        status: 'Contenu'
      });

    } catch (error) {
      ErrorLogger.error(error, 'IncidentPlaybookService.escalateIncident');
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
        completedSteps: response.completedSteps, // Ensure this is preserved or updated if needed
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

      await updateDoc(doc(db, this.RESPONSES_COLLECTION, responseId), sanitizeData(updates));

      // Update incident status
      await updateDoc(doc(db, 'incidents', response.incidentId), sanitizeData({
        status: 'Résolu',
        dateResolved: new Date().toISOString(),
        lessonsLearned
      }));

    } catch (error) {
      ErrorLogger.error(error, 'IncidentPlaybookService.completeResponse');
      throw error;
    }
  }

  // Default Playbooks
  static async initializeDefaultPlaybooks(organizationId: string): Promise<void> {
    const defaultPlaybooks = PLAYBOOK_TEMPLATES;

    for (const playbook of defaultPlaybooks) {
      const existing = await this.getPlaybooks(organizationId, playbook.category);
      if (existing.length === 0) {
        // Safe cast as we are creating a new one based on the template
        await this.createPlaybook(playbook, organizationId);
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
      ErrorLogger.error(error, 'IncidentPlaybookService.getResponseByDocId');
      return null;
    }
  }

  // Analytics and Reporting
  static async getResponseStats(timeframe: 'week' | 'month' | 'quarter'): Promise<Record<string, unknown> | null> {
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
      ErrorLogger.error(error, 'IncidentPlaybookService.getResponseStats');
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

    return `${hours}h ${minutes} m`;
  }

  private static async getCommonCategories(responses: IncidentResponse[]): Promise<Record<string, number>> {
    const categories: Record<string, number> = {};
    const playbookCache: Record<string, IncidentPlaybook> = {};

    for (const response of responses) {
      let playbook = playbookCache[response.playbookId];
      if (!playbook) {
        const fetched = await this.getPlaybook(response.playbookId);
        if (fetched) {
          playbook = fetched;
          playbookCache[response.playbookId] = fetched;
        }
      }

      if (playbook) {
        const category = playbook.category || 'Autre';
        categories[category] = (categories[category] || 0) + 1;
      }
    }

    return categories;
  }

  private static calculateEscalationRate(responses: IncidentResponse[]): number {
    if (responses.length === 0) return 0;

    const escalatedCount = responses.filter(r =>
      r.timeline.some(event => event.type === 'escalation')
    ).length;

    return Math.round((escalatedCount / responses.length) * 100);
  }
}
