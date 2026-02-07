import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { Project, UserProfile } from '../types';
import { ErrorLogger } from './errorLogger';
import { HardwareInfo } from '../utils/hardwareDetection';

export interface IntakeOptions {
 projects: Project[];
 users: UserProfile[];
}

export interface AssetSubmissionData {
 name: string;
 serialNumber: string;
 userId: string;
 projectId: string;
 notes: string;
 hardwareType: string;
 orgId: string;
 hardware: HardwareInfo;
}

export class IntakeService {
 /**
 * Fetch projects and users options for the organization
 */
 static async fetchOptions(orgId: string): Promise<IntakeOptions> {
 try {
 const [projSnap, userSnap] = await Promise.all([
 getDocs(query(collection(db, 'projects'), where('organizationId', '==', orgId), limit(500))),
 getDocs(query(collection(db, 'users'), where('organizationId', '==', orgId), limit(500)))
 ]);

 return {
 projects: projSnap.docs.map(d => ({ id: d.id, ...d.data() } as Project)),
 users: userSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile))
 };
 } catch (error) {
 ErrorLogger.error(error, 'IntakeService.fetchOptions');
 throw error;
 }
 }

 /**
 * Submit a new kiosk asset
 */
 static async submitAsset(data: AssetSubmissionData): Promise<void> {
 try {
 const submitKioskAsset = httpsCallable(functions, 'submitKioskAsset');
 await submitKioskAsset(data);
 } catch (error) {
 ErrorLogger.error(error, 'IntakeService.submitAsset');
 throw error;
 }
 }
}
