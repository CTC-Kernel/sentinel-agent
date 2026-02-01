/**
 * Epic 31: Voxel Snapshots Cloud Functions
 *
 * Story 31.6: Daily Snapshots
 *
 * Captures daily snapshots of Voxel graph state for historical analysis.
 * Stores summary metrics (not full graph data) for time-machine functionality.
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

// Configuration
const SNAPSHOT_COLLECTION = 'voxel_snapshots';
const RETENTION_DAYS = 365;
const BATCH_SIZE = 500;

/**
 * Calculate risk level distribution
 */
const calculateRiskDistribution = (risks) => {
    const distribution = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: risks.length,
    };

    risks.forEach(risk => {
        const data = risk.data?.();
        const riskLevel = data?.riskLevel || data?.residualRiskLevel || 'low';
        if (distribution[riskLevel] !== undefined) {
            distribution[riskLevel]++;
        }
    });

    return distribution;
};

/**
 * Calculate anomaly statistics
 */
const calculateAnomalyStats = (anomalies) => {
    const stats = {
        total: anomalies.length,
        active: 0,
        acknowledged: 0,
        resolved: 0,
        dismissed: 0,
        bySeverity: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
        },
        byType: {},
    };

    anomalies.forEach(anomaly => {
        const data = anomaly.data?.();
        // Status counts
        if (data?.status === 'active') stats.active++;
        else if (data?.status === 'acknowledged') stats.acknowledged++;
        else if (data?.status === 'resolved') stats.resolved++;
        else if (data?.status === 'dismissed') stats.dismissed++;

        // Severity counts
        if (data?.severity && stats.bySeverity[data.severity] !== undefined) {
            stats.bySeverity[data.severity]++;
        }

        // Type counts
        if (data?.type) {
            stats.byType[data.type] = (stats.byType[data.type] || 0) + 1;
        }
    });

    return stats;
};

/**
 * Calculate compliance score summary
 */
const calculateComplianceMetrics = async (db, organizationId) => {
    try {
        const controlsRef = db.collection('controls').where('organizationId', '==', organizationId);
        const controlsSnap = await controlsRef.get();

        let totalControls = 0;
        let implementedControls = 0;
        let partialControls = 0;
        let notImplemented = 0;
        let effectivenessSum = 0;

        controlsSnap.forEach(doc => {
            const data = doc.data();
            totalControls++;

            if (data.status === 'Implémenté') {
                implementedControls++;
            } else if (data.status === 'Partiel' || data.status === 'En cours') {
                partialControls++;
            } else {
                notImplemented++;
            }

            if (typeof data.effectiveness === 'number') {
                effectivenessSum += data.effectiveness;
            }
        });

        return {
            totalControls,
            implementedControls,
            partialControls,
            notImplemented,
            implementationRate: totalControls > 0 ? Math.round((implementedControls / totalControls) * 100) : 0,
            averageEffectiveness: totalControls > 0 ? Math.round(effectivenessSum / totalControls) : 0,
        };
    } catch (error) {
        logger.error('Error calculating compliance metrics:', error);
        return null;
    }
};

/**
 * Create a snapshot for a single organization
 */
const createOrganizationSnapshot = async (db, organizationId, snapshotDate) => {
    try {
        // Fetch entity counts
        const collections = ['assets', 'risks', 'controls', 'incidents', 'suppliers', 'projects', 'audits'];
        const nodeCounts = {};

        for (const collection of collections) {
            const snap = await db.collection(collection)
                .where('organizationId', '==', organizationId)
                .count()
                .get();
            nodeCounts[collection.slice(0, -1)] = snap.data().count; // Remove 's' for node type
        }

        // Fetch edge counts (relationships)
        const edgeCounts = {
            riskToControl: 0,
            assetToRisk: 0,
            controlToAudit: 0,
        };

        // Count risk-control relationships
        const risksSnap = await db.collection('risks')
            .where('organizationId', '==', organizationId)
            .get();

        risksSnap.forEach(doc => {
            const data = doc.data();
            if (data.linkedControlIds?.length) {
                edgeCounts.riskToControl += data.linkedControlIds.length;
            }
            if (data.linkedAssetIds?.length) {
                edgeCounts.assetToRisk += data.linkedAssetIds.length;
            }
        });

        // Fetch anomalies
        const anomaliesSnap = await db.collection('voxel_anomalies')
            .where('organizationId', '==', organizationId)
            .get();

        const anomalyStats = calculateAnomalyStats(anomaliesSnap.docs);

        // Fetch risk distribution
        const riskDistribution = calculateRiskDistribution(risksSnap.docs);

        // Fetch compliance metrics
        const complianceMetrics = await calculateComplianceMetrics(db, organizationId);

        // Create snapshot document
        const snapshot = {
            organizationId,
            date: snapshotDate,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            metrics: {
                nodes: {
                    total: Object.values(nodeCounts).reduce((a, b) => a + b, 0),
                    byType: nodeCounts,
                },
                edges: {
                    total: Object.values(edgeCounts).reduce((a, b) => a + b, 0),
                    byType: edgeCounts,
                },
                anomalies: anomalyStats,
                risks: riskDistribution,
                compliance: complianceMetrics,
            },
        };

        // Store snapshot
        const snapshotId = `${organizationId}_${snapshotDate}`;
        await db.collection(SNAPSHOT_COLLECTION).doc(snapshotId).set(snapshot);

        logger.info(`Created snapshot for organization ${organizationId} on ${snapshotDate}`);
        return snapshot;
    } catch (error) {
        logger.error(`Error creating snapshot for organization ${organizationId}:`, error);
        throw error;
    }
};

