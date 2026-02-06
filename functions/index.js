/**
 * Sentinel GRC - Cloud Functions Entry Point
 *
 * This file re-exports all functions from domain-specific modules.
 * Each module handles a specific domain with appropriate memory/timeout configurations.
 *
 * Modules:
 * - auth: SSO, authentication, password reset
 * - users: User claims, roles, token refresh, super admin
 * - organizations: Create, delete, manage organizations
 * - notifications: Email, push notifications, scheduled reminders
 * - stripe: Checkout, billing portal, webhooks
 * - ai: Gemini AI content generation and chat
 * - integrations: External APIs (Shodan, HIBP, Safe Browsing, RSS)
 * - scheduled: Backups, audit logging, system events
 * - vault: Document encryption, signatures, watermarks
 * - voxel: Anomaly detection, snapshots, analytics
 * - training: Training certificates, NIS2 Article 21.2(g) compliance
 */

const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp();

// =============================================================================
// DOMAIN MODULES
// =============================================================================

// Auth Module (SSO, Authentication)
const auth = require('./auth');

// Users Module (Claims, Roles, Token Refresh)
const users = require('./users');

// Organizations Module (Create, Delete, Manage)
const organizations = require('./organizations');

// Notifications Module (Email, Push, Scheduled)
const notifications = require('./notifications');

// Stripe Module (Payments, Subscriptions)
const stripe = require('./stripe');

// AI Module (Gemini)
const ai = require('./ai');

// Integrations Module (External APIs)
const integrations = require('./integrations');

// Scheduled Module (Backups, Audit, Logs)
const scheduled = require('./scheduled');

// Agents Module (Endpoint Compliance Agents)
const agents = require('./agents');

// Releases Module (Agent Downloads)
const releases = require('./releases');

// Training Module (Certificates - NIS2 Article 21.2g)
const training = require('./training');

// CMDB Module (Configuration Management Database)
const cmdb = require('./cmdb');

// =============================================================================
// EXISTING MODULES (already modularized)
// =============================================================================

// Audit Portal (B2B2C)
const auditPortal = require('./auditPortal');

// Certifier Portal (Ecosystem)
const certifierPortal = require('./certifierPortal');

// API (Express API)
const { api } = require('./api');

// Voxel Intelligence Engine
const detectAnomalies = require('./voxel/detectAnomalies');
const anomalyAlerts = require('./voxel/anomalyAlerts');
const voxelSnapshots = require('./voxel/snapshots');

// Document Vault
const retentionEngine = require('./vault/retentionEngine');
const { checkKmsSetup } = require('./vault/checkKmsSetup');
const { encryptOnUpload } = require('./vault/encryptOnUpload');
const { decryptOnDownload } = require('./vault/decryptOnDownload');
const { migrateDocuments, scheduledDocumentMigration, getMigrationStatus } = require('./vault/migrateDocuments');
const { verifyIntegrity, getHashHistory, generateIntegrityCertificate } = require('./vault/integrityService');
const {
  initiateSignature,
  verifySignature,
  sendSignatureNotifications,
  handleSignatureWebhook,
  generateSignedDocumentCertificate
} = require('./vault/signatureService');
const {
  getDocumentAuditTrail,
  getUserAuditTrail,
  getOrganizationAuditTrail,
  exportAuditTrail,
  getAuditStatistics
} = require('./vault/auditQueries');
const {
  downloadWithWatermark,
  getWatermarkSettingsCallable,
  updateWatermarkSettings,
  previewWatermark
} = require('./vault/watermarkService');

// Compliance Score
const { calculateComplianceScore } = require('./callable/calculateComplianceScore');
const {
  onRisksChange,
  onControlsChange,
  onDocumentsChange,
  onAuditsChange,
} = require('./triggers/onScoreRelevantChange');

// Framework Seeding
const { seedNIS2Framework } = require('./callable/seedNIS2Framework');

// =============================================================================
// RE-EXPORTS
// =============================================================================

