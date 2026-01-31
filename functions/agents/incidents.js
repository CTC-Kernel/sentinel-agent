/**
 * Incident Reporting API
 *
 * Handles security incident reports from Sentinel agents.
 * Creates entries in the incidents collection with agent as source.
 */

const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Map agent incident types to app incident categories.
 */
const INCIDENT_TYPE_MAPPING = {
    malware: 'Ransomware',
    suspicious_process: 'Autre',
    unauthorized_change: 'Autre',
    data_exfiltration: 'Fuite de Donn\u00e9es',
    crypto_miner: 'Ransomware',
    reverse_shell: 'Autre',
    credential_theft: 'Fuite de Donn\u00e9es',
    privilege_escalation: 'Autre',
    firewall_disabled: 'Autre',
    antivirus_disabled: 'Autre',
};

/**
 * Valid incident severities.
 */
const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low'];

/**
 * Valid incident types from agent.
 */
const VALID_INCIDENT_TYPES = Object.keys(INCIDENT_TYPE_MAPPING);

/**
 * Generate incident title from type and evidence.
 */
function generateIncidentTitle(incidentType, evidence) {
    const titles = {
        malware: `Malware detected: ${evidence?.file_name || evidence?.process_name || 'Unknown'}`,
        suspicious_process: `Suspicious process: ${evidence?.process_name || 'Unknown'}`,
        unauthorized_change: `Unauthorized system change: ${evidence?.change_type || 'Unknown'}`,
        data_exfiltration: `Potential data exfiltration: ${evidence?.destination || 'Unknown'}`,
        crypto_miner: `Crypto miner detected: ${evidence?.process_name || 'Unknown'}`,
        reverse_shell: `Reverse shell detected: ${evidence?.process_name || evidence?.remote_address || 'Unknown'}`,
        credential_theft: `Credential theft attempt: ${evidence?.tool_name || 'Unknown'}`,
        privilege_escalation: `Privilege escalation: ${evidence?.user || 'Unknown'}`,
        firewall_disabled: 'Firewall protection disabled',
        antivirus_disabled: 'Antivirus protection disabled',
    };
    return titles[incidentType] || `Security incident: ${incidentType}`;
}

/**
 * Handle incident report from agent.
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {string} agentId - Agent ID from route params
 * @param {Object} agentDoc - Agent Firestore document reference
 * @param {Object} agentData - Agent document data
 */
