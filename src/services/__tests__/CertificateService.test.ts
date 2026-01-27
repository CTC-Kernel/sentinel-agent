/**
 * Certificate Service Tests
 *
 * Unit tests for CertificateService.
 * Part of NIS2 Article 21.2(h) compliance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { Certificate, CertificateStats } from '../../types/certificates';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
    fromDate: vi.fn((date: Date) => ({ toDate: () => date })),
  },
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    commit: vi.fn(),
  })),
}));

vi.mock('../../firebase', () => ({
  db: {},
}));

vi.mock('../errorLogger', () => ({
  ErrorLogger: {
    error: vi.fn(),
  },
}));

// Import after mocks
import { CertificateService } from '../CertificateService';

describe('CertificateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateStats', () => {
    const createMockCertificate = (overrides: Partial<Certificate> = {}): Certificate => ({
      id: 'cert-1',
      organizationId: 'org-1',
      name: 'Test Certificate',
      type: 'ssl_tls',
      commonName: 'test.example.com',
      domains: ['test.example.com'],
      serialNumber: '123456',
      issuer: 'Test CA',
      issuerType: 'public_ca',
      validFrom: Timestamp.fromDate(new Date('2024-01-01')),
      validTo: Timestamp.fromDate(new Date('2025-01-01')),
      status: 'valid',
      keyAlgorithm: 'RSA',
      keySize: 2048,
      alertsSent: {},
      createdAt: Timestamp.now(),
      createdBy: 'user-1',
      updatedAt: Timestamp.now(),
      updatedBy: 'user-1',
      ...overrides,
    });

    it('should calculate stats for empty certificates array', () => {
      const stats = CertificateService.calculateStats([]);

      expect(stats.total).toBe(0);
      expect(stats.valid).toBe(0);
      expect(stats.expiringSoon).toBe(0);
      expect(stats.expired).toBe(0);
      expect(stats.revoked).toBe(0);
    });

    it('should count certificates by status', () => {
      const certificates: Certificate[] = [
        createMockCertificate({ id: '1', status: 'valid' }),
        createMockCertificate({ id: '2', status: 'valid' }),
        createMockCertificate({ id: '3', status: 'expiring_soon' }),
        createMockCertificate({ id: '4', status: 'expired' }),
        createMockCertificate({ id: '5', status: 'revoked' }),
      ];

      const stats = CertificateService.calculateStats(certificates);

      expect(stats.total).toBe(5);
      expect(stats.valid).toBe(2);
      expect(stats.expiringSoon).toBe(1);
      expect(stats.expired).toBe(1);
      expect(stats.revoked).toBe(1);
    });

    it('should count certificates by type', () => {
      const certificates: Certificate[] = [
        createMockCertificate({ id: '1', type: 'ssl_tls' }),
        createMockCertificate({ id: '2', type: 'ssl_tls' }),
        createMockCertificate({ id: '3', type: 'code_signing' }),
        createMockCertificate({ id: '4', type: 'client' }),
      ];

      const stats = CertificateService.calculateStats(certificates);

      expect(stats.byType.ssl_tls).toBe(2);
      expect(stats.byType.code_signing).toBe(1);
      expect(stats.byType.client).toBe(1);
    });

    it('should count certificates by algorithm', () => {
      const certificates: Certificate[] = [
        createMockCertificate({ id: '1', keyAlgorithm: 'RSA' }),
        createMockCertificate({ id: '2', keyAlgorithm: 'RSA' }),
        createMockCertificate({ id: '3', keyAlgorithm: 'ECDSA' }),
      ];

      const stats = CertificateService.calculateStats(certificates);

      expect(stats.byAlgorithm.RSA).toBe(2);
      expect(stats.byAlgorithm.ECDSA).toBe(1);
    });

    it('should count certificates by issuer type', () => {
      const certificates: Certificate[] = [
        createMockCertificate({ id: '1', issuerType: 'public_ca' }),
        createMockCertificate({ id: '2', issuerType: 'public_ca' }),
        createMockCertificate({ id: '3', issuerType: 'private_ca' }),
        createMockCertificate({ id: '4', issuerType: 'self_signed' }),
      ];

      const stats = CertificateService.calculateStats(certificates);

      expect(stats.byIssuerType.public_ca).toBe(2);
      expect(stats.byIssuerType.private_ca).toBe(1);
      expect(stats.byIssuerType.self_signed).toBe(1);
    });

    it('should detect weak cryptography', () => {
      const certificates: Certificate[] = [
        createMockCertificate({ id: '1', keyAlgorithm: 'RSA', keySize: 1024 }), // Weak
        createMockCertificate({ id: '2', keyAlgorithm: 'RSA', keySize: 2048 }), // OK
        createMockCertificate({ id: '3', signatureAlgorithm: 'SHA1withRSA' }), // Weak
        createMockCertificate({ id: '4', signatureAlgorithm: 'SHA256withRSA' }), // OK
      ];

      const stats = CertificateService.calculateStats(certificates);

      expect(stats.weakCrypto).toBe(2);
    });

    it('should identify certificates expiring in next 30 days', () => {
      const now = new Date();
      const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
      const in45Days = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

      const certificates: Certificate[] = [
        createMockCertificate({
          id: '1',
          validTo: Timestamp.fromDate(in15Days),
        }),
        createMockCertificate({
          id: '2',
          validTo: Timestamp.fromDate(in45Days),
        }),
      ];

      const stats = CertificateService.calculateStats(certificates);

      expect(stats.expiringNext30Days.length).toBe(1);
      expect(stats.expiringNext30Days[0].id).toBe('1');
    });
  });

  describe('filterCertificates', () => {
    const createMockCertificate = (overrides: Partial<Certificate> = {}): Certificate => ({
      id: 'cert-1',
      organizationId: 'org-1',
      name: 'Test Certificate',
      type: 'ssl_tls',
      commonName: 'test.example.com',
      domains: ['test.example.com'],
      serialNumber: '123456',
      issuer: 'Test CA',
      issuerType: 'public_ca',
      validFrom: Timestamp.fromDate(new Date('2024-01-01')),
      validTo: Timestamp.fromDate(new Date('2025-01-01')),
      status: 'valid',
      keyAlgorithm: 'RSA',
      keySize: 2048,
      alertsSent: {},
      createdAt: Timestamp.now(),
      createdBy: 'user-1',
      updatedAt: Timestamp.now(),
      updatedBy: 'user-1',
      ...overrides,
    });

    it('should return all certificates when no filters applied', () => {
      const certificates: Certificate[] = [
        createMockCertificate({ id: '1' }),
        createMockCertificate({ id: '2' }),
        createMockCertificate({ id: '3' }),
      ];

      const filtered = CertificateService.filterCertificates(certificates, {});

      expect(filtered.length).toBe(3);
    });

    it('should filter by status', () => {
      const certificates: Certificate[] = [
        createMockCertificate({ id: '1', status: 'valid' }),
        createMockCertificate({ id: '2', status: 'expired' }),
        createMockCertificate({ id: '3', status: 'valid' }),
      ];

      const filtered = CertificateService.filterCertificates(certificates, {
        status: 'valid',
      });

      expect(filtered.length).toBe(2);
      expect(filtered.every((c) => c.status === 'valid')).toBe(true);
    });

    it('should filter by type', () => {
      const certificates: Certificate[] = [
        createMockCertificate({ id: '1', type: 'ssl_tls' }),
        createMockCertificate({ id: '2', type: 'code_signing' }),
        createMockCertificate({ id: '3', type: 'ssl_tls' }),
      ];

      const filtered = CertificateService.filterCertificates(certificates, {
        type: 'ssl_tls',
      });

      expect(filtered.length).toBe(2);
      expect(filtered.every((c) => c.type === 'ssl_tls')).toBe(true);
    });

    it('should filter by issuer type', () => {
      const certificates: Certificate[] = [
        createMockCertificate({ id: '1', issuerType: 'public_ca' }),
        createMockCertificate({ id: '2', issuerType: 'private_ca' }),
        createMockCertificate({ id: '3', issuerType: 'public_ca' }),
      ];

      const filtered = CertificateService.filterCertificates(certificates, {
        issuerType: 'public_ca',
      });

      expect(filtered.length).toBe(2);
      expect(filtered.every((c) => c.issuerType === 'public_ca')).toBe(true);
    });

    it('should filter by search query on name', () => {
      const certificates: Certificate[] = [
        createMockCertificate({ id: '1', name: 'Production SSL' }),
        createMockCertificate({ id: '2', name: 'Staging SSL' }),
        createMockCertificate({ id: '3', name: 'Development Cert' }),
      ];

      const filtered = CertificateService.filterCertificates(certificates, {
        searchQuery: 'ssl',
      });

      expect(filtered.length).toBe(2);
    });

    it('should filter by search query on common name', () => {
      const certificates: Certificate[] = [
        createMockCertificate({ id: '1', name: 'Cert A', commonName: 'api.acme.com', issuer: 'CA1', domains: ['api.acme.com'] }),
        createMockCertificate({ id: '2', name: 'Cert B', commonName: 'www.acme.com', issuer: 'CA1', domains: ['www.acme.com'] }),
        createMockCertificate({ id: '3', name: 'Cert C', commonName: 'test.other.com', issuer: 'CA2', domains: ['test.other.com'] }),
      ];

      const filtered = CertificateService.filterCertificates(certificates, {
        searchQuery: 'acme',
      });

      expect(filtered.length).toBe(2);
    });

    it('should filter by search query on domains', () => {
      const certificates: Certificate[] = [
        createMockCertificate({ id: '1', name: 'Cert A', commonName: 'api.foo.com', issuer: 'CA1', domains: ['api.uniquedomain.com', 'www.uniquedomain.com'] }),
        createMockCertificate({ id: '2', name: 'Cert B', commonName: 'test.bar.com', issuer: 'CA2', domains: ['test.bar.com'] }),
      ];

      const filtered = CertificateService.filterCertificates(certificates, {
        searchQuery: 'uniquedomain',
      });

      expect(filtered.length).toBe(1);
    });

    it('should combine multiple filters', () => {
      const certificates: Certificate[] = [
        createMockCertificate({ id: '1', status: 'valid', type: 'ssl_tls', name: 'Production' }),
        createMockCertificate({ id: '2', status: 'valid', type: 'code_signing', name: 'Production' }),
        createMockCertificate({ id: '3', status: 'expired', type: 'ssl_tls', name: 'Production' }),
        createMockCertificate({ id: '4', status: 'valid', type: 'ssl_tls', name: 'Staging' }),
      ];

      const filtered = CertificateService.filterCertificates(certificates, {
        status: 'valid',
        type: 'ssl_tls',
        searchQuery: 'Production',
      });

      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('1');
    });
  });
});
