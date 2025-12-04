
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { ErrorLogger } from './errorLogger';

export const logAction = async (
  user: { uid: string; email: string; organizationId?: string } | null,
  action: string,
  resource: string,
  details?: string,
  explicitOrgId?: string // Allow explicit org ID for onboarding logs
) => {
  // SECURITY: Prefer explicit orgId, then user.organizationId
  const orgId = explicitOrgId || user?.organizationId;

  if (!user || !orgId) return;

  try {
    const logEventFn = httpsCallable(functions, 'logEvent');
    await logEventFn({
      organizationId: orgId,
      action,
      resource,
      details: details || ''
    });
  } catch (error) {
    // Fallback or silent fail for logs to avoid crashing app
    ErrorLogger.error(error, 'Logger.logAction');
  }
};
