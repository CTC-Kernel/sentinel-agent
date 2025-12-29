
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { ErrorLogger } from './errorLogger';

export const logAction = async (
    user: { uid: string; email: string; organizationId?: string; displayName?: string } | null,
    action: string,
    resource: string,
    details?: string,
    explicitOrgId?: string, // Allow explicit org ID for onboarding logs
    resourceId?: string, // ID for deep linking
    metadata?: Record<string, unknown>, // Additional context
    changes?: Array<{ field: string; oldValue: unknown; newValue: unknown }> // Granular diffs
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
            details: details || '',
            userDisplayName: user.displayName || user.email, // Fallback to email
            userEmail: user.email,
            resourceId: resourceId || null,
            metadata: metadata || null,
            changes: changes || null
        });
    } catch (error) {
        // Fallback or silent fail for logs to avoid crashing app
        ErrorLogger.error(error, 'Logger.logAction');
    }
};

type AuthAuditPayload = {
    provider: 'password' | 'google' | 'apple' | 'sso';
    status: 'attempt' | 'success' | 'failure';
    email?: string | null;
    errorCode?: string;
    metadata?: Record<string, unknown>;
};

export const logAuthAuditEvent = async (payload: AuthAuditPayload) => {
    try {
        const logAuthAttemptFn = httpsCallable(functions, 'logAuthAttempt');
        await logAuthAttemptFn({
            provider: payload.provider,
            status: payload.status,
            email: payload.email || null,
            errorCode: payload.errorCode || null,
            metadata: payload.metadata || null
        });
    } catch (error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = error as any;
        if (err?.code === 'not-found' || err?.message?.includes('404')) {
            // Silently ignore 404/not-found to prevent console noise if function is missing
            ErrorLogger.debug('Auth audit function not found (expected in local dev)', 'Logger.logAuthAuditEvent');
            return;
        }

        ErrorLogger.warn('Failed to log authentication audit event', 'Logger.logAuthAuditEvent', {
            metadata: { error }
        });
    }
};
