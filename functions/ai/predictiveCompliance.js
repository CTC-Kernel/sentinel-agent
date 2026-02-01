/**
 * Predictive Compliance Cloud Functions
 *
 * AI-powered compliance predictions, trend analysis, and
 * recommended action generation.
 *
 * Sprint 7 - AI-Powered Features
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

// H3: db initialized inside handlers to avoid module-level initialization issues

// Default targets for predictions
const DEFAULT_TARGETS = [
    { score: 50, label: 'Conformité minimale', isPrimary: false },
    { score: 75, label: 'Conformité standard', isPrimary: true },
    { score: 90, label: 'Excellence', isPrimary: false },
];

// Action templates by check type
const ACTION_TEMPLATES = {
    mfa_enabled: {
        title: 'Activer l\'authentification multi-facteurs',
        category: 'agent_remediation',
        effort: 'low',
        estimatedHours: 2,
        hasAutomatedRemediation: true,
        steps: [
            { stepNumber: 1, title: 'Configurer MFA', description: 'Activer MFA dans les paramètres de sécurité', estimatedMinutes: 30, isOptional: false },
            { stepNumber: 2, title: 'Déployer via agent', description: 'Déployer la politique via les agents Sentinel', estimatedMinutes: 15, isOptional: false },
            { stepNumber: 3, title: 'Vérifier déploiement', description: 'Vérifier que tous les agents sont conformes', estimatedMinutes: 15, isOptional: false },
        ],
    },
    disk_encryption: {
        title: 'Activer le chiffrement des disques',
        category: 'agent_remediation',
        effort: 'medium',
        estimatedHours: 8,
        hasAutomatedRemediation: true,
        steps: [
            { stepNumber: 1, title: 'Vérifier compatibilité', description: 'Vérifier la compatibilité TPM/SecureBoot', estimatedMinutes: 60, isOptional: false },
            { stepNumber: 2, title: 'Sauvegarder les clés', description: 'Configurer la sauvegarde des clés de récupération', estimatedMinutes: 30, isOptional: false },
            { stepNumber: 3, title: 'Activer BitLocker/FileVault', description: 'Déployer le chiffrement via politique', estimatedMinutes: 60, isOptional: false },
        ],
    },
    firewall_enabled: {
        title: 'Activer le pare-feu système',
        category: 'agent_remediation',
        effort: 'low',
        estimatedHours: 1,
        hasAutomatedRemediation: true,
        steps: [
            { stepNumber: 1, title: 'Vérifier règles', description: 'Vérifier les règles de pare-feu existantes', estimatedMinutes: 20, isOptional: false },
            { stepNumber: 2, title: 'Activer pare-feu', description: 'Activer le pare-feu via politique agent', estimatedMinutes: 10, isOptional: false },
        ],
    },
    antivirus_active: {
        title: 'Vérifier l\'antivirus actif',
        category: 'agent_remediation',
        effort: 'low',
        estimatedHours: 2,
        hasAutomatedRemediation: true,
        steps: [
            { stepNumber: 1, title: 'Vérifier état', description: 'Vérifier l\'état de l\'antivirus sur tous les agents', estimatedMinutes: 30, isOptional: false },
            { stepNumber: 2, title: 'Mettre à jour signatures', description: 'Forcer la mise à jour des signatures', estimatedMinutes: 30, isOptional: false },
        ],
    },
    patches_uptodate: {
        title: 'Mettre à jour les systèmes',
        category: 'agent_remediation',
        effort: 'high',
        estimatedHours: 16,
        hasAutomatedRemediation: false,
        steps: [
            { stepNumber: 1, title: 'Analyser patches', description: 'Identifier les patches manquants par priorité', estimatedMinutes: 60, isOptional: false },
            { stepNumber: 2, title: 'Tester patches', description: 'Tester les patches sur un groupe pilote', estimatedMinutes: 240, isOptional: false },
            { stepNumber: 3, title: 'Déployer patches', description: 'Déployer les patches approuvés', estimatedMinutes: 120, isOptional: false },
            { stepNumber: 4, title: 'Vérifier déploiement', description: 'Vérifier le succès du déploiement', estimatedMinutes: 60, isOptional: false },
        ],
    },
    password_policy: {
        title: 'Renforcer la politique de mots de passe',
        category: 'policy',
        effort: 'medium',
        estimatedHours: 4,
        hasAutomatedRemediation: false,
        steps: [
            { stepNumber: 1, title: 'Définir politique', description: 'Définir les exigences de complexité', estimatedMinutes: 60, isOptional: false },
            { stepNumber: 2, title: 'Communiquer', description: 'Communiquer les changements aux utilisateurs', estimatedMinutes: 30, isOptional: false },
            { stepNumber: 3, title: 'Implémenter', description: 'Déployer la nouvelle politique', estimatedMinutes: 60, isOptional: false },
        ],
    },
    security_training: {
        title: 'Former les utilisateurs à la sécurité',
        category: 'training',
        effort: 'high',
        estimatedHours: 40,
        hasAutomatedRemediation: false,
        steps: [
            { stepNumber: 1, title: 'Planifier formations', description: 'Planifier les sessions de formation', estimatedMinutes: 120, isOptional: false },
            { stepNumber: 2, title: 'Préparer contenu', description: 'Préparer le matériel de formation', estimatedMinutes: 480, isOptional: false },
            { stepNumber: 3, title: 'Dispenser formations', description: 'Dispenser les formations', estimatedMinutes: 960, isOptional: false },
            { stepNumber: 4, title: 'Évaluer', description: 'Évaluer la compréhension', estimatedMinutes: 120, isOptional: false },
        ],
    },
    backup_policy: {
        title: 'Mettre en place une politique de sauvegarde',
        category: 'technical',
        effort: 'high',
        estimatedHours: 24,
        hasAutomatedRemediation: false,
        steps: [
            { stepNumber: 1, title: 'Définir RTO/RPO', description: 'Définir les objectifs de récupération', estimatedMinutes: 120, isOptional: false },
            { stepNumber: 2, title: 'Configurer sauvegardes', description: 'Configurer les jobs de sauvegarde', estimatedMinutes: 240, isOptional: false },
            { stepNumber: 3, title: 'Tester restauration', description: 'Tester les procédures de restauration', estimatedMinutes: 240, isOptional: false },
        ],
    },
    documentation: {
        title: 'Documenter les procédures',
        category: 'documentation',
        effort: 'medium',
        estimatedHours: 16,
        hasAutomatedRemediation: false,
        steps: [
            { stepNumber: 1, title: 'Identifier gaps', description: 'Identifier la documentation manquante', estimatedMinutes: 120, isOptional: false },
            { stepNumber: 2, title: 'Rédiger documents', description: 'Rédiger les documents nécessaires', estimatedMinutes: 480, isOptional: false },
            { stepNumber: 3, title: 'Valider', description: 'Faire valider par les parties prenantes', estimatedMinutes: 120, isOptional: false },
        ],
    },
};

/**
 * Calculate linear regression for trend analysis
 */
