const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions");
const crypto = require("crypto");
const { checkCallableRateLimit } = require('./utils/rateLimiter');

// Rate limiting for token validation (prevents brute-force attacks)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_ATTEMPTS = 5; // Max 5 failed attempts per minute

const checkTokenRateLimit = async (clientIp) => {
    if (!clientIp) return true; // Allow if no IP (shouldn't happen)

    const db = admin.firestore();
    const rateLimitRef = db.collection('rate_limits').doc(`portal_token_${clientIp.replace(/\./g, '_')}`);

    try {
        const doc = await rateLimitRef.get();
        if (!doc.exists) return true;

        const data = doc.data();
        const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;

        if (data.lastAttempt < windowStart) {
            // Window expired, reset
            return true;
        }

        if (data.attempts >= RATE_LIMIT_MAX_ATTEMPTS) {
            throw new HttpsError('resource-exhausted', 'Too many attempts. Please try again later.');
        }

        return true;
    } catch (error) {
        if (error.code === 'resource-exhausted') throw error;
        // Allow on rate limit check failure (fail-open for availability)
        return true;
    }
};

// FIXED: Rate limiter now properly resets after window expires
const recordFailedTokenAttempt = async (clientIp) => {
    if (!clientIp) return;

    const db = admin.firestore();
    const rateLimitRef = db.collection('rate_limits').doc(`portal_token_${clientIp.replace(/\./g, '_')}`);

    try {
        const doc = await rateLimitRef.get();
        const now = Date.now();
        const windowStart = now - RATE_LIMIT_WINDOW_MS;

        if (!doc.exists || doc.data().lastAttempt < windowStart) {
            // Window expired or new entry - reset counter to 1
            await rateLimitRef.set({
                attempts: 1,
                lastAttempt: now,
                windowStart: now
            });
        } else {
            // Within window - increment counter
            await rateLimitRef.update({
                attempts: admin.firestore.FieldValue.increment(1),
                lastAttempt: now
            });
        }
    } catch (error) {
        logger.warn('Failed to record rate limit attempt:', error);
        // Fail-open for availability
    }
};

// Helper to validate token with rate limiting
const validatePortalToken = async (token, clientIp = null) => {
    if (!token) throw new HttpsError('unauthenticated', 'Token missing');

    // Check rate limit before validation
    await checkTokenRateLimit(clientIp);

    const db = admin.firestore();
    const shareDoc = await db.collection('audit_shares').doc(token).get();

    if (!shareDoc.exists) {
        // Record failed attempt for rate limiting
        await recordFailedTokenAttempt(clientIp);
        throw new HttpsError('not-found', 'Invalid audit token');
    }

    const shareData = shareDoc.data();
    if (shareData.expiresAt && new Date(shareData.expiresAt) < new Date()) {
        throw new HttpsError('permission-denied', 'Audit token expired');
    }

    if (shareData.revoked) {
        throw new HttpsError('permission-denied', 'Audit access revoked');
    }

    return shareData;
};

// 1. Generate Audit Share Link (Internal Admin Only)
exports.generateAuditShareLink = onCall({ region: 'europe-west1' }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');

    const { auditId, auditorEmail, expiryDays } = request.data;
    const db = admin.firestore();
    const organizationId = request.auth.token.organizationId;
    const userRole = request.auth.token.role || 'user';

    // RBAC: Verify user has permission to share audits
    const allowedRoles = ['admin', 'rssi', 'manager', 'auditor'];
    if (!allowedRoles.includes(userRole)) {
        throw new HttpsError('permission-denied', 'Insufficient permissions to share audits');
    }

    // Verify the audit exists and belongs to the user's organization
    const auditDoc = await db.collection('audits').doc(auditId).get();
    if (!auditDoc.exists) {
        throw new HttpsError('not-found', 'Audit not found');
    }

    const audit = auditDoc.data();
    if (audit.organizationId !== organizationId) {
        throw new HttpsError('permission-denied', 'Cannot share audit from another organization');
    }

    // Additional check: User must be audit owner or admin
    if (audit.createdBy !== request.auth.uid && !['admin', 'rssi'].includes(userRole)) {
        throw new HttpsError('permission-denied', 'Only audit owner or admin can share this audit');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiryDays || 30)); // Default 30 days

    const shareData = {
        auditId,
        organizationId,
        auditorEmail,
        generatedBy: request.auth.uid,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        permissions: ['read', 'write_findings', 'certify'],
        revoked: false,
        token // indexed by doc ID effectively, but storing it for sanity
    };

    try {
        await admin.firestore().collection('audit_shares').doc(token).set(shareData);
        // In a real app, trigger email sending here via Mail Service
        return {
            success: true,
            link: `/portal/audit/${token}`,
            token: token
        };
    } catch (error) {
        logger.error('Error creating audit share', error);
        throw new HttpsError('internal', 'Failed to generate share link');
    }
});

