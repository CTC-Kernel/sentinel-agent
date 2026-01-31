/**
 * Anomaly Detection Cloud Functions
 *
 * Statistical anomaly detection for agent metrics,
 * baseline calculation, and alert generation.
 *
 * Sprint 8 - Anomaly Detection
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Escape special regex characters to prevent ReDoS attacks
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// Constants
// ============================================================================

const BASELINE_WINDOW_DAYS = 7;
const MIN_DATA_POINTS = 24; // Minimum 24 hours of data
const STDDEV_MULTIPLIER = 2; // Default anomaly threshold
const METRIC_TYPES = [
    'cpu_percent',
    'memory_percent',
    'disk_percent',
    'network_in_bytes',
    'network_out_bytes',
];

const ANOMALY_TYPES = {
    CPU_SPIKE: 'cpu_spike',
    MEMORY_SPIKE: 'memory_spike',
    DISK_SPIKE: 'disk_spike',
    NETWORK_SPIKE: 'network_spike',
    NEW_PROCESS: 'new_process',
    SUSPICIOUS_CONNECTION: 'suspicious_connection',
    COMPLIANCE_DROP: 'compliance_drop',
};

const SEVERITY_LEVELS = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
    INFO: 'info',
};

// ============================================================================
// Statistical Helpers
// ============================================================================

/**
 * Calculate mean of values
 */
