/**
 * Mobile Compliance Checks
 *
 * Performs device security checks on iOS and Android.
 * These checks run when the app is opened and report to the Sentinel platform.
 */

import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface MobileCheckResult {
    checkId: string;
    name: string;
    description: string;
    status: 'pass' | 'fail' | 'warning' | 'not_applicable';
    details: string;
    framework: string;
    controlId: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    evidence: Record<string, unknown>;
}

export interface DeviceInfo {
    deviceId: string;
    deviceName: string;
    platform: 'ios' | 'android';
    osVersion: string;
    manufacturer: string;
    model: string;
    appVersion: string;
    isDevice: boolean;
}

/**
 * Get device information for enrollment
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
    const appVersion = Application.nativeApplicationVersion || '1.0.0';

    return {
        deviceId: await getOrCreateDeviceId(),
        deviceName: Device.deviceName || 'Unknown Device',
        platform: Platform.OS as 'ios' | 'android',
        osVersion: Device.osVersion || 'Unknown',
        manufacturer: Device.manufacturer || 'Unknown',
        model: Device.modelName || 'Unknown',
        appVersion,
        isDevice: Device.isDevice,
    };
}

/**
 * Get or create a unique device ID stored securely
 */
async function getOrCreateDeviceId(): Promise<string> {
    const DEVICE_ID_KEY = 'sentinel_device_id';

    try {
        let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);

        if (!deviceId) {
            // Generate a unique ID
            deviceId = `mobile-${Platform.OS}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
        }

        return deviceId;
    } catch {
        // Fallback if SecureStore is not available
        return `mobile-${Platform.OS}-${Date.now()}`;
    }
}

/**
 * Run all mobile compliance checks
 */
export async function runAllMobileChecks(): Promise<MobileCheckResult[]> {
    const results: MobileCheckResult[] = [];

    // Run all checks in parallel for speed
    const [
        biometricResult,
        deviceSecurityResult,
        osVersionResult,
        simulatorResult,
        secureStorageResult,
    ] = await Promise.all([
        checkBiometricAuthentication(),
        checkDeviceSecurity(),
        checkOsVersion(),
        checkIsRealDevice(),
        checkSecureStorage(),
    ]);

    results.push(
        biometricResult,
        deviceSecurityResult,
        osVersionResult,
        simulatorResult,
        secureStorageResult
    );

    return results;
}

/**
 * Check if biometric authentication is available and enrolled
 * Maps to ISO 27001 A.9.4.2 - Secure log-on procedures
 */
async function checkBiometricAuthentication(): Promise<MobileCheckResult> {
    const checkId = 'mobile-biometric-auth';
    const baseResult = {
        checkId,
        name: 'Authentification Biométrique',
        description: 'Vérifie si Face ID, Touch ID ou empreinte digitale est activé',
        framework: 'ISO27001',
        controlId: 'A.9.4.2',
        severity: 'high' as const,
    };

    try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

        const typesDescription = supportedTypes.map(type => {
            switch (type) {
                case LocalAuthentication.AuthenticationType.FINGERPRINT:
                    return 'Empreinte digitale';
                case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
                    return 'Reconnaissance faciale';
                case LocalAuthentication.AuthenticationType.IRIS:
                    return 'Scan iris';
                default:
                    return 'Autre';
            }
        }).join(', ');

        if (!hasHardware) {
            return {
                ...baseResult,
                status: 'not_applicable',
                details: 'Appareil sans capteur biométrique',
                evidence: { hasHardware, isEnrolled, supportedTypes },
            };
        }

        if (!isEnrolled) {
            return {
                ...baseResult,
                status: 'fail',
                details: 'Authentification biométrique non configurée sur l\'appareil',
                evidence: { hasHardware, isEnrolled, supportedTypes },
            };
        }

        return {
            ...baseResult,
            status: 'pass',
            details: `Authentification biométrique active: ${typesDescription}`,
            evidence: { hasHardware, isEnrolled, supportedTypes, typesDescription },
        };
    } catch (error) {
        return {
            ...baseResult,
            status: 'warning',
            details: 'Impossible de vérifier l\'authentification biométrique',
            evidence: { error: String(error) },
        };
    }
}

/**
 * Check device security level (passcode, encryption)
 * Maps to ISO 27001 A.8.3.1 - Protection of cryptographic keys
 */
async function checkDeviceSecurity(): Promise<MobileCheckResult> {
    const checkId = 'mobile-device-security';
    const baseResult = {
        checkId,
        name: 'Sécurité de l\'Appareil',
        description: 'Vérifie le niveau de sécurité de l\'appareil (code, chiffrement)',
        framework: 'ISO27001',
        controlId: 'A.8.3.1',
        severity: 'critical' as const,
    };

    try {
        const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();

        switch (securityLevel) {
            case LocalAuthentication.SecurityLevel.NONE:
                return {
                    ...baseResult,
                    status: 'fail',
                    details: 'Aucun verrouillage d\'écran configuré - appareil non sécurisé',
                    evidence: { securityLevel: 'NONE' },
                };
            case LocalAuthentication.SecurityLevel.SECRET:
                return {
                    ...baseResult,
                    status: 'pass',
                    details: 'Code PIN ou mot de passe configuré',
                    evidence: { securityLevel: 'SECRET' },
                };
            case LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK:
                return {
                    ...baseResult,
                    status: 'warning',
                    details: 'Biométrie faible détectée (ex: reconnaissance faciale 2D)',
                    evidence: { securityLevel: 'BIOMETRIC_WEAK' },
                };
            case LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG:
                return {
                    ...baseResult,
                    status: 'pass',
                    details: 'Biométrie forte activée (Face ID, Touch ID, ou équivalent)',
                    evidence: { securityLevel: 'BIOMETRIC_STRONG' },
                };
            default:
                return {
                    ...baseResult,
                    status: 'warning',
                    details: 'Niveau de sécurité inconnu',
                    evidence: { securityLevel: String(securityLevel) },
                };
        }
    } catch (error) {
        return {
            ...baseResult,
            status: 'warning',
            details: 'Impossible de déterminer le niveau de sécurité',
            evidence: { error: String(error) },
        };
    }
}

/**
 * Check OS version for known vulnerabilities
 * Maps to ISO 27001 A.12.6.1 - Management of technical vulnerabilities
 */
async function checkOsVersion(): Promise<MobileCheckResult> {
    const checkId = 'mobile-os-version';
    const baseResult = {
        checkId,
        name: 'Version du Système',
        description: 'Vérifie si le système d\'exploitation est à jour',
        framework: 'ISO27001',
        controlId: 'A.12.6.1',
        severity: 'high' as const,
    };

    const osVersion = Device.osVersion || '0';
    const majorVersion = parseInt(osVersion.split('.')[0], 10);

    if (Platform.OS === 'ios') {
        // iOS 15+ is considered secure (2021+)
        // iOS 17+ is latest (2023+)
        if (majorVersion >= 17) {
            return {
                ...baseResult,
                status: 'pass',
                details: `iOS ${osVersion} - Version à jour`,
                evidence: { osVersion, platform: 'ios', majorVersion },
            };
        } else if (majorVersion >= 15) {
            return {
                ...baseResult,
                status: 'warning',
                details: `iOS ${osVersion} - Mise à jour recommandée vers iOS 17+`,
                evidence: { osVersion, platform: 'ios', majorVersion },
            };
        } else {
            return {
                ...baseResult,
                status: 'fail',
                details: `iOS ${osVersion} - Version obsolète avec vulnérabilités connues`,
                evidence: { osVersion, platform: 'ios', majorVersion },
            };
        }
    } else {
        // Android 12+ is considered secure (API 31+, 2021)
        // Android 14+ is latest (API 34+, 2023)
        if (majorVersion >= 14) {
            return {
                ...baseResult,
                status: 'pass',
                details: `Android ${osVersion} - Version à jour`,
                evidence: { osVersion, platform: 'android', majorVersion },
            };
        } else if (majorVersion >= 12) {
            return {
                ...baseResult,
                status: 'warning',
                details: `Android ${osVersion} - Mise à jour recommandée vers Android 14+`,
                evidence: { osVersion, platform: 'android', majorVersion },
            };
        } else {
            return {
                ...baseResult,
                status: 'fail',
                details: `Android ${osVersion} - Version obsolète avec vulnérabilités connues`,
                evidence: { osVersion, platform: 'android', majorVersion },
            };
        }
    }
}

/**
 * Check if running on a real device (not simulator/emulator)
 * Maps to ISO 27001 A.9.1.2 - Access to networks and network services
 */
async function checkIsRealDevice(): Promise<MobileCheckResult> {
    const checkId = 'mobile-real-device';
    const baseResult = {
        checkId,
        name: 'Appareil Physique',
        description: 'Vérifie que l\'application s\'exécute sur un vrai appareil',
        framework: 'ISO27001',
        controlId: 'A.9.1.2',
        severity: 'medium' as const,
    };

    const isDevice = Device.isDevice;
    const deviceType = Device.deviceType;

    if (isDevice) {
        return {
            ...baseResult,
            status: 'pass',
            details: 'Application exécutée sur un appareil physique',
            evidence: { isDevice, deviceType },
        };
    } else {
        return {
            ...baseResult,
            status: 'fail',
            details: 'Application exécutée sur un simulateur/émulateur',
            evidence: { isDevice, deviceType },
        };
    }
}

/**
 * Check if secure storage is available
 * Maps to ISO 27001 A.10.1.1 - Policy on the use of cryptographic controls
 */
async function checkSecureStorage(): Promise<MobileCheckResult> {
    const checkId = 'mobile-secure-storage';
    const baseResult = {
        checkId,
        name: 'Stockage Sécurisé',
        description: 'Vérifie la disponibilité du stockage chiffré (Keychain/Keystore)',
        framework: 'ISO27001',
        controlId: 'A.10.1.1',
        severity: 'high' as const,
    };

    try {
        // Try to write and read from secure storage
        const testKey = 'sentinel_security_test';
        const testValue = `test-${Date.now()}`;

        await SecureStore.setItemAsync(testKey, testValue);
        const retrieved = await SecureStore.getItemAsync(testKey);
        await SecureStore.deleteItemAsync(testKey);

        if (retrieved === testValue) {
            return {
                ...baseResult,
                status: 'pass',
                details: Platform.OS === 'ios'
                    ? 'Keychain iOS disponible et fonctionnel'
                    : 'Android Keystore disponible et fonctionnel',
                evidence: { secureStorageAvailable: true, platform: Platform.OS },
            };
        } else {
            return {
                ...baseResult,
                status: 'warning',
                details: 'Stockage sécurisé disponible mais avec erreur de lecture',
                evidence: { secureStorageAvailable: true, readError: true },
            };
        }
    } catch (error) {
        return {
            ...baseResult,
            status: 'fail',
            details: 'Stockage sécurisé non disponible',
            evidence: { secureStorageAvailable: false, error: String(error) },
        };
    }
}

/**
 * Calculate overall compliance score from check results
 */
export function calculateComplianceScore(results: MobileCheckResult[]): number {
    if (results.length === 0) return 0;

    const weights: Record<MobileCheckResult['severity'], number> = {
        critical: 3,
        high: 2,
        medium: 1,
        low: 0.5,
    };

    let totalWeight = 0;
    let earnedWeight = 0;

    for (const result of results) {
        if (result.status === 'not_applicable') continue;

        const weight = weights[result.severity];
        totalWeight += weight;

        if (result.status === 'pass') {
            earnedWeight += weight;
        } else if (result.status === 'warning') {
            earnedWeight += weight * 0.5;
        }
        // 'fail' adds 0
    }

    if (totalWeight === 0) return 100;
    return Math.round((earnedWeight / totalWeight) * 100);
}

/**
 * Get summary of check results
 */
export function getCheckSummary(results: MobileCheckResult[]): {
    total: number;
    pass: number;
    fail: number;
    warning: number;
    notApplicable: number;
} {
    return {
        total: results.length,
        pass: results.filter(r => r.status === 'pass').length,
        fail: results.filter(r => r.status === 'fail').length,
        warning: results.filter(r => r.status === 'warning').length,
        notApplicable: results.filter(r => r.status === 'not_applicable').length,
    };
}
