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
const { agentHeartbeat, getAgentStatus } = require('./heartbeat');
const { uploadResults, getAgentResults } = require('./results');
const { getAgentConfig, updateAgentConfig } = require('./config');
const {
  generateEnrollmentToken,
  listEnrollmentTokens,
  revokeEnrollmentToken
} = require('./tokens');
const { listAgents, deleteAgent, getAgentDetails } = require('./management');
const { agentApi } = require('./api');

module.exports = {
  // Agent REST API (for agent communication)
  agentApi,

  // Enrollment
  enrollAgent,

  // Heartbeat & Status
  agentHeartbeat,
  getAgentStatus,

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
};
