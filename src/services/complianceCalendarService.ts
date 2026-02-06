import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import type { ComplianceEvent, ComplianceDeadline } from '../types/complianceCalendar';

const EVENTS_COLLECTION = 'complianceEvents';
const DEADLINES_COLLECTION = 'complianceDeadlines';

export const ComplianceCalendarService = {
  subscribeToEvents(
    organizationId: string,
    onData: (events: ComplianceEvent[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(db, EVENTS_COLLECTION),
      where('organizationId', '==', organizationId),
      orderBy('date', 'asc')
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const events: ComplianceEvent[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as ComplianceEvent[];
        onData(events);
      },
      (error) => {
        ErrorLogger.error(error, 'ComplianceCalendarService.subscribeToEvents');
        onError?.(error);
      }
    );
  },

  async getEvents(organizationId: string): Promise<ComplianceEvent[]> {
    try {
      const q = query(
        collection(db, EVENTS_COLLECTION),
        where('organizationId', '==', organizationId),
        orderBy('date', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ComplianceEvent[];
    } catch (error) {
      ErrorLogger.error(error, 'ComplianceCalendarService.getEvents');
      throw error;
    }
  },

  async createEvent(
    data: Omit<ComplianceEvent, 'id'>,
    organizationId: string,
    userId: string
  ): Promise<string> {
    try {
      const eventData = sanitizeData({
        ...data,
        organizationId,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, EVENTS_COLLECTION), eventData);
      return docRef.id;
    } catch (error) {
      ErrorLogger.error(error, 'ComplianceCalendarService.createEvent');
      throw error;
    }
  },

  async updateEvent(eventId: string, data: Partial<ComplianceEvent>): Promise<void> {
    try {
      const updateData = sanitizeData({ ...data, updatedAt: new Date().toISOString() });
      const docRef = doc(db, EVENTS_COLLECTION, eventId);
      await updateDoc(docRef, updateData);
    } catch (error) {
      ErrorLogger.error(error, 'ComplianceCalendarService.updateEvent');
      throw error;
    }
  },

  async deleteEvent(eventId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, EVENTS_COLLECTION, eventId));
    } catch (error) {
      ErrorLogger.error(error, 'ComplianceCalendarService.deleteEvent');
      throw error;
    }
  },

  async completeEvent(eventId: string): Promise<void> {
    try {
      const docRef = doc(db, EVENTS_COLLECTION, eventId);
      await updateDoc(docRef, sanitizeData({
        status: 'completed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      ErrorLogger.error(error, 'ComplianceCalendarService.completeEvent');
      throw error;
    }
  },

  subscribeToDeadlines(
    organizationId: string,
    onData: (deadlines: ComplianceDeadline[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(db, DEADLINES_COLLECTION),
      where('organizationId', '==', organizationId),
      orderBy('deadline', 'asc')
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const deadlines: ComplianceDeadline[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as ComplianceDeadline[];
        onData(deadlines);
      },
      (error) => {
        ErrorLogger.error(error, 'ComplianceCalendarService.subscribeToDeadlines');
        onError?.(error);
      }
    );
  },

  async createDeadline(
    data: Omit<ComplianceDeadline, 'id'>,
    organizationId: string
  ): Promise<string> {
    try {
      const deadlineData = sanitizeData({
        ...data,
        organizationId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, DEADLINES_COLLECTION), deadlineData);
      return docRef.id;
    } catch (error) {
      ErrorLogger.error(error, 'ComplianceCalendarService.createDeadline');
      throw error;
    }
  },

  async updateDeadline(deadlineId: string, data: Partial<ComplianceDeadline>): Promise<void> {
    try {
      const updateData = sanitizeData({ ...data, updatedAt: new Date().toISOString() });
      const docRef = doc(db, DEADLINES_COLLECTION, deadlineId);
      await updateDoc(docRef, updateData);
    } catch (error) {
      ErrorLogger.error(error, 'ComplianceCalendarService.updateDeadline');
      throw error;
    }
  },

  async deleteDeadline(deadlineId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, DEADLINES_COLLECTION, deadlineId));
    } catch (error) {
      ErrorLogger.error(error, 'ComplianceCalendarService.deleteDeadline');
      throw error;
    }
  },

  async getUpcomingEvents(organizationId: string, days = 30): Promise<ComplianceEvent[]> {
    try {
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      const q = query(
        collection(db, EVENTS_COLLECTION),
        where('organizationId', '==', organizationId),
        where('date', '>=', now.toISOString()),
        where('date', '<=', futureDate.toISOString()),
        orderBy('date', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ComplianceEvent[];
    } catch (error) {
      ErrorLogger.error(error, 'ComplianceCalendarService.getUpcomingEvents');
      throw error;
    }
  },

  async getOverdueEvents(organizationId: string): Promise<ComplianceEvent[]> {
    try {
      const now = new Date().toISOString();
      const q = query(
        collection(db, EVENTS_COLLECTION),
        where('organizationId', '==', organizationId),
        where('date', '<', now),
        where('status', 'in', ['upcoming', 'in-progress']),
        orderBy('date', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ComplianceEvent[];
    } catch (error) {
      ErrorLogger.error(error, 'ComplianceCalendarService.getOverdueEvents');
      throw error;
    }
  },

  computeStats(events: ComplianceEvent[], deadlines: ComplianceDeadline[]) {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const nowISO = now.toISOString();
    const eventsThisMonth = events.filter(
      (e) => e.date >= startOfMonth.toISOString() && e.date <= endOfMonth.toISOString()
    );
    const eventsThisWeek = events.filter(
      (e) => e.date >= startOfWeek.toISOString() && e.date <= endOfWeek.toISOString()
    );
    const overdueEvents = events.filter(
      (e) => e.date < nowISO && (e.status === 'upcoming' || e.status === 'in-progress')
    );
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const criticalDeadlines = deadlines.filter(
      (d) => d.status === 'pending' && d.deadline >= nowISO && d.deadline <= thirtyDaysFromNow.toISOString()
    );
    const completedEvents = events.filter((e) => e.status === 'completed').length;
    const totalNonCancelled = events.filter((e) => e.status !== 'cancelled').length;
    const complianceRate = totalNonCancelled > 0
      ? Math.round((completedEvents / totalNonCancelled) * 100)
      : 100;
    const byCategory = events.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const byFramework = events.reduce((acc, e) => {
      if (e.framework) { acc[e.framework] = (acc[e.framework] || 0) + 1; }
      return acc;
    }, {} as Record<string, number>);
    return {
      totalEvents: events.length,
      eventsThisMonth: eventsThisMonth.length,
      eventsThisWeek: eventsThisWeek.length,
      overdueCount: overdueEvents.length,
      overdueEvents,
      criticalDeadlines: criticalDeadlines.length,
      complianceRate,
      byCategory,
      byFramework,
      totalDeadlines: deadlines.length,
    };
  },
};
