/**
 * Software Inventory API
 *
 * Handles software inventory data uploaded from Sentinel agents.
 * Aggregates fleet-wide software data with authorization and risk tracking.
 */

const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Software categories with detection patterns.
 */
const CATEGORY_PATTERNS = {
    development: /vs\s?code|visual studio|intellij|pycharm|webstorm|eclipse|xcode|android studio|git|node|npm|yarn|docker|kubernetes/i,
    security: /antivirus|firewall|vpn|kaspersky|norton|mcafee|avast|bitdefender|malwarebytes|crowdstrike|sentinel|defender/i,
    communication: /slack|teams|zoom|discord|skype|webex|meet|telegram|whatsapp|signal/i,
    browser: /chrome|firefox|safari|edge|opera|brave|vivaldi/i,
    productivity: /office|word|excel|powerpoint|outlook|notion|evernote|todoist|asana|trello|jira|confluence/i,
    media: /vlc|spotify|itunes|photoshop|premiere|final cut|audacity|obs|handbrake/i,
    system: /driver|runtime|framework|\.net|java|python|ruby|redistributable|update|service pack/i,
    utility: /7-zip|winrar|ccleaner|notepad|sublime|atom|terminal|iterm|putty|filezilla|winscp/i,
};

/**
 * Detect software category from name.
 */
function detectCategory(name) {
    const lowerName = name.toLowerCase();

    for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS)) {
        if (pattern.test(lowerName)) {
            return category;
        }
    }

    return 'other';
}

/**
 * Normalize software name for consistent matching.
 */
function normalizeName(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[®™©]/g, '')
        .replace(/\s*\(.*?\)\s*/g, ''); // Remove parenthetical versions
}

/**
 * Compare semantic versions.
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(p => parseInt(p, 10) || 0);
    const parts2 = v2.split('.').map(p => parseInt(p, 10) || 0);

    const maxLength = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLength; i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;

        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }

    return 0;
}

/**
 * Calculate software risk score.
 */
function calculateRiskScore(vulnerabilitySummary, isOutdated, isUnauthorized, fleetExposure) {
    let score = 0;

    // Vulnerability contribution (max 50 points)
    score += (vulnerabilitySummary.critical || 0) * 15;
    score += (vulnerabilitySummary.high || 0) * 8;
    score += (vulnerabilitySummary.medium || 0) * 3;
    score += (vulnerabilitySummary.low || 0) * 1;
    score = Math.min(score, 50);

    // Outdated contribution (max 20 points)
    if (isOutdated) {
        score += 20;
    }

    // Unauthorized contribution (max 15 points)
    if (isUnauthorized) {
        score += 15;
    }

    // Fleet exposure contribution (max 15 points)
    score += (fleetExposure || 0) * 15;

    return Math.min(100, Math.round(score));
}

/**
 * Get risk level from score.
 */
function getRiskLevel(score) {
    if (score >= 90) return 'critical';
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 10) return 'low';
    return 'none';
}

/**
 * Handle software inventory upload from agent.
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {string} agentId - Agent ID from route params
 * @param {Object} agentDoc - Agent Firestore document reference
 * @param {Object} agentData - Agent document data
 */
