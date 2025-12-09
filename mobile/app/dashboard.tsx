import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function DashboardScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        risks: 0,
        compliance: 0,
        incidents: 0
    });

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        try {
            // In a real app, filter by actual user org. For now, just demo data/counts if possible or mocked
            // Since we don't have easy context of "current user org" unless we fetch user profile first.
            // We'll mock for the MVP to ensure UI works, or try to fetch if auth user exists.

            if (auth.currentUser) {
                // Placeholder: Fetch real counts if possible, else mock for "offline/demo" feel
                // Real fetch example:
                // const risksCount = await getCountFromServer(query(collection(db, 'risks'), where('ownerId', '==', auth.currentUser.uid)));
                // setStats({ ...stats, risks: risksCount.data().count });

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
        } catch (error) {
            Alert.alert('Erreur', 'Impossible de se déconnecter.');
        }
    };

    const KpiCard = ({ title, value, icon, color, subtitle }: any) => (
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
                        value={`${stats.compliance}%`}
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

                <Text style={styles.sectionTitle}>Actions Rapides</Text>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => router.push('/scanner')}
                >
                    <MaterialCommunityIcons name="qrcode-scan" size={24} color="white" />
                    <Text style={styles.actionButtonText}>Scanner un Actif</Text>
                </TouchableOpacity>

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
    actionButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
