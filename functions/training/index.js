/**
 * Training Module - Cloud Functions
 *
 * Cloud Functions for the Training & Awareness module.
 * Part of NIS2 Article 21.2(g) compliance.
 *
 * Functions:
 * - generateTrainingCertificate: Generate PDF certificates
 * - verifyCertificate: Verify certificate by hash
 * - checkTrainingDeadlines: Scheduled daily deadline checker
 * - sendTrainingReminders: Scheduled daily reminder sender
 * - onTrainingAssignmentComplete: Firestore trigger on completion
 *
 * @module training
 */

const { generateTrainingCertificate, verifyCertificate } = require('./generateCertificate');
const { checkTrainingDeadlines } = require('./checkDeadlines');
const { sendTrainingReminders } = require('./sendReminders');
const { onTrainingAssignmentComplete } = require('./onAssignmentComplete');

module.exports = {
  // Certificate generation
  generateTrainingCertificate,
  verifyCertificate,

  // Scheduled functions
  checkTrainingDeadlines,
  sendTrainingReminders,

  // Firestore triggers
  onTrainingAssignmentComplete,
};
