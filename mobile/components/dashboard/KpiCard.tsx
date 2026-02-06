/**
 * KPI Card Component
 *
 * Displays a key performance indicator with icon, value, and title.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface KpiCardProps {
    title: string;
    value: string | number;
    icon: IconName;
    color: string;
    subtitle?: string;
}

export function KpiCard({ title, value, icon, color, subtitle }: KpiCardProps) {
    return (
        <View style={styles.card}>
            <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
                <MaterialCommunityIcons name={icon} size={24} color={color} />
            </View>
            <View>
                <Text style={styles.cardValue}>{value}</Text>
                <Text style={styles.cardTitle}>{title}</Text>
            </View>
            {subtitle && <Text style={[styles.cardSubtitle, { color }]}>{subtitle}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 16,
        width: '47%',
        shadowColor: COLORS.textSecondary,
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
        fontWeight: '700',
        color: COLORS.text,
    },
    cardTitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    cardSubtitle: {
        fontSize: 12,
        marginTop: 4,
    },
});
