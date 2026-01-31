/**
 * Vulnerability Upload API
 *
 * Handles vulnerability data uploaded from Sentinel agents.
 * Creates entries in the vulnerabilities collection with agent as source.
 */

const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Severity levels with CVSS score mappings.
 */
const SEVERITY_LEVELS = {
    critical: { min: 9.0, max: 10.0 },
    high: { min: 7.0, max: 8.9 },
    medium: { min: 4.0, max: 6.9 },
    low: { min: 0.1, max: 3.9 },
};

/**
 * Map CVSS score to severity level.
 */
function cvssToSeverity(cvss) {
    if (cvss >= 9.0) return 'critical';
    if (cvss >= 7.0) return 'high';
    if (cvss >= 4.0) return 'medium';
    if (cvss >= 0.1) return 'low';
    return 'low';
}

/**
 * Generate a deduplication key for a vulnerability.
 */
function getDeduplicationKey(vuln, agentId) {
    const cve = vuln.cve_id || 'no-cve';
    const pkg = vuln.package_name || 'unknown';
    return `${agentId}:${pkg}:${cve}`;
}

/**
 * Handle vulnerability upload from agent.
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {string} agentId - Agent ID from route params
 * @param {Object} agentDoc - Agent Firestore document reference
 * @param {Object} agentData - Agent document data
 */
async function uploadVulnerabilities(req, res, agentId, agentDoc, agentData) {
    try {
        const { vulnerabilities, scan_type } = req.body;

        // Validate payload
        if (!vulnerabilities || !Array.isArray(vulnerabilities)) {
            return res.status(400).json({
                error: 'vulnerabilities array is required',
            });
        }

        if (vulnerabilities.length === 0) {
            return res.status(200).json({
                received_count: 0,
                created_count: 0,
                updated_count: 0,
                message: 'No vulnerabilities to process',
            });
        }

        const organizationId = agentData.organizationId;
        const BATCH_LIMIT = 400;
        let batch = db.batch();
        let opCount = 0;
        const orgRef = db.collection('organizations').doc(organizationId);
        const vulnsCollection = orgRef.collection('vulnerabilities');

        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        const processedKeys = new Set();

        // Pre-fetch all existing vulnerabilities for this agent to avoid N+1 queries
        const existingVulnsSnapshot = await vulnsCollection
            .where('agentId', '==', agentId)
            .get();
        const existingVulnsByDedup = new Map();
        existingVulnsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.dedupKey) existingVulnsByDedup.set(data.dedupKey, doc);
        });

        for (const vuln of vulnerabilities) {
            // Validate required fields
            if (!vuln.package_name) {
                skippedCount++;
                continue;
            }

            // Generate deduplication key
            const dedupKey = getDeduplicationKey(vuln, agentId);

            // Skip duplicates in same batch
            if (processedKeys.has(dedupKey)) {
                skippedCount++;
                continue;
            }
            processedKeys.add(dedupKey);

            // Determine severity from CVSS or provided severity
            const severity = vuln.severity?.toLowerCase() || (vuln.cvss_score ? cvssToSeverity(vuln.cvss_score) : 'medium');

            // Build vulnerability data
            const vulnData = {
                // Core fields matching app Vulnerability model
                title: vuln.cve_id
                    ? `${vuln.cve_id}: ${vuln.package_name}`
                    : `Outdated package: ${vuln.package_name}`,
                description: vuln.description || `Package ${vuln.package_name} has a known vulnerability.`,
                severity,
                score: vuln.cvss_score || null,
                cveId: vuln.cve_id || null,
                status: 'open',

                // Source tracking
                source: 'agent',
                agentId,
                assetId: agentData.linkedAssetId || null,
                hostname: agentData.hostname,
                machineId: agentData.machineId,

                // Package details
                packageName: vuln.package_name,
                installedVersion: vuln.installed_version || null,
                availableVersion: vuln.available_version || null,
                remediation: vuln.remediation || `Update ${vuln.package_name} to the latest version.`,

                // Metadata
                scanType: scan_type || 'packages',
                detectedAt: vuln.detected_at || new Date().toISOString(),
                dedupKey,

                // Organization
                organizationId,
            };

            // Check if vulnerability already exists using pre-fetched Map
            const existingDoc = existingVulnsByDedup.get(dedupKey);

            if (existingDoc) {
                // Update existing vulnerability but don't overwrite analyst-set status
                const { status: _status, ...updateData } = vulnData;
                batch.update(existingDoc.ref, {
                    ...updateData,
                    lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                opCount++;
                updatedCount++;
            } else {
                // Create new vulnerability
                const newRef = vulnsCollection.doc();
                batch.set(newRef, {
                    ...vulnData,
                    id: newRef.id,
                    firstSeenAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                opCount++;
                createdCount++;

                // Alert on critical severity
                if (severity === 'critical') {
                    const alertRef = db
                        .collection('organizations')
                        .doc(organizationId)
                        .collection('alerts')
                        .doc();
                    batch.set(alertRef, {
                        id: alertRef.id,
                        type: 'critical_vulnerability',
                        title: `Critical vulnerability detected: ${vuln.cve_id || vuln.package_name}`,
                        message: `Agent ${agentData.hostname} detected a critical vulnerability in ${vuln.package_name}.`,
                        severity: 'critical',
                        source: 'agent',
                        agentId,
                        vulnerabilityId: newRef.id,
                        read: false,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    opCount++;
                }
            }

            if (opCount >= BATCH_LIMIT) {
                await batch.commit();
                batch = db.batch();
                opCount = 0;
            }
        }

        // Update agent's last vulnerability scan timestamp
        batch.update(agentDoc.ref, {
            lastVulnScanAt: admin.firestore.FieldValue.serverTimestamp(),
            vulnScanType: scan_type || 'packages',
        });
        opCount++;

        if (opCount > 0) await batch.commit();

        logger.info(`Agent ${agentId} uploaded ${vulnerabilities.length} vulnerabilities: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped`);

        return res.status(200).json({
            received_count: vulnerabilities.length,
            created_count: createdCount,
            updated_count: updatedCount,
            skipped_count: skippedCount,
        });
    } catch (error) {
        logger.error('Upload vulnerabilities error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    uploadVulnerabilities,
    cvssToSeverity,
    SEVERITY_LEVELS,
};
