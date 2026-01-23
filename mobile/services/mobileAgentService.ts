/**
 * Mobile Agent Service
 *
 * Handles agent enrollment, heartbeat, and result uploads for mobile devices.
 * Connects to the Sentinel GRC backend via Firebase Cloud Functions.
 */

import { auth, db } from '../firebaseConfig';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    getDeviceInfo,
    runAllMobileChecks,
    calculateComplianceScore,
    MobileCheckResult,
} from './mobileComplianceChecks';

const STORAGE_KEYS = {
    AGENT_ID: '@sentinel/agent_id',
    LAST_HEARTBEAT: '@sentinel/last_heartbeat',
    PENDING_RESULTS: '@sentinel/pending_results',
    ENROLLMENT_STATUS: '@sentinel/enrollment_status',
};

export interface MobileAgent {
    id: string;
    deviceId: string;
    deviceName: string;
    platform: 'ios' | 'android';
    osVersion: string;
    manufacturer: string;
    model: string;
    appVersion: string;
    organizationId: string;
    userId: string;
    status: 'active' | 'offline' | 'error';
    complianceScore: number | null;
    lastHeartbeat: Date | null;
    lastCheckAt: Date | null;
    enrolledAt: Date;
    enrolledWithToken?: string;
}

export interface EnrollmentResult {
    success: boolean;
    agentId?: string;
    error?: string;
}

/**
 * Check if the current device is already enrolled as an agent
 */
export async function isDeviceEnrolled(): Promise<boolean> {
    try {
        const agentId = await AsyncStorage.getItem(STORAGE_KEYS.AGENT_ID);
        if (!agentId) return false;

        // Verify agent still exists in Firestore
        const user = auth.currentUser;
        if (!user) return false;

        // Get user's organization
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return false;

        const organizationId = userDoc.data()?.organizationId;
        if (!organizationId) return false;

        const agentDoc = await getDoc(
            doc(db, 'organizations', organizationId, 'agents', agentId)
        );

        return agentDoc.exists();
    } catch {
        return false;
    }
}

/**
 * Get the current enrolled agent info
 */
export async function getEnrolledAgent(): Promise<MobileAgent | null> {
    try {
        const agentId = await AsyncStorage.getItem(STORAGE_KEYS.AGENT_ID);
        if (!agentId) return null;

        const user = auth.currentUser;
        if (!user) return null;

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return null;

        const organizationId = userDoc.data()?.organizationId;
        if (!organizationId) return null;

        const agentDoc = await getDoc(
            doc(db, 'organizations', organizationId, 'agents', agentId)
        );

        if (!agentDoc.exists()) {
            // Agent was deleted, clear local storage
            await AsyncStorage.removeItem(STORAGE_KEYS.AGENT_ID);
            return null;
        }

        const data = agentDoc.data();
        return {
            id: agentDoc.id,
            deviceId: data.deviceId,
            deviceName: data.deviceName,
            platform: data.platform,
            osVersion: data.osVersion,
            manufacturer: data.manufacturer,
            model: data.model,
            appVersion: data.appVersion,
            organizationId: data.organizationId,
            userId: data.userId,
            status: computeAgentStatus(data.lastHeartbeat),
            complianceScore: data.complianceScore ?? null,
            lastHeartbeat: data.lastHeartbeat?.toDate() ?? null,
            lastCheckAt: data.lastCheckAt?.toDate() ?? null,
            enrolledAt: data.enrolledAt?.toDate() ?? new Date(),
            enrolledWithToken: data.enrolledWithToken,
        };
    } catch {
        return null;
    }
}

/**
 * Compute agent status based on last heartbeat
 */
function computeAgentStatus(lastHeartbeat: Timestamp | null): 'active' | 'offline' | 'error' {
    if (!lastHeartbeat) return 'offline';

    const now = Date.now();
    const heartbeatTime = lastHeartbeat.toDate().getTime();
    const diffMs = now - heartbeatTime;

    // Mobile agents are considered active if heartbeat within 24 hours
    // (since they only send heartbeat when app is opened)
    const MOBILE_OFFLINE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

    return diffMs < MOBILE_OFFLINE_THRESHOLD_MS ? 'active' : 'offline';
}

