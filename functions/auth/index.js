/**
 * Auth Module - SSO and Authentication Functions
 * Domain: Authentication, SSO Settings, Auth Audit Logging
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { validate, z } = require('../utils/validation');

// SSO Provider Configuration
const ssoProviderEnum = z.enum(['password', 'google', 'apple', 'microsoft', 'okta', 'saml']);
const enforcementModeEnum = z.enum(['monitor', 'strict']);
const SUPPORTED_SSO_PROVIDERS = ssoProviderEnum.options;
const DEFAULT_ALLOWED_SSO_PROVIDERS = ['password', 'google', 'apple'];

const PROVIDER_NORMALIZATION_MAP = {
    password: 'password',
    'google.com': 'google',
    google: 'google',
    'apple.com': 'apple',
    apple: 'apple',
    'microsoft.com': 'microsoft',
    microsoft: 'microsoft',
    'login.microsoftonline.com': 'microsoft',
    okta: 'okta',
    'okta.com': 'okta',
    saml: 'saml',
    'saml.com': 'saml'
};

const normalizeProvider = (providerId = '') => {
    const key = providerId.toLowerCase();
    return PROVIDER_NORMALIZATION_MAP[key] || key.replace('.com', '');
};

const getDefaultSsoSettings = (organizationId) => ({
    organizationId,
    allowedProviders: DEFAULT_ALLOWED_SSO_PROVIDERS,
    defaultProvider: 'password',
    enforcementMode: 'monitor',
    notes: null,
    updatedAt: null,
    updatedBy: null
});

const getSsoSettingsDocRef = (orgId) => admin.firestore().collection('organization_settings').doc(orgId);

const fetchOrganizationSsoSettings = async (organizationId) => {
    const doc = await getSsoSettingsDocRef(organizationId).get();
    if (!doc.exists) {
        return getDefaultSsoSettings(organizationId);
    }

    const data = doc.data() || {};
    const sanitizedAllowedProviders = (data.allowedProviders || DEFAULT_ALLOWED_SSO_PROVIDERS)
        .map(normalizeProvider)
        .filter((provider) => SUPPORTED_SSO_PROVIDERS.includes(provider));

    return {
        ...getDefaultSsoSettings(organizationId),
        ...data,
        allowedProviders: Array.from(new Set(sanitizedAllowedProviders)),
        defaultProvider: data.defaultProvider ? normalizeProvider(data.defaultProvider) : 'password'
    };
};

const persistAuthAuditLog = async ({
    provider,
    status,
    email,
    errorCode,
    metadata,
    organizationId,
    ip,
    source
}) => {
    try {
        await admin.firestore().collection('auth_audit_logs').add({
            provider: normalizeProvider(provider),
            status,
            email: (email || '').toLowerCase(),
            errorCode: errorCode || null,
            metadata: metadata || null,
            organizationId: organizationId || null,
            timestamp: new Date().toISOString(),
            source: source || 'client_pre_auth',
            ip: ip || null
        });
    } catch (error) {
        logger.error('Error persisting auth audit log', error);
    }
};

const resolveOrganizationContext = async ({ userId, email }) => {
    const db = admin.firestore();
    const context = { organizationId: null, userRecord: null };
    const normalizedEmail = email ? email.toLowerCase() : null;

    if (userId) {
        const userSnap = await db.collection('users').doc(userId).get();
        if (userSnap.exists) {
            context.userRecord = { id: userSnap.id, ...userSnap.data() };
            context.organizationId = userSnap.data().organizationId || null;
        }
    }

    if (!context.organizationId && normalizedEmail) {
        const userQuery = await db.collection('users').where('email', '==', normalizedEmail).limit(1).get();
        if (!userQuery.empty) {
            const doc = userQuery.docs[0];
            context.userRecord = { id: doc.id, ...doc.data() };
            context.organizationId = doc.data().organizationId || null;
        }
    }

    if (!context.organizationId && normalizedEmail && normalizedEmail.includes('@')) {
        const domain = normalizedEmail.split('@')[1];
        if (domain) {
            const orgQuery = await db.collection('organizations').where('domain', '==', domain).limit(1).get();
            if (!orgQuery.empty) {
                context.organizationId = orgQuery.docs[0].id;
            }
        }
    }

    return context;
};

const ssoSettingsSchema = z.object({
    allowedProviders: z.array(ssoProviderEnum).min(1),
    defaultProvider: ssoProviderEnum.optional(),
    enforcementMode: enforcementModeEnum.default('monitor'),
    notes: z.string().max(2000).nullable().optional()
});

const canManageSsoSettings = (token = {}) =>
    token.superAdmin === true || token.role === 'admin' || token.role === 'rssi';

const canViewSsoSettings = (token = {}) =>
    canManageSsoSettings(token) || token.role === 'auditor';

// Rate limiting configuration for auth attempts
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX_ATTEMPTS = 10; // Max 10 attempts per window per email/IP

/**
 * Check rate limit for auth attempts
 * @param {string} email - User email
 * @param {string} ip - Client IP
 * @returns {Promise<boolean>} - True if rate limit exceeded
 */
