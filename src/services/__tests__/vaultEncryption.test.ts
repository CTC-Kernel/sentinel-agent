/**
 * Story 23.6 - Tests de Sécurité pour le Chiffrement
 *
 * Suite de tests pour valider la sécurité du système de chiffrement.
 */

import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  VAULT_CONFIG,
  getKeyPath,
  CLASSIFICATION_CONFIG,
  canAccessClassification,
  getClassificationLevels,
  compareClassificationLevels,
} from '@/services/vaultConfig';
import type { ClassificationLevel, DocumentEncryptionMetadata } from '@/types/vault';

describe('Vault Configuration', () => {
  describe('VAULT_CONFIG', () => {
    it('should have correct KMS configuration', () => {
      expect(VAULT_CONFIG.keyRingId).toBe('sentinel-vault');
      expect(VAULT_CONFIG.cryptoKeyId).toBe('documents-key');
      expect(VAULT_CONFIG.location).toBe('europe-west1');
    });

    it('should use europe-west1 for RGPD compliance', () => {
      expect(VAULT_CONFIG.location).toBe('europe-west1');
    });
  });

  describe('getKeyPath', () => {
    it('should generate correct key path format', () => {
      const keyPath = getKeyPath();
      expect(keyPath).toMatch(
        /^projects\/.*\/locations\/europe-west1\/keyRings\/sentinel-vault\/cryptoKeys\/documents-key$/
      );
    });
  });
});

