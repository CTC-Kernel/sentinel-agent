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

// In-memory rate limiter for external API calls (Shodan, HIBP)
const apiCallCounts = new Map();
const API_RATE_LIMIT = 5; // per hour per user per API

function checkApiRateLimit(userId, apiName) {
    const key = `${userId}:${apiName}`;
    const now = Date.now();
    const calls = apiCallCounts.get(key) || [];
    const recentCalls = calls.filter(t => now - t < 3600000);
    if (recentCalls.length >= API_RATE_LIMIT) {
        throw new HttpsError('resource-exhausted', `Rate limit exceeded for ${apiName}. Try again later.`);
    }
    recentCalls.push(now);
    apiCallCounts.set(key, recentCalls);
}

/**
 * Encrypt data using the USER_SECRETS_ENCRYPTION_KEY
 */
function encryptData(text, secretKey) {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(secretKey, 'sentinel-grc-integration-salt-v2', 32);
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
    const key = crypto.scryptSync(secretKey, 'sentinel-grc-integration-salt-v2', 32);
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
        throw new HttpsError('internal', 'Failed to connect integration');
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
            checkApiRateLimit(request.auth.uid, 'shodan');

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
            checkApiRateLimit(request.auth.uid, 'hibp');

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
        throw new HttpsError('internal', 'Failed to fetch evidence');
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
        checkApiRateLimit(uid, 'shodan');

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
        checkApiRateLimit(uid, 'hibp');

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
            throw new HttpsError('internal', 'Failed to fetch threat feed');
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
        throw new HttpsError('internal', 'Failed to fetch RSS feed');
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
        throw new HttpsError('internal', `Failed to fetch events from external source`);
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
    cors: false
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
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Fetch Scanner Vulnerabilities (Nessus, Qualys, OpenVAS)
 * Requires proper scanner configuration in organization settings
 */
exports.fetchScannerVulnerabilities = onCall({
    memory: '512MiB',
    timeoutSeconds: 120,
    region: 'europe-west1',
    secrets: [userSecretsKey]
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { scanner } = request.data;
    const organizationId = request.auth.token.organizationId || request.auth.token.sub;

    if (!scanner || !['nessus', 'qualys', 'openvas'].includes(scanner)) {
        throw new HttpsError('invalid-argument', 'Scanner must be one of: nessus, qualys, openvas');
    }

    const db = admin.firestore();

    // Check if scanner is configured for this organization
    const configDoc = await db.collection('organizations').doc(organizationId)
        .collection('integrations').doc(scanner).get();

    if (!configDoc.exists) {
        throw new HttpsError('failed-precondition',
            `Scanner ${scanner} is not configured. Please configure the integration in Settings > Integrations.`);
    }

    const config = configDoc.data();
    if (!config || !config.apiUrl || !config.credentials) {
        throw new HttpsError('failed-precondition',
            `Scanner ${scanner} configuration is incomplete. Please provide API URL and credentials.`);
    }

    try {
        // Decrypt credentials
        const apiKey = config.credentials.apiKey ? decryptUserSecret(config.credentials.apiKey) : null;
        const accessKey = config.credentials.accessKey ? decryptUserSecret(config.credentials.accessKey) : null;
        const secretKey = config.credentials.secretKey ? decryptUserSecret(config.credentials.secretKey) : null;

        let vulnerabilities = [];

        switch (scanner) {
            case 'nessus':
                vulnerabilities = await fetchNessusVulnerabilities(config.apiUrl, accessKey, secretKey);
                break;
            case 'qualys':
                vulnerabilities = await fetchQualysVulnerabilities(config.apiUrl, apiKey);
                break;
            case 'openvas':
                vulnerabilities = await fetchOpenVASVulnerabilities(config.apiUrl, apiKey);
                break;
        }

        logger.info(`Fetched ${vulnerabilities.length} vulnerabilities from ${scanner} for org ${organizationId}`);
        return vulnerabilities;

    } catch (error) {
        logger.error(`Scanner ${scanner} fetch error:`, error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', `Failed to fetch vulnerabilities from scanner`);
    }
});

// Scanner-specific fetch functions
async function fetchNessusVulnerabilities(apiUrl, accessKey, secretKey) {
    if (!accessKey || !secretKey) {
        throw new HttpsError('failed-precondition', 'Nessus requires Access Key and Secret Key');
    }

    // Nessus API authentication uses X-ApiKeys header
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(`${apiUrl}/scans`, {
            method: 'GET',
            headers: {
                'X-ApiKeys': `accessKey=${accessKey}; secretKey=${secretKey}`,
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Nessus API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Transform Nessus format to our vulnerability format
        return (data.scans || []).flatMap(scan =>
            (scan.vulnerabilities || []).map(vuln => ({
                id: `nessus-${vuln.plugin_id}`,
                title: vuln.plugin_name,
                severity: mapNessusSeverity(vuln.severity),
                cvss: vuln.cvss_score || null,
                cve: vuln.cve || [],
                description: vuln.description,
                solution: vuln.solution,
                affectedAssets: vuln.hosts || [],
                source: 'nessus',
                discoveredAt: new Date().toISOString()
            }))
        );
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

async function fetchQualysVulnerabilities(apiUrl, apiKey) {
    if (!apiKey) {
        throw new HttpsError('failed-precondition', 'Qualys requires API Key');
    }

    // Qualys uses basic auth with username:password or API token
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(`${apiUrl}/api/2.0/fo/asset/host/vm/detection/`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${Buffer.from(apiKey).toString('base64')}`,
                'X-Requested-With': 'Sentinel-GRC'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Qualys API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Transform Qualys format to our vulnerability format
        return (data.HOST_LIST_VM_DETECTION_OUTPUT?.RESPONSE?.HOST_LIST?.HOST || []).flatMap(host =>
            (host.DETECTION_LIST?.DETECTION || []).map(det => ({
                id: `qualys-${det.QID}`,
                title: det.TITLE,
                severity: mapQualysSeverity(det.SEVERITY),
                cvss: det.CVSS?.BASE || null,
                cve: det.CVE_LIST?.CVE?.map(c => c.ID) || [],
                description: det.RESULTS,
                solution: det.SOLUTION,
                affectedAssets: [host.IP],
                source: 'qualys',
                discoveredAt: det.FIRST_FOUND_DATETIME || new Date().toISOString()
            }))
        );
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

async function fetchOpenVASVulnerabilities(apiUrl, apiKey) {
    if (!apiKey) {
        throw new HttpsError('failed-precondition', 'OpenVAS requires API Key');
    }

    // OpenVAS/GVM uses GMP protocol, typically via REST API wrapper
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(`${apiUrl}/gmp`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                command: 'get_results',
                filter: 'levels=hml'
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`OpenVAS API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Transform OpenVAS format to our vulnerability format
        return (data.results || []).map(result => ({
            id: `openvas-${result.id}`,
            title: result.name,
            severity: mapOpenVASSeverity(result.severity),
            cvss: parseFloat(result.severity) || null,
            cve: result.nvt?.cve ? [result.nvt.cve] : [],
            description: result.description,
            solution: result.nvt?.solution,
            affectedAssets: [result.host?.hostname || result.host?.ip],
            source: 'openvas',
            discoveredAt: result.creation_time || new Date().toISOString()
        }));
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// Severity mapping functions
function mapNessusSeverity(severity) {
    const severityMap = { 0: 'info', 1: 'low', 2: 'medium', 3: 'high', 4: 'critical' };
    return severityMap[severity] || 'unknown';
}

function mapQualysSeverity(severity) {
    if (severity >= 5) return 'critical';
    if (severity >= 4) return 'high';
    if (severity >= 3) return 'medium';
    if (severity >= 2) return 'low';
    return 'info';
}

function mapOpenVASSeverity(cvss) {
    const score = parseFloat(cvss);
    if (score >= 9.0) return 'critical';
    if (score >= 7.0) return 'high';
    if (score >= 4.0) return 'medium';
    if (score >= 0.1) return 'low';
    return 'info';
}
