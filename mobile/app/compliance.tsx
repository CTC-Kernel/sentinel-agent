/**
 * Mobile Compliance Screen
 *
 * Shows device compliance status and allows running security checks.
 * Refactored to use Zustand store and extracted components.
 */

import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAgentStore } from '../stores/agentStore';
import { getCheckSummary } from '../services/mobileComplianceChecks';
import { COLORS } from '../theme/colors';
import {
    EnrollCard,
    DeviceCard,
    ScoreCard,
    SummaryStats,
    CheckResultCard,
} from '../components/compliance';

export default function ComplianceScreen() {
    const router = useRouter();

    // Zustand store state and actions
    const {
        isLoading,
        isRefreshing,
        isRunningChecks,
        enrolled,
        agent,
        deviceInfo,
        checkResults,
        complianceScore,
        error,
        loadData,
        enrollDevice,
        runChecks,
        refresh,
        clearError,
    } = useAgentStore();

    // Load data on mount
    useEffect(() => {
        loadData();
    }, [loadData]);

    // Show error alerts
    useEffect(() => {
        if (error) {
            Alert.alert('Erreur', error, [{ text: 'OK', onPress: clearError }]);
        }
    }, [error, clearError]);

    // Handle enrollment
    const handleEnroll = async () => {
        const result = await enrollDevice();
        if (!result.success && result.error) {
            Alert.alert('Erreur', result.error);
        }
    };

    // Handle running checks
    const handleRunChecks = async () => {
        const result = await runChecks();
        if (!result.success && result.error) {
            Alert.alert('Erreur', result.error);
        }
    };

    // Loading state
    if (isLoading && !isRefreshing) {
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
                    <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
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
                    <EnrollCard onEnroll={handleEnroll} isLoading={isLoading} />
                ) : (
                    <>
                        <DeviceCard deviceInfo={deviceInfo} agent={agent} />

                        <ScoreCard
                            score={complianceScore}
                            lastCheckAt={agent?.lastCheckAt ?? null}
                            isRunningChecks={isRunningChecks}
                            onRunChecks={handleRunChecks}
                        />

                        {checkResults.length > 0 && (
                            <SummaryStats
                                pass={summary.pass}
                                warning={summary.warning}
                                fail={summary.fail}
                            />
                        )}

                        {checkResults.length > 0 && (
                            <View style={styles.resultsContainer}>
                                <Text style={styles.sectionTitle}>Résultats des vérifications</Text>
                                {checkResults.map((result) => (
                                    <CheckResultCard key={result.checkId} result={result} />
                                ))}
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
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
    resultsContainer: {
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 12,
    },
});