// 2. Get Shared Audit Data (External Public Access via Token)
exports.getSharedAuditData = onCall({ region: 'europe-west1', enforceAppCheck: false }, async (request) => {
    // Rate limiting for external endpoint
    checkCallableRateLimit(request, 'standard');

    const { token } = request.data;
    const clientIp = request.rawRequest?.ip || request.rawRequest?.headers?.['x-forwarded-for'] || null;
    const shareData = await validatePortalToken(token, clientIp);
    const db = admin.firestore();

    try {
        // SECURITY: Validate organizationId BEFORE accessing any document data
        if (!shareData.organizationId) {
            throw new HttpsError('failed-precondition', 'Share missing organization context');
        }

        // Fetch Audit
        const auditDoc = await db.collection('audits').doc(shareData.auditId).get();
        if (!auditDoc.exists) throw new HttpsError('not-found', 'Audit not found');

        // Fetch Scope (Risks, Controls, Findings) - Limit sensitive data
        // For MVP, we fetch basic details
        const audit = auditDoc.data();

        // SECURITY: Verify the audit belongs to the same organization as the share token
        if (audit.organizationId !== shareData.organizationId) {
            throw new HttpsError('permission-denied', 'Organization mismatch');
        }

        // Sanitize Audit Data for External Viewer
        const sanitizedAudit = {
            id: auditDoc.id,
            name: audit.name,
            status: audit.status,
            type: audit.type,
            date: audit.date,
            description: audit.description,
            scope: audit.scope, // Assuming scope structure
            checklists: audit.checklists
        };

        // Fetch related findings
        const findingsSnap = await db.collection('findings')
            .where('auditId', '==', shareData.auditId)
            .where('organizationId', '==', shareData.organizationId)
            .limit(1000)
            .get();

        const findings = findingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Fetch relevant controls (often nested in audit or separate collection? Assuming separate for MVP scalability or part of audit object)
        // For Sentinel V2, Controls are likely referenced or instantiated. 
        // We will fetch controls linked to this audit if they are centralized, or defaults.
        // Assuming 'controls' collection with 'auditId' or specific list.
        // If controls are embedded in 'audit.checklists', we already have them. 
        // Let's assume we need to fetch linked 'documents' (Evidence).

        const docsSnap = await db.collection('documents')
            .where('auditId', '==', shareData.auditId)
            .where('organizationId', '==', shareData.organizationId)
            .limit(1000)
            .get();

        const documents = docsSnap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                name: data.name,
                type: data.type,
                url: data.url, // In a real secure app, this would be a signed URL generated on fly
                category: data.category
            };
        });

        return {
            audit: sanitizedAudit,
            findings: findings,
            documents: documents,
            permissions: shareData.permissions,
            auditorEmail: shareData.auditorEmail
        };

    } catch (error) {
        logger.error('Error fetching shared audit data', error);
        throw new HttpsError('internal', 'Failed to load audit data');
    }
});

