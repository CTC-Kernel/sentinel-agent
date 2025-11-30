import React, { useState } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, doc, writeBatch, getDoc } from 'firebase/firestore';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';
import { Database, Loader2, Zap } from '../ui/Icons';
import { Organization } from '../../types';

const COLLECTIONS_TO_MIGRATE = [
    'assets',
    'risks',
    'controls',
    'audits',
    'projects',
    'incidents',
    'documents',
    'suppliers',
    'processing_activities',
    'business_processes',
    'bcp_drills',
    'system_logs'
];

export const MigrationTool: React.FC = () => {
    const { addToast } = useStore();
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);

    const log = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    const runMigration = async () => {
        setLoading(true);
        setLogs([]);
        setProgress(0);

        try {
            log("🚀 Démarrage de la migration...");

            // 1. Fetch all organizations to have a fallback
            const orgsSnap = await getDocs(collection(db, 'organizations'));
            const orgs = orgsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Organization));
            const defaultOrgId = orgs.length === 1 ? orgs[0].id : null;

            log(`ℹ️ ${orgs.length} organisation(s) trouvée(s). Default fallback: ${defaultOrgId || 'Aucun'}`);

            // 2. Migrate Collections
            let totalFixed = 0;
            const totalSteps = COLLECTIONS_TO_MIGRATE.length + 1; // +1 for orgs check

            for (let i = 0; i < COLLECTIONS_TO_MIGRATE.length; i++) {
                const colName = COLLECTIONS_TO_MIGRATE[i];
                log(`🔍 Analyse de la collection: ${colName}...`);

                const snap = await getDocs(collection(db, colName));
                const batch = writeBatch(db);
                let batchCount = 0;
                let fixedInCol = 0;

                for (const docSnap of snap.docs) {
                    const data = docSnap.data();

                    if (!data.organizationId) {
                        let targetOrgId = defaultOrgId;

                        // Heuristic: Try to find org via owner/user
                        const userId = data.ownerId || data.userId || data.reporter || data.manager || data.auditor;
                        if (userId && !targetOrgId) {
                            try {
                                const userSnap = await getDoc(doc(db, 'users', userId));
                                if (userSnap.exists() && userSnap.data().organizationId) {
                                    targetOrgId = userSnap.data().organizationId;
                                }
                            } catch (e) {
                                // Ignore error
                            }
                        }

                        if (targetOrgId) {
                            batch.update(docSnap.ref, { organizationId: targetOrgId });
                            batchCount++;
                            fixedInCol++;
                        } else {
                            log(`⚠️ Impossible de déterminer l'organisation pour ${colName}/${docSnap.id}`);
                        }
                    }

                    if (batchCount >= 400) {
                        await batch.commit();
                        batchCount = 0;
                    }
                }

                if (batchCount > 0) {
                    await batch.commit();
                }

                if (fixedInCol > 0) {
                    log(`✅ ${colName}: ${fixedInCol} documents corrigés.`);
                    totalFixed += fixedInCol;
                } else {
                    log(`✓ ${colName}: OK`);
                }

                setProgress(((i + 1) / totalSteps) * 100);
            }

            // 3. Verify Organizations & Subscriptions
            log("🔍 Vérification des organisations et abonnements...");
            const orgBatch = writeBatch(db);
            let orgFixed = 0;

            for (const org of orgs) {
                const updates: Record<string, unknown> = {};

                // Check Slug
                if (!org.slug) {
                    const slug = org.name.toLowerCase()
                        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, '');
                    updates.slug = slug;
                }

                // Check Subscription
                if (!org.subscription || !org.subscription.planId) {
                    updates.subscription = {
                        planId: 'discovery',
                        status: 'active',
                        startDate: new Date().toISOString(),
                        cancelAtPeriodEnd: false
                    };
                }

                if (Object.keys(updates).length > 0) {
                    orgBatch.update(doc(db, 'organizations', org.id), updates);
                    orgFixed++;
                }
            }

            if (orgFixed > 0) {
                await orgBatch.commit();
                log(`✅ ${orgFixed} organisations mises à jour.`);
            } else {
                log(`✓ Organisations: OK`);
            }

            setProgress(100);
            log("🎉 Migration terminée avec succès !");
            addToast(`Migration terminée. ${totalFixed} documents et ${orgFixed} organisations corrigés.`, "success");

        } catch (error) {
            ErrorLogger.error(error, 'MigrationTool.runMigration');
            const msg = error instanceof Error ? error.message : 'Unknown error';
            log(`❌ Erreur: ${msg}`);
            addToast("Erreur lors de la migration", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-panel rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <Database className="h-6 w-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Migration & Intégrité</h3>
                    <p className="text-sm text-slate-500">Vérifier et réparer la cohérence des données multi-tenant.</p>
                </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 mb-6 font-mono text-xs h-48 overflow-y-auto border border-slate-200 dark:border-slate-700">
                {logs.length === 0 ? (
                    <span className="text-slate-400 italic">Prêt à démarrer...</span>
                ) : (
                    logs.map((l, i) => <div key={i} className="mb-1 text-slate-600 dark:text-slate-300">{l}</div>)
                )}
            </div>

            {loading && (
                <div className="mb-4">
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-indigo-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            <button
                onClick={runMigration}
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                {loading ? 'Migration en cours...' : 'Lancer la Migration'}
            </button>
        </div>
    );
};