/**
 * Scheduled function: Run daily at midnight UTC
 */
exports.scheduledVoxelSnapshot = onSchedule({
    schedule: "0 0 * * *", // Midnight UTC daily
    timeZone: "Europe/Paris",
    region: "europe-west1",
    memory: "512MiB",
    timeoutSeconds: 540,
}, async (event) => {
    const db = admin.firestore();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    logger.info(`Starting daily Voxel snapshot for ${today}`);

    try {
        // Get all organizations
        const orgsSnap = await db.collection('organizations').get();
        const organizations = orgsSnap.docs.map(doc => doc.id);

        logger.info(`Processing ${organizations.length} organizations`);

        let successCount = 0;
        let errorCount = 0;

        // Process organizations in batches
        for (let i = 0; i < organizations.length; i += BATCH_SIZE) {
            const batch = organizations.slice(i, i + BATCH_SIZE);
            const promises = batch.map(orgId =>
                createOrganizationSnapshot(db, orgId, today)
                    .then(() => successCount++)
                    .catch(() => errorCount++)
            );
            await Promise.all(promises);
        }

        logger.info(`Daily snapshot completed: ${successCount} successes, ${errorCount} errors`);

        // Clean up old snapshots (older than retention period)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];

        const oldSnapshots = await db.collection(SNAPSHOT_COLLECTION)
            .where('date', '<', cutoffStr)
            .limit(BATCH_SIZE)
            .get();

        if (!oldSnapshots.empty) {
            const deleteBatch = db.batch();
            oldSnapshots.docs.forEach(doc => deleteBatch.delete(doc.ref));
            await deleteBatch.commit();
            logger.info(`Deleted ${oldSnapshots.size} old snapshots`);
        }

        return { success: true, processed: successCount, errors: errorCount };
    } catch (error) {
        logger.error('Error in scheduled Voxel snapshot:', error);
        throw error;
    }
});

/**
 * Callable function: Create manual snapshot
 */
exports.createVoxelSnapshot = onCall({
    region: "europe-west1",
    memory: "256MiB",
}, async (request) => {
    const { auth, data } = request;

    if (!auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const db = admin.firestore();

    // Get organizationId from token
    const organizationId = request.auth.token.organizationId;
    if (!organizationId) {
        throw new HttpsError('failed-precondition', 'Organization ID not found in token');
    }

    const snapshotDate = data?.date || new Date().toISOString().split('T')[0];

    try {
        const snapshot = await createOrganizationSnapshot(db, organizationId, snapshotDate);
        return { success: true, snapshot };
    } catch (error) {
        logger.error('Error creating manual snapshot:', error);
        throw new HttpsError('internal', 'Failed to create snapshot');
    }
});

/**
 * Callable function: Get snapshots for an organization
 */
exports.getVoxelSnapshots = onCall({
    region: "europe-west1",
}, async (request) => {
    const { auth, data } = request;

    if (!auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const db = admin.firestore();

    // Get organizationId from token
    const organizationId = request.auth.token.organizationId;
    if (!organizationId) {
        throw new HttpsError('failed-precondition', 'Organization ID not found in token');
    }

    const { startDate, endDate, limit = 30 } = data || {};

    try {
        let query = db.collection(SNAPSHOT_COLLECTION)
            .where('organizationId', '==', organizationId)
            .orderBy('date', 'desc');

        if (startDate) {
            query = query.where('date', '>=', startDate);
        }
        if (endDate) {
            query = query.where('date', '<=', endDate);
        }

        query = query.limit(Math.min(limit, 365));

        const snapshotsSnap = await query.get();
        const snapshots = snapshotsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
        }));

        return { success: true, snapshots };
    } catch (error) {
        logger.error('Error fetching snapshots:', error);
        throw new HttpsError('internal', 'Failed to fetch snapshots');
    }
});

