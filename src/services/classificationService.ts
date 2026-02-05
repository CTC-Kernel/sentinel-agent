/**
 * Story 24.1 - Classification Service
 *
 * Helper functions for document classification management.
 * Provides utilities for classification level operations, validation,
 * and role-based access control.
 */

import { Timestamp } from 'firebase/firestore';
import type { ClassificationLevel, DocumentClassification } from '@/types/vault';
import { CLASSIFICATION_CONFIG, canAccessClassification, getClassificationLevels, compareClassificationLevels } from './vaultConfig';

/**
 * User roles hierarchy for classification access
 * Higher index = more privileges
 */
export const ROLE_HIERARCHY = [
 'user',
 'auditor',
 'project_manager',
 'rssi',
 'admin',
 'super_admin',
] as const;

export type UserRole = (typeof ROLE_HIERARCHY)[number] | 'direction';

/**
 * Classification level hierarchy for comparison
 * Higher index = more restricted
 */
export const CLASSIFICATION_HIERARCHY: ClassificationLevel[] = [
 'public',
 'internal',
 'confidential',
 'secret',
];

/**
 * Get the numeric sensitivity level of a classification
 * @param level - Classification level
 * @returns Numeric sensitivity (0 = lowest, 3 = highest)
 */
export function getClassificationSensitivity(level: ClassificationLevel): number {
 return CLASSIFICATION_HIERARCHY.indexOf(level);
}

/**
 * Check if a user role can access a specific classification level
 * Re-exports from vaultConfig for convenience
 */
export { canAccessClassification };

/**
 * Check if a user role can SET a specific classification level
 * Users can only set classifications they have access to
 * @param level - Target classification level
 * @param userRole - User's role
 * @returns True if user can set this classification
 */
export function canSetClassification(
 level: ClassificationLevel,
 userRole: string
): boolean {
 return canAccessClassification(level, userRole);
}

/**
 * Get the maximum classification level a user can access
 * @param userRole - User's role
 * @returns Maximum accessible classification level
 */
export function getMaxClassificationForRole(userRole: string): ClassificationLevel {
 const levels = getClassificationLevels();

 // Find the highest level the user can access
 for (let i = levels.length - 1; i >= 0; i--) {
 if (canAccessClassification(levels[i], userRole)) {
 return levels[i];
 }
 }

 return 'public'; // Fallback
}

/**
 * Get all classification levels a user can access
 * @param userRole - User's role
 * @returns Array of accessible classification levels
 */
export function getAccessibleClassifications(userRole: string): ClassificationLevel[] {
 return getClassificationLevels().filter(level =>
 canAccessClassification(level, userRole)
 );
}

/**
 * Create a new DocumentClassification object
 * @param level - Classification level
 * @param userId - ID of user classifying the document
 * @param justification - Optional justification for the classification
 * @param autoClassified - Whether classification was automatic
 * @returns DocumentClassification object
 */
export function createClassification(
 level: ClassificationLevel,
 userId: string,
 justification?: string,
 autoClassified = false
): DocumentClassification {
 return {
 level,
 classifiedBy: userId,
 classifiedAt: Timestamp.now(),
 justification,
 autoClassified,
 };
}

/**
 * Validate a classification change request
 * @param currentLevel - Current classification level (or undefined for new document)
 * @param newLevel - Requested new classification level
 * @param userRole - User's role attempting the change
 * @returns Object with isValid boolean and optional error message
 */
export function validateClassificationChange(
 currentLevel: ClassificationLevel | undefined,
 newLevel: ClassificationLevel,
 userRole: string
): { isValid: boolean; error?: string } {
 // Check if user can access the new level
 if (!canAccessClassification(newLevel, userRole)) {
 return {
 isValid: false,
 error: `Permissions insuffisantes pour classifier en "${CLASSIFICATION_CONFIG[newLevel].label}"`
 };
 }

 // If upgrading classification, check if user has permission for current level too
 if (currentLevel && !canAccessClassification(currentLevel, userRole)) {
 return {
 isValid: false,
 error: `Permissions insuffisantes pour modifier un document "${CLASSIFICATION_CONFIG[currentLevel].label}"`
 };
 }

 return { isValid: true };
}

/**
 * Check if classification level requires justification
 * @param level - Classification level
 * @returns True if justification is required
 */
export function requiresJustification(level: ClassificationLevel): boolean {
 return level === 'confidential' || level === 'secret';
}

/**
 * Get classification display information
 * @param level - Classification level
 * @returns Display configuration for the level
 */
export function getClassificationDisplay(level: ClassificationLevel) {
 return CLASSIFICATION_CONFIG[level];
}

/**
 * Compare two classification levels
 * Re-exports from vaultConfig for convenience
 */
export { compareClassificationLevels };

/**
 * Determine if a classification upgrade is being requested
 * @param currentLevel - Current classification level
 * @param newLevel - New classification level
 * @returns True if newLevel is more restrictive than currentLevel
 */
export function isClassificationUpgrade(
 currentLevel: ClassificationLevel,
 newLevel: ClassificationLevel
): boolean {
 return compareClassificationLevels(newLevel, currentLevel) > 0;
}

/**
 * Determine if a classification downgrade is being requested
 * @param currentLevel - Current classification level
 * @param newLevel - New classification level
 * @returns True if newLevel is less restrictive than currentLevel
 */
export function isClassificationDowngrade(
 currentLevel: ClassificationLevel,
 newLevel: ClassificationLevel
): boolean {
 return compareClassificationLevels(newLevel, currentLevel) < 0;
}

/**
 * Get default classification for new documents
 * @returns Default classification level
 */
export function getDefaultClassification(): ClassificationLevel {
 return 'internal';
}

/**
 * Auto-classify document based on content indicators
 * This is a simple heuristic - can be extended with ML/NLP
 * @param content - Document content or title
 * @param documentType - Type of document
 * @returns Suggested classification level
 */
export function suggestClassification(
 content: string,
 documentType?: string
): ClassificationLevel {
 const lowerContent = content.toLowerCase();

 // Secret indicators
 const secretKeywords = [
 'mot de passe', 'password', 'secret', 'credential',
 'clé privée', 'private key', 'certificat', 'certificate',
 'authentification', 'token', 'api key', 'encryption key',
 'données personnelles sensibles', 'données de santé',
 ];

 // Confidential indicators
 const confidentialKeywords = [
 'confidentiel', 'confidential', 'interne uniquement',
 'ne pas diffuser', 'stratégie', 'strategy', 'financier',
 'salary', 'salaire', 'contrat', 'contract', 'propriétaire',
 'données personnelles', 'rgpd', 'gdpr',
 ];

 // Internal indicators
 const internalKeywords = [
 'procédure', 'procedure', 'politique', 'policy',
 'guide', 'manuel', 'documentation', 'interne',
 ];

 // Check keywords in order of sensitivity
 if (secretKeywords.some(kw => lowerContent.includes(kw))) {
 return 'secret';
 }

 if (confidentialKeywords.some(kw => lowerContent.includes(kw))) {
 return 'confidential';
 }

 if (internalKeywords.some(kw => lowerContent.includes(kw))) {
 return 'internal';
 }

 // Type-based classification
 if (documentType) {
 const type = documentType.toLowerCase();
 if (type.includes('preuve') || type.includes('evidence')) {
 return 'confidential';
 }
 if (type.includes('politique') || type.includes('policy')) {
 return 'internal';
 }
 }

 return 'internal'; // Default
}

/**
 * Export classification configuration
 */
export { CLASSIFICATION_CONFIG, getClassificationLevels };
