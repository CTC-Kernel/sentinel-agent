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

const { getAgentStatus, getAgentMetricsHistory } = require('./heartbeat');
const { getAgentResults } = require('./results');
const { updateAgentConfig } = require('./config');
const {
  generateEnrollmentToken,
  listEnrollmentTokens,
  revokeEnrollmentToken
} = require('./tokens');
const { listAgents, deleteAgent, getAgentDetails, getAgentComplianceResults } = require('./management');
const { onAgentCreated, onResultUploaded } = require('./sync');
const { agentApi } = require('./api');
const {
  recalculateAgentBaseline,
  runAnomalyDetection,
  scheduledAnomalyDetection,
  dailyBaselineRecalculation,
  updateAnomalyStats,
} = require('./anomalyDetection');
const {
  deployAgentPolicy,
  rollbackAgentPolicy,
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

  // Heartbeat & Status (onCall only)
  getAgentStatus,
  getAgentMetricsHistory,

  // Results (onCall only)
  getAgentResults,

  // Configuration (onCall only)
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

  // Anomaly Detection
  recalculateAgentBaseline,
  runAnomalyDetection,
  scheduledAnomalyDetection,
  dailyBaselineRecalculation,
  updateAnomalyStats,

  // Policy Management (Sprint 9)
  deployAgentPolicy,
  rollbackAgentPolicy,
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