/**
 * Callable function: Get a specific snapshot by date
 */
exports.getVoxelSnapshotByDate = onCall({
    region: "europe-west1",
}, async (request) => {
    const { auth, data } = request;

    if (!auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (!data?.date) {
        throw new HttpsError('invalid-argument', 'Date is required');
    }

    const db = admin.firestore();

    // Get organizationId from token
    const organizationId = request.auth.token.organizationId;
    if (!organizationId) {
        throw new HttpsError('failed-precondition', 'Organization ID not found in token');
    }

    const snapshotId = `${organizationId}_${data.date}`;

    try {
        const snapshotDoc = await db.collection(SNAPSHOT_COLLECTION).doc(snapshotId).get();

        if (!snapshotDoc.exists) {
            return { success: true, snapshot: null };
        }

        const snapshotData = snapshotDoc.data();
        return {
            success: true,
            snapshot: {
                id: snapshotDoc.id,
                ...snapshotData,
                createdAt: snapshotData.createdAt?.toDate?.()?.toISOString() || null,
            },
        };
    } catch (error) {
        logger.error('Error fetching snapshot by date:', error);
        throw new HttpsError('internal', 'Failed to fetch snapshot');
    }
});

/**
 * Callable function: Compare two snapshots
 */
exports.compareVoxelSnapshots = onCall({
    region: "europe-west1",
}, async (request) => {
    const { auth, data } = request;

    if (!auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (!data?.date1 || !data?.date2) {
        throw new HttpsError('invalid-argument', 'Both dates are required');
    }

    const db = admin.firestore();

    // Get organizationId from token
    const organizationId = request.auth.token.organizationId;
    if (!organizationId) {
        throw new HttpsError('failed-precondition', 'Organization ID not found in token');
    }

    try {
        const snapshot1Id = `${organizationId}_${data.date1}`;
        const snapshot2Id = `${organizationId}_${data.date2}`;

        const [snap1Doc, snap2Doc] = await Promise.all([
            db.collection(SNAPSHOT_COLLECTION).doc(snapshot1Id).get(),
            db.collection(SNAPSHOT_COLLECTION).doc(snapshot2Id).get(),
        ]);

        if (!snap1Doc.exists || !snap2Doc.exists) {
            throw new HttpsError('not-found', 'One or both snapshots not found');
        }

        const snap1 = snap1Doc.data();
        const snap2 = snap2Doc.data();

        // Calculate deltas
        const delta = {
            nodes: {
                total: snap2.metrics.nodes.total - snap1.metrics.nodes.total,
                byType: {},
            },
            edges: {
                total: snap2.metrics.edges.total - snap1.metrics.edges.total,
            },
            anomalies: {
                total: snap2.metrics.anomalies.total - snap1.metrics.anomalies.total,
                active: snap2.metrics.anomalies.active - snap1.metrics.anomalies.active,
            },
            compliance: snap2.metrics.compliance && snap1.metrics.compliance ? {
                implementationRate: snap2.metrics.compliance.implementationRate - snap1.metrics.compliance.implementationRate,
                averageEffectiveness: snap2.metrics.compliance.averageEffectiveness - snap1.metrics.compliance.averageEffectiveness,
            } : null,
        };

        // Calculate node type deltas
        const allNodeTypes = new Set([
            ...Object.keys(snap1.metrics.nodes.byType),
            ...Object.keys(snap2.metrics.nodes.byType),
        ]);

        allNodeTypes.forEach(type => {
            const val1 = snap1.metrics.nodes.byType[type] || 0;
            const val2 = snap2.metrics.nodes.byType[type] || 0;
            delta.nodes.byType[type] = val2 - val1;
        });

        return {
            success: true,
            snapshot1: { date: data.date1, metrics: snap1.metrics },
            snapshot2: { date: data.date2, metrics: snap2.metrics },
            delta,
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.error('Error comparing snapshots:', error);
        throw new HttpsError('internal', 'Failed to compare snapshots');
    }
});
