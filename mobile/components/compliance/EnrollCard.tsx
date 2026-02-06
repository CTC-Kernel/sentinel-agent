/**
 * Enrollment Card Component
 *
 * Displayed when device is not yet enrolled for compliance monitoring.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';

interface EnrollCardProps {
    onEnroll: () => void;
    isLoading?: boolean;
}

export function EnrollCard({ onEnroll, isLoading }: EnrollCardProps) {
    return (
        <View style={styles.enrollCard}>
            <MaterialCommunityIcons
                name="shield-lock-outline"
                size={64}
                color={COLORS.primary}
            />
            <Text style={styles.enrollTitle}>Enregistrer cet appareil</Text>
            <Text style={styles.enrollDescription}>
                Enregistrez votre {Platform.OS === 'ios' ? 'iPhone/iPad' : 'appareil Android'}{' '}
                pour surveiller sa conformité sécurité.
            </Text>
            <TouchableOpacity
                style={[styles.enrollButton, isLoading && styles.buttonDisabled]}
                onPress={onEnroll}
                disabled={isLoading}
            >
                <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                <Text style={styles.enrollButtonText}>Enregistrer l'appareil</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    enrollCard: {
        backgroundColor: COLORS.card,
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    enrollTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.text,
        marginTop: 16,
        marginBottom: 8,
    },
    enrollDescription: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    enrollButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 16,
        gap: 8,
    },
    enrollButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
});
