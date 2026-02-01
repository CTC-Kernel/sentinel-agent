/**
 * CVE Enrichment Scheduled Function
 *
 * Daily enrichment of agent-discovered vulnerabilities with NVD and EPSS data.
 * Fetches CVE details from NVD API and EPSS scores from FIRST.
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

// Secrets
const nvdApiKey = defineSecret("NVD_API_KEY");

// H3: db initialized inside handlers to avoid module-level initialization issues
// const db = admin.firestore(); -- REMOVED

// NVD API configuration
const NVD_API_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const EPSS_API_BASE = 'https://api.first.org/data/v1/epss';

// Rate limiting - NVD allows 5 requests per 30 seconds for public API
const NVD_RATE_LIMIT_MS = 6500; // 6.5 seconds between requests
const BATCH_SIZE = 50; // Process 50 CVEs per run

/**
 * Fetch CVE data from NVD API
 */
async function fetchNvdData(cveId) {
    try {
        const response = await fetch(`${NVD_API_BASE}?cveId=${cveId}`, {
            headers: {
                'Accept': 'application/json',
                // Add API key if available (increases rate limit)
                ...(nvdApiKey.value() && { 'apiKey': nvdApiKey.value() })
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                logger.warn(`CVE ${cveId} not found in NVD`);
                return null;
            }
            throw new Error(`NVD API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.vulnerabilities || data.vulnerabilities.length === 0) {
            return null;
        }

        const cve = data.vulnerabilities[0].cve;
        const metrics = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV30?.[0];

        return {
            cveId: cve.id,
            description: cve.descriptions?.find(d => d.lang === 'en')?.value || cve.descriptions?.[0]?.value || '',
            publishedDate: cve.published,
            lastModifiedDate: cve.lastModified,
            cvssV3: metrics ? {
                baseScore: metrics.cvssData.baseScore,
                baseSeverity: metrics.cvssData.baseSeverity.toLowerCase(),
                attackVector: metrics.cvssData.attackVector,
                attackComplexity: metrics.cvssData.attackComplexity,
                privilegesRequired: metrics.cvssData.privilegesRequired,
                userInteraction: metrics.cvssData.userInteraction,
                scope: metrics.cvssData.scope,
                confidentialityImpact: metrics.cvssData.confidentialityImpact,
                integrityImpact: metrics.cvssData.integrityImpact,
                availabilityImpact: metrics.cvssData.availabilityImpact,
                vectorString: metrics.cvssData.vectorString,
            } : null,
            cvssV2BaseScore: cve.metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore || null,
            cweIds: cve.weaknesses?.flatMap(w => w.description.map(d => d.value)) || [],
            affectedCpes: cve.configurations?.flatMap(c =>
                c.nodes?.flatMap(n =>
                    n.cpeMatch?.map(m => m.criteria) || []
                ) || []
            ) || [],
            references: cve.references?.map(r => ({
                url: r.url,
                source: r.source || 'unknown',
                tags: r.tags || [],
            })) || [],
            isKnownExploited: false, // Will be updated separately with KEV data
            hasVendorAdvisory: cve.references?.some(r => r.tags?.includes('Vendor Advisory')) || false,
            hasPatch: cve.references?.some(r => r.tags?.includes('Patch')) || false,
            enrichedAt: new Date().toISOString(),
        };
    } catch (error) {
        logger.error(`Error fetching NVD data for ${cveId}:`, error);
        return null;
    }
}

/**
 * Fetch EPSS scores for multiple CVEs
 */
async function fetchEpssData(cveIds) {
    try {
        // EPSS API accepts multiple CVEs in one request
        const cveList = cveIds.join(',');
        const response = await fetch(`${EPSS_API_BASE}?cve=${cveList}`, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`EPSS API error: ${response.status}`);
        }

        const data = await response.json();

        // Map results by CVE ID
        const epssMap = new Map();
        for (const item of data.data || []) {
            epssMap.set(item.cve, {
                probability: parseFloat(item.epss),
                percentile: parseFloat(item.percentile) * 100,
                calculatedAt: data.date || new Date().toISOString(),
                modelVersion: data.model_version || 'unknown',
            });
        }

        return epssMap;
    } catch (error) {
        logger.error('Error fetching EPSS data:', error);
        return new Map();
    }
}

/**
 * Fetch CISA Known Exploited Vulnerabilities (KEV) catalog
 */
async function fetchKevData() {
    try {
        const response = await fetch('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`KEV API error: ${response.status}`);
        }

        const data = await response.json();
        const kevSet = new Set();
        const kevDueDates = new Map();

        for (const vuln of data.vulnerabilities || []) {
            kevSet.add(vuln.cveID);
            if (vuln.dueDate) {
                kevDueDates.set(vuln.cveID, vuln.dueDate);
            }
        }

        return { kevSet, kevDueDates };
    } catch (error) {
        logger.error('Error fetching KEV data:', error);
        return { kevSet: new Set(), kevDueDates: new Map() };
    }
}

/**
 * Calculate risk score combining CVSS, EPSS, and context
 */
function calculateRiskScore(cvssScore, epssProbability, affectedAgentCount, isKnownExploited) {
    // CVSS contribution (40% weight)
    const cvssContribution = (cvssScore / 10) * 40;

    // EPSS contribution (30% weight)
    const epssContribution = epssProbability * 30;

    // Exposure contribution based on agent count (20% weight, max at 10 agents)
    const exposureContribution = Math.min(affectedAgentCount / 10, 1) * 20;

    // Known exploited bonus (10% weight)
    const exploitedContribution = isKnownExploited ? 10 : 0;

    return Math.min(100, Math.round(
        cvssContribution + epssContribution + exposureContribution + exploitedContribution
    ));
}

/**
 * Map CVSS score to severity
 */
function cvssToSeverity(score) {
    if (score >= 9.0) return 'Critique';
    if (score >= 7.0) return 'Élevé';
    if (score >= 4.0) return 'Moyen';
    return 'Faible';
}

/**
 * Daily CVE enrichment scheduled function
 * Runs at 3 AM UTC every day
 */
const dailyCveEnrichment = onSchedule({
    schedule: "0 3 * * *",
    memory: '512MiB',
    timeoutSeconds: 540, // 9 minutes
    region: 'europe-west1',
    secrets: [nvdApiKey],
}, async () => {
    logger.info("Starting daily CVE enrichment...");
    // H3: Initialize db inside handler
    const db = admin.firestore();

    try {
        // Fetch KEV data once for all orgs
        const { kevSet, kevDueDates } = await fetchKevData();
        logger.info(`Loaded ${kevSet.size} CVEs from KEV catalog`);

        // Get all organizations
        const orgsSnap = await db.collection('organizations').get();

        for (const orgDoc of orgsSnap.docs) {
            const organizationId = orgDoc.id;
            logger.info(`Processing organization: ${organizationId}`);

            // Get vulnerabilities that need enrichment
            // Priority: no NVD data > stale data (>7 days old)
            const vulnsRef = db
                .collection('organizations')
                .doc(organizationId)
                .collection('agentVulnerabilities');

            // First, get vulnerabilities without NVD data
            let vulnsToEnrich = await vulnsRef
                .where('nvdData', '==', null)
                .limit(BATCH_SIZE)
                .get();

            // If we have capacity, also get stale entries
            if (vulnsToEnrich.size < BATCH_SIZE) {
                const staleDate = new Date();
                staleDate.setDate(staleDate.getDate() - 7);

                const staleSnap = await vulnsRef
                    .where('nvdData.enrichedAt', '<', staleDate.toISOString())
                    .limit(BATCH_SIZE - vulnsToEnrich.size)
                    .get();

                vulnsToEnrich = {
                    docs: [...vulnsToEnrich.docs, ...staleSnap.docs],
                    size: vulnsToEnrich.size + staleSnap.size,
                };
            }

            if (vulnsToEnrich.size === 0) {
                logger.info(`No vulnerabilities to enrich for ${organizationId}`);
                continue;
            }

            logger.info(`Enriching ${vulnsToEnrich.size} vulnerabilities for ${organizationId}`);

            // Collect all CVE IDs for bulk EPSS fetch
            const cveIds = vulnsToEnrich.docs
                .map(doc => doc.data().cveId)
                .filter(id => id && id.startsWith('CVE-'));

            // Fetch EPSS data in bulk
            const epssData = await fetchEpssData(cveIds);

            // Process each vulnerability (H2: chunked batches to stay under 500 limit)
            const BATCH_LIMIT = 450;
            let batch = db.batch();
            let batchOpCount = 0;
            let enrichedCount = 0;
            let errorCount = 0;

            for (const vulnDoc of vulnsToEnrich.docs) {
                const vulnData = vulnDoc.data();
                const cveId = vulnData.cveId;

                if (!cveId || !cveId.startsWith('CVE-')) {
                    continue;
                }

                try {
                    // Fetch NVD data with rate limiting
                    await new Promise(resolve => setTimeout(resolve, NVD_RATE_LIMIT_MS));
                    const nvdData = await fetchNvdData(cveId);

                    if (!nvdData) {
                        continue;
                    }

                    // Check if CVE is in KEV
                    nvdData.isKnownExploited = kevSet.has(cveId);
                    if (kevDueDates.has(cveId)) {
                        nvdData.kevDueDate = kevDueDates.get(cveId);
                    }

                    // Get EPSS data
                    const epss = epssData.get(cveId);

                    // Calculate risk score
                    const cvssScore = nvdData.cvssV3?.baseScore || 5;
                    const epssProbability = epss?.probability || 0;
                    const affectedAgentCount = vulnData.affectedAgentCount || 1;
                    const riskScore = calculateRiskScore(
                        cvssScore,
                        epssProbability,
                        affectedAgentCount,
                        nvdData.isKnownExploited
                    );

                    // Update vulnerability
                    const updateData = {
                        nvdData,
                        severity: cvssToSeverity(cvssScore),
                        score: cvssScore,
                        cvssVector: nvdData.cvssV3?.vectorString || null,
                        riskScore,
                        riskFactors: {
                            cvssContribution: Math.round((cvssScore / 10) * 40),
                            epssContribution: Math.round(epssProbability * 30),
                            exposureContribution: Math.round(Math.min(affectedAgentCount / 10, 1) * 20),
                            assetCriticalityContribution: nvdData.isKnownExploited ? 10 : 0,
                        },
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    };

                    if (epss) {
                        updateData.epssData = epss;
                    }

                    // Update description if we have a better one
                    if (nvdData.description && nvdData.description.length > 50) {
                        updateData.title = nvdData.description.substring(0, 100) +
                            (nvdData.description.length > 100 ? '...' : '');
                        updateData.description = nvdData.description;
                    }

                    // Add timeline event
                    const timeline = vulnData.timeline || [];
                    timeline.push({
                        id: `enrich-${Date.now()}`,
                        type: 'enriched',
                        timestamp: new Date().toISOString(),
                        description: `Enrichi avec données NVD (CVSS: ${cvssScore})${epss ? `, EPSS: ${(epssProbability * 100).toFixed(2)}%` : ''}`,
                    });
                    updateData.timeline = timeline;

                    batch.update(vulnDoc.ref, updateData);
                    batchOpCount++;
                    enrichedCount++;

                    // Create alert for newly discovered KEV
                    if (nvdData.isKnownExploited && !vulnData.nvdData?.isKnownExploited) {
                        const alertRef = db
                            .collection('organizations')
                            .doc(organizationId)
                            .collection('alerts')
                            .doc();

                        batch.set(alertRef, {
                            id: alertRef.id,
                            type: 'kev_vulnerability',
                            title: `Vulnérabilité activement exploitée: ${cveId}`,
                            message: `La vulnérabilité ${cveId} est dans le catalogue KEV de CISA. Remédiation urgente requise.`,
                            severity: 'Critique',
                            source: 'cve_enrichment',
                            vulnerabilityId: vulnDoc.id,
                            cveId,
                            kevDueDate: nvdData.kevDueDate || null,
                            read: false,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                        batchOpCount++;
                    }

                    // H2: Flush batch if approaching limit
                    if (batchOpCount >= BATCH_LIMIT) {
                        await batch.commit();
                        batch = db.batch();
                        batchOpCount = 0;
                    }

                } catch (error) {
                    logger.error(`Error enriching ${cveId}:`, error);
                    errorCount++;
                }
            }

            // Commit remaining batch
            if (batchOpCount > 0) {
                await batch.commit();
                logger.info(`Enriched ${enrichedCount} vulnerabilities for ${organizationId} (${errorCount} errors)`);
            }
        }

        logger.info("Daily CVE enrichment completed");

    } catch (error) {
        logger.error("Error in daily CVE enrichment:", error);
        throw error;
    }
});

/**
 * Update vulnerability correlations across agents
 * Runs at 4 AM UTC every day (after enrichment)
 */
const dailyVulnerabilityCorrelation = onSchedule({
    schedule: "0 4 * * *",
    memory: '512MiB',
    timeoutSeconds: 300,
    region: 'europe-west1',
}, async () => {
    logger.info("Starting vulnerability correlation update...");
    // H3: Initialize db inside handler
    const db = admin.firestore();

    try {
        const orgsSnap = await db.collection('organizations').get();

        for (const orgDoc of orgsSnap.docs) {
            const organizationId = orgDoc.id;

            // Get all agent vulnerabilities
            const vulnsSnap = await db
                .collection('organizations')
                .doc(organizationId)
                .collection('agentVulnerabilities')
                .get();

            if (vulnsSnap.empty) continue;

            // Group by CVE ID
            const vulnsByCve = new Map();
            for (const doc of vulnsSnap.docs) {
                const data = doc.data();
                const cveId = data.cveId;
                if (!cveId) continue;

                if (!vulnsByCve.has(cveId)) {
                    vulnsByCve.set(cveId, []);
                }
                vulnsByCve.get(cveId).push(data);
            }

            // Create/update correlation documents (H2: chunked batches)
            const correlationsRef = db
                .collection('organizations')
                .doc(organizationId)
                .collection('vulnerabilityCorrelations');

            const CORR_BATCH_LIMIT = 450;
            let batch = db.batch();
            let corrBatchCount = 0;

            for (const [cveId, vulns] of vulnsByCve.entries()) {
                const agentIds = new Set();
                const versions = new Map();
                let earliestDiscovery = new Date();

                for (const vuln of vulns) {
                    for (const agent of vuln.discoveringAgents || []) {
                        agentIds.add(agent.agentId);

                        for (const software of agent.affectedSoftware || []) {
                            const key = `${software.name}@${software.version}`;
                            versions.set(key, (versions.get(key) || 0) + 1);
                        }

                        if (agent.firstDiscovered) {
                            const discovered = new Date(agent.firstDiscovered);
                            if (discovered < earliestDiscovery) {
                                earliestDiscovery = discovered;
                            }
                        }
                    }
                }

                const primaryVuln = vulns[0];
                const correlation = {
                    affectedAgentCount: agentIds.size,
                    affectedAgentIds: Array.from(agentIds),
                    cvssScore: primaryVuln.nvdData?.cvssV3?.baseScore || 0,
                    epssProbability: primaryVuln.epssData?.probability || 0,
                    riskScore: primaryVuln.riskScore || 0,
                    affectedVersions: Array.from(versions.entries()).map(([key, count]) => {
                        const [software, version] = key.split('@');
                        return { software, version, agentCount: count };
                    }),
                    firstDiscovered: earliestDiscovery.toISOString(),
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                };

                batch.set(correlationsRef.doc(cveId), correlation, { merge: true });
                corrBatchCount++;

                // H2: Flush batch if approaching limit
                if (corrBatchCount >= CORR_BATCH_LIMIT) {
                    await batch.commit();
                    batch = db.batch();
                    corrBatchCount = 0;
                }
            }

            if (corrBatchCount > 0) {
                await batch.commit();
            }
            logger.info(`Updated ${vulnsByCve.size} correlations for ${organizationId}`);
        }

        logger.info("Vulnerability correlation update completed");

    } catch (error) {
        logger.error("Error in vulnerability correlation:", error);
        throw error;
    }
});

module.exports = {
    dailyCveEnrichment,
    dailyVulnerabilityCorrelation,
};
