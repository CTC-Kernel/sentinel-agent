#!/usr/bin/env node
/**
 * Cleanup False Positive Incidents
 *
 * This script removes incidents that were caused by the process detection bug
 * where "contains" matching caused false positives (e.g., launchd matching "nc",
 * findmybeaconingd matching "beacon").
 *
 * Usage: node scripts/cleanup-false-positives.js
 */

import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// Known false positive patterns
// These are legitimate macOS/system processes that were incorrectly flagged
const FALSE_POSITIVE_PATTERNS = [
    // Processes containing "nc" but are legitimate
    'launchd',
    'launchservicesd',
    'audioclocksyncd',
    'syncdefaultsd',
    'CMFSyncAgent',
    'NetworkExtension',
    'NotificationCenter',
    'imklaunchagent',
    'exchangesyncd',
    'avconferenced',
    'InferenceProviderService',
    'SyncService',
    'SiriNCService',
    'CallHistorySyncHelper',
    'SimLaunchHost',
    'postersyncd',
    'siriinferenced',
    'transparencyd',
    'ProtectedCloudKeySyncing',
    'intelligencecontextd',
    'AquaAppearanceHelper',
    'generativeexperiencesd',

    // Processes containing "beacon" but are legitimate
    'findmybeaconingd',

    // Processes containing "empire" but are legitimate
    // (none currently known)
];

async function cleanupFalsePositives() {
    console.log('Starting false positive cleanup...\n');

    // Get all organizations
    const orgsSnapshot = await db.collection('organizations').get();

    let totalDeleted = 0;
    let totalAlertDeleted = 0;

    for (const orgDoc of orgsSnapshot.docs) {
        const orgId = orgDoc.id;
        console.log(`Processing organization: ${orgId}`);

        // Find agent-sourced incidents
        const incidentsRef = db
            .collection('organizations')
            .doc(orgId)
            .collection('incidents');

        const incidentsSnapshot = await incidentsRef
            .where('source', '==', 'agent')
            .get();

        const batch = db.batch();
        let batchCount = 0;
        const incidentIdsToDelete = [];

        for (const incidentDoc of incidentsSnapshot.docs) {
            const incident = incidentDoc.data();
            const evidence = incident.evidence || {};
            const processName = evidence.process_name || '';

            // Check if this is a false positive
            const isFalsePositive = FALSE_POSITIVE_PATTERNS.some(pattern =>
                processName.toLowerCase().includes(pattern.toLowerCase())
            );

            if (isFalsePositive) {
                console.log(`  - Deleting false positive: ${incident.title} (${processName})`);
                batch.delete(incidentDoc.ref);
                incidentIdsToDelete.push(incidentDoc.id);
                batchCount++;
                totalDeleted++;

                // Firestore batches have a limit of 500 operations
                if (batchCount >= 400) {
                    await batch.commit();
                    console.log(`    Committed batch of ${batchCount} deletions`);
                    batchCount = 0;
                }
            }
        }

        // Also delete associated alerts
        if (incidentIdsToDelete.length > 0) {
            const alertsRef = db
                .collection('organizations')
                .doc(orgId)
                .collection('alerts');

            for (const incidentId of incidentIdsToDelete) {
                const alertsSnapshot = await alertsRef
                    .where('incidentId', '==', incidentId)
                    .get();

                for (const alertDoc of alertsSnapshot.docs) {
                    batch.delete(alertDoc.ref);
                    batchCount++;
                    totalAlertDeleted++;
                }
            }
        }

        // Commit remaining operations
        if (batchCount > 0) {
            await batch.commit();
            console.log(`    Committed final batch of ${batchCount} deletions`);
        }

        console.log(`  Deleted ${incidentIdsToDelete.length} false positive incidents`);
    }

    console.log(`\n========================================`);
    console.log(`Cleanup complete!`);
    console.log(`Total incidents deleted: ${totalDeleted}`);
    console.log(`Total alerts deleted: ${totalAlertDeleted}`);
    console.log(`========================================\n`);
}

// Run cleanup
cleanupFalsePositives()
    .then(() => {
        console.log('Done!');
        process.exit(0);
    })
    .catch(error => {
        console.error('Cleanup failed:', error);
        process.exit(1);
    });
