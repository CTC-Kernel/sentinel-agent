/**
 * Dashboard Screen
 *
 * Main dashboard showing KPIs and quick actions.
 * Refactored to use Zustand store and extracted components.
 */

import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    SafeAreaView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAgentStore } from '../stores/agentStore';
import { sendHeartbeatAndCheck } from '../services/mobileAgentService';
import { COLORS } from '../theme/colors';
import { KpiCard, DeviceComplianceCard } from '../components/dashboard';

export default function DashboardScreen() {
    const router = useRouter();
    const [stats, setStats] = useState({
        risks: 0,
        compliance: 0,
        incidents: 0,
    });

    // Get agent state from Zustand store
    const { enrolled, agent, loadData } = useAgentStore();

    // Refresh all data when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            // Load agent data
            loadData();

            // Load stats (mocked for MVP)
            if (auth.currentUser) {
                setStats({
                    risks: 12,
                    compliance: 78,
                    incidents: 2,
                });
            }

            // Send heartbeat when app is opened
            if (enrolled && agent) {
                sendHeartbeatAndCheck(false).catch(console.error);
            }
        }, [loadData, enrolled, agent])
    );

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.replace('/');
        } catch {
            Alert.alert('Erreur', 'Impossible de se déconnecter.');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Bonjour,</Text>
                    <Text style={styles.username}>
                        {auth.currentUser?.email?.split('@')[0] || 'Utilisateur'}
                    </Text>
                </View>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                    <MaterialCommunityIcons name="logout" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.sectionTitle}>Vue d'ensemble</Text>

                <View style={styles.grid}>
                    <KpiCard
                        title="Risques Élevés"
                        value={stats.risks}
                        icon="alert"
                        color={COLORS.error}
                    />
                    <KpiCard
                        title="Conformité"
                        value={`${stats.compliance}%`}
                        icon="shield-check"
                        color={COLORS.success}
                    />
                    <KpiCard
                        title="Incidents"
                        value={stats.incidents}
                        icon="bell-ring"
                        color={COLORS.warning}
                        subtitle="En cours"
                    />
                    <KpiCard
                        title="Actions"
                        value="5"
                        icon="checkbox-marked-circle-outline"
                        color="#3b82f6"
                    />
                </View>

                <Text style={styles.sectionTitle}>Conformité Appareil</Text>
                <DeviceComplianceCard
                    enrolled={enrolled}
                    agent={agent}
                    onPress={() => router.push('/compliance')}
                />

                <Text style={styles.sectionTitle}>Actions Rapides</Text>
                <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.actionButtonHalf]}
                        onPress={() => router.push('/scanner')}
                    >
                        <MaterialCommunityIcons name="qrcode-scan" size={24} color="white" />
                        <Text style={styles.actionButtonText}>Scanner</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.actionButton,
                            styles.actionButtonHalf,
                            { backgroundColor: COLORS.primary },
                        ]}
                        onPress={() => router.push('/compliance')}
                    >
                        <MaterialCommunityIcons name="shield-check" size={24} color="white" />
                        <Text style={styles.actionButtonText}>Vérifier</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        paddingTop: 60,
        backgroundColor: COLORS.card,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    greeting: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    username: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.text,
        textTransform: 'capitalize',
    },
    logoutButton: {
        padding: 8,
        backgroundColor: COLORS.background,
        borderRadius: 8,
    },
    content: {
        padding: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 16,
        marginTop: 8,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 32,
    },
    actionButton: {
        backgroundColor: COLORS.text,
        borderRadius: 16,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        shadowColor: COLORS.text,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    actionButtonHalf: {
        flex: 1,
        padding: 16,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
});
