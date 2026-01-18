/**
 * Integrations Module - External API Integration Functions
 * Domain: Shodan, HIBP, Safe Browsing, RSS Feeds, Threat Feeds, N8N
 */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");
const crypto = require("crypto");

// Secrets
const userSecretsKey = defineSecret("USER_SECRETS_ENCRYPTION_KEY");

// Services
const { N8NService, n8nWebhookSecret } = require('../services/n8nService');

/**
 * Encrypt data using the USER_SECRETS_ENCRYPTION_KEY
 */
function encryptData(text, secretKey) {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(secretKey, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypt data using the USER_SECRETS_ENCRYPTION_KEY
 */
function decryptData(text, secretKey) {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const key = crypto.scryptSync(secretKey, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

/**
 * Get user secret key for encryption
 */
function getUserSecretKey() {
    const raw = userSecretsKey.value();
    if (!raw) {
        throw new Error("USER_SECRETS_ENCRYPTION_KEY is missing");
    }

    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
        return Buffer.from(raw, "hex");
    }

    const utf8 = Buffer.from(raw, "utf8");
    if (utf8.length === 32) {
        return utf8;
    }

    if (utf8.length > 32) {
        return utf8.subarray(0, 32);
    }

    const padded = Buffer.alloc(32);
    utf8.copy(padded);
    return padded;
}

/**
 * Decrypt user secret
 */
function decryptUserSecret(secretObject) {
    if (!secretObject || !secretObject.iv || !secretObject.cipherText || !secretObject.tag) {
        return null;
    }

    const key = getUserSecretKey();
    const iv = Buffer.from(secretObject.iv, "base64");
    const encrypted = Buffer.from(secretObject.cipherText, "base64");
    const authTag = Buffer.from(secretObject.tag, "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
}

/**
 * Connect Integration (store encrypted credentials)
 */
exports.connectIntegration = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1',
    secrets: [userSecretsKey]
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { providerId, credentials, organizationId } = request.data;

    if (!organizationId || !providerId || !credentials) {
        throw new HttpsError('invalid-argument', 'Missing required fields.');
    }

    const allowedProviders = ['aws', 'azure', 'gcp', 'github', 'website_check', 'shodan', 'hibp'];
    if (!allowedProviders.includes(providerId)) {
        throw new HttpsError('invalid-argument', 'Unsupported providerId');
    }

    try {
        const userRef = admin.firestore().collection("users").doc(request.auth.uid);
        const userSnap = await userRef.get();
        const userData = userSnap.data();

        if (!userData) {
            throw new HttpsError('failed-precondition', 'User profile is missing.');
        }

        if (userData.organizationId !== organizationId || userData.role !== 'admin') {
            const orgRef = admin.firestore().collection("organizations").doc(organizationId);
            const orgSnap = await orgRef.get();
            if (!orgSnap.exists || orgSnap.data().ownerId !== request.auth.uid) {
                throw new HttpsError('permission-denied', 'Only admins can manage integrations.');
            }
        }

        const encryptedCredentials = encryptData(JSON.stringify(credentials), userSecretsKey.value());

        await admin.firestore().collection('organizations').doc(organizationId)
            .collection('integrations').doc(providerId).set({
                id: providerId,
                status: 'connected',
                connectedAt: new Date().toISOString(),
                connectedBy: request.auth.uid,
                encryptedCredentials
            }, { merge: true });

        return { success: true };
    } catch (error) {
        logger.error('Error connecting integration:', error);
        throw new HttpsError('internal', 'Failed to connect integration: ' + error.message);
    }
});

/**
 * Fetch Evidence from external integrations
 */
exports.fetchEvidence = onCall({
    memory: '512MiB',
    timeoutSeconds: 120,
    region: 'europe-west1',
    secrets: [userSecretsKey]
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { providerId, resourceId, organizationId } = request.data;

    if (request.data && request.data.isDemoMode) {
        throw new HttpsError('failed-precondition', 'Demo mode is disabled in production.');
    }

    if (!organizationId || !providerId || !resourceId) {
        throw new HttpsError('invalid-argument', 'Missing required fields.');
    }

    try {
        const doc = await admin.firestore().collection('organizations').doc(organizationId)
            .collection('integrations').doc(providerId).get();

        if (!doc.exists) {
            throw new HttpsError('not-found', 'Integration not found.');
        }

        const data = doc.data();
        let apiKey = null;
        if (data.encryptedCredentials) {
            try {
                const creds = JSON.parse(decryptData(data.encryptedCredentials, userSecretsKey.value()));
                apiKey = creds.apiKey;
            } catch (e) {
                logger.warn('Failed to decrypt credentials', e);
            }
        }

        if (providerId === 'shodan') {
            if (!apiKey) throw new HttpsError('failed-precondition', 'Missing API Key for Shodan');

            const response = await fetch(`https://api.shodan.io/shodan/host/${encodeURIComponent(resourceId)}?key=${apiKey}`);
            if (!response.ok) {
                if (response.status === 404) {
                    return { status: 'pass', details: 'IP not found in Shodan (Good sign)', lastSync: new Date().toISOString() };
                }
                throw new Error(`Shodan API Error: ${response.statusText}`);
            }
            const result = await response.json();
            const openPorts = result.ports || [];
            const vulns = result.vulns || [];

            if (vulns.length > 0) {
                return {
                    status: 'fail',
                    details: `Found ${vulns.length} vulnerabilities and open ports: ${openPorts.join(', ')}`,
                    lastSync: new Date().toISOString()
                };
            }

            return {
                status: 'pass',
                details: `No vulnerabilities found. Open ports: ${openPorts.join(', ')}`,
                lastSync: new Date().toISOString()
            };
        }

        if (providerId === 'hibp') {
            if (!apiKey) throw new HttpsError('failed-precondition', 'Missing API Key for HIBP');

            const response = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(resourceId)}`, {
                headers: {
                    'hibp-api-key': apiKey,
                    'user-agent': 'Sentinel-GRC'
                }
            });

            if (response.status === 404) {
                return { status: 'pass', details: 'No breaches found for this email.', lastSync: new Date().toISOString() };
            }

            if (!response.ok) throw new Error(`HIBP API Error: ${response.statusText}`);

            const breaches = await response.json();
            return {
                status: 'fail',
                details: `Found ${breaches.length} breaches: ${breaches.map(b => b.Name).join(', ')}`,
                lastSync: new Date().toISOString()
            };
        }

        if (providerId === 'website_check') {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                const response = await fetch(resourceId, { method: 'HEAD', signal: controller.signal });
                clearTimeout(timeoutId);
                if (response.ok) {
                    return { status: 'pass', details: `Website is UP (Status: ${response.status})`, lastSync: new Date().toISOString() };
                } else {
                    return { status: 'fail', details: `Website returned status ${response.status}`, lastSync: new Date().toISOString() };
                }
            } catch (err) {
                const message = err && err.name === 'AbortError' ? 'Timeout (5s) reached' : (err.message || 'Unknown error');
                return { status: 'fail', details: `Website is DOWN or Unreachable: ${message}`, lastSync: new Date().toISOString() };
            }
        }

        throw new HttpsError('unimplemented', `Provider ${providerId} not supported yet.`);

    } catch (error) {
        logger.error('Error fetching evidence:', error);
        throw new HttpsError('internal', 'Failed to fetch evidence: ' + error.message);
    }
});

/**
 * Scan asset with Shodan
 */
exports.scanAssetWithShodan = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1',
    secrets: [userSecretsKey]
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const ip = request.data?.ip;
    if (!ip || typeof ip !== 'string') {
        throw new HttpsError('invalid-argument', 'IP address is required.');
    }

    try {
        const db = admin.firestore();
        const userKeysSnap = await db.collection('user_api_keys').doc(uid).get();
        const userKeys = userKeysSnap.data() || {};

        const shodanSecret = userKeys.shodan;
        const apiKey = decryptUserSecret(shodanSecret);

        if (!apiKey) {
            throw new HttpsError('failed-precondition', 'Shodan API key not configured.');
        }

        const response = await fetch(`https://api.shodan.io/shodan/host/${encodeURIComponent(ip)}?key=${apiKey}`);
        if (!response.ok) {
            const text = await response.text();
            logger.error('Shodan API error', { status: response.status, body: text });
            throw new HttpsError('internal', 'Shodan API error');
        }

        const result = await response.json();
        return { result };
    } catch (error) {
        logger.error('scanAssetWithShodan failed', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'Failed to query Shodan');
    }
});

/**
 * Check email breach with Have I Been Pwned
 */
exports.checkBreachWithHIBP = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1',
    secrets: [userSecretsKey]
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const email = request.data?.email;
    if (!email || typeof email !== 'string') {
        throw new HttpsError('invalid-argument', 'Email is required.');
    }

    try {
        const db = admin.firestore();
        const userKeysSnap = await db.collection('user_api_keys').doc(uid).get();
        const userKeys = userKeysSnap.data() || {};

        const hibpSecret = userKeys.hibp;
        const apiKey = decryptUserSecret(hibpSecret);

        if (!apiKey) {
            throw new HttpsError('failed-precondition', 'HIBP API key not configured.');
        }

        const response = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`, {
            headers: {
                'hibp-api-key': apiKey,
                'user-agent': 'Sentinel-GRC'
            }
        });

        if (response.status === 404) {
            return { breaches: [] };
        }

        if (!response.ok) {
            const text = await response.text();
            logger.error('HIBP API error', { status: response.status, body: text });
            throw new HttpsError('internal', 'HIBP API error');
        }

        const breaches = await response.json();
        return { breaches };
    } catch (error) {
        logger.error('checkBreachWithHIBP failed', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'Failed to query HIBP');
    }
});

/**
 * Check URL reputation with Safe Browsing
 */
exports.checkUrlReputationWithSafeBrowsing = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1',
    secrets: [userSecretsKey]
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const url = request.data?.url;
    if (!url || typeof url !== 'string') {
        throw new HttpsError('invalid-argument', 'URL is required.');
    }

    try {
        const db = admin.firestore();
        const userKeysSnap = await db.collection('user_api_keys').doc(uid).get();
        const userKeys = userKeysSnap.data() || {};

        const safeSecret = userKeys.safeBrowsing;
        const apiKey = decryptUserSecret(safeSecret);

        if (!apiKey) {
            throw new HttpsError('failed-precondition', 'Safe Browsing API key not configured.');
        }

        const response = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client: { clientId: 'sentinel-grc', clientVersion: '1.0.0' },
                threatInfo: {
                    threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
                    platformTypes: ['ANY_PLATFORM'],
                    threatEntryTypes: ['URL'],
                    threatEntries: [{ url }]
                }
            })
        });

        if (!response.ok) {
            const text = await response.text();
            logger.error('Safe Browsing API error', { status: response.status, body: text });
            throw new HttpsError('internal', 'Safe Browsing API error');
        }

        const body = await response.json();
        const matches = Array.isArray(body.matches) ? body.matches : [];
        const safe = matches.length === 0;
        const threatType = safe ? undefined : matches[0].threatType;

        return { result: { safe, threatType } };
    } catch (error) {
        logger.error('checkUrlReputationWithSafeBrowsing failed', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'Failed to query Safe Browsing');
    }
});

/**
 * Fetch external threat feeds (bypass CORS)
 */
exports.fetchThreatFeed = onCall({
    memory: '256MiB',
    timeoutSeconds: 120,
    region: 'europe-west1'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { url } = request.data;

    if (!url) {
        throw new HttpsError('invalid-argument', 'URL is required.');
    }

    const allowedDomains = [
        'www.cisa.gov',
        'urlhaus-api.abuse.ch',
        'haveibeenpwned.com',
        'safebrowsing.googleapis.com',
        'api.shodan.io'
    ];

    try {
        const parsedUrl = new URL(url);
        if (!allowedDomains.includes(parsedUrl.hostname)) {
            throw new HttpsError('permission-denied', 'Domain not allowed.');
        }
    } catch (error) {
        throw new HttpsError('invalid-argument', 'Invalid URL.');
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Sentinel-GRC/1.0 ThreatFeed Proxy'
            }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            logger.warn(`Threat feed HTTP error: ${response.status} ${response.statusText} for URL: ${url}`);
            throw new HttpsError('internal', `HTTP ${response.status}: ${response.statusText}`);
        }

        const text = await response.text();

        try {
            return JSON.parse(text);
        } catch {
            return { data: text };
        }
    } catch (error) {
        logger.error('Error fetching threat feed:', {
            error: error.message,
            stack: error.stack,
            url: url,
            code: error.code
        });

        if (error.name === 'AbortError') {
            throw new HttpsError('deadline-exceeded', 'Request timeout after 10 seconds.');
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            throw new HttpsError('unavailable', 'External service unavailable.');
        } else {
            throw new HttpsError('internal', 'Failed to fetch threat feed: ' + error.message);
        }
    }
});

/**
 * Fetch RSS feeds (bypass CORS)
 */
exports.fetchRssFeed = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const url = request?.data?.url;
    if (!url) {
        throw new HttpsError('invalid-argument', 'URL is required.');
    }

    const allowedRssHosts = new Set([
        'www.cert.ssi.gouv.fr',
        'cert.ssi.gouv.fr',
        'www.cnil.fr',
        'cnil.fr'
    ]);

    const isPrivateOrLocalHost = (hostname) => {
        const h = String(hostname || '').toLowerCase();
        if (!h) return true;
        if (h === 'localhost' || h.endsWith('.local')) return true;
        if (h === '127.0.0.1' || h === '::1') return true;
        const isIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(h);
        if (isIpv4) {
            const parts = h.split('.').map(n => Number(n));
            if (parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return true;
            if (parts[0] === 10) return true;
            if (parts[0] === 127) return true;
            if (parts[0] === 192 && parts[1] === 168) return true;
            if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
            if (parts[0] === 169 && parts[1] === 254) return true;
        }
        return false;
    };

    try {
        let parsed;
        try {
            parsed = new URL(String(url));
        } catch {
            throw new HttpsError('invalid-argument', 'Invalid URL');
        }

        if (parsed.protocol !== 'https:') {
            throw new HttpsError('invalid-argument', 'Only HTTPS URLs are allowed');
        }

        if (isPrivateOrLocalHost(parsed.hostname)) {
            throw new HttpsError('permission-denied', 'URL host is not allowed');
        }

        if (!allowedRssHosts.has(parsed.hostname)) {
            throw new HttpsError('permission-denied', 'RSS host not allowlisted');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(parsed.toString(), {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Sentinel-GRC/1.0'
            }
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
        }
        const text = await response.text();
        return { content: text };
    } catch (error) {
        if (error instanceof HttpsError) {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Error fetching RSS feed:', { message, error });
        throw new HttpsError('internal', 'Failed to fetch RSS feed: ' + message);
    }
});

/**
 * Fetch External Security Events (SIEM/EDR)
 */
exports.fetchExternalSecurityEvents = onCall({
    memory: '512MiB',
    timeoutSeconds: 120,
    region: 'europe-west1'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { source } = request.data;
    const organizationId = request.auth.token.organizationId || request.auth.token.sub;

    if (!source) {
        throw new HttpsError('invalid-argument', 'Source is required.');
    }

    const db = admin.firestore();
    const settingsDoc = await db.collection('organizations').doc(organizationId).collection('integrations').doc(source).get();

    if (!settingsDoc.exists) {
        throw new HttpsError('failed-precondition', `Connector ${source} not configured for this organization.`);
    }

    const config = settingsDoc.data().config;
    if (!config) {
        throw new HttpsError('failed-precondition', `Connector ${source} configuration is empty.`);
    }

    if (!config.apiKey || !config.url) {
        throw new HttpsError('failed-precondition', `Connector ${source} configuration is incomplete (missing API Key or URL).`);
    }

    try {
        throw new HttpsError('unimplemented', `Connector implementation for ${source} is not available.`);
    } catch (error) {
        logger.error(`External API call to ${source} failed`, error);
        throw new HttpsError('internal', `Failed to fetch events from ${source}: ${error.message}`);
    }
});

/**
 * N8N Webhook Receiver
 */
exports.ingestWebhook = onRequest({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1',
    secrets: [n8nWebhookSecret],
    cors: true
}, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    if (!N8NService.validateSecret(req)) {
        logger.warn('Unauthorized N8N Webhook Attempt', { ip: req.ip });
        res.status(401).send('Unauthorized');
        return;
    }

    try {
        const result = await N8NService.processIngest(req.body);
        res.status(200).json(result);
    } catch (error) {
        logger.error('N8N Ingest Error', error);
        res.status(500).json({ error: error.message });
    }
});
