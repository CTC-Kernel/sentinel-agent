/**
 * Epic 29: Voxel Anomaly Detection Cloud Functions
 *
 * Story 29.2: Cloud Function Anomaly Detection
 * Story 29.3: Circular Dependency Detection
 *
 * Detects anomalies in GRC data:
 * - orphan_control: Controls not linked to any risk
 * - coverage_gap: Risks without mitigation controls
 * - stale_assessment: Assessments older than 90 days
 * - circular_dependency: Circular risk->control->risk chains
 * - compliance_drift: Control effectiveness below threshold
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

// Configuration constants
const STALE_THRESHOLD_DAYS = 90;
const EFFECTIVENESS_THRESHOLD = 50; // Below this % is considered compliance drift
const BATCH_SIZE = 500;

// Risk score thresholds (aligned with frontend src/constants/complianceConfig.ts)
const RISK_THRESHOLDS = { CRITICAL: 15, HIGH: 10, MEDIUM: 5, LOW: 0 };

/**
 * Severity calculation based on anomaly type and context
 */
const calculateSeverity = (type, context = {}) => {
    switch (type) {
        case 'circular_dependency':
            return 'critical'; // Always critical - system integrity issue
        case 'coverage_gap':
            // Severity based on risk score
            if (context.riskScore >= RISK_THRESHOLDS.CRITICAL) return 'critical';
            if (context.riskScore >= RISK_THRESHOLDS.HIGH) return 'high';
            if (context.riskScore >= RISK_THRESHOLDS.MEDIUM) return 'medium';
            return 'low';
        case 'orphan_control':
            return 'medium'; // Potential waste, but not urgent
        case 'stale_assessment':
            // Severity based on days overdue
            if (context.daysSinceAssessment > 180) return 'critical';
            if (context.daysSinceAssessment > 120) return 'high';
            return 'medium';
        case 'compliance_drift':
            // Severity based on how far below threshold
            if (context.actualValue < 30) return 'critical';
            if (context.actualValue < EFFECTIVENESS_THRESHOLD) return 'high';
            return 'medium';
        default:
            return 'medium';
    }
};

/**
 * Create anomaly document structure
 */
const createAnomaly = (type, nodeId, message, details = {}, organizationId) => {
    const severity = calculateSeverity(type, details);
    return {
        type,
        severity,
        nodeId,
        message,
        details,
        detectedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'active',
        detectionSource: 'server',
        organizationId,
    };
};

/**
 * Detect orphan controls - controls not linked to any risk
 */
const detectOrphanControls = async (db, organizationId) => {
    const anomalies = [];

    // Get all controls
    const controlsSnap = await db.collection('controls')
        .where('organizationId', '==', organizationId)
        .get();

    // Get all risks to find which controls are linked
    const risksSnap = await db.collection('risks')
        .where('organizationId', '==', organizationId)
        .get();

    // Build set of linked control IDs
    const linkedControlIds = new Set();
    risksSnap.forEach(doc => {
        const risk = doc.data();
        if (risk.mitigationControlIds && Array.isArray(risk.mitigationControlIds)) {
            risk.mitigationControlIds.forEach(id => linkedControlIds.add(id));
        }
        if (risk.relatedControlIds && Array.isArray(risk.relatedControlIds)) {
            risk.relatedControlIds.forEach(id => linkedControlIds.add(id));
        }
    });

    // Find orphan controls
    controlsSnap.forEach(doc => {
        const control = doc.data();
        if (!linkedControlIds.has(doc.id) && control.status !== 'Inactif') {
            anomalies.push(createAnomaly(
                'orphan_control',
                doc.id,
                `Contrôle "${control.name || control.code}" n'est lié à aucun risque`,
                { controlCode: control.code, controlName: control.name },
                organizationId
            ));
        }
    });

    return anomalies;
};

/**
 * Detect coverage gaps - risks without mitigation controls
 */