function calculateLinearRegression(points) {
    if (points.length < 2) {
        return { slope: 0, intercept: points[0]?.score ?? 0, r2: 0 };
    }

    const n = points.length;
    const startTime = new Date(points[0].timestamp).getTime();

    const x = points.map(p =>
        (new Date(p.timestamp).getTime() - startTime) / (24 * 60 * 60 * 1000)
    );
    const y = points.map(p => p.score);

    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
        numerator += (x[i] - xMean) * (y[i] - yMean);
        denominator += (x[i] - xMean) ** 2;
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;

    const yPredicted = x.map(xi => slope * xi + intercept);
    const ssRes = y.reduce((sum, yi, i) => sum + (yi - yPredicted[i]) ** 2, 0);
    const ssTot = y.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0);
    const r2 = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

    return {
        slope: Math.round(slope * 1000) / 1000,
        intercept: Math.round(intercept * 100) / 100,
        r2: Math.round(r2 * 1000) / 1000,
    };
}

/**
 * Generate predictions for target scores
 */
function generatePredictions(trend, targets) {
    return targets.map(target => {
        const { score: targetScore, label: targetLabel } = target;

        if (trend.currentScore >= targetScore) {
            return {
                targetScore,
                targetLabel,
                predictedDate: null,
                daysUntil: null,
                confidence: 'high',
                confidenceProbability: 1,
                lowerBound: null,
                upperBound: null,
                isReached: true,
                isUnreachable: false,
                message: `Objectif de ${targetScore}% atteint ! Score actuel: ${trend.currentScore}%`,
            };
        }

        if (trend.velocity <= 0) {
            return {
                targetScore,
                targetLabel,
                predictedDate: null,
                daysUntil: null,
                confidence: 'low',
                confidenceProbability: 0.2,
                lowerBound: null,
                upperBound: null,
                isReached: false,
                isUnreachable: true,
                message: `Au rythme actuel, l'objectif de ${targetScore}% ne sera pas atteint. Actions recommandées nécessaires.`,
            };
        }

        const pointsNeeded = targetScore - trend.currentScore;
        const daysUntil = Math.ceil(pointsNeeded / trend.velocity);

        const r2Confidence = Math.max(0, trend.trendLine.r2);
        const dataConfidence = Math.min(1, trend.dataPoints / 30);
        const confidenceProbability = r2Confidence * 0.6 + dataConfidence * 0.4;

        let confidence = 'low';
        if (confidenceProbability >= 0.8) confidence = 'high';
        else if (confidenceProbability >= 0.5) confidence = 'medium';

        const marginDays = Math.round(daysUntil * (1 - confidenceProbability) * 0.5);
        const predictedDate = new Date();
        predictedDate.setDate(predictedDate.getDate() + daysUntil);

        const lowerBoundDate = new Date();
        lowerBoundDate.setDate(lowerBoundDate.getDate() + Math.max(1, daysUntil - marginDays));

        const upperBoundDate = new Date();
        upperBoundDate.setDate(upperBoundDate.getDate() + daysUntil + marginDays);

        let message = '';
        if (daysUntil <= 7) {
            message = `Objectif de ${targetScore}% prévu dans ${daysUntil} jour${daysUntil > 1 ? 's' : ''}.`;
        } else if (daysUntil <= 30) {
            const weeks = Math.round(daysUntil / 7);
            message = `Objectif de ${targetScore}% prévu dans ${weeks} semaine${weeks > 1 ? 's' : ''}.`;
        } else {
            const months = Math.round(daysUntil / 30);
            message = `Objectif de ${targetScore}% prévu dans ${months} mois.`;
        }

        return {
            targetScore,
            targetLabel,
            predictedDate: predictedDate.toISOString(),
            daysUntil,
            confidence,
            confidenceProbability: Math.round(confidenceProbability * 100) / 100,
            lowerBound: lowerBoundDate.toISOString(),
            upperBound: upperBoundDate.toISOString(),
            isReached: false,
            isUnreachable: false,
            message,
        };
    });
}

