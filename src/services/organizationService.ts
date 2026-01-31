import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Organization } from '../types/subscriptions';
import { ErrorLogger } from './errorLogger';
import { useStore } from '../store';
import { hasPermission } from '../utils/permissions';

export class OrganizationService {
    static async updateOrganization(orgId: string, data: Partial<Organization>): Promise<void> {
        try {
            const user = useStore.getState().user;
            if (!user || user.organizationId !== orgId) {
                throw new Error('Cannot update another organization');
            }
            if (!hasPermission(user, 'Settings', 'manage')) {
                throw new Error('Insufficient permissions');
            }
            const orgRef = doc(db, 'organizations', orgId);
            await setDoc(orgRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
        } catch (error) {
            ErrorLogger.error(error, 'OrganizationService.updateOrganization');
            throw error;
        }
    }
}
