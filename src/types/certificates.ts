/**
 * Certificate Types
 *
 * Types for SSL/TLS certificate inventory management.
 * Part of NIS2 Article 21.2(h) compliance.
 *
 * @module types/certificates
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Certificate status based on expiration
 */
export type CertificateStatus = 'valid' | 'expiring_soon' | 'expired' | 'revoked';

/**
 * Certificate type
 */
export type CertificateType = 'ssl_tls' | 'code_signing' | 'email' | 'client' | 'root_ca' | 'intermediate_ca' | 'other';

/**
 * Key algorithm
 */
export type KeyAlgorithm = 'RSA' | 'ECDSA' | 'Ed25519' | 'DSA' | 'other';

/**
 * Certificate issuer type
 */
export type IssuerType = 'public_ca' | 'private_ca' | 'self_signed';

/**
 * Certificate entity
 */
export interface Certificate {
 id: string;
 organizationId: string;

 // Basic info
 name: string;
 description?: string;
 type: CertificateType;

 // Certificate details
 commonName: string;
 domains: string[]; // SANs
 serialNumber: string;

 // Issuer
 issuer: string;
 issuerType: IssuerType;

 // Validity
 validFrom: Timestamp;
 validTo: Timestamp;
 status: CertificateStatus;

 // Cryptography
 keyAlgorithm: KeyAlgorithm;
 keySize: number; // bits
 signatureAlgorithm: string;

 // Fingerprints
 thumbprintSha1?: string;
 thumbprintSha256?: string;

 // Linked entities
 assetId?: string;
 assetName?: string;

 // Management
 owner?: string;
 ownerEmail?: string;
 autoRenew: boolean;

 // Alerts
 alertsSent: {
 day30?: Timestamp;
 day15?: Timestamp;
 day7?: Timestamp;
 };

 // Notes
 notes?: string;
 tags?: string[];

 // Audit
 createdAt: Timestamp;
 createdBy: string;
 updatedAt: Timestamp;
 updatedBy: string;
}

/**
 * Certificate form data (for creation/editing)
 */
export type CertificateFormData = Omit<Certificate,
 'id' | 'organizationId' | 'status' | 'alertsSent' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'
>;

/**
 * Certificate stats for dashboard
 */
export interface CertificateStats {
 total: number;
 valid: number;
 expiringSoon: number; // < 30 days
 expired: number;
 revoked: number;
 byType: Record<CertificateType, number>;
 byAlgorithm: Record<KeyAlgorithm, number>;
 byIssuerType: Record<IssuerType, number>;
 expiringNext30Days: Certificate[];
 weakCrypto: number; // RSA < 2048 or SHA1
}

/**
 * Certificate import row (CSV)
 */
export interface CertificateImportRow {
 name: string;
 commonName: string;
 domains: string;
 serialNumber: string;
 issuer: string;
 issuerType: string;
 validFrom: string;
 validTo: string;
 keyAlgorithm: string;
 keySize: string;
 signatureAlgorithm?: string;
 owner?: string;
 ownerEmail?: string;
 notes?: string;
 tags?: string;
}

/**
 * Certificate filter options
 */
export interface CertificateFilters {
 status?: CertificateStatus;
 type?: CertificateType;
 issuerType?: IssuerType;
 expiringWithin?: number; // days
 searchQuery?: string;
}