async function reportIncident(req, res, agentId, agentDoc, agentData) {
    try {
        const {
            incident_type,
            severity,
            title,
            description,
            evidence,
            confidence,
            detected_at,
        } = req.body;

        // Validate required fields
        if (!incident_type) {
            return res.status(400).json({ error: 'incident_type is required' });
        }

        // Validate incident type
        if (!VALID_INCIDENT_TYPES.includes(incident_type)) {
            return res.status(400).json({
                error: `Invalid incident_type. Must be one of: ${VALID_INCIDENT_TYPES.join(', ')}`,
            });
        }

        // Validate severity
        const incidentSeverity = severity?.toLowerCase() || 'medium';
        if (!VALID_SEVERITIES.includes(incidentSeverity)) {
            return res.status(400).json({
                error: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}`,
            });
        }

        // Validate confidence
        const incidentConfidence = typeof confidence === 'number' ? Math.min(100, Math.max(0, confidence)) : 50;

        const organizationId = agentData.organizationId;
        const batch = db.batch();

        // Map to app category
        const category = INCIDENT_TYPE_MAPPING[incident_type] || 'Autre';

        // Build incident data matching app Incident model
        const incidentsCollection = db
            .collection('organizations')
            .doc(organizationId)
            .collection('incidents');

        const incidentRef = incidentsCollection.doc();

        const incidentData = {
            id: incidentRef.id,

            // Core fields
            title: title || generateIncidentTitle(incident_type, evidence),
            description: description || `Security incident detected by agent on ${agentData.hostname}.`,
            severity: incidentSeverity,
            status: 'open',
            category,

            // Source tracking
            source: 'agent',
            reporter: 'SYSTEM (Agent)',
            agentId,
            hostname: agentData.hostname,
            machineId: agentData.machineId,
            assetId: agentData.linkedAssetId || null,

            // Agent-specific fields
            incidentType: incident_type,
            evidence: evidence || {},
            confidence: incidentConfidence,
            detectedAt: detected_at || new Date().toISOString(),

            // Standard fields
            organizationId,
            assignee: null,
            priority: incidentSeverity === 'critical' ? 1 : incidentSeverity === 'high' ? 2 : 3,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),

            // Timeline starts with detection
            timeline: [{
                action: 'detected',
                timestamp: detected_at || new Date().toISOString(),
                actor: 'SYSTEM (Agent)',
                details: `Detected by Sentinel Agent on ${agentData.hostname}`,
            }],
        };

        batch.set(incidentRef, incidentData);

        // Create alert for Critical/High incidents
        if (incidentSeverity === 'critical' || incidentSeverity === 'high') {
            const alertRef = db
                .collection('organizations')
                .doc(organizationId)
                .collection('alerts')
                .doc();

            batch.set(alertRef, {
                id: alertRef.id,
                type: 'security_incident',
                title: `${incidentSeverity} security incident: ${incidentData.title}`,
                message: `Agent ${agentData.hostname} detected a ${incidentSeverity.toLowerCase()} security incident: ${incident_type}`,
                severity: incidentSeverity,
                source: 'agent',
                agentId,
                incidentId: incidentRef.id,
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        // Update agent with last incident timestamp
        batch.update(agentDoc.ref, {
            lastIncidentAt: admin.firestore.FieldValue.serverTimestamp(),
            lastIncidentType: incident_type,
        });

        // Log audit entry
        const auditRef = db
            .collection('organizations')
            .doc(organizationId)
            .collection('auditLogs')
            .doc();

        batch.set(auditRef, {
            type: 'incident_created',
            action: 'create',
            resource: 'incident',
            resourceId: incidentRef.id,
            actor: 'SYSTEM (Agent)',
            agentId,
            hostname: agentData.hostname,
            details: {
                incident_type,
                severity: incidentSeverity,
                confidence: incidentConfidence,
            },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        await batch.commit();

        logger.info(`Agent ${agentId} reported incident: ${incident_type} (${incidentSeverity}) - ID: ${incidentRef.id}`);

        // Check if auto-playbook should be triggered
        const playbookTriggered = await checkAndTriggerPlaybook(
            organizationId,
            incidentRef.id,
            incident_type,
            incidentSeverity
        );

        return res.status(201).json({
            incident_id: incidentRef.id,
            acknowledged: true,
            category,
            playbook_triggered: playbookTriggered,
        });
    } catch (error) {
        logger.error('Report incident error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Check if automatic playbook should be triggered for this incident type.
 *
 * @param {string} organizationId - Organization ID
 * @param {string} incidentId - Created incident ID
 * @param {string} incidentType - Incident type
 * @param {string} severity - Incident severity
 * @returns {boolean} Whether a playbook was triggered
 */
async function checkAndTriggerPlaybook(organizationId, incidentId, incidentType, severity) {
    try {
        // Find matching playbook
        const playbooksQuery = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('playbooks')
            .where('enabled', '==', true)
            .where('triggers', 'array-contains', incidentType)
            .limit(1)
            .get();

        if (playbooksQuery.empty) {
            return false;
        }

        const playbook = playbooksQuery.docs[0];
        const playbookData = playbook.data();

        // Check severity threshold
        const severityOrder = ['critical', 'high', 'medium', 'low'];
        const playbookMinSeverity = (playbookData.minSeverity || 'low').toLowerCase();

        if (severityOrder.indexOf(severity) > severityOrder.indexOf(playbookMinSeverity)) {
            return false;
        }

        // Create playbook execution
        const executionRef = db
            .collection('organizations')
            .doc(organizationId)
            .collection('playbookExecutions')
            .doc();

        await executionRef.set({
            id: executionRef.id,
            playbookId: playbook.id,
            playbookName: playbookData.name,
            incidentId,
            incidentType,
            severity,
            status: 'pending',
            triggeredBy: 'agent',
            steps: playbookData.steps || [],
            currentStep: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        logger.info(`Triggered playbook ${playbookData.name} for incident ${incidentId}`);
        return true;
    } catch (error) {
        logger.warn('Failed to trigger playbook:', error);
        return false;
    }
}

module.exports = {
    reportIncident,
    INCIDENT_TYPE_MAPPING,
    VALID_SEVERITIES,
    VALID_INCIDENT_TYPES,
};