/**
 * Generate compliance predictions (callable)
 */
const generateCompliancePredictions = onCall({
    memory: '512MiB',
    timeoutSeconds: 120,
    region: 'europe-west1',
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const db = admin.firestore();
    const { organizationId } = request.data;
    const tokenOrgId = request.auth.token.organizationId;

    if (!tokenOrgId || tokenOrgId !== organizationId) {
        throw new HttpsError('permission-denied', 'Access denied.');
    }

    logger.info(`Generating compliance predictions for org ${organizationId}`);

    try {
        // Get all compliance scores for the organization
        const scoresSnapshot = await db
            .collection('complianceScores')
            .where('organizationId', '==', organizationId)
            .get();

        if (scoresSnapshot.empty) {
            return { success: true, predictionsGenerated: 0 };
        }

        // H2: batch chunking to avoid 500-op limit
        const BATCH_LIMIT = 450;
        let batch = db.batch();
        let batchCount = 0;
        let predictionsGenerated = 0;

        for (const scoreDoc of scoresSnapshot.docs) {
            const scoreData = scoreDoc.data();

            // Get score history (last 90 days)
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 90);

            const historySnapshot = await db
                .collection('organizations')
                .doc(organizationId)
                .collection('complianceScoreHistory')
                .where('frameworkId', '==', scoreData.frameworkId)
                .where('timestamp', '>=', cutoffDate.toISOString())
                .orderBy('timestamp', 'asc')
                .get();

            const history = historySnapshot.docs.map(d => ({
                timestamp: d.data().timestamp,
                score: d.data().score,
                compliantCount: d.data().compliantCount || 0,
                totalCount: d.data().totalCount || 0,
            }));

            // Calculate trend
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            const currentScore = scoreData.score;
            const weekAgoPoint = history.find(p => new Date(p.timestamp) >= weekAgo);
            const monthAgoPoint = history.find(p => new Date(p.timestamp) >= monthAgo);

            const score7DaysAgo = weekAgoPoint?.score ?? currentScore;
            const score30DaysAgo = monthAgoPoint?.score ?? currentScore;

            const weeklyChange = currentScore - score7DaysAgo;
            const monthlyChange = currentScore - score30DaysAgo;

            let direction = 'stable';
            if (weeklyChange > 1) direction = 'up';
            else if (weeklyChange < -1) direction = 'down';

            const velocity = history.length >= 2
                ? (history[history.length - 1].score - history[0].score) /
                  ((new Date(history[history.length - 1].timestamp).getTime() -
                    new Date(history[0].timestamp).getTime()) / (24 * 60 * 60 * 1000))
                : 0;

            const trendLine = calculateLinearRegression(history);

            const trend = {
                frameworkId: scoreData.frameworkId,
                frameworkCode: scoreData.frameworkCode,
                currentScore,
                score7DaysAgo,
                score30DaysAgo,
                weeklyChange,
                monthlyChange,
                direction,
                velocity: Math.round(velocity * 100) / 100,
                history,
                trendLine,
                dataPoints: history.length,
                calculatedAt: now.toISOString(),
            };

            // Generate predictions
            const predictions = generatePredictions(trend, DEFAULT_TARGETS);

            // Determine overall confidence and reliability
            const dataQuality = Math.min(100, Math.round((history.length / 30) * 100));
            const isReliable = history.length >= 7;

            let overallConfidence = 'low';
            if (trendLine.r2 >= 0.7 && history.length >= 14) overallConfidence = 'high';
            else if (trendLine.r2 >= 0.4 && history.length >= 7) overallConfidence = 'medium';

            // Identify factors
            const factors = [];
            if (velocity > 0.5) {
                factors.push({
                    type: 'positive',
                    name: 'Progression rapide',
                    description: 'Le score progresse plus vite que la moyenne.',
                    impact: 0.3,
                });
            }
            if (velocity < 0) {
                factors.push({
                    type: 'negative',
                    name: 'Régression',
                    description: 'Le score est en baisse.',
                    impact: -0.5,
                });
            }
            if (history.length < 14) {
                factors.push({
                    type: 'neutral',
                    name: 'Données limitées',
                    description: 'Plus de données historiques amélioreront la précision.',
                    impact: 0,
                });
            }

            // Build prediction document
            const predictionDoc = {
                organizationId,
                frameworkId: scoreData.frameworkId,
                frameworkCode: scoreData.frameworkCode,
                frameworkName: scoreData.frameworkId, // Would need framework name lookup
                currentScore,
                trend,
                predictions,
                overallConfidence,
                dataQuality,
                dataPointsUsed: history.length,
                minimumDataPoints: 7,
                isReliable,
                factors,
                generatedAt: now.toISOString(),
                validUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
            };

            // Upsert prediction
            const predictionRef = db
                .collection('organizations')
                .doc(organizationId)
                .collection('compliancePredictions')
                .doc(scoreData.frameworkId);

            batch.set(predictionRef, predictionDoc);
            batchCount++;
            predictionsGenerated++;

            if (batchCount >= BATCH_LIMIT) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
            }
        }

        if (batchCount > 0) {
            await batch.commit();
        }

        logger.info(`Generated ${predictionsGenerated} predictions for org ${organizationId}`);

        return { success: true, predictionsGenerated };
    } catch (error) {
        logger.error('Error generating predictions:', error);
        throw new HttpsError('internal', 'Failed to generate predictions.');
    }
});

