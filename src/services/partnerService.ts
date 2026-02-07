/**
 * Partner Management Service
 * Handles partnerships CRUD and real-time subscriptions
 */

import { collection, query, where, onSnapshot, deleteDoc, doc, Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { ErrorLogger } from './errorLogger';

export interface Partner {
 id: string;
 contactEmail: string;
 status: 'PENDING' | 'ACTIVE';
 certifierId?: string;
 invitedAt: string;
 tenantId: string;
 tenantName?: string;
}

export class PartnerService {
 /**
  * Subscribe to real-time partnership updates for an organization
  */
 static subscribeToPartners(
  organizationId: string,
  onData: (partners: Partner[]) => void,
  onError: (error: Error & { code?: string }) => void
 ): Unsubscribe {
  const q = query(collection(db, 'partnerships'), where('tenantId', '==', organizationId));

  const unsubscribe = onSnapshot(q,
   (snapshot) => {
    const parts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Partner));
    onData(parts);
   },
   (error) => {
    onError(error as Error & { code?: string });
   }
  );
  return unsubscribe;
 }

 /**
  * Invite a certifier partner via Cloud Function
  */
 static async inviteCertifier(email: string, message: string): Promise<void> {
  try {
   const inviteFn = httpsCallable(functions, 'inviteCertifier');
   await inviteFn({ email, message });
  } catch (error) {
   ErrorLogger.error(error, 'PartnerService.inviteCertifier');
   throw error;
  }
 }

 /**
  * Delete a partnership
  */
 static async deletePartnership(partnerId: string): Promise<void> {
  try {
   await deleteDoc(doc(db, 'partnerships', partnerId));
  } catch (error) {
   ErrorLogger.error(error, 'PartnerService.deletePartnership');
   throw error;
  }
 }
}
