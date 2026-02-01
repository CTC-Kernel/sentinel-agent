const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions");
const sgMail = require("@sendgrid/mail");
const { getCertifierInvitationHtml, getAuditAssignmentHtml } = require('./services/emailTemplates');

// Helper to send email safely
const sendEmail = async (to, subject, html, text) => {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
        logger.warn("SENDGRID_API_KEY missing. Email not sent.");
        logger.info(`[MOCK EMAIL] To: ${to}, Subject: ${subject}`);
        return;
    }

    sgMail.setApiKey(apiKey);
    const msg = {
        to,
        from: process.env.SENDGRID_SENDER || 'noreply@sentinel-grc.com',
        subject,
        text: text || 'Notification Sentinel GRC',
        html
    };

    try {
        await sgMail.send(msg);
        logger.info(`Email sent to ${to}`);
    } catch (error) {
        logger.error("SendGrid Error", error);
        if (error.response) {
            logger.error(error.response.body);
        }
    }
};

// 1. Invite a Certifier Partner
exports.inviteCertifier = onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');

    const role = request.auth.token.role;
    if (!['admin', 'rssi'].includes(role) && !request.auth.token.superAdmin) {
        throw new HttpsError('permission-denied', 'Only admins can invite certifiers.');
    }

    const { email, message } = request.data;
    const organizationId = request.auth.token.organizationId;

    if (!email) throw new HttpsError('invalid-argument', 'Email required');

    const db = admin.firestore();

    try {
        // Check if partnership already exists
        const existing = await db.collection('partnerships')
            .where('tenantId', '==', organizationId)
            .where('contactEmail', '==', email)
            .get();

        if (!existing.empty) {
            throw new HttpsError('already-exists', 'Invitation already sent to this email');
        }

        const inviteData = {
            tenantId: organizationId,
            tenantName: request.auth.token.name || 'Organization', // simplified
            contactEmail: email,
            status: 'PENDING', // PENDING, ACTIVE, REJECTED
            createdAt: new Date().toISOString(),
            invitedBy: request.auth.uid,
            message: message || ''
        };

        const docRef = await db.collection('partnerships').add(inviteData);

        // Send Email
        const link = `https://sentinel-grc.web.app/#/portal/register?invite=${docRef.id}`;
        // Send Email
        const htmlContent = getCertifierInvitationHtml(inviteData.tenantName, message, link);

        await sendEmail(email, 'Invitation de Partenariat - Sentinel GRC', htmlContent, message);

        return { success: true };
    } catch (error) {
        logger.error('Invite partner error', error);
        throw new HttpsError('internal', 'Invite failed');
    }
});

// 2. Register/Create Certifier Organization
// This would be called AFTER Firebase Auth Signup, to initialize the Org doc as a Certifier
exports.createCertifierOrganization = onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');

    const { name, siret } = request.data;
    const db = admin.firestore();
    const uid = request.auth.uid;

    try {
        // Check if user already belongs to an org (simplification)
        const userProfile = await db.collection('users').doc(uid).get();
        if (userProfile.data()?.organizationId) {
            throw new HttpsError('failed-precondition', 'User already in an organization');
        }

        // Create Organization
        const orgRef = await db.collection('organizations').add({
            name,
            siret,
            type: 'CERTIFIER', // The Key Differentiator
            createdAt: new Date().toISOString(),
            ownerId: uid,
            status: 'ACTIVE'
        });

        // Update User
        await db.collection('users').doc(uid).set({
            organizationId: orgRef.id,
            role: 'ADMIN' // Certifier Admin
        }, { merge: true });

        // Set Custom Claims (requires re-auth usually, but we set it for future)
        await admin.auth().setCustomUserClaims(uid, { organizationId: orgRef.id, role: 'ADMIN', type: 'CERTIFIER' });

        return { success: true, organizationId: orgRef.id };
    } catch (error) {
        logger.error('Create Certifier Org error', error);
        throw new HttpsError('internal', 'Creation failed');
    }
});

// 3. Link/Accept Partnership (Called by Certifier when accepting invite)
exports.acceptPartnership = onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');

    // We assume the user is logged in as a Certifier
    const { inviteId } = request.data; // passed from email link ideally
    const certifierOrgId = request.auth.token.organizationId;

    if (!certifierOrgId) throw new HttpsError('failed-precondition', 'Must have an organization');

    const db = admin.firestore();

    try {
        const inviteRef = db.collection('partnerships').doc(inviteId);
        const invite = await inviteRef.get();

        if (!invite.exists) throw new HttpsError('not-found', 'Invite not found');
        if (invite.data().status !== 'PENDING') throw new HttpsError('failed-precondition', 'Invite not pending');

        await inviteRef.update({
            status: 'ACTIVE',
            certifierId: certifierOrgId,
            acceptedAt: new Date().toISOString(),
            acceptedBy: request.auth.uid
        });

        return { success: true };
    } catch (error) {
        logger.error('Accept partnership error', error);
        throw new HttpsError('internal', 'Acceptance failed');
    }
});