const checkAuthRateLimit = async (email, ip) => {
    const db = admin.firestore();
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

    // Create a composite key for rate limiting (email + IP or just IP for anonymous)
    const rateLimitKey = email ? `${email.toLowerCase()}_${ip || 'unknown'}` : `anonymous_${ip || 'unknown'}`;

    try {
        const recentAttempts = await db.collection('auth_rate_limits')
            .where('key', '==', rateLimitKey)
            .where('timestamp', '>=', windowStart.toISOString())
            .get();

        if (recentAttempts.size >= RATE_LIMIT_MAX_ATTEMPTS) {
            logger.warn(`Rate limit exceeded for ${rateLimitKey}`, {
                attempts: recentAttempts.size,
                limit: RATE_LIMIT_MAX_ATTEMPTS
            });
            return true;
        }

        // Record this attempt
        await db.collection('auth_rate_limits').add({
            key: rateLimitKey,
            timestamp: new Date().toISOString(),
            email: email?.toLowerCase() || null,
            ip: ip || null
        });

        return false;
    } catch (error) {
        logger.error('Error checking rate limit', error);
        // Fail open - don't block legitimate users if rate limit check fails
        return false;
    }
};

/**
 * Public Callable Function to log authentication attempts (pre-login)
 * SECURITY: Rate limited to prevent abuse
 */
exports.logAuthAttempt = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1',
    cors: [
        'http://localhost:8080',
        'https://app.cyber-threat-consulting.com',
        'https://sentinel-grc-a8701.web.app',
        'https://sentinel-grc-a8701.firebaseapp.com'
    ]
}, async (request) => {
    const { provider, status, email, errorCode, metadata } = request.data;
    const clientIp = request.rawRequest?.ip || null;

    if (!provider || !status) {
        throw new HttpsError('invalid-argument', 'Missing required auth log fields (provider, status).');
    }

    // SECURITY: Check rate limit before processing
    const rateLimited = await checkAuthRateLimit(email, clientIp);
    if (rateLimited) {
        throw new HttpsError('resource-exhausted', 'Too many authentication attempts. Please try again later.');
    }

    try {
        const orgContext = await resolveOrganizationContext({
            userId: metadata?.userId,
            email
        });

        await persistAuthAuditLog({
            provider,
            status,
            email,
            errorCode,
            metadata,
            ip: clientIp,
            organizationId: orgContext.organizationId,
            source: 'client_pre_auth'
        });

        return { success: true };
    } catch (error) {
        logger.error('Error in logAuthAttempt callable:', error);
        throw new HttpsError('internal', 'Failed to log auth attempt.');
    }
});

/**
 * Before User Signed In validation
 */
// NOTE: enforceAppCheck is intentionally false here because this function is called
// during the sign-in flow before the client has fully initialized App Check.
// Blocking auth functions (or their callable equivalents) cannot enforce App Check
// as the token may not yet be available when the user is authenticating for the first time.
exports.beforeUserSignedIn = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1',
    enforceAppCheck: false
}, async (request) => {
    try {
        const providerId = request.data?.providerId || 'password';
        const normalizedProvider = normalizeProvider(providerId);
        const user = request.auth;

        if (!user) {
            throw new HttpsError('unauthenticated', 'User must be authenticated.');
        }

        const { organizationId, userRecord } = await resolveOrganizationContext({
            userId: user.uid,
            email: user.token.email || request.data?.email
        });

        if (!organizationId) {
            await persistAuthAuditLog({
                provider: normalizedProvider,
                status: 'failure',
                email: user.token.email || request.data?.email,
                errorCode: 'missing_organization',
                metadata: { reason: 'No organization context resolved before sign-in' },
                source: 'before_sign_in',
                ip: request.rawRequest?.ip || null
            });
            return { success: true, customClaims: {} };
        }

        const settings = await fetchOrganizationSsoSettings(organizationId);
        const isAllowed = settings.allowedProviders.includes(normalizedProvider);

        if (!isAllowed && settings.enforcementMode === 'strict') {
            await persistAuthAuditLog({
                provider: normalizedProvider,
                status: 'failure',
                email: user.token.email || request.data?.email,
                errorCode: 'provider_not_allowed',
                metadata: {
                    enforcementMode: settings.enforcementMode,
                    allowedProviders: settings.allowedProviders,
                    requestedProvider: normalizedProvider
                },
                organizationId,
                source: 'before_sign_in',
                ip: request.rawRequest?.ip || null
            });

            throw new HttpsError('permission-denied', 'SSO provider is not allowed for this organization.');
        }

        await persistAuthAuditLog({
            provider: normalizedProvider,
            status: isAllowed ? 'success' : 'attempt',
            email: user.token.email || request.data?.email,
            metadata: {
                enforcementMode: settings.enforcementMode,
                allowedProviders: settings.allowedProviders,
                requestedProvider: normalizedProvider
            },
            organizationId,
            source: 'before_sign_in',
            ip: request.rawRequest?.ip || null
        });

        return {
            success: true,
            customClaims: {
                organizationId,
                role: userRecord?.role || 'user',
                allowedSsoProviders: settings.allowedProviders,
                provider: normalizedProvider,
                ssoEnforcementMode: settings.enforcementMode
            }
        };
    } catch (error) {
        logger.error('Error in beforeUserSignedIn:', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'An error occurred during sign-in validation.');
    }
});