/**
 * Enroll this device as a mobile agent
 */
export async function enrollDevice(enrollmentToken?: string): Promise<EnrollmentResult> {
    try {
        const user = auth.currentUser;
        if (!user) {
            return { success: false, error: 'Utilisateur non connecté' };
        }

        // Get user's organization
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
            return { success: false, error: 'Profil utilisateur non trouvé' };
        }

        const organizationId = userDoc.data()?.organizationId;
        if (!organizationId) {
            return { success: false, error: 'Organisation non trouvée' };
        }

        // Validate enrollment token if provided
        if (enrollmentToken) {
            const tokenValid = await validateEnrollmentToken(organizationId, enrollmentToken);
            if (!tokenValid.valid) {
                return { success: false, error: tokenValid.error || 'Token invalide' };
            }
        }

        // Get device info
        const deviceInfo = await getDeviceInfo();

        // Check if device is already enrolled
        const existingAgent = await findExistingAgent(organizationId, deviceInfo.deviceId);
        if (existingAgent) {
            // Update existing agent
            await updateDoc(
                doc(db, 'organizations', organizationId, 'agents', existingAgent.id),
                {
                    deviceName: deviceInfo.deviceName,
                    osVersion: deviceInfo.osVersion,
                    appVersion: deviceInfo.appVersion,
                    lastHeartbeat: serverTimestamp(),
                    userId: user.uid,
                }
            );

            await AsyncStorage.setItem(STORAGE_KEYS.AGENT_ID, existingAgent.id);
            return { success: true, agentId: existingAgent.id };
        }

        // Create new agent
        const agentRef = doc(collection(db, 'organizations', organizationId, 'agents'));
        const agentData = {
            deviceId: deviceInfo.deviceId,
            deviceName: deviceInfo.deviceName,
            platform: deviceInfo.platform,
            osVersion: deviceInfo.osVersion,
            manufacturer: deviceInfo.manufacturer,
            model: deviceInfo.model,
            appVersion: deviceInfo.appVersion,
            organizationId,
            userId: user.uid,
            status: 'active',
            complianceScore: null,
            lastHeartbeat: serverTimestamp(),
            lastCheckAt: null,
            enrolledAt: serverTimestamp(),
            enrolledWithToken: enrollmentToken || null,
            isMobile: true,
        };

        await setDoc(agentRef, agentData);

        // Mark token as used if provided
        if (enrollmentToken) {
            await markTokenAsUsed(organizationId, enrollmentToken);
        }

        // Store agent ID locally
        await AsyncStorage.setItem(STORAGE_KEYS.AGENT_ID, agentRef.id);

        return { success: true, agentId: agentRef.id };
    } catch (error) {
        console.error('Enrollment error:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Find existing agent by device ID
 */
async function findExistingAgent(
    organizationId: string,
    deviceId: string
): Promise<{ id: string } | null> {
    try {
        const agentsRef = collection(db, 'organizations', organizationId, 'agents');
        const q = query(agentsRef, where('deviceId', '==', deviceId));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

        return { id: snapshot.docs[0].id };
    } catch {
        return null;
    }
}

/**
 * Validate enrollment token
 */
async function validateEnrollmentToken(
    organizationId: string,
    token: string
): Promise<{ valid: boolean; error?: string }> {
    try {
        const tokensRef = collection(db, 'organizations', organizationId, 'enrollmentTokens');
        const q = query(tokensRef, where('token', '==', token));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return { valid: false, error: 'Token non trouvé' };
        }

        const tokenDoc = snapshot.docs[0];
        const tokenData = tokenDoc.data();

        if (tokenData.revoked) {
            return { valid: false, error: 'Token révoqué' };
        }

        const expiresAt = tokenData.expiresAt?.toDate();
        if (expiresAt && expiresAt < new Date()) {
            return { valid: false, error: 'Token expiré' };
        }

        if (tokenData.maxUses && tokenData.usedCount >= tokenData.maxUses) {
            return { valid: false, error: 'Token épuisé (nombre max d\'utilisations atteint)' };
        }

        return { valid: true };
    } catch {
        return { valid: false, error: 'Erreur de validation du token' };
    }
}

/**
 * Mark enrollment token as used
 */
async function markTokenAsUsed(organizationId: string, token: string): Promise<void> {
    try {
        const tokensRef = collection(db, 'organizations', organizationId, 'enrollmentTokens');
        const q = query(tokensRef, where('token', '==', token));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const tokenDoc = snapshot.docs[0];
            await updateDoc(tokenDoc.ref, {
                usedCount: (tokenDoc.data().usedCount || 0) + 1,
                lastUsedAt: serverTimestamp(),
            });
        }
    } catch (error) {
        console.error('Error marking token as used:', error);
    }
}

