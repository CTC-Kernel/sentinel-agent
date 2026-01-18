import type { EncryptionConfig, ClassificationLevel } from '@/types/vault';

/**
 * Cloud KMS configuration for document encryption
 */
export const VAULT_CONFIG: EncryptionConfig = {
  keyRingId: 'sentinel-vault',
  cryptoKeyId: 'documents-key',
  location: 'europe-west1',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
};

/**
 * Get the full Cloud KMS key path
 */
export const getKeyPath = (): string => {
  const { projectId, location, keyRingId, cryptoKeyId } = VAULT_CONFIG;
  return `projects/${projectId}/locations/${location}/keyRings/${keyRingId}/cryptoKeys/${cryptoKeyId}`;
};

/**
 * Classification level configuration with role-based access control
 */
export const CLASSIFICATION_CONFIG = {
  public: {
    label: 'Public',
    icon: 'Globe',
    description: 'Accessible a tous',
    color: '#22c55e',
    requiredRoles: [] as string[],
  },
  internal: {
    label: 'Interne',
    icon: 'Building',
    description: 'Employes uniquement',
    color: '#3b82f6',
    requiredRoles: ['user', 'auditor', 'project_manager', 'rssi', 'admin', 'super_admin'],
  },
  confidential: {
    label: 'Confidentiel',
    icon: 'Lock',
    description: 'Managers et RSSI',
    color: '#f59e0b',
    requiredRoles: ['project_manager', 'rssi', 'admin', 'super_admin'],
  },
  secret: {
    label: 'Secret',
    icon: 'ShieldAlert',
    description: 'Direction uniquement',
    color: '#ef4444',
    requiredRoles: ['rssi', 'admin', 'super_admin'],
  },
} as const;

export type ClassificationConfigKey = keyof typeof CLASSIFICATION_CONFIG;

/**
 * Check if a user role can access a classification level
 */
export const canAccessClassification = (
  classification: ClassificationLevel,
  userRole: string
): boolean => {
  const config = CLASSIFICATION_CONFIG[classification];
  if (config.requiredRoles.length === 0) return true;
  return (config.requiredRoles as readonly string[]).includes(userRole);
};

/**
 * Get classification configuration by level
 */
export const getClassificationConfig = (level: ClassificationLevel) => {
  return CLASSIFICATION_CONFIG[level];
};

/**
 * Get all classification levels sorted by sensitivity (least to most)
 */
export const getClassificationLevels = (): ClassificationLevel[] => {
  return ['public', 'internal', 'confidential', 'secret'];
};

/**
 * Compare classification levels for access control
 * Returns: negative if a < b, positive if a > b, zero if equal
 */
export const compareClassificationLevels = (
  a: ClassificationLevel,
  b: ClassificationLevel
): number => {
  const levels = getClassificationLevels();
  return levels.indexOf(a) - levels.indexOf(b);
};

/**
 * Encryption algorithm constants
 */
export const ENCRYPTION_CONSTANTS = {
  ALGORITHM: 'AES-256-GCM' as const,
  KEY_SIZE: 256,
  IV_SIZE: 12,
  TAG_SIZE: 16,
} as const;

/**
 * Default retention periods by document type (in days)
 */
export const DEFAULT_RETENTION_PERIODS = {
  'Politique': 365 * 7, // 7 years
  'Procedure': 365 * 5, // 5 years
  'Preuve': 365 * 3, // 3 years
  'Rapport': 365 * 5, // 5 years
  'Autre': 365 * 3, // 3 years default
} as const;