/**
 * Get SSO Settings for an organization
 */
exports.getSsoSettings = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in to access SSO settings.');
    }

    const token = request.auth.token;
    // SECURITY: Non-super_admin users ALWAYS use their token organizationId
    // Only super_admin can specify a different organizationId via request data
    const organizationId = (token.superAdmin === true && request.data?.organizationId)
        ? request.data.organizationId
        : token.organizationId;

    if (!organizationId) {
        throw new HttpsError('invalid-argument', 'Organization ID is required.');
    }

    if (!canViewSsoSettings(token) && token.organizationId !== organizationId) {
        throw new HttpsError('permission-denied', 'Insufficient permissions to view organization SSO settings.');
    }

    try {
        const settings = await fetchOrganizationSsoSettings(organizationId);
        return { data: settings, supportedProviders: SUPPORTED_SSO_PROVIDERS };
    } catch (error) {
        logger.error('Error fetching SSO settings', error);
        throw new HttpsError('internal', 'Failed to fetch settings.');
    }
});

/**
 * Update SSO Settings for an organization
 */
exports.updateSsoSettings = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in to update SSO settings.');
    }

    const token = request.auth.token;
    const organizationId = request.auth.token.organizationId;

    if (!organizationId) {
        throw new HttpsError('failed-precondition', 'Organization ID not found in token');
    }

    if (!canManageSsoSettings(token) || token.organizationId !== organizationId) {
        throw new HttpsError('permission-denied', 'Insufficient permissions to update organization SSO settings.');
    }

    const payload = validate(ssoSettingsSchema, request.data || {});
    const normalizedAllowedProviders = Array.from(new Set(payload.allowedProviders.map(normalizeProvider)));

    try {
        const docRef = getSsoSettingsDocRef(organizationId);
        const nextSettings = {
            allowedProviders: normalizedAllowedProviders,
            defaultProvider: payload.defaultProvider ? normalizeProvider(payload.defaultProvider) : normalizedAllowedProviders[0],
            enforcementMode: payload.enforcementMode || 'monitor',
            notes: payload.notes || null,
            updatedAt: new Date().toISOString(),
            updatedBy: request.auth.uid
        };

        await docRef.set(nextSettings, { merge: true });
        await persistAuthAuditLog({
            provider: 'sso',
            status: 'success',
            email: token.email,
            metadata: {
                action: 'update_sso_settings',
                organizationId,
                allowedProviders: nextSettings.allowedProviders,
                defaultProvider: nextSettings.defaultProvider,
                enforcementMode: nextSettings.enforcementMode
            },
            organizationId,
            ip: request.rawRequest?.ip || null,
            source: 'backend'
        });

        return { success: true, data: nextSettings };
    } catch (error) {
        logger.error('Error updating SSO settings', error);
        throw new HttpsError('internal', 'An internal error occurred while updating settings.');
    }
});

/**
 * Request a password reset email with a custom template.
 */
