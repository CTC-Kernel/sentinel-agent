import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { Committee, Meeting, Decision } from '../types/governance';

const COMMITTEES_COLLECTION = 'committees';
const MEETINGS_COLLECTION = 'meetings';
const DECISIONS_COLLECTION = 'decisions';

export class GovernanceService {
  // --- Committees ---
  static async getCommittees(organizationId: string): Promise<Committee[]> {
    try {
      const q = query(
        collection(db, COMMITTEES_COLLECTION),
        where('organizationId', '==', organizationId),
        orderBy('name', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Committee));
    } catch (error) {
      ErrorLogger.error(error, 'GovernanceService.getCommittees');
      throw error;
    }
  }

  static subscribeToCommittees(organizationId: string, callback: (committees: Committee[]) => void): Unsubscribe {
    const q = query(
      collection(db, COMMITTEES_COLLECTION),
      where('organizationId', '==', organizationId),
      orderBy('name', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Committee)));
    }, (error) => {
      ErrorLogger.error(error, 'GovernanceService.subscribeToCommittees');
    });
    return unsubscribe;
  }

  static async createCommittee(data: Omit<Committee, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COMMITTEES_COLLECTION), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      ErrorLogger.error(error, 'GovernanceService.createCommittee');
      throw error;
    }
  }

  static async updateCommittee(id: string, data: Partial<Committee>): Promise<void> {
    try {
      await updateDoc(doc(db, COMMITTEES_COLLECTION, id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      ErrorLogger.error(error, 'GovernanceService.updateCommittee');
      throw error;
    }
  }

  static async deleteCommittee(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COMMITTEES_COLLECTION, id));
    } catch (error) {
      ErrorLogger.error(error, 'GovernanceService.deleteCommittee');
      throw error;
    }
  }

  // --- Meetings ---
  static async getMeetings(organizationId: string, committeeId?: string): Promise<Meeting[]> {
    try {
      const constraints = [
        where('organizationId', '==', organizationId),
        orderBy('date', 'desc')
      ];
      if (committeeId) {
        constraints.splice(1, 0, where('committeeId', '==', committeeId));
      }
      const q = query(collection(db, MEETINGS_COLLECTION), ...constraints);
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Meeting));
    } catch (error) {
      ErrorLogger.error(error, 'GovernanceService.getMeetings');
      throw error;
    }
  }

  static subscribeToMeetings(organizationId: string, callback: (meetings: Meeting[]) => void, committeeId?: string): Unsubscribe {
    const constraints = [
      where('organizationId', '==', organizationId),
      orderBy('date', 'desc')
    ];
    if (committeeId) {
      constraints.splice(1, 0, where('committeeId', '==', committeeId));
    }
    const q = query(collection(db, MEETINGS_COLLECTION), ...constraints);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Meeting)));
    }, (error) => {
      ErrorLogger.error(error, 'GovernanceService.subscribeToMeetings');
    });
    return unsubscribe;
  }

  static async createMeeting(data: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, MEETINGS_COLLECTION), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      ErrorLogger.error(error, 'GovernanceService.createMeeting');
      throw error;
    }
  }

  static async updateMeeting(id: string, data: Partial<Meeting>): Promise<void> {
    try {
      await updateDoc(doc(db, MEETINGS_COLLECTION, id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      ErrorLogger.error(error, 'GovernanceService.updateMeeting');
      throw error;
    }
  }

  // --- Decisions ---
  static async getDecisions(organizationId: string, committeeId?: string): Promise<Decision[]> {
    try {
      const constraints = [
        where('organizationId', '==', organizationId),
        orderBy('createdAt', 'desc')
      ];
      if (committeeId) {
        constraints.splice(1, 0, where('committeeId', '==', committeeId));
      }
      const q = query(collection(db, DECISIONS_COLLECTION), ...constraints);
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Decision));
    } catch (error) {
      ErrorLogger.error(error, 'GovernanceService.getDecisions');
      throw error;
    }
  }

  static subscribeToDecisions(organizationId: string, callback: (decisions: Decision[]) => void): Unsubscribe {
    const q = query(
      collection(db, DECISIONS_COLLECTION),
      where('organizationId', '==', organizationId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Decision)));
    }, (error) => {
      ErrorLogger.error(error, 'GovernanceService.subscribeToDecisions');
    });
    return unsubscribe;
  }

  static async createDecision(data: Omit<Decision, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, DECISIONS_COLLECTION), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      ErrorLogger.error(error, 'GovernanceService.createDecision');
      throw error;
    }
  }

  static async updateDecision(id: string, data: Partial<Decision>): Promise<void> {
    try {
      await updateDoc(doc(db, DECISIONS_COLLECTION, id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      ErrorLogger.error(error, 'GovernanceService.updateDecision');
      throw error;
    }
  }

  // --- Statistics ---
  static async getGovernanceStats(organizationId: string) {
    try {
      const [committees, meetings, decisions] = await Promise.all([
        this.getCommittees(organizationId),
        this.getMeetings(organizationId),
        this.getDecisions(organizationId),
      ]);

      const now = new Date();
      const upcomingMeetings = meetings.filter(m => new Date(m.date) > now && m.status === 'scheduled');
      const openActions = meetings.flatMap(m => m.actionItems || []).filter(a => a.status === 'open' || a.status === 'in-progress');
      const overdueActions = openActions.filter(a => new Date(a.dueDate) < now);
      const pendingDecisions = decisions.filter(d => d.status === 'proposed');

      return {
        totalCommittees: committees.filter(c => c.status === 'active').length,
        totalMeetings: meetings.length,
        upcomingMeetings: upcomingMeetings.length,
        totalDecisions: decisions.length,
        pendingDecisions: pendingDecisions.length,
        openActionItems: openActions.length,
        overdueActionItems: overdueActions.length,
        approvedDecisions: decisions.filter(d => d.status === 'approved').length,
      };
    } catch (error) {
      ErrorLogger.error(error, 'GovernanceService.getGovernanceStats');
      throw error;
    }
  }
}
