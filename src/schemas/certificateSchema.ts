/**
 * Certificate Schema
 *
 * Zod validation schema for certificate forms.
 * Part of NIS2 Article 21.2(h) compliance.
 *
 * @module schemas/certificateSchema
 */

import { z } from 'zod';

export const certificateTypeOptions = [
  'ssl_tls',
  'code_signing',
  'email',
  'client',
  'root_ca',
  'intermediate_ca',
  'other',
] as const;

export const keyAlgorithmOptions = ['RSA', 'ECDSA', 'Ed25519', 'DSA', 'other'] as const;

export const issuerTypeOptions = ['public_ca', 'private_ca', 'self_signed'] as const;

export const certificateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(1000).optional(),
  type: z.enum(certificateTypeOptions),

  commonName: z.string().trim().min(1, 'Common Name is required').max(255),
  domains: z.array(z.string().trim()).min(1, 'At least one domain is required'),
  serialNumber: z.string().trim().min(1, 'Serial number is required').max(100),

  issuer: z.string().trim().min(1, "Issuer is required").max(255),
  issuerType: z.enum(issuerTypeOptions),

  validFrom: z.date({ error: 'Start date is required' }),
  validTo: z.date({ error: "Expiration date is required" }),

  keyAlgorithm: z.enum(keyAlgorithmOptions),
  keySize: z.number().min(256).max(8192),
  signatureAlgorithm: z.string().trim().max(100).optional(),

  thumbprintSha1: z.string().trim().max(50).optional(),
  thumbprintSha256: z.string().trim().max(100).optional(),

  assetId: z.string().optional(),
  assetName: z.string().optional(),

  owner: z.string().trim().max(100).optional(),
  ownerEmail: z.string().email().optional().or(z.literal('')),
  autoRenew: z.boolean().default(false),

  notes: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim()).optional(),
}).refine(
  (data) => data.validTo > data.validFrom,
  {
    message: "Expiration date must be after start date",
    path: ['validTo'],
  }
);

export type CertificateFormData = z.infer<typeof certificateSchema>;

/**
 * CSV import schema (relaxed validation)
 */
export const certificateImportSchema = z.object({
  name: z.string().trim().min(1),
  commonName: z.string().trim().min(1),
  domains: z.string().trim().min(1), // comma-separated
  serialNumber: z.string().trim().min(1),
  issuer: z.string().trim().min(1),
  issuerType: z.enum(issuerTypeOptions).optional().default('public_ca'),
  validFrom: z.string().trim().min(1),
  validTo: z.string().trim().min(1),
  keyAlgorithm: z.enum(keyAlgorithmOptions).optional().default('RSA'),
  keySize: z.string().optional().default('2048'),
  signatureAlgorithm: z.string().optional(),
  owner: z.string().optional(),
  ownerEmail: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(), // comma-separated
});

export type CertificateImportData = z.infer<typeof certificateImportSchema>;
