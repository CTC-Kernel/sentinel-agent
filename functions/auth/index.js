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

/**
 * Public Callable Function to log authentication attempts (pre-login)
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

    if (!provider || !status) {
        throw new HttpsError('invalid-argument', 'Missing required auth log fields (provider, status).');
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
            ip: request.rawRequest?.ip || null,
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
    const organizationId = request.auth.token.organizationId || request.data?.organizationId;

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
    const organizationId = request.auth.token.organizationId || request.data?.organizationId;

    if (!organizationId) {
        throw new HttpsError('invalid-argument', 'Organization ID is required.');
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
        throw new HttpsError('internal', 'Failed to update settings: ' + error.message);
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

    try {
        const link = await admin.auth().generatePasswordResetLink(email);

        let userName = 'Utilisateur';
        try {
            const userRecord = await admin.auth().getUserByEmail(email);
            userName = userRecord.displayName || 'Utilisateur';
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
