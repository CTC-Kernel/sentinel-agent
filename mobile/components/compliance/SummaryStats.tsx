/**
 * Summary Stats Component
 *
 * Displays pass/warning/fail counts in colored boxes.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme/colors';

interface SummaryStatsProps {
    pass: number;
    warning: number;
    fail: number;
}

export function SummaryStats({ pass, warning, fail }: SummaryStatsProps) {
    return (
        <View style={styles.summaryContainer}>
            <View style={[styles.summaryItem, { backgroundColor: COLORS.success + '15' }]}>
                <Text style={[styles.summaryValue, { color: COLORS.success }]}>{pass}</Text>
                <Text style={styles.summaryLabel}>Réussi</Text>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: COLORS.warning + '15' }]}>
                <Text style={[styles.summaryValue, { color: COLORS.warning }]}>{warning}</Text>
                <Text style={styles.summaryLabel}>Attention</Text>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: COLORS.error + '15' }]}>
                <Text style={[styles.summaryValue, { color: COLORS.error }]}>{fail}</Text>
                <Text style={styles.summaryLabel}>Échec</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
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
});
