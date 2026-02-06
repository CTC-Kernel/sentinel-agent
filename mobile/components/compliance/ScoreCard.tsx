/**
 * Score Card Component
 *
 * Displays the compliance score with a circular gauge.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, getScoreColor } from '../../theme/colors';

interface ScoreCardProps {
    score: number | null;
    lastCheckAt: Date | null;
    isRunningChecks: boolean;
    onRunChecks: () => void;
}

export function ScoreCard({ score, lastCheckAt, isRunningChecks, onRunChecks }: ScoreCardProps) {
    return (
        <View style={styles.scoreCard}>
            <View style={styles.scoreCircle}>
                <Text style={[styles.scoreValue, { color: getScoreColor(score) }]}>
                    {score !== null ? `${score}%` : '--'}
                </Text>
            </View>
            <Text style={styles.scoreLabel}>Score de Conformité</Text>
            {lastCheckAt && (
                <Text style={styles.lastCheckText}>
                    Dernière vérification: {formatDate(lastCheckAt)}
                </Text>
            )}
            <TouchableOpacity
                style={[styles.runChecksButton, isRunningChecks && styles.buttonDisabled]}
                onPress={onRunChecks}
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
    );
}

function formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;

    return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
    });
}

const styles = StyleSheet.create({
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
});