async function uploadSoftwareInventory(req, res, agentId, agentDoc, agentData) {
    try {
        const { software, scan_timestamp } = req.body;

        // Validate payload
        if (!software || !Array.isArray(software)) {
            return res.status(400).json({
                error: 'software array is required',
            });
        }

        if (software.length === 0) {
            return res.status(200).json({
                received_count: 0,
                added_count: 0,
                updated_count: 0,
                message: 'No software to process',
            });
        }

        const organizationId = agentData.organizationId;
        const orgRef = db.collection('organizations').doc(organizationId);
        const softwareCollection = orgRef.collection('softwareInventory');

        let addedCount = 0;
        let updatedCount = 0;
        const processedNames = new Set();

        // Pre-fetch all existing software for this agent to avoid N+1 queries
        const existingSoftwareSnapshot = await softwareCollection
            .where('agentIds', 'array-contains', agentId)
            .get();
        const existingByName = new Map();
        existingSoftwareSnapshot.forEach(doc => {
            const data = doc.data();
            existingByName.set(data.name, doc);
        });

        // Also fetch software by normalized names that might not have this agent yet
        // We'll still do a lookup for truly new software, but batch what we can

        // Get total agent count for exposure calculation
        const agentsSnapshot = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('agents')
            .count()
            .get();
        const totalAgents = agentsSnapshot.data().count || 1;

        // Process each software item
        for (const sw of software) {
            // Validate required fields
            if (!sw.name) {
                continue;
            }

            const normalizedName = normalizeName(sw.name);

            // Skip duplicates in same batch
            if (processedNames.has(normalizedName)) {
                continue;
            }
            processedNames.add(normalizedName);

            // Check if software already exists using pre-fetched Map or fallback query
            let existingDocResult = existingByName.get(normalizedName);
            if (!existingDocResult) {
                // Fallback: query for software not yet linked to this agent
                const existingQuery = await softwareCollection
                    .where('name', '==', normalizedName)
                    .limit(1)
                    .get();
                if (!existingQuery.empty) {
                    existingDocResult = existingQuery.docs[0];
                }
            }

            const now = new Date().toISOString();
            const category = detectCategory(normalizedName);

            if (!existingDocResult) {
                // Create new software entry
                const newRef = softwareCollection.doc();

                const newEntry = {
                    id: newRef.id,
                    organizationId,
                    name: normalizedName,
                    vendor: sw.vendor || 'Unknown',
                    category,
                    versions: [{
                        version: sw.version || 'Unknown',
                        agentCount: 1,
                        agentIds: [agentId],
                        isLatest: true,
                        isOutdated: false,
                        cveIds: [],
                        riskLevel: 'none',
                        firstSeen: now,
                        lastSeen: now,
                    }],
                    agentCount: 1,
                    agentIds: [agentId],
                    authorizationStatus: 'pending',
                    riskLevel: 'none',
                    riskScore: 10, // Pending = some risk
                    riskFactors: {
                        vulnerabilityScore: 0,
                        outdatedScore: 0,
                        unauthorizedScore: 10,
                        exposureScore: 0,
                        eolScore: 0,
                    },
                    linkedCveIds: [],
                    hasVulnerabilities: false,
                    vulnerabilitySummary: { critical: 0, high: 0, medium: 0, low: 0 },
                    firstDiscovered: now,
                    lastSeen: now,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };

                await newRef.set(newEntry);
                addedCount++;

                logger.debug(`Added new software: ${normalizedName} (${sw.version || 'Unknown'})`);
            } else {
                // Update existing software entry
                const existingDoc = existingDocResult;
                const existingData = existingDoc.data();

                // Check if agent already recorded
                const agentExists = existingData.agentIds.includes(agentId);

                // Update version info
                let versions = [...existingData.versions];
                const versionIndex = versions.findIndex(v => v.version === (sw.version || 'Unknown'));

                if (versionIndex >= 0) {
                    // Update existing version
                    if (!versions[versionIndex].agentIds.includes(agentId)) {
                        versions[versionIndex].agentIds.push(agentId);
                        versions[versionIndex].agentCount++;
                    }
                    versions[versionIndex].lastSeen = now;
                } else {
                    // Add new version
                    versions.push({
                        version: sw.version || 'Unknown',
                        agentCount: 1,
                        agentIds: [agentId],
                        isLatest: false,
                        isOutdated: false,
                        cveIds: [],
                        riskLevel: 'none',
                        firstSeen: now,
                        lastSeen: now,
                    });
                }

                // Sort versions and mark latest/outdated
                versions = versions.sort((a, b) => compareVersions(b.version, a.version));
                versions = versions.map((v, i) => ({
                    ...v,
                    isLatest: i === 0,
                    isOutdated: i > 0,
                }));

                const newAgentIds = agentExists
                    ? existingData.agentIds
                    : [...existingData.agentIds, agentId];

                // Recalculate risk score
                const hasOutdated = versions.some(v => v.isOutdated);
                const isUnauthorized = existingData.authorizationStatus === 'unauthorized' ||
                    existingData.authorizationStatus === 'blocked';
                const fleetExposure = newAgentIds.length / totalAgents;
                const riskScore = calculateRiskScore(
                    existingData.vulnerabilitySummary,
                    hasOutdated,
                    isUnauthorized,
                    fleetExposure
                );

                await existingDoc.ref.update({
                    versions,
                    agentIds: newAgentIds,
                    agentCount: newAgentIds.length,
                    lastSeen: now,
                    riskScore,
                    riskLevel: getRiskLevel(riskScore),
                    'riskFactors.exposureScore': Math.round(fleetExposure * 15),
                    'riskFactors.outdatedScore': hasOutdated ? 20 : 0,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                updatedCount++;

                logger.debug(`Updated software: ${normalizedName} (${sw.version || 'Unknown'})`);
            }
        }

        // Update agent's last software scan timestamp
        await agentDoc.ref.update({
            lastSoftwareScanAt: admin.firestore.FieldValue.serverTimestamp(),
            softwareCount: software.length,
        });

        logger.info(`Agent ${agentId} uploaded ${software.length} software items: ${addedCount} added, ${updatedCount} updated`);

        return res.status(200).json({
            received_count: software.length,
            added_count: addedCount,
            updated_count: updatedCount,
        });
    } catch (error) {
        logger.error('Upload software inventory error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Handle CIS benchmark results upload from agent.
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {string} agentId - Agent ID from route params
 * @param {Object} agentDoc - Agent Firestore document reference
 * @param {Object} agentData - Agent document data
 */
async function uploadCISResults(req, res, agentId, agentDoc, agentData) {
    try {
        const { benchmark_id, benchmark_name, results } = req.body;

        // Validate payload
        if (!benchmark_id || !results || !Array.isArray(results)) {
            return res.status(400).json({
                error: 'benchmark_id and results array are required',
            });
        }

        if (results.length === 0) {
            return res.status(200).json({
                received_count: 0,
                message: 'No CIS results to process',
            });
        }

        const organizationId = agentData.organizationId;
        const baselineRef = db
            .collection('organizations')
            .doc(organizationId)
            .collection('cisBaselines')
            .doc(agentId);

        // Get existing baseline for trend data
        const existingDoc = await baselineRef.get();
        let previousScore = undefined;
        let scoreHistory = [];

        if (existingDoc.exists) {
            const existingData = existingDoc.data();
            previousScore = existingData.complianceScore;
            scoreHistory = existingData.scoreHistory || [];
        }

        // Process results
        const processedResults = results.map(r => ({
            id: `${agentId}_${r.check_id}`,
            checkId: r.check_id,
            benchmarkId: benchmark_id,
            agentId,
            status: r.status, // 'pass', 'fail', 'manual', 'not_applicable', 'error'
            actualValue: r.actual_value,
            expectedValue: r.expected_value,
            evidence: r.evidence || {},
            errorMessage: r.error_message || null,
            timestamp: r.timestamp || new Date().toISOString(),
            durationMs: r.duration_ms || 0,
        }));

        // Calculate summary
        const summary = {
            pass: processedResults.filter(r => r.status === 'pass').length,
            fail: processedResults.filter(r => r.status === 'fail').length,
            manual: processedResults.filter(r => r.status === 'manual').length,
            notApplicable: processedResults.filter(r => r.status === 'not_applicable').length,
            error: processedResults.filter(r => r.status === 'error').length,
            total: processedResults.length,
        };

        // Calculate compliance score
        const applicableCount = summary.pass + summary.fail;
        const complianceScore = applicableCount > 0
            ? Math.round((summary.pass / applicableCount) * 100)
            : 0;

        // Calculate category results
        const categoryMap = new Map();
        for (const result of processedResults) {
            const categoryId = result.checkId.split('.').slice(0, 2).join('.');
            const existing = categoryMap.get(categoryId) || { pass: 0, fail: 0, total: 0 };
            existing.total++;
            if (result.status === 'pass') existing.pass++;
            if (result.status === 'fail') existing.fail++;
            categoryMap.set(categoryId, existing);
        }

        const categoryResults = Array.from(categoryMap.entries()).map(([categoryId, data]) => ({
            categoryId,
            categoryName: categoryId, // Would need lookup for actual names
            pass: data.pass,
            fail: data.fail,
            total: data.total,
            compliancePercent: data.total > 0
                ? Math.round((data.pass / (data.pass + data.fail || 1)) * 100)
                : 0,
        }));

        // Update score history (keep last 30 entries)
        scoreHistory.push({
            timestamp: new Date().toISOString(),
            score: complianceScore,
        });
        if (scoreHistory.length > 30) {
            scoreHistory = scoreHistory.slice(-30);
        }

        // Build baseline document
        const baseline = {
            id: agentId,
            agentId,
            organizationId,
            benchmarkId: benchmark_id,
            benchmarkName: benchmark_name || benchmark_id,
            complianceScore,
            summary,
            categoryResults,
            results: processedResults,
            lastScanAt: new Date().toISOString(),
            previousScore,
            scoreChange: previousScore !== undefined
                ? complianceScore - previousScore
                : undefined,
            scoreHistory,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await baselineRef.set(baseline);

        // Update agent's CIS scan timestamp
        await agentDoc.ref.update({
            lastCisScanAt: admin.firestore.FieldValue.serverTimestamp(),
            cisComplianceScore: complianceScore,
            cisBenchmarkId: benchmark_id,
        });

        // Create alert for low compliance score
        if (complianceScore < 50) {
            const alertRef = db
                .collection('organizations')
                .doc(organizationId)
                .collection('alerts')
                .doc();

            await alertRef.set({
                id: alertRef.id,
                type: 'low_cis_compliance',
                title: `Low CIS compliance on ${agentData.hostname}`,
                message: `Agent ${agentData.hostname} has a CIS compliance score of ${complianceScore}% (${benchmark_name || benchmark_id}).`,
                severity: complianceScore < 30 ? 'critical' : 'high',
                source: 'agent',
                agentId,
                complianceScore,
                benchmarkId: benchmark_id,
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        logger.info(`Agent ${agentId} uploaded CIS results for ${benchmark_id}: score ${complianceScore}% (${summary.pass} pass, ${summary.fail} fail)`);

        return res.status(200).json({
            received_count: results.length,
            compliance_score: complianceScore,
            summary,
        });
    } catch (error) {
        logger.error('Upload CIS results error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Get software authorization status.
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Object} agentData - Agent document data
 */
async function getAuthorizedSoftware(req, res, agentData) {
    try {
        const organizationId = agentData.organizationId;

        const softwareSnapshot = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('softwareInventory')
            .where('authorizationStatus', 'in', ['authorized', 'blocked'])
            .get();

        const authorized = [];
        const blocked = [];

        softwareSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.authorizationStatus === 'authorized') {
                authorized.push({
                    name: data.name,
                    vendor: data.vendor,
                    category: data.category,
                });
            } else {
                blocked.push({
                    name: data.name,
                    vendor: data.vendor,
                    category: data.category,
                    reason: data.authorizationNotes || 'Not specified',
                });
            }
        });

        return res.status(200).json({
            authorized,
            blocked,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logger.error('Get authorized software error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Get CIS benchmark definitions for agent.
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Object} agentData - Agent document data
 */
async function getCISBenchmarks(req, res, agentData) {
    try {
        // For now, return static benchmark definitions
        // In production, these would be stored in Firestore or fetched from CIS API
        const benchmarks = [
            {
                id: 'CIS_WIN11_L1',
                name: 'CIS Microsoft Windows 11 Enterprise Benchmark Level 1',
                version: '1.0.0',
                targetOS: 'windows',
                osVersion: 'Windows 11',
                level: 'L1',
                totalChecks: 280,
            },
            {
                id: 'CIS_WIN11_L2',
                name: 'CIS Microsoft Windows 11 Enterprise Benchmark Level 2',
                version: '1.0.0',
                targetOS: 'windows',
                osVersion: 'Windows 11',
                level: 'L2',
                totalChecks: 350,
            },
            {
                id: 'CIS_MACOS_L1',
                name: 'CIS Apple macOS 14 Sonoma Benchmark Level 1',
                version: '1.0.0',
                targetOS: 'darwin',
                osVersion: 'macOS 14',
                level: 'L1',
                totalChecks: 150,
            },
            {
                id: 'CIS_UBUNTU_L1',
                name: 'CIS Ubuntu Linux 22.04 LTS Benchmark Level 1',
                version: '1.0.0',
                targetOS: 'linux',
                osVersion: 'Ubuntu 22.04',
                level: 'L1',
                totalChecks: 200,
            },
        ];

        // Filter by agent OS
        const agentOS = agentData.os?.toLowerCase();
        const filteredBenchmarks = benchmarks.filter(b => {
            if (agentOS === 'windows') return b.targetOS === 'windows';
            if (agentOS === 'darwin' || agentOS === 'macos') return b.targetOS === 'darwin';
            if (agentOS === 'linux') return b.targetOS === 'linux';
            return true;
        });

        return res.status(200).json({
            benchmarks: filteredBenchmarks,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logger.error('Get CIS benchmarks error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    uploadSoftwareInventory,
    uploadCISResults,
    getAuthorizedSoftware,
    getCISBenchmarks,
    detectCategory,
    normalizeName,
    compareVersions,
    calculateRiskScore,
    getRiskLevel,
};
