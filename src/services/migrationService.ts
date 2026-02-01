import { db } from '../firebase';
import { collection, getDocs, doc, writeBatch, getDoc } from 'firebase/firestore';
import { Organization } from '../types';
import { ErrorLogger } from './errorLogger';

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

export interface MigrationProgress {
  currentStep: string;
  progress: number;
  logs: string[];
}

export class MigrationService {
  /**
   * Run full organization ID migration across all collections
   * @param onProgress Callback for progress updates
   * @returns Object with totalFixed documents and orgFixed count
   */
  static async runOrganizationMigration(
    onProgress: (progress: MigrationProgress) => void
  ): Promise<{ totalFixed: number; orgFixed: number }> {
    try {
      const logs: string[] = [];
      const log = (msg: string) => {
        logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
        onProgress({ currentStep: msg, progress: 0, logs: [...logs] });
      };

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
        let batch = writeBatch(db);
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
              } catch {
                // Ignore error - user not found
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
            batch = writeBatch(db);
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

        const progress = ((i + 1) / totalSteps) * 100;
        onProgress({ currentStep: `Migrating ${colName}`, progress, logs: [...logs] });
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

      onProgress({ currentStep: 'Terminé', progress: 100, logs: [...logs] });
      log("🎉 Migration terminée avec succès !");

      return { totalFixed, orgFixed };
    } catch (error) {
      ErrorLogger.error(error, 'MigrationService.runOrganizationMigration');
      throw error;
    }
  }
}
