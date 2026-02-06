/**
 * Check Result Card Component
 *
 * Displays a single compliance check result.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, getSeverityColor } from '../../theme/colors';
import { MobileCheckResult } from '../../services/mobileComplianceChecks';

interface CheckResultCardProps {
    result: MobileCheckResult;
}

function getStatusIcon(status: MobileCheckResult['status']): {
    name: keyof typeof MaterialCommunityIcons.glyphMap;
    color: string;
} {
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
}

export function CheckResultCard({ result }: CheckResultCardProps) {
    const icon = getStatusIcon(result.status);
    const severityColor = getSeverityColor(result.severity);

    return (
        <View style={styles.resultCard}>
            <MaterialCommunityIcons name={icon.name} size={24} color={icon.color} />
            <View style={styles.resultContent}>
                <Text style={styles.resultName}>{result.name}</Text>
                <Text style={styles.resultDetails}>{result.details}</Text>
                <View style={styles.resultMeta}>
                    <Text style={styles.resultControlId}>
                        {result.framework} - {result.controlId}
                    </Text>
                    <View
                        style={[
                            styles.severityBadge,
                            { backgroundColor: severityColor + '20' },
                        ]}
                    >
                        <Text style={[styles.severityText, { color: severityColor }]}>
                            {result.severity.toUpperCase()}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
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
