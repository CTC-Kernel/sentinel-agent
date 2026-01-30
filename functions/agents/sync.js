/**
 * Agent Synchronization Triggers
 * Handles automated actions when agents are created or updated
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const db = admin.firestore();

/**
 * Trigger: On Agent Created
 * Action: Generate corresponding Asset and perform Auto-Linking (CTC Engine)
 */
exports.onAgentCreated = onDocumentCreated(
    {
        document: "organizations/{organizationId}/agents/{agentId}",
        region: "europe-west1",
        memory: "256MiB",
        timeoutSeconds: 60,
    },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) {
            console.log("No data associated with the event");
            return;
        }

        const agentData = snapshot.data();
        const { organizationId, agentId } = event.params;
        const { hostname, ipAddress, os, osVersion, machineId } = agentData;

        console.log(`[CTC Engine] New Agent detected: ${agentId} (${hostname}). Starting hydration...`);

        try {
            // 1. Check if an Asset already exists for this machine (deduplication)
            // We check by machineId first, then hostname
            let assetRef = null;
            let isNewAsset = false;

            const assetsCollection = db
                .collection("organizations")
                .doc(organizationId)
                .collection("assets");

            const existingByMachine = await assetsCollection
                .where("machineId", "==", machineId)
                .limit(1)
                .get();

            if (!existingByMachine.empty) {
                assetRef = existingByMachine.docs[0].ref;
                console.log(`[CTC Engine] Found existing asset by machineId: ${assetRef.id}`);
            } else {
                const existingByHostname = await assetsCollection
                    .where("name", "==", hostname)
                    .limit(1)
                    .get();

                if (!existingByHostname.empty) {
                    assetRef = existingByHostname.docs[0].ref;
                    console.log(`[CTC Engine] Found existing asset by hostname: ${assetRef.id}`);
                }
            }

            // 2. Create or Update Asset
            const assetData = {
                name: hostname,
                type: "Matériel", // Default to Hardware for Agents
                organizationId,
                ipAddress: ipAddress || null,
                status: "En service", // Active by default on enrollment
                lifecycleStatus: "En service",
                os: os,
                osVersion: osVersion,
                machineId: machineId,
                lastSeen: admin.firestore.FieldValue.serverTimestamp(),
                source: "Agent", // Traceability
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                // Default GRC Values if new
                confidentiality: "Moyen",
                integrity: "Moyen",
                availability: "Moyen",
                owner: "Système", // Default owner
            };

            if (!assetRef) {
                // Create new Asset in org-scoped collection
                const newAssetRef = assetsCollection.doc();
                await newAssetRef.set({
                    ...assetData,
                    id: newAssetRef.id,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    description: `Asset generated automatically from Agent Enrollment (${os} ${osVersion})`
                });
                assetRef = newAssetRef;
                isNewAsset = true;
                console.log(`[CTC Engine] Created new Asset: ${assetRef.id}`);
            } else {
                // Update existing Asset
                await assetRef.set(assetData, { merge: true });
                console.log(`[CTC Engine] Updated existing Asset: ${assetRef.id}`);
            }

            // Link asset to agent (set linkedAssetId for vulnerability/report correlation)
            await snapshot.ref.update({
                linkedAssetId: assetRef.id,
            });

            // 3. Auto-Linking (CTC Engine)
            // Only perform heavy auto-linking if it's a new asset or explicitly requested (future)
            if (isNewAsset) {
                await performAutoLinking(organizationId, assetRef.id, os, agentData);
            }

            // 4. Log Action
            await db.collection("system_logs").add({
                organizationId,
                type: "AUTO_SYNC",
                category: "ASSET",
                action: isNewAsset ? "CREATE" : "UPDATE",
                status: "SUCCESS",
                details: `Synced Agent ${hostname} to Asset ${assetRef.id}`,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                resourceId: assetRef.id,
                actor: "CTC-Engine"
            });

        } catch (error) {
            console.error(`[CTC Engine] Error syncing agent ${agentId}:`, error);
            // Log failure but don't retry endlessly (idempotency needed if retrying)
        }
    }
);

/**
 * Helper: Perform Auto-Linking Logic
 */