/**
 * Send heartbeat and optionally run compliance checks
 */
export async function sendHeartbeatAndCheck(runChecks = true): Promise<{
    success: boolean;
    complianceScore?: number;
    checkResults?: MobileCheckResult[];
    error?: string;
}> {
    try {
        const agentId = await AsyncStorage.getItem(STORAGE_KEYS.AGENT_ID);
        if (!agentId) {
            return { success: false, error: 'Appareil non enregistré' };
        }

        const user = auth.currentUser;
        if (!user) {
            return { success: false, error: 'Utilisateur non connecté' };
        }

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
            return { success: false, error: 'Profil utilisateur non trouvé' };
        }

        const organizationId = userDoc.data()?.organizationId;
        if (!organizationId) {
            return { success: false, error: 'Organisation non trouvée' };
        }

        const agentRef = doc(db, 'organizations', organizationId, 'agents', agentId);

        // Get device info for update
        const deviceInfo = await getDeviceInfo();

        // Run compliance checks if requested
        let checkResults: MobileCheckResult[] = [];
        let complianceScore: number | undefined;

        if (runChecks) {
            checkResults = await runAllMobileChecks();
            complianceScore = calculateComplianceScore(checkResults);

            // Store results
            const resultsRef = collection(agentRef, 'results');
            for (const result of checkResults) {
                const resultDoc = doc(resultsRef);
                await setDoc(resultDoc, {
                    ...result,
                    timestamp: serverTimestamp(),
                    agentId,
                });
            }
        }

        // Update agent document
        const updateData: Record<string, unknown> = {
            lastHeartbeat: serverTimestamp(),
            osVersion: deviceInfo.osVersion,
            appVersion: deviceInfo.appVersion,
            deviceName: deviceInfo.deviceName,
        };

        if (runChecks) {
            updateData.complianceScore = complianceScore;
            updateData.lastCheckAt = serverTimestamp();
        }

        await updateDoc(agentRef, updateData);

        // Store last heartbeat time locally
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_HEARTBEAT, new Date().toISOString());

        return {
            success: true,
            complianceScore,
            checkResults,
        };
    } catch (error) {
        console.error('Heartbeat error:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Unenroll this device
 */
export async function unenrollDevice(): Promise<{ success: boolean; error?: string }> {
    try {
        const agentId = await AsyncStorage.getItem(STORAGE_KEYS.AGENT_ID);
        if (!agentId) {
            return { success: true }; // Already not enrolled
        }

        // Clear local storage
        await AsyncStorage.multiRemove([
            STORAGE_KEYS.AGENT_ID,
            STORAGE_KEYS.LAST_HEARTBEAT,
            STORAGE_KEYS.PENDING_RESULTS,
            STORAGE_KEYS.ENROLLMENT_STATUS,
        ]);

        return { success: true };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}

/**
 * Get last heartbeat time
 */
export async function getLastHeartbeat(): Promise<Date | null> {
    try {
        const lastHeartbeat = await AsyncStorage.getItem(STORAGE_KEYS.LAST_HEARTBEAT);
        return lastHeartbeat ? new Date(lastHeartbeat) : null;
    } catch {
        return null;
    }
}
