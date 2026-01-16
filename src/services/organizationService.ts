import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Organization } from '../types/subscriptions';
import { ErrorLogger } from './errorLogger';

export class OrganizationService {
    static async updateOrganization(orgId: string, data: Partial<Organization>): Promise<void> {
        try {
            const orgRef = doc(db, 'organizations', orgId);
            await setDoc(orgRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
        } catch (error) {
            ErrorLogger.error(error, 'OrganizationService.updateOrganization');
            throw error;
        }
    }
}