// 3. Submit Finding (External)
exports.portal_submitFinding = onCall({ region: 'europe-west1', enforceAppCheck: false }, async (request) => {
    // Rate limiting for external endpoint
    checkCallableRateLimit(request, 'standard');

    const { token, finding } = request.data;
    const clientIp = request.rawRequest?.ip || request.rawRequest?.headers?.['x-forwarded-for'] || null;
    const shareData = await validatePortalToken(token, clientIp);

    if (!shareData.permissions.includes('write_findings')) {
        throw new HttpsError('permission-denied', 'Write permission denied');
    }

    const db = admin.firestore();

    try {
        // SECURITY: Extract only expected fields to prevent mass assignment
        // Block organizationId, createdAt, status, id from user input
        const { title, description, severity, category, recommendation, evidence, controlRef, riskRef } = finding || {};
        const findingData = {
            title: title || '',
            description: description || '',
            severity: severity || 'Moyenne',
            category: category || '',
            recommendation: recommendation || '',
            evidence: evidence || '',
            controlRef: controlRef || null,
            riskRef: riskRef || null,
            auditId: shareData.auditId,
            organizationId: shareData.organizationId,
            createdBy: 'external_auditor', // Marker
            authorEmail: shareData.auditorEmail,
            createdAt: new Date().toISOString(),
            status: 'Ouvert'
        };

        const ref = await db.collection('findings').add(findingData);

        // Security Audit Log
        await db.collection('audit_shares').doc(token).collection('logs').add({
            action: 'submit_finding',
            findingId: ref.id,
            timestamp: new Date().toISOString()
        });

        return { success: true, findingId: ref.id };
    } catch (error) {
        logger.error('Portal submit finding error', error);
        throw new HttpsError('internal', 'Failed to save finding');
    }
});

// 4. Update Status / Certify
exports.portal_updateStatus = onCall({ region: 'europe-west1', enforceAppCheck: false }, async (request) => {
    // Rate limiting for external endpoint
    checkCallableRateLimit(request, 'standard');

    const { token, status, certificationData } = request.data;
    const clientIp = request.rawRequest?.ip || request.rawRequest?.headers?.['x-forwarded-for'] || null;
    const shareData = await validatePortalToken(token, clientIp);

    if (!shareData.permissions.includes('certify')) {
        throw new HttpsError('permission-denied', 'Certification permission denied');
    }

    // SECURITY: Validate status against allowed values to prevent mass assignment
    const allowedStatuses = ['En cours', 'Terminé', 'Certifié'];
    if (!status || !allowedStatuses.includes(status)) {
        throw new HttpsError('invalid-argument', 'Invalid status value');
    }

    // SECURITY: Extract only expected fields from certificationData
    const sanitizedCertificationData = certificationData ? {
        certifiedBy: certificationData.certifiedBy || null,
        certifiedAt: certificationData.certifiedAt || null,
        comments: certificationData.comments || null,
        signature: certificationData.signature || null
    } : null;

    const db = admin.firestore();

    try {
        await db.collection('audits').doc(shareData.auditId).update({
            status: status,
            certificationData: sanitizedCertificationData,
            lastExternalUpdate: new Date().toISOString()
        });

        // Log this major action
        await db.collection('audit_shares').doc(token).collection('logs').add({
            action: 'update_status',
            newStatus: status,
            timestamp: new Date().toISOString()
        });

        return { success: true };
    } catch (error) {
        logger.error('Portal status update error', error);
        throw new HttpsError('internal', 'Update failed');
    }
});

// 5. Revoke Audit Share Link (Internal)
exports.revokeAuditShare = onCall({ region: 'europe-west1' }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');

    const { token } = request.data;
    if (!token) throw new HttpsError('invalid-argument', 'Token required');

    const db = admin.firestore();

    try {
        // Verify ownership/rights
        const shareDoc = await db.collection('audit_shares').doc(token).get();
        if (!shareDoc.exists) throw new HttpsError('not-found', 'Share not found');

        if (shareDoc.data().organizationId !== request.auth.token.organizationId) {
            throw new HttpsError('permission-denied', 'Unauthorized');
        }

        await db.collection('audit_shares').doc(token).update({
            revoked: true,
            revokedAt: new Date().toISOString(),
            revokedBy: request.auth.uid
        });

        return { success: true };
    } catch (error) {
        logger.error('Revoke share error', error);
        throw new HttpsError('internal', 'Revoke failed');
    }
});
