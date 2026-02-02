/**
 * Agent Reports - Cloud Functions for report generation and scheduling
 *
 * Handles PDF/Excel generation, scheduled reports, and data aggregation.
 *
 * Sprint 10 - Reporting & RBAC
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { checkCallableRateLimit } = require('../utils/rateLimiter');

const db = admin.firestore();
const storage = admin.storage();

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Generate an agent report (PDF or Excel)
 */
exports.generateAgentReport = onCall(
  {
    region: 'europe-west1',
    memory: '1GiB',
    timeoutSeconds: 300,
  },
  async (request) => {
    const { auth } = request;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    // SECURITY (C5): Only trust organizationId from auth token, never from request data
    const organizationId = request.auth?.token?.organizationId;
    const { reportId, config } = request.data;

    if (!reportId || !organizationId || !config) {
      throw new HttpsError('invalid-argument', 'reportId, organizationId, and config are required');
    }

    checkCallableRateLimit(request, 'heavy');

    try {
      const startTime = Date.now();
      const reportRef = db
        .collection('organizations')
        .doc(organizationId)
        .collection('agentReports')
        .doc(reportId);

      // Update status to generating
      await reportRef.update({
        status: 'generating',
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Fetch report data based on type
      let reportData;
      switch (config.type) {
        case 'compliance':
          reportData = await fetchComplianceData(organizationId, config.filters, config.dateRange);
          break;
        case 'fleet_health':
          reportData = await fetchFleetHealthData(organizationId, config.filters, config.dateRange);
          break;
        case 'executive':
          reportData = await fetchExecutiveData(organizationId, config.dateRange);
          break;
        default:
          throw new HttpsError('invalid-argument', `Unknown report type: ${config.type}`);
      }

      // Generate file based on format
      let fileBuffer;
      let contentType;
      let fileName;

      switch (config.format) {
        case 'pdf':
          fileBuffer = await generatePDF(config, reportData);
          contentType = 'application/pdf';
          fileName = `${config.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
          break;
        case 'excel':
          fileBuffer = await generateExcel(config, reportData);
          contentType = 'text/csv';
          fileName = `${config.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
          break;
        case 'csv':
          fileBuffer = await generateCSV(config, reportData);
          contentType = 'text/csv';
          fileName = `${config.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
          break;
        case 'json':
          fileBuffer = Buffer.from(JSON.stringify(reportData, null, 2));
          contentType = 'application/json';
          fileName = `${config.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
          break;
        default:
          throw new HttpsError('invalid-argument', `Unknown format: ${config.format}`);
      }

      // Upload to Storage
      const bucket = storage.bucket();
      const filePath = `organizations/${organizationId}/reports/${reportId}/${fileName}`;
      const file = bucket.file(filePath);

      await file.save(fileBuffer, {
        contentType,
        metadata: {
          organizationId,
          reportId,
          reportType: config.type,
          generatedBy: auth.uid,
        },
      });

      // Get file metadata
      const [metadata] = await file.getMetadata();

      // Update report with file info
      await reportRef.update({
        status: 'completed',
        fileUrl: filePath,
        fileName,
        fileSize: parseInt(metadata.size, 10),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        durationMs: Date.now() - startTime,
        metadata: {
          agentCount: reportData.summary?.totalAgents || reportData.agentDetails?.length || 0,
          groupCount: reportData.byGroup?.length || 0,
          dateRange: config.dateRange,
        },
      });

      // Log audit entry
      await db
        .collection('organizations')
        .doc(organizationId)
        .collection('auditLogs')
        .add({
          type: 'report_generated',
          reportId,
          reportType: config.type,
          format: config.format,
          userId: auth.uid,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

      return { success: true, reportId, fileName };
    } catch (error) {
      logger.error('Generate report error:', { reportId, organizationId, error: error.message, stack: error.stack });

      // Update report with error - use generic message to avoid leaking internals
      await db
        .collection('organizations')
        .doc(organizationId)
        .collection('agentReports')
        .doc(reportId)
        .update({
          status: 'failed',
          errorMessage: 'Report generation failed. Check Cloud Functions logs for details.',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to generate report');
    }
  }
);

/**
 * Fetch compliance report data
 */
exports.fetchComplianceReportData = onCall(
  {
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    const { auth } = request;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    // SECURITY (C5): Only trust organizationId from auth token, never from request data
    const organizationId = request.auth?.token?.organizationId;
    const { filters, dateRange } = request.data;

    if (!organizationId) {
      throw new HttpsError('invalid-argument', 'organizationId is required');
    }

    checkCallableRateLimit(request, 'standard');

    // Role check: report data requires at least auditor role
    const userRole = request.auth?.token?.role;
    if (!userRole || !['admin', 'rssi', 'manager', 'auditor'].includes(userRole)) {
      throw new HttpsError('permission-denied', 'Insufficient permissions to access report data');
    }

    try {
      return await fetchComplianceData(organizationId, filters || {}, dateRange || {});
    } catch (error) {
      logger.error('Fetch compliance data error:', error);
      throw new HttpsError('internal', 'Failed to fetch compliance data');
    }
  }
);

/**
 * Fetch fleet health report data
 */
exports.fetchFleetHealthReportData = onCall(
  {
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    const { auth } = request;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    // SECURITY (C5): Only trust organizationId from auth token, never from request data
    const organizationId = request.auth?.token?.organizationId;
    const { filters, dateRange } = request.data;

    if (!organizationId) {
      throw new HttpsError('invalid-argument', 'organizationId is required');
    }

    checkCallableRateLimit(request, 'standard');

    const userRole2 = request.auth?.token?.role;
    if (!userRole2 || !['admin', 'rssi', 'manager', 'auditor'].includes(userRole2)) {
      throw new HttpsError('permission-denied', 'Insufficient permissions to access report data');
    }

    try {
      return await fetchFleetHealthData(organizationId, filters || {}, dateRange || {});
    } catch (error) {
      logger.error('Fetch fleet health data error:', error);
      throw new HttpsError('internal', 'Failed to fetch fleet health data');
    }
  }
);

/**
 * Fetch executive summary data
 */
exports.fetchExecutiveSummaryData = onCall(
  {
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    const { auth } = request;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    // SECURITY (C5): Only trust organizationId from auth token, never from request data
    const organizationId = request.auth?.token?.organizationId;
    const { dateRange } = request.data;

    if (!organizationId) {
      throw new HttpsError('invalid-argument', 'organizationId is required');
    }

    checkCallableRateLimit(request, 'standard');

    const userRole3 = request.auth?.token?.role;
    if (!userRole3 || !['admin', 'rssi', 'manager', 'auditor'].includes(userRole3)) {
      throw new HttpsError('permission-denied', 'Insufficient permissions to access report data');
    }

    try {
      return await fetchExecutiveData(organizationId, dateRange || {});
    } catch (error) {
      logger.error('Fetch executive data error:', error);
      throw new HttpsError('internal', 'Failed to fetch executive data');
    }
  }
);

// ============================================================================
// Scheduled Reports
// ============================================================================

/**
 * Process scheduled reports (runs every hour)
 */
exports.processScheduledReports = onSchedule(
  {
    schedule: 'every 1 hours',
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async () => {
    logger.info('Processing scheduled reports...');

    try {
      const now = new Date();

      // Get organizations (bounded to prevent runaway reads)
      const orgsSnapshot = await db.collection('organizations').limit(500).get();

      for (const orgDoc of orgsSnapshot.docs) {
        const organizationId = orgDoc.id;

        // Get due schedules
        const schedulesSnapshot = await db
          .collection('organizations')
          .doc(organizationId)
          .collection('reportSchedules')
          .where('isEnabled', '==', true)
          .where('nextRunAt', '<=', now.toISOString())
          .get();

        for (const scheduleDoc of schedulesSnapshot.docs) {
          const schedule = scheduleDoc.data();

          try {
            // Create report record
            const reportRef = await db
              .collection('organizations')
              .doc(organizationId)
              .collection('agentReports')
              .add({
                organizationId,
                type: schedule.config.type,
                name: `${schedule.name} - ${now.toLocaleDateString('fr-FR')}`,
                config: schedule.config,
                status: 'pending',
                format: schedule.config.format,
                generatedBy: 'system',
                scheduleId: scheduleDoc.id,
                startedAt: admin.firestore.FieldValue.serverTimestamp(),
                metadata: { agentCount: 0, groupCount: 0, dateRange: schedule.config.dateRange },
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                downloadCount: 0,
              });

            // Trigger report generation inline
            try {
              await generateReportContent(reportRef.id, organizationId, schedule.config);
            } catch (genError) {
              logger.error(`Report generation failed for ${reportRef.id}:`, { error: genError.message, stack: genError.stack });
              await reportRef.update({ status: 'failed', errorMessage: 'Report generation failed. Check Cloud Functions logs for details.' });
            }

            // Calculate next run
            const nextRun = calculateNextRunDate(schedule);

            // Update schedule
            await scheduleDoc.ref.update({
              lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
              lastRunStatus: 'pending',
              lastReportId: reportRef.id,
              nextRunAt: nextRun.toISOString(),
              runCount: admin.firestore.FieldValue.increment(1),
            });

            logger.info(`Scheduled report ${scheduleDoc.id} triggered for org ${organizationId}`);
          } catch (error) {
            logger.error(`Error processing schedule ${scheduleDoc.id}:`, error);

            await scheduleDoc.ref.update({
              lastRunStatus: 'failed',
              lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
      }

      logger.info('Scheduled reports processing completed');
    } catch (error) {
      logger.error('Process scheduled reports error:', error);
    }
  }
);

/**
 * Cleanup expired reports (runs daily at 2 AM)
 */
exports.cleanupExpiredReports = onSchedule(
  {
    schedule: '0 2 * * *',
    region: 'europe-west1',
    memory: '256MiB',
    timeoutSeconds: 300,
  },
  async () => {
    logger.info('Cleaning up expired reports...');

    try {
      const now = new Date().toISOString();
      const bucket = storage.bucket();

      // Get organizations (bounded to prevent runaway reads)
      const orgsSnapshot = await db.collection('organizations').limit(500).get();

      let totalDeleted = 0;

      for (const orgDoc of orgsSnapshot.docs) {
        const organizationId = orgDoc.id;

        // Get expired reports
        const expiredSnapshot = await db
          .collection('organizations')
          .doc(organizationId)
          .collection('agentReports')
          .where('expiresAt', '<=', now)
          .get();

        for (const reportDoc of expiredSnapshot.docs) {
          const report = reportDoc.data();

          // Delete file from storage
          if (report.fileUrl) {
            try {
              await bucket.file(report.fileUrl).delete();
            } catch (error) {
              // File may not exist
              logger.info(`File not found: ${report.fileUrl}`);
            }
          }

          // Delete report record
          await reportDoc.ref.delete();
          totalDeleted++;
        }
      }

      logger.info(`Cleaned up ${totalDeleted} expired reports`);
    } catch (error) {
      logger.error('Cleanup expired reports error:', error);
    }
  }
);

// ============================================================================
// Data Fetching Helpers
// ============================================================================

async function fetchComplianceData(organizationId, filters, dateRange) {
  // Get agents
  let agentsQuery = db
    .collection('organizations')
    .doc(organizationId)
    .collection('agents')
    .limit(1000);

  const agentsSnapshot = await agentsQuery.get();
  const agents = agentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  // Apply filters
  let filteredAgents = agents;
  if (filters.statuses?.length) {
    filteredAgents = filteredAgents.filter(a => filters.statuses.includes(a.status));
  }
  if (filters.osTypes?.length) {
    filteredAgents = filteredAgents.filter(a => filters.osTypes.includes(a.os));
  }

  // Get latest results for each agent (batched in chunks of 10 for parallelism)
  const agentResults = [];
  const limitedAgents = filteredAgents.slice(0, 100); // Limit for performance
  const CHUNK_SIZE = 10;

  for (let i = 0; i < limitedAgents.length; i += CHUNK_SIZE) {
    const chunk = limitedAgents.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(chunk.map(async (agent) => {
      const resultsSnapshot = await db
        .collection('organizations')
        .doc(organizationId)
        .collection('agents')
        .doc(agent.id)
        .collection('results')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!resultsSnapshot.empty) {
        return { agent, result: resultsSnapshot.docs[0].data() };
      }
      return null;
    }));
    agentResults.push(...chunkResults.filter(Boolean));
  }

  // Calculate summary
  const totalAgents = filteredAgents.length;
  const scores = agentResults.map(ar => ar.agent?.complianceScore || 0);
  const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const compliantAgents = scores.filter(s => s >= 80).length;
  const nonCompliantAgents = totalAgents - compliantAgents;

  // Score distribution
  const scoreDistribution = [
    { range: '90-100%', count: 0, percentage: 0 },
    { range: '80-89%', count: 0, percentage: 0 },
    { range: '70-79%', count: 0, percentage: 0 },
    { range: '60-69%', count: 0, percentage: 0 },
    { range: '0-59%', count: 0, percentage: 0 },
  ];

  scores.forEach(score => {
    if (score >= 90) scoreDistribution[0].count++;
    else if (score >= 80) scoreDistribution[1].count++;
    else if (score >= 70) scoreDistribution[2].count++;
    else if (score >= 60) scoreDistribution[3].count++;
    else scoreDistribution[4].count++;
  });

  scoreDistribution.forEach(d => {
    d.percentage = totalAgents > 0 ? (d.count / totalAgents) * 100 : 0;
  });

  // By OS
  const osCounts = {};
  filteredAgents.forEach(agent => {
    const os = agent.os || 'unknown';
    osCounts[os] = osCounts[os] || { count: 0, totalScore: 0 };
    osCounts[os].count++;
    const result = agentResults.find(ar => ar.agent.id === agent.id);
    if (result) {
      osCounts[os].totalScore += result.agent?.complianceScore || 0;
    }
  });

  const byOS = Object.entries(osCounts).map(([os, data]) => ({
    os,
    agentCount: data.count,
    averageScore: data.count > 0 ? data.totalScore / data.count : 0,
  }));

  // Agent details
  const agentDetails = agentResults.map(ar => ({
    agentId: ar.agent.id,
    hostname: ar.agent.hostname || ar.agent.name,
    os: ar.agent.os,
    score: ar.agent?.complianceScore || 0,
    status: (ar.agent?.complianceScore || 0) >= 80 ? 'compliant' : 'non_compliant',
    lastCheck: ar.result?.createdAt || ar.agent.lastSeen,
    issues: ar.result?.failedChecks?.length || 0,
  }));

  return {
    summary: {
      totalAgents,
      compliantAgents,
      nonCompliantAgents,
      averageScore,
      scoreChange: 0, // Would need historical data
      scoreChangePercent: 0,
    },
    scoreDistribution,
    byFramework: [], // Would need framework mapping
    byOS,
    topIssues: [], // Would need aggregation of failed checks
    trends: [], // Would need historical data
    agentDetails,
  };
}

async function fetchFleetHealthData(organizationId, filters, dateRange) {
  // Get agents
  const agentsSnapshot = await db
    .collection('organizations')
    .doc(organizationId)
    .collection('agents')
    .limit(1000)
    .get();

  const agents = agentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  // Calculate status distribution
  const statusCounts = { active: 0, offline: 0, pending: 0, error: 0 };
  agents.forEach(agent => {
    const status = agent.status || 'pending';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const totalAgents = agents.length;
  const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
    percentage: totalAgents > 0 ? (count / totalAgents) * 100 : 0,
  }));

  // OS distribution
  const osCounts = {};
  agents.forEach(agent => {
    const os = agent.os || 'unknown';
    osCounts[os] = (osCounts[os] || 0) + 1;
  });

  const osDistribution = Object.entries(osCounts).map(([os, count]) => ({
    os,
    count,
    percentage: totalAgents > 0 ? (count / totalAgents) * 100 : 0,
  }));

  // Version distribution
  const versionCounts = {};
  agents.forEach(agent => {
    const version = agent.version || 'unknown';
    versionCounts[version] = (versionCounts[version] || 0) + 1;
  });

  const versions = Object.keys(versionCounts).sort().reverse();
  const latestVersion = versions[0];

  const versionDistribution = versions.map(version => ({
    version,
    count: versionCounts[version],
    percentage: totalAgents > 0 ? (versionCounts[version] / totalAgents) * 100 : 0,
    isLatest: version === latestVersion,
  }));

  // Performance metrics (average from agent document fields)
  let avgCpu = 0, avgMemory = 0, avgDisk = 0;
  let metricsCount = 0;

  for (const agent of agents.slice(0, 50)) {
    if (typeof agent.cpuPercent === 'number' || typeof agent.memoryPercent === 'number' || typeof agent.diskPercent === 'number') {
      avgCpu += agent.cpuPercent || 0;
      avgMemory += agent.memoryPercent || 0;
      avgDisk += agent.diskPercent || 0;
      metricsCount++;
    }
  }

  if (metricsCount > 0) {
    avgCpu /= metricsCount;
    avgMemory /= metricsCount;
    avgDisk /= metricsCount;
  }

  // Get anomaly summary
  const anomaliesSnapshot = await db
    .collection('organizations')
    .doc(organizationId)
    .collection('agentAnomalies')
    .limit(1000)
    .get();

  const anomalies = anomaliesSnapshot.docs.map(d => d.data());
  const totalAnomalies = anomalies.length;
  const criticalAnomalies = anomalies.filter(a => a.severity === 'critical').length;
  const resolvedAnomalies = anomalies.filter(a => a.status === 'resolved').length;

  // Calculate MTTR (simplified)
  const resolvedWithTime = anomalies.filter(a => a.status === 'resolved' && a.resolvedAt && a.detectedAt);
  let avgResolutionTime = 0;
  if (resolvedWithTime.length > 0) {
    const totalTime = resolvedWithTime.reduce((sum, a) => {
      const detected = new Date(a.detectedAt).getTime();
      const resolved = new Date(a.resolvedAt).getTime();
      return sum + (resolved - detected);
    }, 0);
    avgResolutionTime = (totalTime / resolvedWithTime.length) / 60000; // Convert to minutes
  }

  return {
    summary: {
      totalAgents,
      activeAgents: statusCounts.active,
      offlineAgents: statusCounts.offline,
      healthyAgents: statusCounts.active, // Simplified
      unhealthyAgents: statusCounts.offline + statusCounts.error,
      averageUptime: statusCounts.active > 0 ? (statusCounts.active / totalAgents) * 100 : 0,
    },
    statusDistribution,
    osDistribution,
    versionDistribution,
    performanceMetrics: {
      avgCpuUsage: avgCpu,
      avgMemoryUsage: avgMemory,
      avgDiskUsage: avgDisk,
    },
    anomalySummary: {
      totalAnomalies,
      criticalAnomalies,
      resolvedAnomalies,
      avgResolutionTime,
    },
    uptimeData: [], // Would need historical data
    agentList: agents.slice(0, 100).map(agent => ({
      agentId: agent.id,
      hostname: agent.hostname || agent.name,
      os: agent.os,
      version: agent.version,
      status: agent.status,
      lastSeen: agent.lastSeen,
      uptime: 0,
      cpuUsage: agent.cpuPercent || 0,
      memoryUsage: agent.memoryPercent || 0,
    })),
  };
}

async function fetchExecutiveData(organizationId, dateRange) {
  // Get basic stats
  const [complianceData, healthData] = await Promise.all([
    fetchComplianceData(organizationId, {}, dateRange),
    fetchFleetHealthData(organizationId, {}, dateRange),
  ]);

  // Calculate overall score
  const overallScore = (complianceData.summary.averageScore + (healthData.summary.averageUptime || 0)) / 2;

  // Determine trend
  let scoreTrend = 'stable';
  if (complianceData.summary.scoreChange > 2) scoreTrend = 'improving';
  else if (complianceData.summary.scoreChange < -2) scoreTrend = 'declining';

  return {
    overallScore,
    scoreTrend,
    keyMetrics: [
      {
        name: 'Score de conformité',
        value: complianceData.summary.averageScore.toFixed(0),
        unit: '%',
        status: complianceData.summary.averageScore >= 80 ? 'good' : complianceData.summary.averageScore >= 60 ? 'warning' : 'critical',
      },
      {
        name: 'Agents actifs',
        value: healthData.summary.activeAgents,
        unit: `/ ${healthData.summary.totalAgents}`,
        status: healthData.summary.activeAgents === healthData.summary.totalAgents ? 'good' : 'warning',
      },
      {
        name: 'Anomalies critiques',
        value: healthData.anomalySummary.criticalAnomalies,
        status: healthData.anomalySummary.criticalAnomalies === 0 ? 'good' : 'critical',
      },
      {
        name: 'MTTR',
        value: healthData.anomalySummary.avgResolutionTime.toFixed(0),
        unit: 'min',
        status: healthData.anomalySummary.avgResolutionTime < 60 ? 'good' : 'warning',
      },
    ],
    highlights: [],
    recommendations: [],
    riskSummary: {
      critical: healthData.anomalySummary.criticalAnomalies,
      high: 0,
      medium: 0,
      low: 0,
    },
  };
}

// ============================================================================
// Report Generation Helpers
// ============================================================================

async function generatePDF(config, data) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Add title page
  let page = pdfDoc.addPage([595, 842]); // A4
  const { height } = page.getSize();

  // Title
  page.drawText(config.name, {
    x: 50,
    y: height - 100,
    size: 24,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Date
  page.drawText(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, {
    x: 50,
    y: height - 130,
    size: 12,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Summary section
  let yPos = height - 200;

  page.drawText('Résumé', {
    x: 50,
    y: yPos,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  yPos -= 30;

  if (data.summary) {
    const summaryItems = [
      `Total agents: ${data.summary.totalAgents || 0}`,
      `Score moyen: ${(data.summary.averageScore || 0).toFixed(1)}%`,
      `Agents conformes: ${data.summary.compliantAgents || data.summary.activeAgents || 0}`,
    ];

    for (const item of summaryItems) {
      page.drawText(item, {
        x: 70,
        y: yPos,
        size: 11,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPos -= 20;
    }
  }

  // Add more pages for details if needed
  if (data.agentDetails?.length > 0) {
    page = pdfDoc.addPage([595, 842]);
    yPos = height - 50;

    page.drawText('Détails des agents', {
      x: 50,
      y: yPos,
      size: 16,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    yPos -= 40;

    for (const agent of data.agentDetails.slice(0, 30)) {
      if (yPos < 100) {
        page = pdfDoc.addPage([595, 842]);
        yPos = height - 50;
      }

      page.drawText(`${agent.hostname || 'N/A'} - ${agent.os || 'N/A'} - Score: ${agent.score?.toFixed(0) || 0}%`, {
        x: 50,
        y: yPos,
        size: 10,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPos -= 15;
    }
  }

  return Buffer.from(await pdfDoc.save());
}

// NOTE: generateExcel actually produces CSV with semicolon delimiters (text/csv; charset=utf-8 with BOM)
async function generateExcel(config, data) {
  const BOM = '\uFEFF';
  const rows = [];

  if (data.agentDetails) {
    rows.push(['Hostname', 'OS', 'Score', 'Status', 'Dernier Check', 'Problemes'].join(';'));
    for (const agent of data.agentDetails) {
      rows.push([
        sanitizeCSVCell(agent.hostname || ''), sanitizeCSVCell(agent.os || ''),
        agent.score?.toFixed(1) || '0',
        sanitizeCSVCell(agent.status || ''), sanitizeCSVCell(agent.lastCheck || ''),
        agent.issues || '0',
      ].join(';'));
    }
  } else if (data.agentList) {
    rows.push(['Hostname', 'OS', 'Version', 'Status', 'Dernier Contact', 'CPU', 'Memoire'].join(';'));
    for (const agent of data.agentList) {
      rows.push([
        sanitizeCSVCell(agent.hostname || ''), sanitizeCSVCell(agent.os || ''),
        sanitizeCSVCell(agent.version || ''),
        sanitizeCSVCell(agent.status || ''), sanitizeCSVCell(agent.lastSeen || ''),
        `${agent.cpuUsage?.toFixed(1) || 0}%`, `${agent.memoryUsage?.toFixed(1) || 0}%`,
      ].join(';'));
    }
  }

  return Buffer.from(BOM + rows.join('\n'), 'utf-8');
}

// Sanitize CSV cell to prevent formula injection
function sanitizeCSVCell(value) {
  const str = String(value || '');
  // Prefix cells starting with formula characters to prevent CSV injection
  if (/^[=+\-@]/.test(str)) {
    return "'" + str;
  }
  return str;
}

async function generateCSV(config, data) {
  const rows = [];

  if (data.agentDetails) {
    rows.push('hostname,os,score,status,lastCheck,issues');

    for (const agent of data.agentDetails) {
      rows.push([
        `"${sanitizeCSVCell(agent.hostname)}"`,
        `"${sanitizeCSVCell(agent.os)}"`,
        agent.score?.toFixed(1) || '0',
        `"${sanitizeCSVCell(agent.status)}"`,
        `"${sanitizeCSVCell(agent.lastCheck)}"`,
        agent.issues || '0',
      ].join(','));
    }
  } else if (data.agentList) {
    rows.push('hostname,os,version,status,lastSeen,cpuUsage,memoryUsage');

    for (const agent of data.agentList) {
      rows.push([
        `"${sanitizeCSVCell(agent.hostname)}"`,
        `"${sanitizeCSVCell(agent.os)}"`,
        `"${sanitizeCSVCell(agent.version)}"`,
        `"${sanitizeCSVCell(agent.status)}"`,
        `"${sanitizeCSVCell(agent.lastSeen)}"`,
        agent.cpuUsage?.toFixed(1) || '0',
        agent.memoryUsage?.toFixed(1) || '0',
      ].join(','));
    }
  }

  return Buffer.from(rows.join('\n'), 'utf-8');
}

/**
 * Helper: Generate report content for a scheduled report
 */
async function generateReportContent(reportId, organizationId, config) {
  const reportRef = db
    .collection('organizations')
    .doc(organizationId)
    .collection('agentReports')
    .doc(reportId);

  await reportRef.update({ status: 'generating' });

  let reportData;
  switch (config.type) {
    case 'compliance':
      reportData = await fetchComplianceData(organizationId, config.filters || {}, config.dateRange || {});
      break;
    case 'fleet_health':
      reportData = await fetchFleetHealthData(organizationId, config.filters || {}, config.dateRange || {});
      break;
    case 'executive':
      reportData = await fetchExecutiveData(organizationId, config.dateRange || {});
      break;
    default:
      throw new Error(`Unknown report type: ${config.type}`);
  }

  let fileBuffer;
  let contentType;
  let fileName;

  switch (config.format) {
    case 'pdf':
      fileBuffer = await generatePDF(config, reportData);
      contentType = 'application/pdf';
      fileName = `${(config.name || 'report').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      break;
    case 'excel':
      fileBuffer = await generateExcel(config, reportData);
      contentType = 'text/csv; charset=utf-8';
      fileName = `${(config.name || 'report').replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
      break;
    case 'csv':
      fileBuffer = await generateCSV(config, reportData);
      contentType = 'text/csv; charset=utf-8';
      fileName = `${(config.name || 'report').replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
      break;
    default:
      fileBuffer = Buffer.from(JSON.stringify(reportData, null, 2));
      contentType = 'application/json';
      fileName = `${(config.name || 'report').replace(/[^a-zA-Z0-9]/g, '_')}.json`;
  }

  const bucket = storage.bucket();
  const filePath = `organizations/${organizationId}/reports/${reportId}/${fileName}`;
  const file = bucket.file(filePath);

  await file.save(fileBuffer, { contentType });
  const [metadata] = await file.getMetadata();

  await reportRef.update({
    status: 'completed',
    fileUrl: filePath,
    fileName,
    fileSize: parseInt(metadata.size, 10),
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    metadata: {
      agentCount: reportData.summary?.totalAgents || reportData.agentDetails?.length || 0,
      groupCount: reportData.byGroup?.length || 0,
      dateRange: config.dateRange,
    },
  });
}

function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function calculateNextRunDate(schedule) {
  const now = new Date();
  const next = new Date();

  next.setHours(schedule.hour || 0, schedule.minute || 0, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  switch (schedule.frequency) {
    case 'daily':
      break;

    case 'weekly': {
      let guard = 0;
      while (guard++ < 8 && next.getDay() !== schedule.dayOfWeek) {
        next.setDate(next.getDate() + 1);
      }
      break;
    }

    case 'monthly': {
      const targetDay = Math.min(schedule.dayOfMonth || 1, daysInMonth(next));
      next.setDate(targetDay);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
        next.setDate(Math.min(schedule.dayOfMonth || 1, daysInMonth(next)));
      }
      break;
    }

    case 'quarterly': {
      const quarterMonth = Math.floor(next.getMonth() / 3) * 3;
      next.setMonth(quarterMonth + 3);
      next.setDate(Math.min(schedule.dayOfMonth || 1, daysInMonth(next)));
      if (next <= now) {
        next.setMonth(next.getMonth() + 3);
        next.setDate(Math.min(schedule.dayOfMonth || 1, daysInMonth(next)));
      }
      break;
    }
  }

  return next;
}
