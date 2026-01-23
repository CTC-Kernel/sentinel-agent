/**
 * Mobile Compliance Screen
 *
 * Shows device compliance status and allows running security checks.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    isDeviceEnrolled,
    enrollDevice,
    sendHeartbeatAndCheck,
    getEnrolledAgent,
    MobileAgent,
} from '../services/mobileAgentService';
import {
    MobileCheckResult,
    getCheckSummary,
    getDeviceInfo,
    DeviceInfo,
} from '../services/mobileComplianceChecks';

const COLORS = {
    primary: '#6366f1',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    background: '#f8fafc',
    card: '#ffffff',
    text: '#1e293b',
    textSecondary: '#64748b',
    border: '#e2e8f0',
};

export default function ComplianceScreen() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isRunningChecks, setIsRunningChecks] = useState(false);
    const [enrolled, setEnrolled] = useState(false);
    const [agent, setAgent] = useState<MobileAgent | null>(null);
    const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
    const [checkResults, setCheckResults] = useState<MobileCheckResult[]>([]);
    const [complianceScore, setComplianceScore] = useState<number | null>(null);

    const loadData = useCallback(async () => {
        try {
            const [isEnrolled, agentData, device] = await Promise.all([
                isDeviceEnrolled(),
                getEnrolledAgent(),
                getDeviceInfo(),
            ]);

            setEnrolled(isEnrolled);
            setAgent(agentData);
            setDeviceInfo(device);

            if (agentData) {
                setComplianceScore(agentData.complianceScore);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleEnroll = async () => {
        setIsLoading(true);
        try {
            const result = await enrollDevice();
            if (result.success) {
                await loadData();
                // Run initial compliance check
                await handleRunChecks();
            } else {
                Alert.alert('Erreur', result.error || 'Impossible d\'enregistrer l\'appareil');
            }
        } catch {
            Alert.alert('Erreur', 'Une erreur est survenue');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRunChecks = async () => {
        setIsRunningChecks(true);
        try {
            const result = await sendHeartbeatAndCheck(true);
            if (result.success) {
                setCheckResults(result.checkResults || []);
                setComplianceScore(result.complianceScore ?? null);
                await loadData(); // Refresh agent data
            } else {
                Alert.alert('Erreur', result.error || 'Impossible d\'exécuter les vérifications');
            }
        } catch {
            Alert.alert('Erreur', 'Une erreur est survenue');
        } finally {
            setIsRunningChecks(false);
        }
    };

    const onRefresh = async () => {
        setIsRefreshing(true);
        await loadData();
    };

    const getScoreColor = (score: number | null) => {
        if (score === null) return COLORS.textSecondary;
        if (score >= 80) return COLORS.success;
        if (score >= 60) return COLORS.warning;
        return COLORS.error;
    };

    const getStatusIcon = (status: MobileCheckResult['status']) => {
        switch (status) {
            case 'pass':
                return { name: 'check-circle', color: COLORS.success };
            case 'fail':
                return { name: 'close-circle', color: COLORS.error };
            case 'warning':
                return { name: 'alert-circle', color: COLORS.warning };
            case 'not_applicable':
                return { name: 'minus-circle', color: COLORS.textSecondary };
            default:
                return { name: 'help-circle', color: COLORS.textSecondary };
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Chargement...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const summary = getCheckSummary(checkResults);

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Conformité Mobile</Text>
                    <View style={styles.headerSpacer} />
                </View>

                {!enrolled ? (
                    /* Not Enrolled State */
                    <View style={styles.enrollCard}>
                        <MaterialCommunityIcons
                            name="shield-lock-outline"
                            size={64}
                            color={COLORS.primary}
                        />
                        <Text style={styles.enrollTitle}>Enregistrer cet appareil</Text>
                        <Text style={styles.enrollDescription}>
                            Enregistrez votre {Platform.OS === 'ios' ? 'iPhone/iPad' : 'appareil Android'}{' '}
                            pour surveiller sa conformité sécurité.
                        </Text>
                        <TouchableOpacity style={styles.enrollButton} onPress={handleEnroll}>
                            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                            <Text style={styles.enrollButtonText}>Enregistrer l'appareil</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {/* Device Info Card */}
                        <View style={styles.deviceCard}>
                            <View style={styles.deviceIconContainer}>
                                <MaterialCommunityIcons
                                    name={Platform.OS === 'ios' ? 'apple' : 'android'}
                                    size={32}
                                    color={COLORS.primary}
                                />
                            </View>
                            <View style={styles.deviceInfo}>
                                <Text style={styles.deviceName}>{deviceInfo?.deviceName}</Text>
                                <Text style={styles.deviceDetails}>
                                    {Platform.OS === 'ios' ? 'iOS' : 'Android'} {deviceInfo?.osVersion}
                                </Text>
                                <Text style={styles.deviceDetails}>
                                    {deviceInfo?.manufacturer} {deviceInfo?.model}
                                </Text>
                            </View>
                            <View style={[
                                styles.statusBadge,
                                { backgroundColor: agent?.status === 'active' ? COLORS.success + '20' : COLORS.warning + '20' }
                            ]}>
                                <View style={[
                                    styles.statusDot,
                                    { backgroundColor: agent?.status === 'active' ? COLORS.success : COLORS.warning }
                                ]} />
                                <Text style={[
                                    styles.statusText,
                                    { color: agent?.status === 'active' ? COLORS.success : COLORS.warning }
                                ]}>
                                    {agent?.status === 'active' ? 'Actif' : 'Hors ligne'}
                                </Text>
                            </View>
                        </View>

                        {/* Compliance Score Card */}
                        <View style={styles.scoreCard}>
                            <View style={styles.scoreCircle}>
                                <Text style={[styles.scoreValue, { color: getScoreColor(complianceScore) }]}>
                                    {complianceScore !== null ? `${complianceScore}%` : '--'}
                                </Text>
                            </View>
                            <Text style={styles.scoreLabel}>Score de Conformité</Text>
                            {agent?.lastCheckAt && (
                                <Text style={styles.lastCheckText}>
                                    Dernière vérification: {formatDate(agent.lastCheckAt)}
                                </Text>
                            )}
                            <TouchableOpacity
                                style={[styles.runChecksButton, isRunningChecks && styles.buttonDisabled]}
                                onPress={handleRunChecks}
                                disabled={isRunningChecks}
                            >
                                {isRunningChecks ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
                                )}
                                <Text style={styles.runChecksButtonText}>
                                    {isRunningChecks ? 'Vérification...' : 'Lancer les vérifications'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Summary Stats */}
                        {checkResults.length > 0 && (
                            <View style={styles.summaryContainer}>
                                <View style={[styles.summaryItem, { backgroundColor: COLORS.success + '15' }]}>
                                    <Text style={[styles.summaryValue, { color: COLORS.success }]}>
                                        {summary.pass}
                                    </Text>
                                    <Text style={styles.summaryLabel}>Réussi</Text>
                                </View>
                                <View style={[styles.summaryItem, { backgroundColor: COLORS.warning + '15' }]}>
                                    <Text style={[styles.summaryValue, { color: COLORS.warning }]}>
                                        {summary.warning}
                                    </Text>
                                    <Text style={styles.summaryLabel}>Attention</Text>
                                </View>
                                <View style={[styles.summaryItem, { backgroundColor: COLORS.error + '15' }]}>
                                    <Text style={[styles.summaryValue, { color: COLORS.error }]}>
                                        {summary.fail}
                                    </Text>
                                    <Text style={styles.summaryLabel}>Échec</Text>
                                </View>
                            </View>
                        )}

                        {/* Check Results List */}
                        {checkResults.length > 0 && (
                            <View style={styles.resultsContainer}>
                                <Text style={styles.sectionTitle}>Résultats des vérifications</Text>
                                {checkResults.map((result, _index) => {
                                    const icon = getStatusIcon(result.status);
                                    return (
                                        <View key={result.checkId} style={styles.resultCard}>
                                            <MaterialCommunityIcons
                                                name={icon.name as keyof typeof MaterialCommunityIcons.glyphMap}
                                                size={24}
                                                color={icon.color}
                                            />
                                            <View style={styles.resultContent}>
                                                <Text style={styles.resultName}>{result.name}</Text>
                                                <Text style={styles.resultDetails}>{result.details}</Text>
                                                <View style={styles.resultMeta}>
                                                    <Text style={styles.resultControlId}>
                                                        {result.framework} - {result.controlId}
                                                    </Text>
                                                    <View style={[
                                                        styles.severityBadge,
                                                        {
                                                            backgroundColor:
                                                                result.severity === 'critical' ? COLORS.error + '20' :
                                                                    result.severity === 'high' ? COLORS.warning + '20' :
                                                                        result.severity === 'medium' ? COLORS.primary + '20' :
                                                                            COLORS.textSecondary + '20'
                                                        }
                                                    ]}>
                                                        <Text style={[
                                                            styles.severityText,
                                                            {
                                                                color:
                                                                    result.severity === 'critical' ? COLORS.error :
                                                                        result.severity === 'high' ? COLORS.warning :
                                                                            result.severity === 'medium' ? COLORS.primary :
                                                                                COLORS.textSecondary
                                                            }
                                                        ]}>
                                                            {result.severity.toUpperCase()}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

function formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;

    return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
    });
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 32,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: COLORS.textSecondary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.text,
        textAlign: 'center',
    },
    headerSpacer: {
        width: 40,
    },

    // Enrollment Card
    enrollCard: {
        backgroundColor: COLORS.card,
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    enrollTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.text,
        marginTop: 16,
        marginBottom: 8,
    },
    enrollDescription: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    enrollButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 16,
        gap: 8,
    },
    enrollButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },

    // Device Card
    deviceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    deviceIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: COLORS.primary + '10',
        justifyContent: 'center',
        alignItems: 'center',
    },
    deviceInfo: {
        flex: 1,
        marginLeft: 12,
    },
    deviceName: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
    },
    deviceDetails: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },

    // Score Card
    scoreCard: {
        backgroundColor: COLORS.card,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    scoreCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 8,
        borderColor: COLORS.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    scoreValue: {
        fontSize: 32,
        fontWeight: '800',
    },
    scoreLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 4,
    },
    lastCheckText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 16,
    },
    runChecksButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 14,
        gap: 8,
    },
    runChecksButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.7,
    },

    // Summary
    summaryContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    summaryItem: {
        flex: 1,
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
    },
    summaryValue: {
        fontSize: 24,
        fontWeight: '700',
    },
    summaryLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 4,
    },

    // Results
    resultsContainer: {
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 12,
    },
    resultCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    resultContent: {
        flex: 1,
        marginLeft: 12,
    },
    resultName: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
    },
    resultDetails: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 4,
        lineHeight: 18,
    },
    resultMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    },
    resultControlId: {
        fontSize: 10,
        color: COLORS.textSecondary,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    severityBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    severityText: {
        fontSize: 10,
        fontWeight: '600',
    },
});