module.exports = {
  // --- Auth Module ---
  ...auth,

  // --- Users Module ---
  ...users,

  // --- Organizations Module ---
  ...organizations,

  // --- Notifications Module ---
  ...notifications,

  // --- Stripe Module ---
  ...stripe,

  // --- AI Module ---
  ...ai,

  // --- Integrations Module ---
  ...integrations,

  // --- Scheduled Module ---
  ...scheduled,

  // --- Agents Module ---
  ...agents,

  // --- Releases Module ---
  ...releases,

  // --- Training Module ---
  ...training,

  // --- API ---
  api,

  // --- Audit Portal ---
  generateAuditShareLink: auditPortal.generateAuditShareLink,
  getSharedAuditData: auditPortal.getSharedAuditData,
  portal_submitFinding: auditPortal.portal_submitFinding,
  portal_updateStatus: auditPortal.portal_updateStatus,
  revokeAuditShare: auditPortal.revokeAuditShare,

  // --- Certifier Portal ---
  inviteCertifier: certifierPortal.inviteCertifier,
  createCertifierOrganization: certifierPortal.createCertifierOrganization,
  acceptPartnership: certifierPortal.acceptPartnership,
  getCertifierDashboard: certifierPortal.getCertifierDashboard,
  assignAuditToPartner: certifierPortal.assignAuditToPartner,

  // --- Voxel Intelligence Engine ---
  scheduledAnomalyDetection: detectAnomalies.scheduledAnomalyDetection,
  detectAnomaliesOnDemand: detectAnomalies.detectAnomaliesOnDemand,
  getAnomalies: detectAnomalies.getAnomalies,
  updateAnomalyStatus: detectAnomalies.updateAnomalyStatus,
  onAnomalyCreated: anomalyAlerts.onAnomalyCreated,
  getAlertConfiguration: anomalyAlerts.getAlertConfiguration,
  updateAlertConfiguration: anomalyAlerts.updateAlertConfiguration,
  testAnomalyAlert: anomalyAlerts.testAnomalyAlert,
  scheduledVoxelSnapshot: voxelSnapshots.scheduledVoxelSnapshot,
  createVoxelSnapshot: voxelSnapshots.createVoxelSnapshot,
  getVoxelSnapshots: voxelSnapshots.getVoxelSnapshots,
  getVoxelSnapshotByDate: voxelSnapshots.getVoxelSnapshotByDate,
  compareVoxelSnapshots: voxelSnapshots.compareVoxelSnapshots,
  convertAnomalyToIncident: detectAnomalies.convertAnomalyToIncident,

  // --- Document Vault ---
  scheduledRetentionEngine: retentionEngine.scheduledRetentionEngine,
  previewRetentionActions: retentionEngine.previewRetentionActions,
  runRetentionEngine: retentionEngine.runRetentionEngine,
  getRetentionHistory: retentionEngine.getRetentionHistory,
  checkKmsSetup,
  encryptOnUpload,
  decryptOnDownload,
  migrateDocuments,
  scheduledDocumentMigration,
  getMigrationStatus,
  verifyIntegrity,
  getHashHistory,
  generateIntegrityCertificate,
  initiateSignature,
  verifySignature,
  sendSignatureNotifications,
  handleSignatureWebhook,
  generateSignedDocumentCertificate,
  getDocumentAuditTrail,
  getUserAuditTrail,
  getOrganizationAuditTrail,
  exportAuditTrail,
  getAuditStatistics,
  downloadWithWatermark,
  getWatermarkSettingsCallable,
  updateWatermarkSettings,
  previewWatermark,

  // --- Compliance Score ---
  calculateComplianceScore,
  onRisksScoreChange: onRisksChange,
  onControlsScoreChange: onControlsChange,
  onDocumentsScoreChange: onDocumentsChange,
  onAuditsScoreChange: onAuditsChange,

  // --- Framework Seeding ---
  seedNIS2Framework,

  // --- CMDB Module ---
  cmdbOnAgentSync: cmdb.onAgentSync,
  cmdbProcessValidationItem: cmdb.processValidationItem,
  cmdbGetDiscoveryStats: cmdb.getDiscoveryStats,
};