// 4. Certifier Dashboard Logic
exports.getCertifierDashboard = onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');

    const certifierOrgId = request.auth.token.organizationId;
    if (!certifierOrgId) throw new HttpsError('failed-precondition', 'Org required');

    const db = admin.firestore();

    try {
        // 1. Get My Clients (Active Partnerships)
        const clientsSnap = await db.collection('partnerships')
            .where('certifierId', '==', certifierOrgId)
            .where('status', '==', 'ACTIVE')
            .get();

        const clients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 2. Get Assigned Audits (Audits shared with 'targetOrgId' == my ID)
        // We need a way to link audits to partners in 'audit_shares' or similar.
        // Assuming we store `targetOrgId` in audit_shares when assigning.
        // OR better: query 'audits' across tenants is hard without CollectionGroup + Org Security.
        // EASIER: Query `audit_shares` where `targetOrgId` == certifierOrgId AND `revoked` == false.

        const sharesSnap = await db.collection('audit_shares')
            .where('targetOrgId', '==', certifierOrgId)
            .where('revoked', '==', false)
            .get();

        const assignments = [];
        if (!sharesSnap.empty) {
            const auditRefs = sharesSnap.docs.map(d => db.doc(`audits/${d.data().auditId}`));
            const auditDocs = await db.getAll(...auditRefs);

            sharesSnap.docs.forEach((share, index) => {
                const sData = share.data();
                const auditDoc = auditDocs[index];
                if (auditDoc.exists) {
                    const aData = auditDoc.data();
                    assignments.push({
                        shareId: share.id,
                        auditId: sData.auditId,
                        auditName: aData.name,
                        tenantName: clients.find(c => c.tenantId === sData.organizationId)?.tenantName || 'Unknown Client',
                        status: aData.status,
                        assignedAt: sData.createdAt
                    });
                }
            });
        }

        return {
            clients,
            assignments
        };

    } catch (error) {
        logger.error('Dashboard Data error', error);
        throw new HttpsError('internal', 'Fetch failed');
    }
});


// ... prior imports ...

// New Function: Assign Audit to Partner
exports.assignAuditToPartner = onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');

    const { auditId, partnerId, partnerName } = request.data;
    const organizationId = request.auth.token.organizationId;

    if (!auditId || !partnerId) throw new HttpsError('invalid-argument', 'Missing fields');

    const db = admin.firestore();
    const token = require('crypto').randomBytes(32).toString('hex'); // Generate a token for access via dashboard too

    try {
        // verify partnership exists and is active
        const partnershipSnap = await db.collection('partnerships')
            .where('tenantId', '==', organizationId)
            .where('certifierId', '==', partnerId)
            .where('status', '==', 'ACTIVE')
            .get();

        if (partnershipSnap.empty) {
            throw new HttpsError('failed-precondition', 'Invalid or inactive partnership');
        }

        const shareData = {
            auditId,
            organizationId,
            targetOrgId: partnerId, // This links it to the certifier dashboard
            targetOrgName: partnerName || 'Partner',
            generatedBy: request.auth.uid,
            createdAt: new Date().toISOString(),
            permissions: ['read', 'write_findings', 'certify'],
            revoked: false,
            token, // Still useful if they want to access via direct link from dashboard
            type: 'PARTNER_ASSIGNMENT'
        };

        // Create the share record
        await db.collection('audit_shares').doc(token).set(shareData);

        // Get Partner Email (need to fetch from the partnership or organization)
        const partnershipData = partnershipSnap.docs[0].data();
        const partnerEmail = partnershipData.contactEmail; // Assuming contactEmail is reliable, otherwise fetch Certifier Org Owner

        if (partnerEmail) {
            const link = `https://sentinel-grc.web.app/#/portal/audit/${token}`; // Or dashboard link
            const htmlContent = getAuditAssignmentHtml(shareData.organizationId, link);
            await sendEmail(partnerEmail, 'Nouvel Audit Assigné - Sentinel GRC', htmlContent, `Un nouvel audit vous a été assigné.`);
        } else {
            logger.warn(`No email found for partner ${partnerId}`);
        }

        return { success: true };

    } catch (error) {
        logger.error('Assign audit error', error);
        throw new HttpsError('internal', 'Assignment failed');
    }
});
