/**
 * Organizations Module - Organization Management Functions
 * Domain: Create, Delete, Manage Organizations
 */

const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { defineString } = require("firebase-functions/params");
const { validate, z } = require('../utils/validation');

const appBaseUrl = defineString("APP_BASE_URL", { default: "https://app.cyber-threat-consulting.com" });

/**
 * Securely create a new organization and assign the creator as Admin
 */
exports.createOrganization = onCall({
    memory: '512MiB',
    timeoutSeconds: 120,
    region: 'europe-west1',
    // SECURITY: Enforce App Check to prevent abuse of organization creation
    enforceAppCheck: true
}, async (request) => {
    const { getWelcomeEmailHtml } = require('../services/emailTemplates');

    const { organizationName, email, password, industry, department, displayName } = validate(z.object({
        organizationName: z.string().min(2).max(100),
        email: z.string().email().optional(),
        password: z.string().min(6).optional(),
        industry: z.string().optional(),
        department: z.string().optional(),
        displayName: z.string().optional()
    }), request.data);

    const db = admin.firestore();

    try {
        let uid;
        let userEmail;
        let userRecord;

        if (request.auth) {
            uid = request.auth.uid;
            userEmail = request.auth.token.email;

            userRecord = await admin.auth().getUser(uid);

            const userSnap = await db.collection('users').doc(uid).get();
            if (userSnap.exists && userSnap.data().organizationId) {
                throw new HttpsError('already-exists', 'User already belongs to an organization.');
            }

        } else {
            if (!email || !password) {
                throw new HttpsError('invalid-argument', 'Email and password are required for new user registration.');
            }

            try {
                userRecord = await admin.auth().getUserByEmail(email);
                const userSnap = await db.collection('users').doc(userRecord.uid).get();
                if (userSnap.exists && userSnap.data().organizationId) {
                    throw new HttpsError('already-exists', 'The email address is already in use by another account and belongs to an organization.');
                }
            } catch (error) {
                if (error.code === 'auth/user-not-found') {
                    userRecord = await admin.auth().createUser({
                        email: email,
                        password: password,
                        displayName: displayName || organizationName + " Admin",
                    });
                } else {
                    throw error;
                }
            }

            uid = userRecord.uid;
            userEmail = userRecord.email;
        }

        const userRef = db.collection('users').doc(uid);
        const userSnap = await userRef.get();

        if (userSnap.exists && userSnap.data().organizationId) {
            throw new HttpsError('already-exists', 'User already belongs to an organization.');
        }

        const organizationId = crypto.randomUUID();
        const slug = organizationName
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || organizationId;

        const batch = db.batch();

        const orgRef = db.collection('organizations').doc(organizationId);
        batch.set(orgRef, {
            id: organizationId,
            name: organizationName,
            slug: slug,
            ownerId: uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            industry: industry || '',
            subscription: {
                planId: 'discovery',
                status: 'active',
                startDate: new Date().toISOString(),
                stripeCustomerId: null,
                stripeSubscriptionId: null,
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false
            }
        });

        batch.set(userRef, {
            uid: uid,
            email: userEmail,
            role: 'admin',
            department: department || '',
            industry: industry || '',
            displayName: displayName || userRecord.displayName || '',
            organizationName: organizationName,
            organizationId: organizationId,
            photoURL: userRecord.photoURL || null,
            lastLogin: new Date().toISOString(),
            onboardingCompleted: true,
            createdAt: new Date().toISOString(),
            theme: 'light'
        }, { merge: true });

        await batch.commit();

        await admin.auth().setCustomUserClaims(uid, {
            organizationId: organizationId,
            role: 'admin'
        });

        const link = `${appBaseUrl.value()}/`;
        const htmlContent = getWelcomeEmailHtml(displayName || userRecord.displayName || 'Administrateur', organizationName, link);

        await db.collection('mail_queue').add({
            to: userEmail,
            message: {
                subject: 'Bienvenue sur Sentinel GRC',
                html: htmlContent
            },
            type: 'WELCOME_EMAIL',
            status: 'PENDING',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true, organizationId };

    } catch (error) {
        logger.error('Error creating organization:', error);
        if (error instanceof HttpsError) {
            throw error;
        }

        // Provide more specific error messages based on error type
        const errorMessage = error.message || 'Unknown error';
        const errorCode = error.code || '';

        // Firestore permission errors
        if (errorCode.includes('permission-denied') || errorMessage.includes('PERMISSION_DENIED')) {
            throw new HttpsError('permission-denied', 'Permissions insuffisantes. Contactez l\'administrateur.');
        }

        // Network/connectivity errors
        if (errorCode.includes('unavailable') || errorMessage.includes('UNAVAILABLE')) {
            throw new HttpsError('unavailable', 'Service temporairement indisponible. Réessayez dans quelques instants.');
        }

        // Auth errors
        if (errorCode.includes('auth/') || errorMessage.includes('auth')) {
            throw new HttpsError('unauthenticated', 'Session expirée. Veuillez vous reconnecter.');
        }

        // Quota errors
        if (errorCode.includes('resource-exhausted')) {
            throw new HttpsError('resource-exhausted', 'Quota dépassé. Réessayez plus tard.');
        }

        throw new HttpsError('internal', 'Erreur de configuration interne: ' + errorMessage);
    }
});

/**
 * Secure Callable Function to delete an organization
 */
exports.deleteOrganization = onCall({
    memory: '512MiB',
    timeoutSeconds: 300,
    region: 'europe-west1'
}, async (request) => {
    const { AccountService: BackendAccountService } = require('../services/accountService');

    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { organizationId } = validate(z.object({
        organizationId: z.string()
    }), request.data);

    try {
        await BackendAccountService.deleteOrganization(organizationId, request.auth.uid);
        return { success: true };
    } catch (error) {
        logger.error(`Delete Organization Failed`, error);
        if (error.message.includes('Permission denied')) {
            throw new HttpsError('permission-denied', error.message);
        }
        throw new HttpsError('internal', 'Deletion failed.');
    }
});

/**
 * GDPR / Cascading Deletion when organization is deleted
 */
exports.onOrganizationDeleted = onDocumentDeleted({
    document: "organizations/{orgId}",
    memory: '1GiB',
    timeoutSeconds: 540,
    region: 'europe-west1'
}, async (event) => {
    const orgId = event.params.orgId;
    const db = admin.firestore();
    const MAX_BATCH_SIZE = 450;

    logger.info(`Organization ${orgId} deleted. Starting cascading cleanup...`);

    try {
        const usersSnap = await db.collection('users').where('organizationId', '==', orgId).get();
        const deletePromises = [];

        usersSnap.forEach(doc => {
            deletePromises.push(admin.auth().deleteUser(doc.id).catch(e => logger.warn(`Failed to delete auth user ${doc.id}`, e)));
        });

        // Collect all document refs to delete
        const allRefs = [];

        usersSnap.forEach(doc => {
            allRefs.push(doc.ref);
        });

        const commonCollections = ['risks', 'incidents', 'assets', 'documents', 'projects', 'audits'];

        for (const col of commonCollections) {
            const snap = await db.collection(col).where('organizationId', '==', orgId).get();
            snap.forEach(doc => allRefs.push(doc.ref));
        }

        // Split into multiple batches of max 450 operations each
        for (let i = 0; i < allRefs.length; i += MAX_BATCH_SIZE) {
            const chunk = allRefs.slice(i, i + MAX_BATCH_SIZE);
            const batch = db.batch();
            chunk.forEach(ref => batch.delete(ref));
            await batch.commit();
        }

        await Promise.all(deletePromises);

        logger.info(`Cascading cleanup for ${orgId} complete. Deleted ${allRefs.length} documents.`);

    } catch (error) {
        logger.error(`Cascading delete failed for ${orgId}`, error);
    }
});

/**
 * On Join Request Created - Notify Admins
 */
exports.onJoinRequestCreated = onDocumentCreated({
    document: "join_requests/{requestId}",
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1'
}, async (event) => {
    const { getJoinRequestEmailHtml } = require('../services/emailTemplates');

    const snap = event.data;
    if (!snap) return;
    const request = snap.data();

    const adminsSnap = await admin.firestore().collection('users')
        .where('organizationId', '==', request.organizationId)
        .where('role', '==', 'admin')
        .get();

    if (adminsSnap.empty) {
        logger.info(`No admins found for org ${request.organizationId}`);
        return;
    }

    const batch = admin.firestore().batch();
    const link = `${appBaseUrl.value()}/team`;

    adminsSnap.forEach(adminDoc => {
        const adminUser = adminDoc.data();
        const mailRef = admin.firestore().collection('mail_queue').doc();
        batch.set(mailRef, {
            to: adminUser.email,
            message: {
                subject: `Nouvelle demande d'acces : ${request.displayName}`,
                html: getJoinRequestEmailHtml(request.displayName, request.userEmail, request.organizationName, link)
            },
            type: 'JOIN_REQUEST',
            status: 'PENDING',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });

    await batch.commit();
    logger.info(`Queued join request emails for ${adminsSnap.size} admins.`);
});

/**
 * On Join Request Updated - Notify User of approval/rejection
 */
exports.onJoinRequestUpdated = onDocumentUpdated({
    document: "join_requests/{requestId}",
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1'
}, async (event) => {
    const { getApprovedEmailHtml, getRejectedEmailHtml } = require('../services/emailTemplates');

    const before = event.data.before.data();
    const after = event.data.after.data();

    if (before.status === after.status) return;

    const link = `${appBaseUrl.value()}/dashboard`;

    if (after.status === 'approved') {
        await admin.firestore().collection('mail_queue').add({
            to: after.userEmail,
            message: {
                subject: `Acces approuve a ${after.organizationName}`,
                html: getApprovedEmailHtml(after.displayName, after.organizationName, link)
            },
            type: 'JOIN_REQUEST_APPROVED',
            status: 'PENDING',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } else if (after.status === 'rejected') {
        await admin.firestore().collection('mail_queue').add({
            to: after.userEmail,
            message: {
                subject: `Demande d'acces refusee - ${after.organizationName}`,
                html: getRejectedEmailHtml(after.displayName, after.organizationName)
            },
            type: 'JOIN_REQUEST_REJECTED',
            status: 'PENDING',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
});

/**
 * Delete Resource (generic resource deletion)
 */
exports.deleteResource = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1'
}, async (request) => {
    const resourceManager = require('../services/resourceManager');

    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }
    const { collectionName, docId } = request.data;
    const userId = request.auth.uid;
    const userRole = request.auth.token.role || 'user';
    const organizationId = request.auth.token.organizationId;

    return await resourceManager.deleteResource(collectionName, docId, userId, userRole, organizationId);
});

/**
 * Submit Kiosk Asset (public terminal intake)
 * SECURITY: Requires organization to have kiosk mode enabled
 */
exports.submitKioskAsset = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1'
}, async (request) => {
    // SECURITY: Require authentication
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const data = request.data;
    const { orgId, name, serialNumber, hardwareType, hardware, notes, userId, projectId, kioskToken } = data;

    if (!orgId || !name || !serialNumber) {
        throw new HttpsError('invalid-argument', 'Missing required fields (orgId, name, serialNumber).');
    }

    // SECURITY: Verify organizationId matches the user's token claims
    const tokenOrgId = request.auth.token.organizationId;
    if (tokenOrgId && tokenOrgId !== orgId) {
        throw new HttpsError('permission-denied', 'Organization mismatch with authenticated user');
    }

    const db = admin.firestore();
    const orgRef = db.collection('organizations').doc(orgId);
    const orgDoc = await orgRef.get();

    if (!orgDoc.exists) {
        throw new HttpsError('not-found', 'Organization not found.');
    }

    const orgData = orgDoc.data();

    // SECURITY: Verify kiosk mode is enabled for this organization
    if (!orgData.kioskModeEnabled) {
        logger.warn(`Kiosk submission rejected: org ${orgId} does not have kiosk mode enabled`);
        throw new HttpsError('permission-denied', 'Kiosk mode is not enabled for this organization.');
    }

    // SECURITY: Validate kiosk token if configured
    if (orgData.kioskToken && orgData.kioskToken !== kioskToken) {
        logger.warn(`Kiosk submission rejected: invalid token for org ${orgId}`);
        throw new HttpsError('permission-denied', 'Invalid kiosk token.');
    }

    const assetData = {
        name,
        serialNumber,
        type: 'Materiel',
        hardwareType: hardwareType || 'Laptop',
        organizationId: orgId,
        hardware: hardware || {},
        status: 'En stock',
        criticality: 'Moyenne',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'Kiosk Intake',
        notes: notes || '',
        ownerId: userId || '',
        relatedProjectIds: projectId ? [projectId] : []
    };

    if (userId) {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            assetData.owner = userDoc.data().displayName || '';
        }
    }

    try {
        const docRef = await db.collection('assets').add(assetData);
        return { success: true, assetId: docRef.id };
    } catch (error) {
        logger.error("Error creating kiosk asset", error);
        throw new HttpsError('internal', 'Failed to create asset.');
    }
});

/**
 * Search Company (Pappers/Sirene Proxy)
 */
exports.searchCompany = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1'
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    const { query } = request.data;
    const searchTerm = query || '';

    if (searchTerm.length < 3) {
        return [];
    }

    try {
        const response = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(searchTerm)}&per_page=10`);

        if (!response.ok) {
            logger.error(`Company API Error: ${response.statusText}`);
            return [];
        }

        const data = await response.json();
        const results = data.results || [];

        return results.map(company => ({
            name: company.nom_complet,
            siren: company.siren,
            address: company.siege.adresse_complete || company.siege.geo_adresse,
            activity: `${company.activite_principale} - ${company.libelle_activite_principale}`
        }));

    } catch (error) {
        logger.error("Error calling api.gouv.fr", error);
        return [];
    }
});

/**
 * Validate VAT (VIES Proxy)
 * TODO: Implement VIES VAT validation service
 */
exports.validateVat = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1'
}, async (request) => {
    throw new HttpsError('unimplemented', 'VIES Validation service not yet configured.');
});
