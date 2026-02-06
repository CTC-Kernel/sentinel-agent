/**
 * Device Compliance Card Component
 *
 * Displays device compliance status with score indicator.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, getScoreColor } from '../../theme/colors';
import { MobileAgent } from '../../services/mobileAgentService';

interface DeviceComplianceCardProps {
    enrolled: boolean;
    agent: MobileAgent | null;
    onPress: () => void;
}

export function DeviceComplianceCard({ enrolled, agent, onPress }: DeviceComplianceCardProps) {
    const score = agent?.complianceScore ?? null;
    const scoreColor = getScoreColor(score);

    return (
        <TouchableOpacity style={styles.deviceComplianceCard} onPress={onPress}>
            <View style={styles.deviceComplianceLeft}>
                <View style={[styles.deviceIconBox, { backgroundColor: COLORS.primary + '20' }]}>
                    <MaterialCommunityIcons
                        name={Platform.OS === 'ios' ? 'apple' : 'android'}
                        size={28}
                        color={COLORS.primary}
                    />
                </View>
                <View style={styles.deviceComplianceInfo}>
                    <Text style={styles.deviceComplianceTitle}>
                        {enrolled ? 'Cet appareil' : 'Enregistrer cet appareil'}
                    </Text>
                    <Text style={styles.deviceComplianceSubtitle}>
                        {enrolled
                            ? agent?.status === 'active'
                                ? 'Agent actif'
                                : 'Agent hors ligne'
                            : 'Surveillez la conformité de votre mobile'}
                    </Text>
                </View>
            </View>
            <View style={styles.deviceComplianceRight}>
                {enrolled && score !== null ? (
                    <View style={[styles.scoreCircleSmall, { borderColor: scoreColor }]}>
                        <Text style={[styles.scoreTextSmall, { color: scoreColor }]}>
                            {score}%
                        </Text>
                    </View>
                ) : (
                    <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textSecondary} />
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    deviceComplianceCard: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
        shadowColor: COLORS.textSecondary,
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
        color: COLORS.text,
    },
    deviceComplianceSubtitle: {
        fontSize: 12,
        color: COLORS.textSecondary,
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
