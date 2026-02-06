/**
 * Device Card Component
 *
 * Displays device information and connection status.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { DeviceInfo } from '../../services/mobileComplianceChecks';
import { MobileAgent } from '../../services/mobileAgentService';

interface DeviceCardProps {
    deviceInfo: DeviceInfo | null;
    agent: MobileAgent | null;
}

export function DeviceCard({ deviceInfo, agent }: DeviceCardProps) {
    const isActive = agent?.status === 'active';

    return (
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
            <View
                style={[
                    styles.statusBadge,
                    { backgroundColor: isActive ? COLORS.success + '20' : COLORS.warning + '20' },
                ]}
            >
                <View
                    style={[
                        styles.statusDot,
                        { backgroundColor: isActive ? COLORS.success : COLORS.warning },
                    ]}
                />
                <Text
                    style={[
                        styles.statusText,
                        { color: isActive ? COLORS.success : COLORS.warning },
                    ]}
                >
                    {isActive ? 'Actif' : 'Hors ligne'}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
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
});
