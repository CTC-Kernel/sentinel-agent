/**
 * CMDB Cloud Functions Module
 *
 * Configuration Management Database functions for:
 * - Agent data reconciliation
 * - Validation queue processing
 * - Discovery statistics
 *
 * @module functions/cmdb
 */

const reconciliation = require('./reconciliation');

module.exports = {
  // Triggers
  onAgentSync: reconciliation.onAgentSync,

  // Callable Functions
  processValidationItem: reconciliation.processValidationItem,
  getDiscoveryStats: reconciliation.getDiscoveryStats,
};
