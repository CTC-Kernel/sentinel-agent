/**
 * AI Module - Gemini AI Functions
 * Domain: AI Content Generation, Chat, API Key Management, Predictive Compliance
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");
const crypto = require("crypto");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { checkCallableRateLimit } = require("../utils/rateLimiter");

// Predictive Compliance Functions
const {
    generateCompliancePredictions,
    generateRecommendedActions,
    dailyPredictionRefresh,
    recordScoreSnapshot
} = require('./predictiveCompliance');

// Gemini Proxy (lightweight, App Check enforced)
const { geminiProxy } = require('./geminiProxy');

/**
 * Determine the correct API version for a given model
 */
function getApiVersionForModel(modelName) {
    if (!modelName) return 'v1beta';
    const modelStr = String(modelName);
    if (modelStr.includes('gemini-3') || modelStr.includes('gemini-2.0')) {
        return 'v1alpha';
    }
    return 'v1beta';
}

// Secrets
const userSecretsKey = defineSecret("USER_SECRETS_ENCRYPTION_KEY");
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// AI Limits per plan
const AI_LIMITS = {
    'discovery': 1000,
    'professional': 5000,
    'enterprise': 50000
};

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
 * Encrypt user secret
 */
function encryptUserSecret(plainText) {
    const key = getUserSecretKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
        iv: iv.toString("base64"),
        cipherText: encrypted.toString("base64"),
        tag: authTag.toString("base64")
    };
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
 * Get Gemini client for user (prioritizes user key, then global key)
 */
async function getGeminiClientForUser(uid, requestModelName, apiVersion) {
    const db = admin.firestore();
    const userKeysRef = db.collection('user_api_keys').doc(uid);
    const userKeysSnap = await userKeysRef.get();
    const userKeys = userKeysSnap.data() || {};

    let apiKey = null;

    // 1) Encrypted key stored in user_api_keys
    if (userKeys.gemini) {
        apiKey = decryptUserSecret(userKeys.gemini);
        if (apiKey) apiKey = apiKey.replace(/\s+/g, '');
    }

    // 2) Progressive migration: cleartext key in users/{uid}.geminiApiKey
    if (!apiKey) {
        const userRef = db.collection('users').doc(uid);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
            const userData = userSnap.data() || {};
            if (userData.geminiApiKey) {
                apiKey = userData.geminiApiKey;
                const updateData = {
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    gemini: encryptUserSecret(apiKey)
                };
                await userKeysRef.set(updateData, { merge: true });
                await userRef.set({ hasGeminiKey: true }, { merge: true });
            }
        }
    }

    // 3) Fallback: global GEMINI_API_KEY (backend secret)
    if (!apiKey) {
        const globalKey = geminiApiKey.value();
        if (globalKey) {
            apiKey = globalKey.replace(/\s+/g, '');
        }
    }

    if (!apiKey) {
        throw new HttpsError('failed-precondition', 'Gemini API key not configured.');
    }

    // Determine API version based on model name
    let effectiveApiVersion = apiVersion;
    if (!effectiveApiVersion) {
        effectiveApiVersion = getApiVersionForModel(requestModelName);
    }

    return new GoogleGenerativeAI(apiKey, { apiVersion: effectiveApiVersion });
}

/**
 * Check and increment AI usage for an organization
 */