async function performAutoLinking(organizationId, assetId, os, agentData) {
    const batch = db.batch();
    let operationCount = 0;
    const MAX_BATCH_SIZE = 450;

    console.log(`[CTC Engine] Starting Auto-Linking for Asset ${assetId}...`);

    // A. Link Standard Controls based on OS
    // e.g. "Antivirus", "Patch Management", "Disk Encryption"
    const keywords = ["Antivirus", "Endpoint", "Protection", "Mise à jour", "Chiffrement"];

    // Find generic controls that match these keywords
    // Note: efficient querying requires full-text search (Algolia/Typesense) or exact matches.
    // Here we assume standard controls might exist with tags or predictable names.
    // We'll use a broad fetch logic purely for demonstration/MVP of CTC Engine.

    const controlsSnap = await db.collection("organizations")
        .doc(organizationId)
        .collection("controls")
        .where("scope", "array-contains", "Poste de travail")
        .limit(20)
        .get();

    // If we can't search by scope easily, we might just query all and filter in memory (bad for scale, okay for MVP)
    // or rely on predefined "Templates". 

    // Let's try to link to *any* Control that seems relevant to "Endpoint Security"
    if (!controlsSnap.empty) {
        controlsSnap.docs.forEach(doc => {
            const control = doc.data();
            // Simple keyword matching
            if (keywords.some(k => control.name?.includes(k) || control.description?.includes(k))) {
                batch.update(doc.ref, {
                    linkedAssetIds: admin.firestore.FieldValue.arrayUnion(assetId)
                });
                operationCount++;
            }
        });
    }

    // B. Link Standard Risks
    // e.g. "Malware", "Vol", "Perte"
    const riskKeywords = ["Malware", "Ransomware", "Vol", "Phishing"];
    const risksSnap = await db.collection("organizations")
        .doc(organizationId)
        .collection("risks")
        .limit(50)
        .get();

    if (!risksSnap.empty) {
        risksSnap.docs.forEach(doc => {
            const risk = doc.data();
            if (riskKeywords.some(k => risk.name?.includes(k))) {
                batch.update(doc.ref, {
                    affectedAssetIds: admin.firestore.FieldValue.arrayUnion(assetId)
                });
                operationCount++;
            }
        });
    }

    // C. Link to Policies (Documents)
    // e.g. "Charte informatique", "PSSI"
    const docKeywords = ["Charte", "PSSI", "Sécurité"];
    const docsSnap = await db.collection("organizations")
        .doc(organizationId)
        .collection("documents")
        .where("type", "==", "Politique")
        .limit(20)
        .get();

    if (!docsSnap.empty) {
        docsSnap.docs.forEach(doc => {
            const d = doc.data();
            if (docKeywords.some(k => d.title?.includes(k))) {
                batch.update(doc.ref, {
                    relatedAssetIds: admin.firestore.FieldValue.arrayUnion(assetId)
                });
                operationCount++;
            }
        });
    }

    // Commit if any operations
    if (operationCount > 0) {
        await batch.commit();
        console.log(`[CTC Engine] Auto-linked ${operationCount} items to Asset ${assetId}`);
    } else {
        console.log(`[CTC Engine] No auto-links found for Asset ${assetId}`);
    }
}

/**
 * Trigger: On Result Uploaded
 * Action: Update Asset Compliance & Create Vulnerabilities if failed
 */
exports.onResultUploaded = onDocumentCreated(
    {
        document: "organizations/{organizationId}/agents/{agentId}/results/{resultId}",
        region: "europe-west1",
        memory: "256MiB",
        timeoutSeconds: 60,
    },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;

        const resultData = snapshot.data();
        const { organizationId, agentId } = event.params;
        const { status, framework, controlId, hostname, machineId } = resultData;

        try {
            // 1. Find Asset (org-scoped collection)
            let assetRef = null;
            const orgAssetsCollection = db
                .collection("organizations")
                .doc(organizationId)
                .collection("assets");

            // Try by machineId first
            const assetSnap = await orgAssetsCollection
                .where("machineId", "==", machineId)
                .limit(1)
                .get();

            if (!assetSnap.empty) {
                assetRef = assetSnap.docs[0].ref;
            } else {
                // Fallback hostname
                const assetSnap2 = await orgAssetsCollection
                    .where("name", "==", hostname)
                    .limit(1)
                    .get();
                if (!assetSnap2.empty) assetRef = assetSnap2.docs[0].ref;
            }

            if (!assetRef) {
                console.warn(`[CTC Engine] Result uploaded for unknown asset (Agent: ${agentId})`);
                return;
            }

            // 2. Handle Failed Checks -> Vulnerability / Incident
            if (status === 'fail' || status === 'error') {
                // Check if Vulnerability already exists for this control/asset
                const vulnCollection = db
                    .collection("organizations")
                    .doc(organizationId)
                    .collection("vulnerabilities");

                const vulnSnap = await vulnCollection
                    .where("assetId", "==", assetRef.id)
                    .where("sourceId", "==", controlId)
                    .where("status", "==", "OPEN")
                    .limit(1)
                    .get();

                if (vulnSnap.empty) {
                    await vulnCollection.add({
                        organizationId,
                        assetId: assetRef.id,
                        title: `Compliance Failure: ${controlId}`,
                        description: `Agent ${hostname} failed check for ${controlId} (${framework})`,
                        severity: "MEDIUM",
                        status: "OPEN",
                        source: "AGENT_COMPLIANCE",
                        sourceId: controlId,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    console.log(`[CTC Engine] Created Vulnerability for Asset ${assetRef.id}`);
                }
            }

            // 3. Update Asset Compliance fields (Simple counter for now)
            // Ideally this aggregates via a scheduled function, but we can do simple flagging here
            if (status === 'fail') {
                await assetRef.update({
                    "complianceStatus": "Non conforme",
                    "lastComplianceCheck": admin.firestore.FieldValue.serverTimestamp()
                });
            }

        } catch (error) {
            console.error(`[CTC Engine] Error processing result for agent ${agentId}:`, error);
        }
    }
);