const detectCoverageGaps = async (db, organizationId) => {
    const anomalies = [];

    const risksSnap = await db.collection('risks')
        .where('organizationId', '==', organizationId)
        .where('status', 'in', ['Ouvert', 'En cours'])
        .get();

    risksSnap.forEach(doc => {
        const risk = doc.data();
        const hasControls = risk.mitigationControlIds &&
            Array.isArray(risk.mitigationControlIds) &&
            risk.mitigationControlIds.length > 0;

        if (!hasControls && risk.strategy !== 'Accepter') {
            anomalies.push(createAnomaly(
                'coverage_gap',
                doc.id,
                `Risque "${risk.threat || risk.name}" sans contrôle de mitigation`,
                {
                    riskScore: risk.score || 0,
                    riskThreat: risk.threat,
                    strategy: risk.strategy
                },
                organizationId
            ));
        }
    });

    return anomalies;
};

/**
 * Detect stale assessments - assessments older than 90 days
 */
const detectStaleAssessments = async (db, organizationId) => {
    const anomalies = [];
    const now = new Date();
    const threshold = new Date(now.getTime() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

    // Check control assessments
    const controlsSnap = await db.collection('controls')
        .where('organizationId', '==', organizationId)
        .where('status', '!=', 'Inactif')
        .get();

    controlsSnap.forEach(doc => {
        const control = doc.data();
        let lastAssessmentDate = null;

        // Check lastAssessmentDate or updatedAt
        if (control.lastAssessmentDate) {
            lastAssessmentDate = control.lastAssessmentDate.toDate ?
                control.lastAssessmentDate.toDate() :
                new Date(control.lastAssessmentDate);
        } else if (control.updatedAt) {
            lastAssessmentDate = control.updatedAt.toDate ?
                control.updatedAt.toDate() :
                new Date(control.updatedAt);
        }

        if (lastAssessmentDate && lastAssessmentDate < threshold) {
            const daysSince = Math.floor((now - lastAssessmentDate) / (1000 * 60 * 60 * 24));
            anomalies.push(createAnomaly(
                'stale_assessment',
                doc.id,
                `Contrôle "${control.name || control.code}" non évalué depuis ${daysSince} jours`,
                {
                    daysSinceAssessment: daysSince,
                    lastAssessmentDate: lastAssessmentDate.toISOString(),
                    threshold: STALE_THRESHOLD_DAYS
                },
                organizationId
            ));
        }
    });

    // Check risk assessments
    const risksSnap = await db.collection('risks')
        .where('organizationId', '==', organizationId)
        .where('status', 'in', ['Ouvert', 'En cours'])
        .get();

    risksSnap.forEach(doc => {
        const risk = doc.data();
        let lastAssessmentDate = null;

        if (risk.lastAssessmentDate) {
            lastAssessmentDate = risk.lastAssessmentDate.toDate ?
                risk.lastAssessmentDate.toDate() :
                new Date(risk.lastAssessmentDate);
        } else if (risk.updatedAt) {
            lastAssessmentDate = risk.updatedAt.toDate ?
                risk.updatedAt.toDate() :
                new Date(risk.updatedAt);
        }

        if (lastAssessmentDate && lastAssessmentDate < threshold) {
            const daysSince = Math.floor((now - lastAssessmentDate) / (1000 * 60 * 60 * 24));
            anomalies.push(createAnomaly(
                'stale_assessment',
                doc.id,
                `Risque "${risk.threat || risk.name}" non réévalué depuis ${daysSince} jours`,
                {
                    daysSinceAssessment: daysSince,
                    lastAssessmentDate: lastAssessmentDate.toISOString(),
                    threshold: STALE_THRESHOLD_DAYS
                },
                organizationId
            ));
        }
    });

    return anomalies;
};

/**
 * Detect compliance drift - control effectiveness below threshold
 */
const detectComplianceDrift = async (db, organizationId) => {
    const anomalies = [];

    const controlsSnap = await db.collection('controls')
        .where('organizationId', '==', organizationId)
        .where('status', '!=', 'Inactif')
        .get();

    controlsSnap.forEach(doc => {
        const control = doc.data();
        const effectiveness = control.effectiveness ?? control.maturity ?? control.score;

        if (typeof effectiveness === 'number' && effectiveness < EFFECTIVENESS_THRESHOLD) {
            anomalies.push(createAnomaly(
                'compliance_drift',
                doc.id,
                `Contrôle "${control.name || control.code}" efficacité insuffisante (${effectiveness}%)`,
                {
                    actualValue: effectiveness,
                    threshold: EFFECTIVENESS_THRESHOLD,
                    controlCode: control.code
                },
                organizationId
            ));
        }
    });

    return anomalies;
};

/**
 * Story 29.3: Circular Dependency Detection using DFS
 * Detects cycles in risk -> control -> risk relationships
 */
const detectCircularDependencies = async (db, organizationId) => {
    const anomalies = [];

    // Build adjacency graph
    const graph = new Map(); // nodeId -> [connectedNodeIds]
    const nodeTypes = new Map(); // nodeId -> 'risk' | 'control'

    // Get all risks and their control relationships
    const risksSnap = await db.collection('risks')
        .where('organizationId', '==', organizationId)
        .get();

    risksSnap.forEach(doc => {
        const risk = doc.data();
        const riskId = `risk:${doc.id}`;
        nodeTypes.set(riskId, 'risk');

        const connections = [];

        // Risk -> Control (mitigation)
        if (risk.mitigationControlIds && Array.isArray(risk.mitigationControlIds)) {
            risk.mitigationControlIds.forEach(controlId => {
                connections.push(`control:${controlId}`);
            });
        }

        // Related controls
        if (risk.relatedControlIds && Array.isArray(risk.relatedControlIds)) {
            risk.relatedControlIds.forEach(controlId => {
                connections.push(`control:${controlId}`);
            });
        }

        graph.set(riskId, connections);
    });

    // Get all controls and their risk relationships
    const controlsSnap = await db.collection('controls')
        .where('organizationId', '==', organizationId)
        .get();

    controlsSnap.forEach(doc => {
        const control = doc.data();
        const controlId = `control:${doc.id}`;
        nodeTypes.set(controlId, 'control');

        const connections = [];

        // Control -> Risk (risks addressed by this control)
        if (control.relatedRiskIds && Array.isArray(control.relatedRiskIds)) {
            control.relatedRiskIds.forEach(riskId => {
                connections.push(`risk:${riskId}`);
            });
        }

        // mitigatedRiskIds
        if (control.mitigatedRiskIds && Array.isArray(control.mitigatedRiskIds)) {
            control.mitigatedRiskIds.forEach(riskId => {
                connections.push(`risk:${riskId}`);
            });
        }

        graph.set(controlId, connections);
    });

    // DFS-based cycle detection
    const visited = new Set();
    const recursionStack = new Set();
    const foundCycles = [];

    const dfs = (nodeId, path = []) => {
        visited.add(nodeId);
        recursionStack.add(nodeId);
        path.push(nodeId);

        const neighbors = graph.get(nodeId) || [];

        for (const neighbor of neighbors) {
            if (!graph.has(neighbor)) continue; // Skip if neighbor doesn't exist

            if (!visited.has(neighbor)) {
                const cyclePath = dfs(neighbor, [...path]);
                if (cyclePath) return cyclePath;
            } else if (recursionStack.has(neighbor)) {
                // Found cycle - extract the cycle path
                const cycleStart = path.indexOf(neighbor);
                const cyclePath = path.slice(cycleStart);
                cyclePath.push(neighbor); // Complete the cycle
                return cyclePath;
            }
        }

        recursionStack.delete(nodeId);
        return null;
    };

    // Run DFS from each unvisited node
    for (const nodeId of graph.keys()) {
        if (!visited.has(nodeId)) {
            const cyclePath = dfs(nodeId);
            if (cyclePath) {
                // Check if this cycle is unique (not already found)
                const cycleKey = [...cyclePath].sort().join(',');
                if (!foundCycles.some(c => [...c].sort().join(',') === cycleKey)) {
                    foundCycles.push(cyclePath);
                }
            }
        }
    }

    // Create anomalies for each detected cycle
    for (const cyclePath of foundCycles) {
        // Get the first node in the cycle for the anomaly nodeId
        const firstNode = cyclePath[0];
        const actualNodeId = firstNode.split(':')[1];

        // Convert path to readable format
        const readablePath = cyclePath.map(node => {
            const [type, id] = node.split(':');
            return `${type}:${id.substring(0, 8)}...`;
        });

        anomalies.push(createAnomaly(
            'circular_dependency',
            actualNodeId,
            `Dépendance circulaire détectée: ${readablePath.join(' -> ')}`,
            {
                cyclePath: cyclePath.map(n => n.split(':')[1]),
                cycleLength: cyclePath.length - 1,
                fullPath: cyclePath
            },
            organizationId
        ));
    }

    return anomalies;
};

/**
 * Write anomalies to Firestore, avoiding duplicates
 */
const writeAnomalies = async (db, anomalies, organizationId) => {
    if (anomalies.length === 0) {
        logger.info(`No anomalies to write for organization ${organizationId}`);
        return { created: 0, skipped: 0 };
    }

    const anomaliesRef = db.collection('voxel_anomalies');

    // Get existing active anomalies to avoid duplicates
    const existingSnap = await anomaliesRef
        .where('organizationId', '==', organizationId)
        .where('status', '==', 'active')
        .get();

    const existingKeys = new Set();
    existingSnap.forEach(doc => {
        const a = doc.data();
        // Create unique key based on type + nodeId
        existingKeys.add(`${a.type}:${a.nodeId}`);
    });

    // Filter out duplicates and batch write
    const newAnomalies = anomalies.filter(a => {
        const key = `${a.type}:${a.nodeId}`;
        return !existingKeys.has(key);
    });

    let created = 0;
    for (let i = 0; i < newAnomalies.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = newAnomalies.slice(i, i + BATCH_SIZE);

        for (const anomaly of chunk) {
            const docRef = anomaliesRef.doc();
            batch.set(docRef, anomaly);
            created++;
        }

        await batch.commit();
    }

    const skipped = anomalies.length - created;
    logger.info(`Wrote ${created} new anomalies, skipped ${skipped} duplicates for org ${organizationId}`);

    return { created, skipped };
};

/**
 * Main detection function - runs all detectors for an organization
 */
const runAnomalyDetection = async (organizationId) => {
    const db = admin.firestore();

    logger.info(`Starting anomaly detection for organization: ${organizationId}`);

    const results = await Promise.allSettled([
        detectOrphanControls(db, organizationId),
        detectCoverageGaps(db, organizationId),
        detectStaleAssessments(db, organizationId),
        detectComplianceDrift(db, organizationId),
        detectCircularDependencies(db, organizationId),
    ]);

    // Collect all anomalies
    const allAnomalies = [];
    const detectionSummary = {
        orphan_control: 0,
        coverage_gap: 0,
        stale_assessment: 0,
        compliance_drift: 0,
        circular_dependency: 0,
        errors: []
    };

    const detectorNames = [
        'orphan_control',
        'coverage_gap',
        'stale_assessment',
        'compliance_drift',
        'circular_dependency'
    ];

    results.forEach((result, index) => {
        const detectorName = detectorNames[index];
        if (result.status === 'fulfilled') {
            allAnomalies.push(...result.value);
            detectionSummary[detectorName] = result.value.length;
        } else {
            logger.error(`Detector ${detectorName} failed:`, result.reason);
            detectionSummary.errors.push({
                detector: detectorName,
                error: result.reason?.message || 'Unknown error'
            });
        }
    });

    // Write anomalies to Firestore
    const writeResult = await writeAnomalies(db, allAnomalies, organizationId);

    // Log completion
    logger.info(`Anomaly detection complete for ${organizationId}:`, {
        total: allAnomalies.length,
        ...detectionSummary,
        ...writeResult
    });

    return {
        organizationId,
        totalDetected: allAnomalies.length,
        summary: detectionSummary,
        ...writeResult
    };
};

/**
 * Scheduled function - runs every hour
 * Story 29.2: Scheduled anomaly detection
 */
exports.scheduledAnomalyDetection = onSchedule({
    schedule: "every 60 minutes",
    timeZone: "Europe/Paris",
    region: "europe-west1",
}, async (event) => {
    logger.info("Starting scheduled anomaly detection");

    const db = admin.firestore();

    try {
        // Get all organizations
        const orgsSnap = await db.collection('organizations').get();

        const results = [];
        for (const orgDoc of orgsSnap.docs) {
            try {
                const result = await runAnomalyDetection(orgDoc.id);
                results.push(result);
            } catch (error) {
                logger.error(`Failed to detect anomalies for org ${orgDoc.id}:`, error);
                results.push({
                    organizationId: orgDoc.id,
                    error: error.message
                });
            }
        }

        logger.info("Scheduled anomaly detection complete", {
            organizationsProcessed: results.length,
            totalAnomalies: results.reduce((sum, r) => sum + (r.totalDetected || 0), 0)
        });

        return results;
    } catch (error) {
        logger.error("Scheduled anomaly detection failed:", error);
        throw error;
    }
});

/**
 * Callable function - on-demand detection
 * Story 29.2: On-demand anomaly detection
 */
exports.detectAnomaliesOnDemand = onCall({
    region: "europe-west1",
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const organizationId = request.auth.token.organizationId;
    if (!organizationId) {
        throw new HttpsError('failed-precondition', 'User must belong to an organization.');
    }

    // Optional: Check role (admin, rssi, or auditor)
    const role = request.auth.token.role;
    if (!['admin', 'rssi', 'auditor'].includes(role)) {
        throw new HttpsError('permission-denied', 'Insufficient permissions to run anomaly detection.');
    }

    try {
        logger.info(`On-demand anomaly detection requested by ${request.auth.uid}`);

        const result = await runAnomalyDetection(organizationId);

        return {
            success: true,
            ...result
        };
    } catch (error) {
        logger.error("On-demand anomaly detection failed:", error);
        throw new HttpsError('internal', 'An internal error occurred during anomaly detection.');
    }
});

/**
 * Get anomalies for an organization
 * Callable function for fetching anomaly data
 */
exports.getAnomalies = onCall({
    region: "europe-west1",
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const organizationId = request.auth.token.organizationId;
    if (!organizationId) {
        throw new HttpsError('failed-precondition', 'User must belong to an organization.');
    }

    const { status, type, severity, limit: queryLimit = 100 } = request.data || {};

    try {
        const db = admin.firestore();
        let query = db.collection('voxel_anomalies')
            .where('organizationId', '==', organizationId);

        if (status) {
            query = query.where('status', '==', status);
        }

        if (type) {
            query = query.where('type', '==', type);
        }

        if (severity) {
            query = query.where('severity', '==', severity);
        }

        query = query.orderBy('detectedAt', 'desc').limit(queryLimit);

        const snap = await query.get();
        const anomalies = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            detectedAt: doc.data().detectedAt?.toDate?.()?.toISOString() || null
        }));

        return {
            success: true,
            anomalies,
            count: anomalies.length
        };
    } catch (error) {
        logger.error("Failed to fetch anomalies:", error);
        throw new HttpsError('internal', 'An internal error occurred while fetching anomalies.');
    }
});