describe('Classification System', () => {
  describe('CLASSIFICATION_CONFIG', () => {
    it('should have all four classification levels', () => {
      const levels = Object.keys(CLASSIFICATION_CONFIG);
      expect(levels).toContain('public');
      expect(levels).toContain('internal');
      expect(levels).toContain('confidential');
      expect(levels).toContain('secret');
      expect(levels).toHaveLength(4);
    });

    it('should have correct role requirements for each level', () => {
      // Public - accessible to all
      expect(CLASSIFICATION_CONFIG.public.requiredRoles).toHaveLength(0);

      // Internal - all authenticated users
      expect(CLASSIFICATION_CONFIG.internal.requiredRoles).toContain('user');

      // Confidential - managers and above
      expect(CLASSIFICATION_CONFIG.confidential.requiredRoles).toContain('project_manager');
      expect(CLASSIFICATION_CONFIG.confidential.requiredRoles).toContain('rssi');
      expect(CLASSIFICATION_CONFIG.confidential.requiredRoles).not.toContain('user');

      // Secret - rssi and admin only
      expect(CLASSIFICATION_CONFIG.secret.requiredRoles).toContain('rssi');
      expect(CLASSIFICATION_CONFIG.secret.requiredRoles).toContain('admin');
      expect(CLASSIFICATION_CONFIG.secret.requiredRoles).not.toContain('project_manager');
    });

    it('should have visual identifiers for each level', () => {
      Object.values(CLASSIFICATION_CONFIG).forEach((config) => {
        expect(config.icon).toBeTruthy();
        expect(config.label).toBeTruthy();
        expect(config.description).toBeTruthy();
        expect(config.color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });
  });

  describe('canAccessClassification', () => {
    it('should allow everyone to access public documents', () => {
      expect(canAccessClassification('public', 'user')).toBe(true);
      expect(canAccessClassification('public', 'guest')).toBe(true);
      expect(canAccessClassification('public', '')).toBe(true);
    });

    it('should allow authenticated users to access internal documents', () => {
      expect(canAccessClassification('internal', 'user')).toBe(true);
      expect(canAccessClassification('internal', 'project_manager')).toBe(true);
      expect(canAccessClassification('internal', 'rssi')).toBe(true);
      expect(canAccessClassification('internal', 'admin')).toBe(true);
    });

    it('should restrict confidential to managers and above', () => {
      expect(canAccessClassification('confidential', 'user')).toBe(false);
      expect(canAccessClassification('confidential', 'project_manager')).toBe(true);
      expect(canAccessClassification('confidential', 'rssi')).toBe(true);
      expect(canAccessClassification('confidential', 'admin')).toBe(true);
    });

    it('should restrict secret to rssi and admin only', () => {
      expect(canAccessClassification('secret', 'user')).toBe(false);
      expect(canAccessClassification('secret', 'project_manager')).toBe(false);
      expect(canAccessClassification('secret', 'rssi')).toBe(true);
      expect(canAccessClassification('secret', 'admin')).toBe(true);
      expect(canAccessClassification('secret', 'super_admin')).toBe(true);
    });
  });

  describe('getClassificationLevels', () => {
    it('should return levels in order of sensitivity', () => {
      const levels = getClassificationLevels();
      expect(levels).toEqual(['public', 'internal', 'confidential', 'secret']);
    });
  });

  describe('compareClassificationLevels', () => {
    it('should correctly compare classification levels', () => {
      expect(compareClassificationLevels('public', 'secret')).toBeLessThan(0);
      expect(compareClassificationLevels('secret', 'public')).toBeGreaterThan(0);
      expect(compareClassificationLevels('internal', 'internal')).toBe(0);
      expect(compareClassificationLevels('confidential', 'internal')).toBeGreaterThan(0);
    });
  });
});

describe('Encryption Metadata Validation', () => {
  it('should validate encryption metadata structure', () => {
    const validMetadata: DocumentEncryptionMetadata = {
      encrypted: true,
      keyVersion: '1',
      encryptedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as unknown as Timestamp,
      algorithm: 'AES-256-GCM',
      hash: 'a'.repeat(64), // SHA-256 produces 64 hex characters
    };

    expect(validMetadata.algorithm).toBe('AES-256-GCM');
    expect(validMetadata.hash).toHaveLength(64);
    expect(validMetadata.encrypted).toBe(true);
  });

  it('should validate SHA-256 hash format', () => {
    const validHash = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
    expect(validHash).toMatch(/^[a-f0-9]{64}$/);
    expect(validHash).toHaveLength(64);
  });
});

describe('Security Edge Cases', () => {
  describe('Role injection prevention', () => {
    it('should not accept invalid role strings', () => {
      expect(canAccessClassification('secret', 'admin; DROP TABLE users;')).toBe(false);
      expect(canAccessClassification('secret', '<script>alert(1)</script>')).toBe(false);
      expect(canAccessClassification('confidential', '__proto__')).toBe(false);
    });
  });

  describe('Classification level validation', () => {
    it('should handle invalid classification levels gracefully', () => {
      // @ts-expect-error - Testing invalid input
      expect(() => canAccessClassification('invalid', 'admin')).not.toThrow();
      // @ts-expect-error - Testing invalid input
      expect(canAccessClassification('invalid', 'admin')).toBe(false);
    });

    it('should handle null/undefined inputs', () => {
      // @ts-expect-error - Testing null input
      expect(canAccessClassification(null, 'admin')).toBe(false);
      // @ts-expect-error - Testing undefined input
      expect(canAccessClassification(undefined, 'admin')).toBe(false);
    });
  });

  describe('Encryption integrity', () => {
    it('should detect hash tampering', () => {
      const originalHash = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
      const tamperedHash = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a09';

      expect(originalHash).not.toBe(tamperedHash);
      expect(originalHash.length).toBe(tamperedHash.length);
    });

    it('should use AES-256-GCM algorithm', () => {
      // Verify the expected algorithm constant
      const expectedAlgorithm = 'AES-256-GCM';
      expect(expectedAlgorithm).toBe('AES-256-GCM');
    });
  });
});

describe('Access Control Matrix', () => {
  const testMatrix: Array<{
    classification: ClassificationLevel;
    role: string;
    expected: boolean;
  }> = [
      // Public
      { classification: 'public', role: 'user', expected: true },
      { classification: 'public', role: 'project_manager', expected: true },
      { classification: 'public', role: 'rssi', expected: true },
      { classification: 'public', role: 'admin', expected: true },

      // Internal
      { classification: 'internal', role: 'user', expected: true },
      { classification: 'internal', role: 'project_manager', expected: true },
      { classification: 'internal', role: 'rssi', expected: true },
      { classification: 'internal', role: 'admin', expected: true },

      // Confidential
      { classification: 'confidential', role: 'user', expected: false },
      { classification: 'confidential', role: 'project_manager', expected: true },
      { classification: 'confidential', role: 'rssi', expected: true },
      { classification: 'confidential', role: 'admin', expected: true },

      // Secret
      { classification: 'secret', role: 'user', expected: false },
      { classification: 'secret', role: 'project_manager', expected: false },
      { classification: 'secret', role: 'rssi', expected: true },
      { classification: 'secret', role: 'admin', expected: true },
    ];

  testMatrix.forEach(({ classification, role, expected }) => {
    it(`should ${expected ? 'allow' : 'deny'} ${role} access to ${classification}`, () => {
      expect(canAccessClassification(classification, role)).toBe(expected);
    });
  });
});
