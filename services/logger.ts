
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';

export const logAction = async (
  user: { uid: string; email: string; organizationId?: string } | null,
  action: string,
  resource: string,
  details?: string,
  explicitOrgId?: string // Allow explicit org ID for onboarding logs
) => {
  const orgId = explicitOrgId || user?.organizationId;

  if (!user || !orgId) return;

  try {
    await addDoc(collection(db, 'system_logs'), {
      organizationId: orgId,
      userId: user.uid,
      userEmail: user.email,
      action,
      resource,
      details: details || '',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    ErrorLogger.error(error, 'Logger.logAction');
  }
};