function calculateMean(values) {
    if (!values || values.length === 0) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values) {
    const mean = calculateMean(values);
    if (mean === null) return null;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * Calculate percentile
 */
function calculatePercentile(values, percentile) {
    if (!values || values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    const fraction = index - lower;
    return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
}

/**
 * Calculate Z-score
 */
function calculateZScore(value, mean, stdDev) {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
}

/**
 * Get severity from deviation multiplier
 */
function getSeverityFromDeviation(deviation) {
    if (deviation >= 4) return SEVERITY_LEVELS.CRITICAL;
    if (deviation >= 3) return SEVERITY_LEVELS.HIGH;
    if (deviation >= 2) return SEVERITY_LEVELS.MEDIUM;
    if (deviation >= 1.5) return SEVERITY_LEVELS.LOW;
    return SEVERITY_LEVELS.INFO;
}

// ============================================================================
// Baseline Calculation
// ============================================================================

/**
 * Calculate baseline for a single metric
 */
function buildMetricBaseline(metric, values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mean = calculateMean(values) ?? 0;

    return {
        metric,
        mean,
        stdDev: calculateStdDev(values) ?? 0,
        min: sorted[0] || 0,
        max: sorted[sorted.length - 1] || 0,
        median: calculatePercentile(values, 50),
        p95: calculatePercentile(values, 95),
        p99: calculatePercentile(values, 99),
        dataPoints: values.length,
        lastUpdated: new Date().toISOString(),
    };
}

/**
 * Calculate hourly pattern for a metric
 */
function calculateHourlyPattern(metric, dataPoints) {
    // Group by hour
    const hourlyData = Array(24).fill(null).map(() => []);

    for (const point of dataPoints) {
        const hour = new Date(point.timestamp).getHours();
        if (point[metric] !== undefined) {
            hourlyData[hour].push(point[metric]);
        }
    }

    const hourlyMeans = hourlyData.map(values =>
        values.length > 0 ? (calculateMean(values) ?? 0) : 0
    );
    const hourlyStdDevs = hourlyData.map(values =>
        values.length > 0 ? (calculateStdDev(values) ?? 0) : 0
    );

    // Find peak and trough
    let peakHour = 0;
    let troughHour = 0;
    let maxMean = hourlyMeans[0];
    let minMean = hourlyMeans[0];

    for (let i = 1; i < 24; i++) {
        if (hourlyMeans[i] > maxMean) {
            maxMean = hourlyMeans[i];
            peakHour = i;
        }
        if (hourlyMeans[i] < minMean) {
            minMean = hourlyMeans[i];
            troughHour = i;
        }
    }

    // Pattern is significant if variance between hours is > 20%
    const filteredHourlyMeans = hourlyMeans.filter(v => v > 0);
    const overallMean = filteredHourlyMeans.length > 0 ? (calculateMean(filteredHourlyMeans) ?? 0) : 0;
    const isSignificant = overallMean > 0 && (maxMean - minMean) / overallMean > 0.2;

    return {
        metric,
        hourlyMeans,
        hourlyStdDevs,
        isSignificant,
        peakHour,
        troughHour,
    };
}

/**
 * Calculate weekly pattern for a metric
 */
function calculateWeeklyPattern(metric, dataPoints) {
    // Group by day of week (0 = Sunday)
    const dailyData = Array(7).fill(null).map(() => []);

    for (const point of dataPoints) {
        const day = new Date(point.timestamp).getDay();
        if (point[metric] !== undefined) {
            dailyData[day].push(point[metric]);
        }
    }

    const dailyMeans = dailyData.map(values =>
        values.length > 0 ? (calculateMean(values) ?? 0) : 0
    );
    const dailyStdDevs = dailyData.map(values =>
        values.length > 0 ? (calculateStdDev(values) ?? 0) : 0
    );

    // Find peak and trough
    let peakDay = 0;
    let troughDay = 0;
    let maxMean = dailyMeans[0];
    let minMean = dailyMeans[0];

    for (let i = 1; i < 7; i++) {
        if (dailyMeans[i] > maxMean) {
            maxMean = dailyMeans[i];
            peakDay = i;
        }
        if (dailyMeans[i] < minMean) {
            minMean = dailyMeans[i];
            troughDay = i;
        }
    }

    const filteredDailyMeans = dailyMeans.filter(v => v > 0);
    const overallMean = filteredDailyMeans.length > 0 ? (calculateMean(filteredDailyMeans) ?? 0) : 0;
    const isSignificant = overallMean > 0 && (maxMean - minMean) / overallMean > 0.15;

    return {
        metric,
        dailyMeans,
        dailyStdDevs,
        isSignificant,
        peakDay,
        troughDay,
    };
}

// ============================================================================
// Anomaly Detection Logic
// ============================================================================

/**
 * Detect metric anomalies for an agent
 */
function detectMetricAnomalies(agent, baseline, currentMetrics, thresholdConfig) {
    const anomalies = [];
    const now = new Date().toISOString();

    const metricMappings = {
        cpuPercent: { type: ANOMALY_TYPES.CPU_SPIKE, metric: 'cpu_percent', unit: '%' },
        memoryPercent: { type: ANOMALY_TYPES.MEMORY_SPIKE, metric: 'memory_percent', unit: '%' },
        diskPercent: { type: ANOMALY_TYPES.DISK_SPIKE, metric: 'disk_percent', unit: '%' },
        networkInBytes: { type: ANOMALY_TYPES.NETWORK_SPIKE, metric: 'network_in_bytes', unit: 'B/s' },
        networkOutBytes: { type: ANOMALY_TYPES.NETWORK_SPIKE, metric: 'network_out_bytes', unit: 'B/s' },
    };

    for (const [currentKey, mapping] of Object.entries(metricMappings)) {
        const currentValue = currentMetrics[currentKey];
        if (currentValue === undefined) continue;

        // Find baseline for this metric
        const metricBaseline = baseline.metrics.find(m => m.metric === mapping.metric);
        if (!metricBaseline || metricBaseline.dataPoints < MIN_DATA_POINTS) continue;

        // Get threshold config
        const thresholdMetric = thresholdConfig?.metricThresholds?.find(
            t => t.metric === mapping.metric && t.enabled
        );
        const multiplier = thresholdMetric?.stdDevMultiplier || STDDEV_MULTIPLIER;
        const absoluteThreshold = thresholdMetric?.absoluteThreshold;

        // Check for anomaly
        const deviation = Math.abs(calculateZScore(currentValue, metricBaseline.mean, metricBaseline.stdDev));
        const exceedsAbsolute = absoluteThreshold && currentValue > absoluteThreshold;

        if (deviation > multiplier || exceedsAbsolute) {
            const severity = getSeverityFromDeviation(deviation);

            anomalies.push({
                organizationId: agent.organizationId,
                agentId: agent.id,
                agentHostname: agent.hostname || agent.name,
                agentOS: agent.os,
                type: mapping.type,
                severity,
                status: 'new',
                title: `${mapping.type === ANOMALY_TYPES.CPU_SPIKE ? 'Pic CPU' :
                    mapping.type === ANOMALY_TYPES.MEMORY_SPIKE ? 'Pic Mémoire' :
                    mapping.type === ANOMALY_TYPES.DISK_SPIKE ? 'Pic Disque' :
                    'Pic Réseau'} détecté`,
                description: `${currentKey} à ${currentValue.toFixed(1)}${mapping.unit} (normale: ${metricBaseline.mean.toFixed(1)}${mapping.unit} ±${metricBaseline.stdDev.toFixed(1)})`,
                currentValue,
                baselineValue: metricBaseline.mean,
                baselineStdDev: metricBaseline.stdDev,
                deviationMultiplier: deviation,
                threshold: multiplier,
                unit: mapping.unit,
                context: {
                    metricsSnapshot: currentMetrics,
                },
                detectedAt: now,
                firstOccurrence: now,
                lastOccurrence: now,
                occurrenceCount: 1,
                relatedAnomalyIds: [],
                isCluster: false,
            });
        }
    }

    return anomalies;
}

/**
 * Detect new/suspicious processes
 */
function detectProcessAnomalies(agent, baseline, currentProcesses, thresholdConfig) {
    const anomalies = [];
    const now = new Date().toISOString();

    if (!thresholdConfig?.processDetection?.detectNewProcesses) {
        return anomalies;
    }

    const knownProcessNames = new Set(baseline.knownProcesses.map(p => p.name));
    const ignorePatterns = [];
    for (const p of (thresholdConfig.processDetection.ignorePatterns || [])) {
        try {
            if (p.length > 200) continue;
            ignorePatterns.push(new RegExp(escapeRegExp(p), 'i'));
        } catch (e) {
            logger.warn('Invalid regex pattern in anomaly config', { pattern: p });
            continue;
        }
    }
    const alertPatterns = [];
    for (const p of (thresholdConfig.processDetection.alertPatterns || [])) {
        try {
            if (p.length > 200) continue;
            alertPatterns.push(new RegExp(escapeRegExp(p), 'i'));
        } catch (e) {
            logger.warn('Invalid regex pattern in anomaly config', { pattern: p });
            continue;
        }
    }

    for (const process of currentProcesses) {
        // Skip if known
        if (knownProcessNames.has(process.name)) continue;

        // Skip if matches ignore pattern
        if (ignorePatterns.some(p => p.test(process.name))) continue;

        // Skip system processes if configured
        if (thresholdConfig.processDetection.ignoreSystemProcesses &&
            (process.user === 'SYSTEM' || process.user === 'root')) {
            continue;
        }

        // Check for suspicious patterns
        const isSuspicious = alertPatterns.some(p =>
            p.test(process.name) || p.test(process.commandLine || '')
        );

        anomalies.push({
            organizationId: agent.organizationId,
            agentId: agent.id,
            agentHostname: agent.hostname || agent.name,
            agentOS: agent.os,
            type: ANOMALY_TYPES.NEW_PROCESS,
            severity: isSuspicious ? SEVERITY_LEVELS.HIGH : SEVERITY_LEVELS.LOW,
            status: 'new',
            title: isSuspicious ? 'Processus suspect détecté' : 'Nouveau processus détecté',
            description: `Processus "${process.name}" non reconnu dans la baseline`,
            currentValue: 1,
            baselineValue: 0,
            baselineStdDev: 0,
            deviationMultiplier: 0,
            threshold: 0,
            unit: '',
            context: {
                processName: process.name,
                pid: process.pid,
                commandLine: process.commandLine,
                user: process.user,
                cpuPercent: process.cpuPercent,
                memoryBytes: process.memoryBytes,
            },
            detectedAt: now,
            firstOccurrence: now,
            lastOccurrence: now,
            occurrenceCount: 1,
            relatedAnomalyIds: [],
            isCluster: false,
        });
    }

    return anomalies;
}

/**
 * Detect suspicious connections
 */
function detectConnectionAnomalies(agent, baseline, currentConnections, thresholdConfig) {
    const anomalies = [];
    const now = new Date().toISOString();

    if (!thresholdConfig?.connectionDetection?.detectNewOutbound) {
        return anomalies;
    }

    const knownConnections = new Set(
        baseline.knownConnections.map(c => `${c.remotePattern}:${c.remotePort}`)
    );
    const trustedPatterns = [];
    for (const p of (thresholdConfig.connectionDetection.trustedPatterns || [])) {
        try {
            if (p.length > 200) continue;
            trustedPatterns.push(new RegExp(escapeRegExp(p), 'i'));
        } catch (e) {
            logger.warn('Invalid regex pattern in anomaly config', { pattern: p });
            continue;
        }
    }
    const suspiciousPatterns = [];
    for (const p of (thresholdConfig.connectionDetection.suspiciousPatterns || [])) {
        try {
            if (p.length > 200) continue;
            suspiciousPatterns.push(new RegExp(escapeRegExp(p), 'i'));
        } catch (e) {
            logger.warn('Invalid regex pattern in anomaly config', { pattern: p });
            continue;
        }
    }
    const suspiciousPorts = new Set(thresholdConfig.connectionDetection.suspiciousPorts || []);

    for (const conn of currentConnections) {
        // Skip local connections if configured
        if (thresholdConfig.connectionDetection.ignoreLocal &&
            (conn.remoteAddress.startsWith('127.') ||
             conn.remoteAddress.startsWith('192.168.') ||
             conn.remoteAddress.startsWith('10.') ||
             conn.remoteAddress === '::1')) {
            continue;
        }

        const connKey = `${conn.remoteAddress}:${conn.remotePort}`;

        // Skip if known
        if (knownConnections.has(connKey)) continue;

        // Skip if trusted
        if (trustedPatterns.some(p => p.test(conn.remoteAddress))) continue;

        // Check if suspicious
        const isSuspiciousPattern = suspiciousPatterns.some(p => p.test(conn.remoteAddress));
        const isSuspiciousPort = suspiciousPorts.has(conn.remotePort);
        const isSuspicious = isSuspiciousPattern || isSuspiciousPort;

        anomalies.push({
            organizationId: agent.organizationId,
            agentId: agent.id,
            agentHostname: agent.hostname || agent.name,
            agentOS: agent.os,
            type: ANOMALY_TYPES.SUSPICIOUS_CONNECTION,
            severity: isSuspicious ? SEVERITY_LEVELS.HIGH : SEVERITY_LEVELS.LOW,
            status: 'new',
            title: isSuspicious ? 'Connexion suspecte détectée' : 'Nouvelle connexion détectée',
            description: `Connexion vers ${conn.remoteAddress}:${conn.remotePort} non reconnue`,
            currentValue: 1,
            baselineValue: 0,
            baselineStdDev: 0,
            deviationMultiplier: 0,
            threshold: 0,
            unit: '',
            context: {
                remoteAddress: conn.remoteAddress,
                remotePort: conn.remotePort,
                protocol: conn.protocol,
                processName: conn.processName,
                pid: conn.pid,
            },
            detectedAt: now,
            firstOccurrence: now,
            lastOccurrence: now,
            occurrenceCount: 1,
            relatedAnomalyIds: [],
            isCluster: false,
        });
    }

    return anomalies;
}

// ============================================================================
// Cloud Functions
// ============================================================================

/**
 * Recalculate baseline for a specific agent
 */
exports.recalculateAgentBaseline = onCall({
    memory: '512MiB',
    timeoutSeconds: 120,
    region: 'europe-west1',
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { organizationId, agentId, window = '7d' } = request.data || {};

    if (!organizationId || !agentId) {
        throw new HttpsError('invalid-argument', 'organizationId and agentId are required.');
    }

    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    const userData = userDoc.data();
    if (!userData || userData.organizationId !== organizationId) {
        throw new HttpsError('permission-denied', 'Access denied to this organization');
    }

    try {
        // Get agent info
        const agentDoc = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('agents')
            .doc(agentId)
            .get();

        if (!agentDoc.exists) {
            throw new HttpsError('not-found', 'Agent not found.');
        }

        const agent = { id: agentDoc.id, ...agentDoc.data() };

        // Determine date range
        const windowDays = parseInt(window) || BASELINE_WINDOW_DAYS;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - windowDays);

        // Fetch metric history
        const metricsSnapshot = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('agents')
            .doc(agentId)
            .collection('metrics_history')
            .where('timestamp', '>=', startDate)
            .orderBy('timestamp', 'asc')
            .get();

        const dataPoints = metricsSnapshot.docs.map(doc => doc.data());

        if (dataPoints.length < MIN_DATA_POINTS) {
            logger.info(`Not enough data points for baseline: ${dataPoints.length} < ${MIN_DATA_POINTS}`);
            return { success: false, message: 'Insufficient data points' };
        }

        // Calculate metric baselines
        const metrics = METRIC_TYPES.map(metric => {
            const values = dataPoints
                .map(p => p[metric.replace(/_/g, '')])
                .filter(v => v !== undefined && v !== null);
            return buildMetricBaseline(metric, values);
        });

        // Calculate patterns
        const hourlyPatterns = METRIC_TYPES.map(metric =>
            calculateHourlyPattern(metric.replace(/_/g, ''), dataPoints)
        );

        const weeklyPatterns = METRIC_TYPES.map(metric =>
            calculateWeeklyPattern(metric.replace(/_/g, ''), dataPoints)
        );

        // Get known processes (from last 7 days of process snapshots)
        const processSnapshot = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('agentProcesses')
            .where('agentId', '==', agentId)
            .where('timestamp', '>=', startDate.toISOString())
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();

        const processMap = new Map();
        for (const doc of processSnapshot.docs) {
            const processes = doc.data().processes || [];
            for (const proc of processes) {
                if (processMap.has(proc.name)) {
                    const existing = processMap.get(proc.name);
                    existing.seenCount++;
                    existing.typicalCpu = (existing.typicalCpu + proc.cpuPercent) / 2;
                    existing.typicalMemory = (existing.typicalMemory + proc.memoryBytes) / 2;
                } else {
                    processMap.set(proc.name, {
                        name: proc.name,
                        typicalCpu: proc.cpuPercent || 0,
                        typicalMemory: proc.memoryBytes || 0,
                        firstSeen: doc.data().timestamp,
                        seenCount: 1,
                        isSystem: proc.user === 'SYSTEM' || proc.user === 'root',
                        isWhitelisted: false,
                    });
                }
            }
        }
        const knownProcesses = Array.from(processMap.values());

        // Get known connections
        const connectionSnapshot = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('agentConnections')
            .where('agentId', '==', agentId)
            .where('timestamp', '>=', startDate.toISOString())
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();

        const connectionMap = new Map();
        for (const doc of connectionSnapshot.docs) {
            const connections = doc.data().connections || [];
            for (const conn of connections) {
                if (conn.state !== 'ESTABLISHED') continue;
                const key = `${conn.remoteAddress}:${conn.remotePort}`;
                if (connectionMap.has(key)) {
                    connectionMap.get(key).seenCount++;
                } else {
                    connectionMap.set(key, {
                        remotePattern: conn.remoteAddress,
                        remotePort: conn.remotePort,
                        protocol: conn.protocol?.replace('6', '') || 'tcp',
                        processName: conn.processName,
                        firstSeen: doc.data().timestamp,
                        seenCount: 1,
                        isWhitelisted: false,
                    });
                }
            }
        }
        const knownConnections = Array.from(connectionMap.values());

        // Calculate stability score
        const avgDataPoints = calculateMean(metrics.map(m => m.dataPoints)) ?? 0;
        const stabilityScore = Math.min(100, Math.round((avgDataPoints / (windowDays * 24)) * 100));
        const isStable = stabilityScore >= 70;

        // Create or update baseline
        const now = new Date();
        const baselineData = {
            organizationId,
            agentId,
            agentHostname: agent.hostname || agent.name,
            window,
            metrics,
            hourlyPatterns,
            weeklyPatterns,
            knownProcesses,
            knownConnections,
            isStable,
            stabilityScore,
            minimumDataPoints: MIN_DATA_POINTS,
            currentDataPoints: dataPoints.length,
            calculationStarted: startDate.toISOString(),
            lastRecalculated: now.toISOString(),
            nextRecalculation: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        };

        // Check for existing baseline
        const existingBaseline = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('agentBaselines')
            .where('agentId', '==', agentId)
            .limit(1)
            .get();

        if (existingBaseline.empty) {
            await db
                .collection('organizations')
                .doc(organizationId)
                .collection('agentBaselines')
                .add(baselineData);
        } else {
            await existingBaseline.docs[0].ref.update(baselineData);
        }

        logger.info(`Baseline recalculated for agent ${agentId}`, {
            dataPoints: dataPoints.length,
            stabilityScore,
        });

        return { success: true, stabilityScore, dataPoints: dataPoints.length };
    } catch (error) {
        logger.error('Error recalculating baseline', error);
        throw new HttpsError('internal', 'Failed to recalculate baseline');
    }
});

/**
 * Run anomaly detection for agents
 */
exports.runAnomalyDetection = onCall({
    memory: '512MiB',
    timeoutSeconds: 300,
    region: 'europe-west1',
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { organizationId, agentIds } = request.data || {};

    if (!organizationId) {
        throw new HttpsError('invalid-argument', 'organizationId is required.');
    }

    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    const userData = userDoc.data();
    if (!userData || userData.organizationId !== organizationId) {
        throw new HttpsError('permission-denied', 'Access denied to this organization');
    }

    try {
        // Get threshold config
        const thresholdSnapshot = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('anomalyThresholds')
            .where('isDefault', '==', true)
            .limit(1)
            .get();

        const thresholdConfig = thresholdSnapshot.empty ? null : thresholdSnapshot.docs[0].data();

        // Get agents to scan
        let agentsQuery = db
            .collection('organizations')
            .doc(organizationId)
            .collection('agents')
            .where('status', '==', 'active');

        if (agentIds && agentIds.length > 0) {
            // Firestore doesn't support 'in' with more than 10 values
            const chunks = [];
            for (let i = 0; i < agentIds.length; i += 10) {
                chunks.push(agentIds.slice(i, i + 10));
            }

            let agents = [];
            for (const chunk of chunks) {
                const chunkSnapshot = await db
                    .collection('organizations')
                    .doc(organizationId)
                    .collection('agents')
                    .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
                    .get();
                agents.push(...chunkSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }

            // Process specific agents
            return await processAgentsForAnomalies(organizationId, agents, thresholdConfig);
        }

        const agentsSnapshot = await agentsQuery.get();
        const agents = agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return await processAgentsForAnomalies(organizationId, agents, thresholdConfig);
    } catch (error) {
        logger.error('Error running anomaly detection', error);
        throw new HttpsError('internal', 'Failed to run anomaly detection');
    }
});

/**
 * Process agents for anomalies
 */
async function processAgentsForAnomalies(organizationId, agents, thresholdConfig) {
    let totalAnomalies = 0;

    for (const agent of agents) {
        try {
            // Get baseline for this agent
            const baselineSnapshot = await db
                .collection('organizations')
                .doc(organizationId)
                .collection('agentBaselines')
                .where('agentId', '==', agent.id)
                .limit(1)
                .get();

            if (baselineSnapshot.empty) {
                logger.info(`No baseline for agent ${agent.id}, skipping`);
                continue;
            }

            const baseline = baselineSnapshot.docs[0].data();

            if (!baseline.isStable) {
                logger.info(`Baseline not stable for agent ${agent.id}, skipping`);
                continue;
            }

            // Get current metrics
            const currentMetrics = {
                cpuPercent: agent.cpuPercent,
                memoryPercent: agent.memoryPercent,
                diskPercent: agent.diskPercent,
            };

            // Detect metric anomalies
            const metricAnomalies = detectMetricAnomalies(agent, baseline, currentMetrics, thresholdConfig);

            // Get current processes if available
            const realtimeDoc = await db
                .collection('organizations')
                .doc(organizationId)
                .collection('agentRealtime')
                .doc(agent.id)
                .get();

            let processAnomalies = [];
            let connectionAnomalies = [];

            if (realtimeDoc.exists) {
                const realtimeData = realtimeDoc.data();

                if (realtimeData.processes) {
                    processAnomalies = detectProcessAnomalies(
                        agent, baseline, realtimeData.processes, thresholdConfig
                    );
                }

                if (realtimeData.connections) {
                    connectionAnomalies = detectConnectionAnomalies(
                        agent, baseline, realtimeData.connections, thresholdConfig
                    );
                }
            }

            const allAnomalies = [...metricAnomalies, ...processAnomalies, ...connectionAnomalies];

            // Save anomalies
            const batch = db.batch();
            for (const anomaly of allAnomalies) {
                const ref = db
                    .collection('organizations')
                    .doc(organizationId)
                    .collection('agentAnomalies')
                    .doc();
                batch.set(ref, anomaly);
            }

            if (allAnomalies.length > 0) {
                await batch.commit();
                totalAnomalies += allAnomalies.length;
            }

        } catch (agentError) {
            logger.error(`Error processing agent ${agent.id}`, agentError);
        }
    }

    return { success: true, agentsProcessed: agents.length, anomaliesDetected: totalAnomalies };
}

/**
 * Scheduled anomaly detection (every 5 minutes)
 */
exports.scheduledAnomalyDetection = onSchedule({
    schedule: 'every 5 minutes',
    region: 'europe-west1',
    memory: '1GiB',
    timeoutSeconds: 540,
}, async () => {
    logger.info('Starting scheduled anomaly detection');

    try {
        // Get all organizations with agents (limited to prevent runaway)
        const orgsSnapshot = await db.collection('organizations').limit(100).get();
        if (orgsSnapshot.size >= 100) {
            logger.warn('scheduledAnomalyDetection: org query limit of 100 reached, some orgs may be skipped');
        }

        for (const orgDoc of orgsSnapshot.docs) {
            const organizationId = orgDoc.id;

            // Check if org has active agents
            const agentsSnapshot = await db
                .collection('organizations')
                .doc(organizationId)
                .collection('agents')
                .where('status', '==', 'active')
                .limit(1)
                .get();

            if (agentsSnapshot.empty) continue;

            // Get threshold config
            const thresholdSnapshot = await db
                .collection('organizations')
                .doc(organizationId)
                .collection('anomalyThresholds')
                .where('isDefault', '==', true)
                .limit(1)
                .get();

            const thresholdConfig = thresholdSnapshot.empty ? null : thresholdSnapshot.docs[0].data();

            // Get all active agents
            const allAgentsSnapshot = await db
                .collection('organizations')
                .doc(organizationId)
                .collection('agents')
                .where('status', '==', 'active')
                .get();

            const agents = allAgentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            await processAgentsForAnomalies(organizationId, agents, thresholdConfig);

            logger.info(`Processed ${agents.length} agents for org ${organizationId}`);
        }

        logger.info('Scheduled anomaly detection completed');
    } catch (error) {
        logger.error('Error in scheduled anomaly detection', error);
    }
});

/**
 * Daily baseline recalculation (at 3 AM)
 */
exports.dailyBaselineRecalculation = onSchedule({
    schedule: '0 3 * * *',
    timezone: 'Europe/Paris',
    region: 'europe-west1',
    memory: '1GiB',
    timeoutSeconds: 540,
}, async () => {
    logger.info('Starting daily baseline recalculation');

    try {
        const orgsSnapshot = await db.collection('organizations').limit(100).get();
        if (orgsSnapshot.size >= 100) {
            logger.warn('dailyBaselineRecalculation: org query limit of 100 reached, some orgs may be skipped');
        }

        for (const orgDoc of orgsSnapshot.docs) {
            const organizationId = orgDoc.id;

            // Get all agents
            const agentsSnapshot = await db
                .collection('organizations')
                .doc(organizationId)
                .collection('agents')
                .get();

            for (const agentDoc of agentsSnapshot.docs) {
                const agentId = agentDoc.id;

                try {
                    // Recalculate baseline
                    const agent = { id: agentId, ...agentDoc.data() };

                    // Get metric history
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - BASELINE_WINDOW_DAYS);

                    const metricsSnapshot = await db
                        .collection('organizations')
                        .doc(organizationId)
                        .collection('agents')
                        .doc(agentId)
                        .collection('metrics_history')
                        .where('timestamp', '>=', startDate)
                        .orderBy('timestamp', 'asc')
                        .get();

                    if (metricsSnapshot.size >= MIN_DATA_POINTS) {
                        const dataPoints = metricsSnapshot.docs.map(doc => doc.data());

                        // Simplified baseline update
                        const metrics = METRIC_TYPES.map(metric => {
                            const key = metric.replace(/_/g, '');
                            const values = dataPoints
                                .map(p => p[key])
                                .filter(v => v !== undefined && v !== null);
                            return buildMetricBaseline(metric, values);
                        });

                        // Update baseline
                        const baselineQuery = await db
                            .collection('organizations')
                            .doc(organizationId)
                            .collection('agentBaselines')
                            .where('agentId', '==', agentId)
                            .limit(1)
                            .get();

                        if (!baselineQuery.empty) {
                            await baselineQuery.docs[0].ref.update({
                                metrics,
                                lastRecalculated: new Date().toISOString(),
                                currentDataPoints: dataPoints.length,
                            });
                        }
                    }
                } catch (agentError) {
                    logger.error(`Error recalculating baseline for agent ${agentId}`, agentError);
                }
            }
        }

        logger.info('Daily baseline recalculation completed');
    } catch (error) {
        logger.error('Error in daily baseline recalculation', error);
    }
});

/**
 * Update anomaly statistics (every hour)
 */
exports.updateAnomalyStats = onSchedule({
    schedule: 'every 1 hours',
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 120,
}, async () => {
    logger.info('Starting anomaly stats update');

    try {
        const orgsSnapshot = await db.collection('organizations').limit(100).get();
        if (orgsSnapshot.size >= 100) {
            logger.warn('updateAnomalyStats: org query limit of 100 reached, some orgs may be skipped');
        }

        for (const orgDoc of orgsSnapshot.docs) {
            const organizationId = orgDoc.id;

            // Get anomalies from last 30 days only
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const anomaliesSnapshot = await db
                .collection('organizations')
                .doc(organizationId)
                .collection('agentAnomalies')
                .where('detectedAt', '>=', thirtyDaysAgo.toISOString())
                .get();

            if (anomaliesSnapshot.empty) continue;

            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

            const stats = {
                totalAnomalies: anomaliesSnapshot.size,
                activeAnomalies: 0,
                byStatus: { new: 0, acknowledged: 0, investigating: 0, resolved: 0, false_positive: 0 },
                bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
                byType: {},
                last24h: 0,
                last7d: 0,
                trend: 'stable',
                meanTimeToAcknowledge: 0,
                meanTimeToResolve: 0,
                topAffectedAgents: [],
                calculatedAt: now.toISOString(),
            };

            const agentCounts = {};
            let totalAckTime = 0;
            let ackCount = 0;
            let totalResolveTime = 0;
            let resolveCount = 0;
            const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
            let previous24h = 0;

            for (const doc of anomaliesSnapshot.docs) {
                const anomaly = doc.data();

                // Count by status
                if (stats.byStatus[anomaly.status] !== undefined) {
                    stats.byStatus[anomaly.status]++;
                }

                // Count by severity
                if (stats.bySeverity[anomaly.severity] !== undefined) {
                    stats.bySeverity[anomaly.severity]++;
                }

                // Count by type
                stats.byType[anomaly.type] = (stats.byType[anomaly.type] || 0) + 1;

                // Count active
                if (['new', 'acknowledged', 'investigating'].includes(anomaly.status)) {
                    stats.activeAnomalies++;
                }

                // Time-based counts
                const detectedDate = new Date(anomaly.detectedAt);
                if (detectedDate >= yesterday) {
                    stats.last24h++;
                }
                if (detectedDate >= lastWeek) {
                    stats.last7d++;
                }
                if (detectedDate >= twoDaysAgo && detectedDate < yesterday) {
                    previous24h++;
                }

                // Agent counts
                agentCounts[anomaly.agentId] = agentCounts[anomaly.agentId] || {
                    hostname: anomaly.agentHostname,
                    count: 0,
                };
                agentCounts[anomaly.agentId].count++;

                // Time to acknowledge
                if (anomaly.acknowledgedAt) {
                    const ackTime = new Date(anomaly.acknowledgedAt).getTime() - detectedDate.getTime();
                    totalAckTime += ackTime;
                    ackCount++;
                }

                // Time to resolve
                if (anomaly.resolvedAt) {
                    const resolveTime = new Date(anomaly.resolvedAt).getTime() - detectedDate.getTime();
                    totalResolveTime += resolveTime;
                    resolveCount++;
                }
            }

            // Calculate mean times
            if (ackCount > 0) {
                stats.meanTimeToAcknowledge = totalAckTime / ackCount / (1000 * 60 * 60);
            }
            if (resolveCount > 0) {
                stats.meanTimeToResolve = totalResolveTime / resolveCount / (1000 * 60 * 60);
            }

            // Top affected agents
            stats.topAffectedAgents = Object.entries(agentCounts)
                .map(([agentId, data]) => ({
                    agentId,
                    hostname: data.hostname,
                    anomalyCount: data.count,
                }))
                .sort((a, b) => b.anomalyCount - a.anomalyCount)
                .slice(0, 5);

            // Calculate trend
            if (stats.last24h > previous24h * 1.2) {
                stats.trend = 'increasing';
            } else if (stats.last24h < previous24h * 0.8) {
                stats.trend = 'decreasing';
            }

            // Save stats
            await db
                .collection('organizations')
                .doc(organizationId)
                .collection('stats')
                .doc('agentAnomalies')
                .set(stats);
        }

        logger.info('Anomaly stats update completed');
    } catch (error) {
        logger.error('Error updating anomaly stats', error);
    }
});