async function checkAndIncrementAiUsage(uid, organizationId) {
    if (!organizationId) return true;

    const db = admin.firestore();
    const orgRef = db.collection('organizations').doc(organizationId);
    const orgSnap = await orgRef.get();

    if (!orgSnap.exists) return false;

    const orgData = orgSnap.data();
    const planId = orgData.subscription?.planId || 'discovery';
    const limit = AI_LIMITS[planId] || 5;

    const today = new Date().toISOString().split('T')[0];
    const usageRef = orgRef.collection('usage').doc(`ai_${today}`);

    return await db.runTransaction(async (t) => {
        const usageDoc = await t.get(usageRef);
        let currentCount = 0;

        if (usageDoc.exists) {
            currentCount = usageDoc.data().count || 0;
        }

        if (currentCount >= limit) {
            throw new HttpsError('resource-exhausted', `Daily AI limit reached for ${planId} plan (${limit} requests/day). Upgrade to increase limits.`);
        }

        t.set(usageRef, {
            count: currentCount + 1,
            date: today,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return true;
    });
}

/**
 * Save user API keys (encrypted)
 */
exports.saveUserApiKeys = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1',
    secrets: [userSecretsKey]
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    // SECURITY: Rate limit API key updates (sensitive operation)
    checkCallableRateLimit(request, 'admin');

    const {
        geminiApiKey,
        shodanApiKey,
        hibpApiKey,
        safeBrowsingApiKey
    } = request.data || {};

    if (geminiApiKey === undefined && shodanApiKey === undefined && hibpApiKey === undefined && safeBrowsingApiKey === undefined) {
        return { success: true, updated: false };
    }

    try {
        const db = admin.firestore();
        const userKeysRef = db.collection('user_api_keys').doc(uid);
        const updateData = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const flags = {};

        if (geminiApiKey !== undefined) {
            if (geminiApiKey) {
                updateData.gemini = encryptUserSecret(geminiApiKey);
                flags.hasGeminiKey = true;
            } else {
                updateData.gemini = admin.firestore.FieldValue.delete();
                flags.hasGeminiKey = false;
            }
        }

        if (shodanApiKey !== undefined) {
            if (shodanApiKey) {
                updateData.shodan = encryptUserSecret(shodanApiKey);
                flags.hasShodanKey = true;
            } else {
                updateData.shodan = admin.firestore.FieldValue.delete();
                flags.hasShodanKey = false;
            }
        }

        if (hibpApiKey !== undefined) {
            if (hibpApiKey) {
                updateData.hibp = encryptUserSecret(hibpApiKey);
                flags.hasHibpKey = true;
            } else {
                updateData.hibp = admin.firestore.FieldValue.delete();
                flags.hasHibpKey = false;
            }
        }

        if (safeBrowsingApiKey !== undefined) {
            if (safeBrowsingApiKey) {
                updateData.safeBrowsing = encryptUserSecret(safeBrowsingApiKey);
                flags.hasSafeBrowsingKey = true;
            } else {
                updateData.safeBrowsing = admin.firestore.FieldValue.delete();
                flags.hasSafeBrowsingKey = false;
            }
        }

        await userKeysRef.set(updateData, { merge: true });

        if (Object.keys(flags).length > 0) {
            await db.collection('users').doc(uid).set(flags, { merge: true });
        }

        return { success: true, updated: true };
    } catch (error) {
        logger.error('saveUserApiKeys failed', error);
        throw new HttpsError('internal', 'Failed to save API keys');
    }
});

/**
 * Call Gemini for content generation
 */