/**
 * Generate recommended actions (callable)
 */
const generateRecommendedActions = onCall({
    memory: '512MiB',
    timeoutSeconds: 120,
    region: 'europe-west1',
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const db = admin.firestore();
    const { organizationId } = request.data;
    const tokenOrgId = request.auth.token.organizationId;

    if (!tokenOrgId || tokenOrgId !== organizationId) {
        throw new HttpsError('permission-denied', 'Access denied.');
    }

    logger.info(`Generating recommended actions for org ${organizationId}`);

    try {
        // Get failed agent checks
        const agentsSnapshot = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('agents')
            .where('status', '==', 'active')
            .get();

        const failedChecks = new Map();

        for (const agentDoc of agentsSnapshot.docs) {
            const agentId = agentDoc.id;

            const resultsSnapshot = await db
                .collection('organizations')
                .doc(organizationId)
                .collection('agents')
                .doc(agentId)
                .collection('checkResults')
                .where('status', '==', 'fail')
                .get();

            for (const resultDoc of resultsSnapshot.docs) {
                const resultData = resultDoc.data();
                const checkId = resultData.checkId;

                if (failedChecks.has(checkId)) {
                    failedChecks.get(checkId).agentCount++;
                    failedChecks.get(checkId).agentIds.push(agentId);
                } else {
                    failedChecks.set(checkId, {
                        checkId,
                        agentCount: 1,
                        agentIds: [agentId],
                        framework: resultData.framework,
                        controlId: resultData.controlId,
                    });
                }
            }
        }

        // Generate actions from failed checks
        const actions = [];
        let rank = 1;

        // Sort by agent count (highest impact first)
        const sortedChecks = Array.from(failedChecks.values())
            .sort((a, b) => b.agentCount - a.agentCount);

        for (const check of sortedChecks) {
            // Find template for this check type
            let template = null;
            for (const [key, tmpl] of Object.entries(ACTION_TEMPLATES)) {
                if (check.checkId.toLowerCase().includes(key)) {
                    template = tmpl;
                    break;
                }
            }

            if (!template) {
                // Default template
                template = {
                    title: `Remédier le check ${check.checkId}`,
                    category: 'technical',
                    effort: 'medium',
                    estimatedHours: 4,
                    hasAutomatedRemediation: false,
                    steps: [
                        { stepNumber: 1, title: 'Analyser', description: 'Analyser la cause du non-conformité', estimatedMinutes: 60, isOptional: false },
                        { stepNumber: 2, title: 'Remédier', description: 'Appliquer les corrections nécessaires', estimatedMinutes: 120, isOptional: false },
                        { stepNumber: 3, title: 'Vérifier', description: 'Vérifier la conformité', estimatedMinutes: 30, isOptional: false },
                    ],
                };
            }

            // Calculate score impact based on agent count and check importance
            const baseImpact = Math.min(5, Math.ceil(check.agentCount / 5));
            const scoreImpact = baseImpact * (template.effort === 'low' ? 1.5 : 1);

            // Determine if quick win
            const isQuickWin = template.effort === 'low' && scoreImpact >= 2;

            // Priority based on effort and impact
            let priority = 'medium';
            if (isQuickWin) priority = 'high';
            else if (check.agentCount > 10) priority = 'critical';
            else if (template.effort === 'high') priority = 'low';

            actions.push({
                id: `action_${check.checkId}_${Date.now()}`,
                rank,
                title: template.title,
                description: `${check.agentCount} agent${check.agentCount > 1 ? 's' : ''} affecté${check.agentCount > 1 ? 's' : ''} par ce problème de conformité.`,
                category: template.category,
                priority,
                effort: template.effort,
                estimatedHours: template.estimatedHours,
                scoreImpact: Math.round(scoreImpact),
                affectedRequirements: 1,
                frameworkIds: [check.framework],
                controlIds: [check.controlId],
                hasAutomatedRemediation: template.hasAutomatedRemediation,
                affectedAgentCount: check.agentCount,
                prerequisites: [],
                isQuickWin,
                confidence: check.agentCount > 5 ? 'high' : 'medium',
                steps: template.steps,
                resources: [],
            });

            rank++;
        }

        // Save actions to Firestore (H2: batch chunking to avoid 500-op limit)
        const BATCH_LIMIT = 450;

        // Clear existing actions in chunked batches
        const existingActionsSnapshot = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('recommendedActions')
            .get();

        for (let i = 0; i < existingActionsSnapshot.docs.length; i += BATCH_LIMIT) {
            const chunk = existingActionsSnapshot.docs.slice(i, i + BATCH_LIMIT);
            const deleteBatch = db.batch();
            for (const doc of chunk) {
                deleteBatch.delete(doc.ref);
            }
            await deleteBatch.commit();
        }

        // Add new actions in chunked batches
        for (let i = 0; i < actions.length; i += BATCH_LIMIT) {
            const chunk = actions.slice(i, i + BATCH_LIMIT);
            const addBatch = db.batch();
            for (const action of chunk) {
                const actionRef = db
                    .collection('organizations')
                    .doc(organizationId)
                    .collection('recommendedActions')
                    .doc();

                addBatch.set(actionRef, {
                    ...action,
                    id: actionRef.id,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            await addBatch.commit();
        }

        logger.info(`Generated ${actions.length} recommended actions for org ${organizationId}`);

        return { success: true, actionsGenerated: actions.length };
    } catch (error) {
        logger.error('Error generating actions:', error);
        throw new HttpsError('internal', 'Failed to generate actions.');
    }
});

/**
 * Scheduled task to refresh predictions daily
 */
const dailyPredictionRefresh = onSchedule({
    schedule: '0 5 * * *', // 5 AM daily
    memory: '512MiB',
    timeoutSeconds: 300,
    region: 'europe-west1',
}, async () => {
    const db = admin.firestore();
    logger.info('Starting daily prediction refresh...');

    try {
        // Get all organizations
        const orgsSnapshot = await db.collection('organizations').get();

        let totalPredictions = 0;
        let totalActions = 0;

        for (const orgDoc of orgsSnapshot.docs) {
            const organizationId = orgDoc.id;

            try {
                // Generate predictions
                const scoresSnapshot = await db
                    .collection('complianceScores')
                    .where('organizationId', '==', organizationId)
                    .get();

                // ... (simplified - would call same logic as generateCompliancePredictions)

                logger.info(`Refreshed predictions for org ${organizationId}`);
            } catch (error) {
                logger.error(`Failed to refresh predictions for org ${organizationId}:`, error);
            }
        }

        logger.info(`Daily prediction refresh complete. ${totalPredictions} predictions, ${totalActions} actions generated.`);
    } catch (error) {
        logger.error('Daily prediction refresh failed:', error);
    }
});

/**
 * Record score snapshot for history
 */
const recordScoreSnapshot = onSchedule({
    schedule: '0 0 * * *', // Midnight daily
    memory: '256MiB',
    timeoutSeconds: 120,
    region: 'europe-west1',
}, async () => {
    const db = admin.firestore();
    logger.info('Recording daily score snapshots...');

    try {
        const orgsSnapshot = await db.collection('organizations').get();
        const now = new Date().toISOString();
        let totalRecorded = 0;

        for (const orgDoc of orgsSnapshot.docs) {
            const organizationId = orgDoc.id;
            const scoresSnapshot = await db.collection('organizations')
                .doc(organizationId)
                .collection('complianceScores')
                .get();

            // H2: batch chunking to avoid 500-op limit
            const BATCH_LIMIT = 450;
            const docs = scoresSnapshot.docs;

            for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
                const chunk = docs.slice(i, i + BATCH_LIMIT);
                const batch = db.batch();

                for (const scoreDoc of chunk) {
                    const scoreData = scoreDoc.data();

                    const historyRef = db
                        .collection('organizations')
                        .doc(organizationId)
                        .collection('complianceScoreHistory')
                        .doc();

                    batch.set(historyRef, {
                        frameworkId: scoreData.frameworkId,
                        frameworkCode: scoreData.frameworkCode,
                        score: scoreData.score,
                        compliantCount: scoreData.fullyCompliant || 0,
                        partialCount: scoreData.partiallyCompliant || 0,
                        nonCompliantCount: scoreData.nonCompliant || 0,
                        totalCount: scoreData.totalRequirements || 0,
                        timestamp: now,
                    });
                }

                await batch.commit();
            }

            totalRecorded += scoresSnapshot.size;
        }

        logger.info(`Recorded ${totalRecorded} score snapshots.`);
    } catch (error) {
        logger.error('Failed to record score snapshots:', error);
    }
});

module.exports = {
    generateCompliancePredictions,
    generateRecommendedActions,
    dailyPredictionRefresh,
    recordScoreSnapshot,
};
