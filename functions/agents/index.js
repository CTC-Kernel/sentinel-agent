/**
 * Sentinel GRC - Agent API Module
 *
 * Handles all agent-related Cloud Functions:
 * - Enrollment: Token-based agent registration
 * - Heartbeat: Health monitoring and status updates
 * - Results: Compliance check result uploads
 * - Config: Configuration distribution
 * - Tokens: Enrollment token management
 */

const { enrollAgent } = require('./enrollment');
const { agentHeartbeat, getAgentStatus, getAgentMetricsHistory } = require('./heartbeat');
const { uploadResults, getAgentResults } = require('./results');
const { getAgentConfig, updateAgentConfig } = require('./config');
const {
  generateEnrollmentToken,
  listEnrollmentTokens,
  revokeEnrollmentToken
} = require('./tokens');
const { listAgents, deleteAgent, getAgentDetails, getAgentComplianceResults } = require('./management');
const { onAgentCreated, onResultUploaded } = require('./sync');
const { agentApi } = require('./api');
const {
  uploadSoftwareInventory,
  uploadCISResults,
  getAuthorizedSoftware,
  getCISBenchmarks,
} = require('./software');
const {
  recalculateAgentBaseline,
  runAnomalyDetection,
  scheduledAnomalyDetection,
  dailyBaselineRecalculation,
  updateAnomalyStats,
} = require('./anomalyDetection');
const {
  deployPolicy,
  rollbackPolicy,
  getEffectivePolicy,
  autoAssignAgentsToGroups,
  onAgentUpdated,
  validatePolicyRules,
} = require('./policies');
const {
  generateAgentReport,
  fetchComplianceReportData,
  fetchFleetHealthReportData,
  fetchExecutiveSummaryData,
  processScheduledReports,
  cleanupExpiredReports,
} = require('./reports');

module.exports = {
  // Agent REST API (for agent communication)
  agentApi,

  // Synchronization Triggers (CTC Engine)
  onAgentCreated,
  onResultUploaded,

  // Enrollment
  enrollAgent,

  // Heartbeat & Status
  agentHeartbeat,
  getAgentStatus,
  getAgentMetricsHistory,

  // Results
  uploadResults,
  getAgentResults,

  // Configuration
  getAgentConfig,
  updateAgentConfig,

  // Token Management
  generateEnrollmentToken,
  listEnrollmentTokens,
  revokeEnrollmentToken,

  // Agent Management
  listAgents,
  deleteAgent,
  getAgentDetails,
  getAgentComplianceResults,

  // Software Inventory & CIS Benchmarks
  uploadSoftwareInventory,
  uploadCISResults,
  getAuthorizedSoftware,
  getCISBenchmarks,

  // Anomaly Detection
  recalculateAgentBaseline,
  runAnomalyDetection,
  scheduledAnomalyDetection,
  dailyBaselineRecalculation,
  updateAnomalyStats,

  // Policy Management (Sprint 9)
  deployPolicy,
  rollbackPolicy,
  getEffectivePolicy,
  autoAssignAgentsToGroups,
  onAgentUpdated,
  validatePolicyRules,

  // Report Generation (Sprint 10)
  generateAgentReport,
  fetchComplianceReportData,
  fetchFleetHealthReportData,
  fetchExecutiveSummaryData,
  processScheduledReports,
  cleanupExpiredReports,
};
