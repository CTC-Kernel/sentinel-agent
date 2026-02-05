import { collection, getDocs, query, where, doc, updateDoc, deleteDoc, getDoc, serverTimestamp, arrayUnion, writeBatch } from 'firebase/firestore';
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
 const newRef = doc(collection(db, this.PLAYBOOKS_COLLECTION));
 const batch = writeBatch(db);

 batch.set(newRef, sanitizeData({
 ...playbook,
 organizationId,
 createdAt: serverTimestamp(),
 updatedAt: serverTimestamp()
 }));

 await batch.commit();

 await logAction({
 uid: 'user',
 email: 'user@app',
 organizationId: organizationId
 }, 'CREATE', 'IncidentPlaybook', `Playbook créé: ${playbook.title}`);

 return newRef.id;
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

 static async getPlaybook(id: string, organizationId?: string): Promise<IncidentPlaybook | null> {
 try {
 const docRef = doc(db, this.PLAYBOOKS_COLLECTION, id);
 const docSnap = await getDoc(docRef);

 if (docSnap.exists()) {
 // Verify organizationId if provided to prevent cross-tenant access
 if (organizationId && docSnap.data().organizationId !== organizationId) {
 return null;
 }

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

 static async updatePlaybook(id: string, updates: Partial<IncidentPlaybook>, organizationId?: string): Promise<void> {
 try {
 const docRef = doc(db, this.PLAYBOOKS_COLLECTION, id);

 // Verify organizationId if provided to prevent cross-tenant modification
 if (organizationId) {
 const docSnap = await getDoc(docRef);
 if (!docSnap.exists() || docSnap.data().organizationId !== organizationId) {
 throw new Error('Playbook not found or access denied');
 }
 }

 await updateDoc(docRef, sanitizeData({
 ...updates,
 updatedAt: serverTimestamp()
 }));

 await logAction({
 uid: 'system',
 email: 'system@sentinel-grc.com',
 organizationId: organizationId || 'system'
 }, 'UPDATE', 'IncidentPlaybook', `Playbook mis à jour: ${id} `);
 } catch (error) {
 ErrorLogger.error(error, 'IncidentPlaybookService.updatePlaybook');
 throw error;
 }
 }

 static async deletePlaybook(id: string, organizationId?: string): Promise<void> {
 try {
 const docRef = doc(db, this.PLAYBOOKS_COLLECTION, id);

 // Verify organizationId if provided to prevent cross-tenant deletion
 if (organizationId) {
 const docSnap = await getDoc(docRef);
 if (!docSnap.exists() || docSnap.data().organizationId !== organizationId) {
 throw new Error('Playbook not found or access denied');
 }
 }

 await deleteDoc(docRef);

 await logAction({
 uid: 'system',
 email: 'system@sentinel-grc.com',
 organizationId: organizationId || 'system'
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

 // Use writeBatch for atomic creation of response + incident update
 const batch = writeBatch(db);
 const newResponseRef = doc(collection(db, this.RESPONSES_COLLECTION));
 batch.set(newResponseRef, sanitizeData(response));

 // Update incident status
 const incidentRef = doc(db, 'incidents', incidentId);
 batch.update(incidentRef, sanitizeData({
 status: 'Analyse',
 playbookStepsCompleted: []
 }));

 await batch.commit();

 await logAction({
 uid: 'user',
 email: 'user@app',
 organizationId: organizationId
 }, 'CREATE', 'IncidentResponse', `Response initiée: ${incidentId} `);

 return newResponseRef.id;
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
 note?: string,
 userId?: string,
 userName?: string,
 organizationId?: string
 ): Promise<void> {
 try {
 const response = await this.getResponseByDocId(responseId);
 if (!response) throw new Error('Response introuvable');

 // IDOR check
 if (organizationId && response.organizationId !== organizationId) {
 throw new Error('Access denied');
 }

 const responseRef = doc(db, this.RESPONSES_COLLECTION, responseId);
 const atomicUpdates: Record<string, unknown> = {
 updatedAt: serverTimestamp(),
 };

 if (completed) {
 // Use arrayUnion to avoid race conditions
 atomicUpdates.completedSteps = arrayUnion(stepId);
 atomicUpdates.currentStepIndex = Math.min(response.currentStepIndex + 1, 100);

 const timelineEntry: TimelineEvent = {
 id: `step_${stepId}_completed`,
 timestamp: new Date().toISOString(),
 type: 'step_completed',
 description: `Step ${stepId} completed`,
 metadata: { evidence, note }
 };
 atomicUpdates.timeline = arrayUnion(timelineEntry);
 }

 if (evidence) {
 atomicUpdates.evidence = { ...response.evidence, ...evidence };
 }

 if (note) {
 const noteEntry: ResponseNote = {
 id: `note_${Date.now()}`,
 userId: userId || 'unknown',
 userName: userName || 'Unknown User',
 content: note,
 createdAt: new Date().toISOString(),
 category: 'action'
 };
 atomicUpdates.notes = arrayUnion(noteEntry);
 }

 // Use writeBatch for atomic update of response + incident
 const batch = writeBatch(db);
 batch.update(responseRef, sanitizeData(atomicUpdates));

 // Update incident playbook steps
 const incidentRef = doc(db, 'incidents', response.incidentId);
 batch.update(incidentRef, sanitizeData({
 playbookStepsCompleted: [...response.completedSteps, ...(completed ? [stepId] : [])]
 }));

 await batch.commit();

 } catch (error) {
 ErrorLogger.error(error, 'IncidentPlaybookService.updateStepProgress');
 throw error;
 }
 }

 static async escalateIncident(
 responseId: string,
 reason: string,
 escalatedTo: string[],
 organizationId?: string
 ): Promise<void> {
 try {
 const response = await this.getResponseByDocId(responseId);
 if (!response) throw new Error('Response introuvable');

 // IDOR check
 if (organizationId && response.organizationId !== organizationId) {
 throw new Error('Access denied');
 }

 const escalationTimeline: TimelineEvent = {
 id: `escalation_${Date.now()}`,
 timestamp: new Date().toISOString(),
 type: 'escalation',
 description: `Incident escalated: ${reason}`,
 metadata: { escalatedTo, reason }
 };

 // Use writeBatch for atomic update of response + incident
 const batch = writeBatch(db);

 const responseRef = doc(db, this.RESPONSES_COLLECTION, responseId);
 batch.update(responseRef, sanitizeData({
 assignedTo: arrayUnion(...escalatedTo),
 timeline: arrayUnion(escalationTimeline),
 updatedAt: serverTimestamp(),
 }));

 // Update incident status
 const incidentRef = doc(db, 'incidents', response.incidentId);
 batch.update(incidentRef, sanitizeData({
 status: 'Contenu'
 }));

 await batch.commit();

 } catch (error) {
 ErrorLogger.error(error, 'IncidentPlaybookService.escalateIncident');
 throw error;
 }
 }

 static async completeResponse(responseId: string, lessonsLearned?: string, organizationId?: string): Promise<void> {
 try {
 const response = await this.getResponseByDocId(responseId);
 if (!response) throw new Error('Response introuvable');

 // IDOR check
 if (organizationId && response.organizationId !== organizationId) {
 throw new Error('Access denied');
 }

 const updates: Partial<IncidentResponse> = {
 status: 'completed',
 completedAt: new Date().toISOString(),
 completedSteps: response.completedSteps,
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

 // Use writeBatch for atomic update of response + incident
 const batch = writeBatch(db);

 const responseRef = doc(db, this.RESPONSES_COLLECTION, responseId);
 batch.update(responseRef, sanitizeData(updates));

 // Update incident status
 const incidentRef = doc(db, 'incidents', response.incidentId);
 batch.update(incidentRef, sanitizeData({
 status: 'Résolu',
 dateResolved: new Date().toISOString(),
 lessonsLearned
 }));

 await batch.commit();

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
