/**
 * Training Module - Cloud Functions
 *
 * Cloud Functions for the Training & Awareness module.
 * Part of NIS2 Article 21.2(g) compliance.
 *
 * @module training
 */

const { generateTrainingCertificate, verifyCertificate } = require('./generateCertificate');

module.exports = {
  generateTrainingCertificate,
  verifyCertificate,
};