exports.callGeminiGenerateContent = onCall({
    memory: '512MiB',
    timeoutSeconds: 120,
    region: 'europe-west1',
    secrets: [userSecretsKey, geminiApiKey]
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    // SECURITY: Rate limit AI calls (expensive operation)
    checkCallableRateLimit(request, 'heavy');

    const prompt = request.data?.prompt;
    const modelName = request.data?.modelName || "gemini-3-pro-preview";
    const thinkingLevel = request.data?.thinkingLevel;
    const thoughtSignature = request.data?.thoughtSignature;

    if (!prompt || typeof prompt !== 'string') {
        throw new HttpsError('invalid-argument', 'Prompt is required.');
    }

    try {
        // Check and increment usage
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        const userData = userDoc.data();
        if (userData?.organizationId) {
            await checkAndIncrementAiUsage(uid, userData.organizationId);
        }

        const runGenerate = async (name) => {
            const version = getApiVersionForModel(name);
            const genAI = await getGeminiClientForUser(uid, name, version);

            let config = {};
            if (name.includes("gemini-3")) {
                config.thinkingConfig = {
                    thinkingLevel: thinkingLevel || (name.includes("flash") ? "low" : "high")
                };
            }

            const model = genAI.getGenerativeModel({ model: name });
            const contents = [{ role: 'user', parts: [{ text: prompt }] }];

            // Add signature if provided
            if (thoughtSignature) {
                contents[0].parts[0].thoughtSignature = thoughtSignature;
            }

            const result = await model.generateContent({
                contents,
                generationConfig: config
            });
            const response = await result.response;

            // Extract text and signature
            const text = response.text();
            let signature = null;
            if (response.candidates?.[0]?.content?.parts) {
                const sigPart = response.candidates[0].content.parts.find(p => p.thoughtSignature);
                if (sigPart) signature = sigPart.thoughtSignature;
            }

            return { text, signature };
        };

        try {
            const { text, signature } = await runGenerate(modelName);
            return { text, thoughtSignature: signature, model: modelName, version: getApiVersionForModel(modelName) };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn(`Primary Gemini model (${modelName}) failed in callGeminiGenerateContent`, { error: message });

            const isTransient = message.includes('404') || message.includes('not found') ||
                message.includes('429') || message.includes('Too Many Requests') ||
                message.includes('503') || message.includes('500') || message.includes('resource exhausted');

            if (isTransient) {
                const fallbackModels = ['gemini-3-flash-preview', 'gemini-1.5-pro', 'gemini-1.5-flash'];
                for (const name of fallbackModels) {
                    if (name === modelName) continue;
                    try {
                        const { text, signature } = await runGenerate(name);
                        return { text, thoughtSignature: signature, model: name, version: getApiVersionForModel(name), fallback: true };
                    } catch (fallbackError) {
                        logger.warn(`Fallback Gemini model (${name}) failed in callGeminiGenerateContent`, {
                            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
                        });
                        continue;
                    }
                }

                // If all fallbacks fail, throw appropriate error
                if (message.includes('429') || message.includes('resource exhausted')) {
                    throw new HttpsError('resource-exhausted', 'Service IA surchargé. Patientez.');
                }
            }

            throw error;
        }
    } catch (error) {
        logger.error('callGeminiGenerateContent failed', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'Failed to call Gemini generateContent');
    }
});

/**
 * Call Gemini for chat conversations
 */