/**
 * Resolve or dismiss an anomaly
 */
exports.updateAnomalyStatus = onCall({
    region: "europe-west1",
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { anomalyId, status, reason } = request.data || {};

    if (!anomalyId || !status) {
        throw new HttpsError('invalid-argument', 'Missing anomalyId or status.');
    }

    if (!['acknowledged', 'resolved', 'dismissed', 'ignored'].includes(status)) {
        throw new HttpsError('invalid-argument', 'Invalid status value.');
    }

    const organizationId = request.auth.token.organizationId;
    if (!organizationId) {
        throw new HttpsError('failed-precondition', 'User must belong to an organization.');
    }

    try {
        const db = admin.firestore();
        const anomalyRef = db.collection('voxel_anomalies').doc(anomalyId);
        const anomalySnap = await anomalyRef.get();

        if (!anomalySnap.exists) {
            throw new HttpsError('not-found', 'Anomaly not found.');
        }

        const anomalyData = anomalySnap.data();
        if (anomalyData.organizationId !== organizationId) {
            throw new HttpsError('permission-denied', 'Cannot modify anomaly from another organization.');
        }

        const updateData = {
            status,
            resolvedBy: request.auth.uid,
            resolvedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (reason) {
            updateData.dismissalReason = reason;
        }

        await anomalyRef.update(updateData);

        logger.info(`Anomaly ${anomalyId} updated to ${status} by ${request.auth.uid}`);

        return { success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.error("Failed to update anomaly:", error);
        throw new HttpsError('internal', 'An internal error occurred while updating anomaly.');
    }
});

/**
 * Story 29.5: Remediate Anomalies - Convert Anomaly to Incident
 * Bridges the gap between Voxel detection and GRC remediation
 */
exports.convertAnomalyToIncident = onCall({
    memory: '512MiB',
    region: 'europe-west1',
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { anomalyId, title, severity: overrideSeverity } = request.data || {};

    if (!anomalyId) {
        throw new HttpsError('invalid-argument', 'Missing anomalyId.');
    }

    const organizationId = request.auth.token.organizationId;
    if (!organizationId) {
        throw new HttpsError('failed-precondition', 'User must belong to an organization.');
    }

    const db = admin.firestore();

    try {
        return await db.runTransaction(async (transaction) => {
            const anomalyRef = db.collection('voxel_anomalies').doc(anomalyId);
            const anomalySnap = await transaction.get(anomalyRef);

            if (!anomalySnap.exists) {
                throw new HttpsError('not-found', 'Anomaly not found.');
            }

            const anomaly = anomalySnap.data();
            if (anomaly.organizationId !== organizationId) {
                throw new HttpsError('permission-denied', 'Cannot access this anomaly.');
            }

            if (anomaly.status === 'resolved' || anomaly.incidentId) {
                throw new HttpsError('failed-precondition', 'Anomaly already handled.');
            }

            // Create new Incident
            const incidentRef = db.collection('incidents').doc();
            const incidentData = {
                title: title || `Remédiation: ${anomaly.message}`,
                description: `Incident généré automatiquement par Voxel Intelligence suite à la détection d'une anomalie.\n\nType: ${anomaly.type}\nMessage: ${anomaly.message}\nDétails: ${JSON.stringify(anomaly.details, null, 2)}`,
                severity: overrideSeverity || (anomaly.severity === 'critical' ? 'Critique' : anomaly.severity === 'high' ? 'Haute' : 'Moyenne'),
                status: 'Ouvert',
                category: 'Anomalie de Conformité',
                organizationId,
                reporter: request.auth.token.email || 'SYSTEM',
                dateReported: new Date().toISOString(),
                source: 'Voxel',
                relatedAnomalyId: anomalyId,
                affectedAssetId: anomaly.nodeId && anomaly.type !== 'stale_assessment' ? anomaly.nodeId : null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            transaction.set(incidentRef, incidentData);

            // Link Incident to Anomaly and mark as resolved/acknowledged
            transaction.update(anomalyRef, {
                status: 'resolved',
                incidentId: incidentRef.id,
                resolvedBy: request.auth.uid,
                resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
                remediationType: 'incident'
            });

            // Log action in Audit Trail
            const auditRef = db.collection('audit_logs').doc();
            transaction.set(auditRef, {
                organizationId,
                userId: request.auth.uid,
                userEmail: request.auth.token.email || '',
                action: 'CREATE',
                resource: 'Incident',
                details: `Incident ${incidentRef.id} created from anomaly ${anomalyId}`,
                metadata: { anomalyId, incidentId: incidentRef.id },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                source: 'voxel_bridge'
            });

            return { success: true, incidentId: incidentRef.id };
        });
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.error("Failed to convert anomaly to incident:", error);
        throw new HttpsError('internal', 'An internal error occurred during remediation.');
    }
});

// Export helper functions for testing
module.exports = {
    scheduledAnomalyDetection: exports.scheduledAnomalyDetection,
    detectAnomaliesOnDemand: exports.detectAnomaliesOnDemand,
    getAnomalies: exports.getAnomalies,
    updateAnomalyStatus: exports.updateAnomalyStatus,
    convertAnomalyToIncident: exports.convertAnomalyToIncident,
    // Internal helpers for testing
    _internal: {
        detectOrphanControls,
        detectCoverageGaps,
        detectStaleAssessments,
        detectComplianceDrift,
        detectCircularDependencies,
        calculateSeverity,
        createAnomaly,
        runAnomalyDetection,
    }
};
