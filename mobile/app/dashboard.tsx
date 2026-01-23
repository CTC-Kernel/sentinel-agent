
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, SafeAreaView, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { isDeviceEnrolled, getEnrolledAgent, sendHeartbeatAndCheck, MobileAgent } from '../services/mobileAgentService';

export default function DashboardScreen() {
    const router = useRouter();
    const [, setLoading] = useState(true);
    const [stats, setStats] = useState({
        risks: 0,
        compliance: 0,
        incidents: 0
    });
    const [mobileAgent, setMobileAgent] = useState<MobileAgent | null>(null);
    const [deviceEnrolled, setDeviceEnrolled] = useState(false);

    // Refresh agent data when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadAgentData();
        }, [])
    );

    useEffect(() => {
        fetchStats();
    }, []);

    const loadAgentData = async () => {
        try {
            const enrolled = await isDeviceEnrolled();
            setDeviceEnrolled(enrolled);

            if (enrolled) {
                const agent = await getEnrolledAgent();
                setMobileAgent(agent);

                // Send heartbeat when app is opened
                if (agent) {
                    sendHeartbeatAndCheck(false).catch(console.error);
                }
            }
        } catch (error) {
            console.error('Error loading agent data:', error);
        }
    };

    const fetchStats = async () => {
        setLoading(true);
        try {
            if (auth.currentUser) {
                // Mocking for immediate visual feedback in MVP
                setStats({
                    risks: 12,
                    compliance: 78,
                    incidents: 2
                });
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Erreur', 'Impossible de charger les données.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.replace('/');
        } catch {
            Alert.alert('Erreur', 'Impossible de se déconnecter.');
        }
    };

    type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

    type KpiCardProps = {
        title: string;
        value: string | number;
        icon: IconName;
        color: string;
        subtitle?: string;
    };

    const KpiCard = ({ title, value, icon, color, subtitle }: KpiCardProps) => (
        <View style={styles.card}>
            <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
                <MaterialCommunityIcons name={icon} size={24} color={color} />
            </View>
            <View>
                <Text style={styles.cardValue}>{value}</Text>
                <Text style={styles.cardTitle}>{title}</Text>
            </View>
            {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Bonjour,</Text>
                    <Text style={styles.username}>{auth.currentUser?.email?.split('@')[0] || 'Utilisateur'}</Text>
                </View>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                    <MaterialCommunityIcons name="logout" size={20} color="#64748b" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.sectionTitle}>Vue d'ensemble</Text>

                <View style={styles.grid}>
                    <KpiCard
                        title="Risques Élevés"
                        value={stats.risks}
                        icon="alert"
                        color="#ef4444"
                    />
                    <KpiCard
                        title="Conformité"
                        value={`${stats.compliance}% `}
                        icon="shield-check"
                        color="#22c55e"
                    />
                    <KpiCard
                        title="Incidents"
                        value={stats.incidents}
                        icon="bell-ring"
                        color="#f59e0b"
                        subtitle="En cours"
                    />
                    <KpiCard
                        title="Actions"
                        value="5"
                        icon="checkbox-marked-circle-outline"
                        color="#3b82f6"
                    />
                </View>

                {/* Mobile Device Compliance Card */}
                <Text style={styles.sectionTitle}>Conformité Appareil</Text>
                <TouchableOpacity
                    style={styles.deviceComplianceCard}
                    onPress={() => router.push('/compliance')}
                >
                    <View style={styles.deviceComplianceLeft}>
                        <View style={[styles.deviceIconBox, { backgroundColor: '#6366f1' + '20' }]}>
                            <MaterialCommunityIcons
                                name={Platform.OS === 'ios' ? 'apple' : 'android'}
                                size={28}
                                color="#6366f1"
                            />
                        </View>
                        <View style={styles.deviceComplianceInfo}>
                            <Text style={styles.deviceComplianceTitle}>
                                {deviceEnrolled ? 'Cet appareil' : 'Enregistrer cet appareil'}
                            </Text>
                            <Text style={styles.deviceComplianceSubtitle}>
                                {deviceEnrolled
                                    ? mobileAgent?.status === 'active' ? 'Agent actif' : 'Agent hors ligne'
                                    : 'Surveillez la conformité de votre mobile'
                                }
                            </Text>
                        </View>
                    </View>
                    <View style={styles.deviceComplianceRight}>
                        {deviceEnrolled && mobileAgent?.complianceScore !== null ? (
                            <View style={[
                                styles.scoreCircleSmall,
                                {
                                    borderColor: (mobileAgent?.complianceScore ?? 0) >= 80
                                        ? '#22c55e'
                                        : (mobileAgent?.complianceScore ?? 0) >= 60
                                        ? '#f59e0b'
                                        : '#ef4444'
                                }
                            ]}>
                                <Text style={[
                                    styles.scoreTextSmall,
                                    {
                                        color: (mobileAgent?.complianceScore ?? 0) >= 80
                                            ? '#22c55e'
                                            : (mobileAgent?.complianceScore ?? 0) >= 60
                                            ? '#f59e0b'
                                            : '#ef4444'
                                    }
                                ]}>
                                    {mobileAgent?.complianceScore}%
                                </Text>
                            </View>
                        ) : (
                            <MaterialCommunityIcons name="chevron-right" size={24} color="#64748b" />
                        )}
                    </View>
                </TouchableOpacity>

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
                        style={[styles.actionButton, styles.actionButtonHalf, { backgroundColor: '#6366f1' }]}
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
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        paddingTop: 60, // For status bar
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    greeting: {
        fontSize: 14,
        color: '#64748b',
    },
    username: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0f172a',
        textTransform: 'capitalize',
    },
    logoutButton: {
        padding: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
    },
    content: {
        padding: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 16,
        marginTop: 8,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 32,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 16,
        width: '47%', // roughly half - gap
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        gap: 12,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    cardTitle: {
        fontSize: 14,
        color: '#64748b',
    },
    cardSubtitle: {
        fontSize: 12,
        color: '#f59e0b',
        marginTop: 4,
    },
    actionButton: {
        backgroundColor: '#0f172a',
        borderRadius: 16,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        shadowColor: '#0f172a',
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
        fontWeight: 'bold',
    },
    // Device Compliance Card
    deviceComplianceCard: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    deviceComplianceLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    deviceIconBox: {
        width: 56,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    deviceComplianceInfo: {
        marginLeft: 12,
        flex: 1,
    },
    deviceComplianceTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
    },
    deviceComplianceSubtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    deviceComplianceRight: {
        marginLeft: 12,
    },
    scoreCircleSmall: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 3,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scoreTextSmall: {
        fontSize: 14,
        fontWeight: '700',
    },
});