exports.callGeminiChat = onCall({
    memory: '512MiB',
    timeoutSeconds: 120,
    region: 'europe-west1',
    secrets: [userSecretsKey, geminiApiKey]
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const systemPrompt = request.data?.systemPrompt;
    const message = request.data?.message;
    const modelName = request.data?.modelName || "gemini-3-pro-preview";
    const thinkingLevel = request.data?.thinkingLevel;
    const thoughtSignature = request.data?.thoughtSignature;

    if (!systemPrompt || typeof systemPrompt !== 'string' || !message || typeof message !== 'string') {
        throw new HttpsError('invalid-argument', 'systemPrompt and message are required.');
    }

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    try {
        // Check and increment usage
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        const userData = userDoc.data();
        if (userData?.organizationId) {
            await checkAndIncrementAiUsage(uid, userData.organizationId);
        }

        const runChat = async (name) => {
            const version = getApiVersionForModel(name);
            const client = await getGeminiClientForUser(uid, name, version);

            const userPart = { text: message };
            if (thoughtSignature) {
                userPart.thoughtSignature = thoughtSignature;
            }

            const contents = [
                { role: "user", parts: [{ text: systemPrompt }] },
                { role: "model", parts: [{ text: "Bien recu. Je suis Sentinel AI, pret a vous assister sur tous les sujets GRC." }] },
                { role: "user", parts: [userPart] }
            ];

            let config = {};
            if (name.includes("gemini-3")) {
                config.thinkingConfig = {
                    thinkingLevel: thinkingLevel || "low"
                };
            }

            const model = client.getGenerativeModel({ model: name });
            const result = await model.generateContent({
                contents,
                generationConfig: config
            });
            const response = await result.response;

            // Extract text and signature
            const text = response.text();
            let signature = null;
            if (response.candidates?.[0]?.content?.parts) {
                const sigPart = response.candidates[0].content.parts.find(p => p.thoughtSignature);
                if (sigPart) signature = sigPart.thoughtSignature;
            }

            return { text, signature };
        };

        try {
            const { text, signature } = await runChat(modelName);
            return { text, thoughtSignature: signature, model: modelName, version: getApiVersionForModel(modelName) };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            logger.warn(`Primary Gemini chat model (${modelName}) failed: ${errMsg}`);

            const isTransient = errMsg.includes('429') ||
                errMsg.includes('Too Many Requests') ||
                errMsg.includes('resource exhausted') ||
                errMsg.includes('503') ||
                errMsg.includes('500') ||
                errMsg.includes('404') ||
                errMsg.includes('Not Found') ||
                errMsg.includes('fetch failed') ||
                errMsg.includes('network') ||
                errMsg.includes('quota');

            if (isTransient) {
                const fallbackModels = ['gemini-3-flash-preview', 'gemini-1.5-pro', 'gemini-1.5-flash'];
                const backoffDelays = [1000, 2000, 4000];

                for (let i = 0; i < fallbackModels.length; i++) {
                    const fallbackModel = fallbackModels[i];
                    const waitTime = backoffDelays[i] || 3000;

                    if (fallbackModel === modelName) continue;

                    logger.info(`Retrying with ${fallbackModel} after ${waitTime}ms... (Attempt ${i + 1})`);
                    await delay(waitTime);

                    try {
                        const { text, signature } = await runChat(fallbackModel);
                        return { text, thoughtSignature: signature, model: `${fallbackModel} (fallback)`, version: getApiVersionForModel(fallbackModel) };
                    } catch (retryError) {
                        const retryMsg = retryError instanceof Error ? retryError.message : String(retryError);
                        logger.warn(`Retry attempt ${i + 1} (${fallbackModel}) failed: ${retryMsg}`);
                    }
                }

                if (errMsg.includes('429') || errMsg.includes('resource exhausted')) {
                    throw new HttpsError('resource-exhausted', 'Le service IA est actuellement surcharge. Veuillez reessayer plus tard.');
                }
            }

            throw error;
        }
    } catch (error) {
        logger.error('callGeminiChat failed', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'Une erreur est survenue lors de l\'appel au service IA.');
    }
});

/**
 * Migrate user API keys (cleanup plaintext keys)
 */
exports.migrateUserKeys = onCall({
    memory: '512MiB',
    timeoutSeconds: 300,
    region: 'europe-west1'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const db = admin.firestore();
    const usersRef = db.collection('users');
    let totalMigrated = 0;

    // SECURITY: Only migrate keys for the authenticated user
    // The previous implementation was a critical security flaw allowing global deletion
    const userId = request.auth.uid;
    const userRef = usersRef.doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User profile not found.');
    }

    // Rate Limit Check
    checkCallableRateLimit(request, 'admin');

    const data = userDoc.data();
    const updates = {};
    if (data.geminiApiKey) updates.geminiApiKey = admin.firestore.FieldValue.delete();
    if (data.shodanApiKey) updates.shodanApiKey = admin.firestore.FieldValue.delete();
    if (data.hibpApiKey) updates.hibpApiKey = admin.firestore.FieldValue.delete();
    if (data.safeBrowsingApiKey) updates.safeBrowsingApiKey = admin.firestore.FieldValue.delete();

    if (Object.keys(updates).length > 0) {
        await userRef.update(updates);
        totalMigrated = 1;
    }

    return { success: true, migratedCount: totalMigrated };
});

// ============================================================================
// Predictive Compliance Exports
// ============================================================================

exports.generateCompliancePredictions = generateCompliancePredictions;
exports.generateRecommendedActions = generateRecommendedActions;
exports.dailyPredictionRefresh = dailyPredictionRefresh;
exports.recordScoreSnapshot = recordScoreSnapshot;

// ============================================================================
// Gemini Proxy Export
// ============================================================================

exports.geminiProxy = geminiProxy;