exports.requestPasswordReset = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1'
}, async (request) => {
    const { getPasswordResetEmailHtml } = require('../services/emailTemplates');

    const email = request.data.email;
    if (!email) {
        throw new HttpsError('invalid-argument', 'Email is required.');
    }

    // SECURITY: Rate limit password reset requests to 5 per email per hour
    const clientIp = request.rawRequest?.ip || 'unknown';
    const rateLimitKey = `pwd_reset_${email.toLowerCase()}`;
    const db = admin.firestore();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    try {
        const recentRequests = await db.collection('auth_rate_limits')
            .where('key', '==', rateLimitKey)
            .where('timestamp', '>=', oneHourAgo.toISOString())
            .get();

        if (recentRequests.size >= 5) {
            logger.warn(`Password reset rate limit exceeded for ${email}`, { ip: clientIp });
            // Return success to avoid email enumeration, but do not actually send
            return { success: true, message: 'Reset email sent.' };
        }

        // Record this attempt
        await db.collection('auth_rate_limits').add({
            key: rateLimitKey,
            timestamp: new Date().toISOString(),
            email: email.toLowerCase(),
            ip: clientIp,
            type: 'password_reset'
        });
    } catch (rateLimitError) {
        // Fail open - don't block legitimate users if rate limit check fails
        logger.error('Error checking password reset rate limit', rateLimitError);
    }

    try {
        const link = await admin.auth().generatePasswordResetLink(email);

        let userName = 'User';
        try {
            const userRecord = await admin.auth().getUserByEmail(email);
            userName = userRecord.displayName || 'User';
        } catch (e) {
            logger.warn(`Could not fetch user details for ${email}`, e);
        }

        await admin.firestore().collection('mail_queue').add({
            to: email,
            message: {
                subject: 'Reinitialisation de votre mot de passe - Sentinel GRC',
                html: getPasswordResetEmailHtml(userName, link)
            },
            type: 'PASSWORD_RESET',
            status: 'PENDING',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        logger.info(`Password reset requested for ${email}`);
        return { success: true, message: 'Reset email sent.' };

    } catch (error) {
        logger.error('Error requesting password reset:', error);
        if (error.code === 'auth/user-not-found') {
            logger.warn(`Password reset requested for non-existent email: ${email}`);
            return { success: true, message: 'Reset email sent.' };
        }
        throw new HttpsError('internal', 'Internal error processing request.');
    }
});

/**
 * Verify MFA status for super admin actions
 * SECURITY: This function verifies that the user has recently authenticated with MFA
 * and is authorized for sensitive super admin operations.
 *
 * Note: Firebase doesn't provide direct TOTP verification server-side.
 * This function checks:
 * 1. User has super_admin role
 * 2. User has MFA enrolled
 * 3. Token was issued recently (within 5 minutes for sensitive actions)
 */
exports.verifyMFACode = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const uid = request.auth.uid;
    const token = request.auth.token;

    // SECURITY: Only super_admin can use this verification
    if (token.role !== 'super_admin' && !token.superAdmin) {
        logger.warn(`Non-super-admin attempted MFA verification: ${uid}`);
        throw new HttpsError('permission-denied', 'Only super admins can use this verification.');
    }

    try {
        // Get the user's MFA status from Firebase Auth
        const userRecord = await admin.auth().getUser(uid);

        // Check if user has TOTP MFA enrolled
        const hasTOTP = userRecord.multiFactor?.enrolledFactors?.some(
            f => f.factorId === 'totp'
        );

        if (!hasTOTP) {
            logger.warn(`Super admin ${uid} attempted action without MFA enrolled`);
            throw new HttpsError('failed-precondition', 'MFA is not enrolled. Please enable TOTP authentication.');
        }

        // Verify token was issued recently (within 5 minutes)
        // This ensures the user recently authenticated (with MFA)
        const authTime = token.auth_time;
        const now = Math.floor(Date.now() / 1000);
        const MAX_AUTH_AGE_SECONDS = 5 * 60; // 5 minutes

        if (!authTime || (now - authTime) > MAX_AUTH_AGE_SECONDS) {
            logger.info(`Super admin ${uid} auth token too old for sensitive action`);
            throw new HttpsError('failed-precondition', 'Session expired for sensitive actions. Please re-authenticate.');
        }

        // Log successful MFA verification for audit
        await persistAuthAuditLog({
            provider: 'mfa_verification',
            status: 'success',
            email: token.email,
            metadata: {
                action: 'super_admin_mfa_check',
                hasTOTP: true,
                authAge: now - authTime
            },
            organizationId: token.organizationId,
            ip: request.rawRequest?.ip || null,
            source: 'backend'
        });

        logger.info(`MFA verified for super admin action: ${uid}`);

        return {
            verified: true,
            mfaEnrolled: true,
            authAge: now - authTime
        };

    } catch (error) {
        if (error instanceof HttpsError) {
            throw error;
        }
        logger.error('Error verifying MFA:', error);
        throw new HttpsError('internal', 'Failed to verify MFA status.');
    }
});
