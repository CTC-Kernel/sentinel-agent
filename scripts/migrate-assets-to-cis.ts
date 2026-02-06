/**
 * Migration Script: Assets → Configuration Items
 *
 * Migrates existing Asset documents to CMDB Configuration Items.
 * Preserves references and creates legacy links.
 *
 * Usage:
 *   npx ts-node scripts/migrate-assets-to-cis.ts [--dry-run] [--org=orgId]
 *
 * @module scripts/migrate-assets-to-cis
 */

import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Timestamp, WriteBatch } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// CONFIGURATION
// =============================================================================

const BATCH_SIZE = 500;
const DRY_RUN = process.argv.includes('--dry-run');
const ORG_FILTER = process.argv.find(arg => arg.startsWith('--org='))?.split('=')[1];

// =============================================================================
// TYPES
// =============================================================================

interface Asset {
  id: string;
  organizationId: string;
  name: string;
  type: 'Matériel' | 'Logiciel' | 'Données' | 'Service' | 'Humain';
  description?: string;
  category?: string;
  location?: string;
  ownerId?: string;
  supportContact?: string;
  confidentiality: string;
  integrity: string;
  availability: string;
  status?: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  ipAddress?: string;
  macAddress?: string;
  hostname?: string;
  operatingSystem?: string;
  purchaseDate?: Timestamp;
  warrantyEndDate?: Timestamp;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  createdBy: string;
  updatedBy?: string;
}

interface MigrationResult {
  total: number;
  migrated: number;
  skipped: number;
  errors: string[];
}

// =============================================================================
// MAPPING
// =============================================================================

const ASSET_TYPE_TO_CI_CLASS: Record<string, string> = {
  'Matériel': 'Hardware',
  'Logiciel': 'Software',
  'Données': 'Document',
  'Service': 'Service',
  'Humain': 'Service', // Map human to service
};

const ASSET_TYPE_TO_CI_TYPE: Record<string, string> = {
  'Matériel': 'Workstation',
  'Logiciel': 'Application',
  'Données': 'Configuration',
  'Service': 'IT_Service',
  'Humain': 'Business_Service',
};

const CRITICALITY_MAPPING: Record<string, string> = {
  'Critique': 'Critical',
  'Élevée': 'High',
  'Moyenne': 'Medium',
  'Faible': 'Low',
};

/**
 * Calculate CI criticality from CIA triad
 */
function calculateCriticality(c: string, i: string, a: string): string {
  const levels = ['Faible', 'Moyenne', 'Élevée', 'Critique'];
  const maxLevel = Math.max(
    levels.indexOf(c),
    levels.indexOf(i),
    levels.indexOf(a)
  );
  const frenchLevel = levels[maxLevel] || 'Moyenne';
  return CRITICALITY_MAPPING[frenchLevel] || 'Medium';
}

/**
 * Generate fingerprint from asset data
 */
function generateFingerprint(asset: Asset) {
  return {
    serialNumber: asset.serialNumber || null,
    primaryMacAddress: asset.macAddress?.toLowerCase() || null,
    hostname: asset.hostname?.toLowerCase().split('.')[0] || null,
    fqdn: null,
    osFingerprint: asset.operatingSystem
      ? `unknown-${asset.operatingSystem}-unknown`.toLowerCase()
      : null,
    cloudInstanceId: null,
  };
}

/**
 * Calculate DQS for migrated asset
 */
function calculateDQS(asset: Asset): number {
  let score = 0;
  const maxScore = 100;

  // Required fields
  if (asset.name) score += 15;
  if (asset.type) score += 10;
  if (asset.ownerId) score += 10;

  // Optional but valuable fields
  if (asset.description) score += 5;
  if (asset.serialNumber) score += 15;
  if (asset.macAddress) score += 10;
  if (asset.hostname) score += 10;
  if (asset.ipAddress) score += 5;
  if (asset.manufacturer) score += 5;
  if (asset.model) score += 5;
  if (asset.operatingSystem) score += 5;
  if (asset.location) score += 5;

  return Math.min(score, maxScore);
}

/**
 * Map Asset to Configuration Item
 */
function mapAssetToCI(asset: Asset): Record<string, unknown> {
  const ciClass = ASSET_TYPE_TO_CI_CLASS[asset.type] || 'Hardware';
  const ciType = ASSET_TYPE_TO_CI_TYPE[asset.type] || 'Workstation';
  const fingerprint = generateFingerprint(asset);

  const ci = {
    organizationId: asset.organizationId,
    ciClass,
    ciType,
    fingerprint,
    name: asset.name,
    description: asset.description || null,
    status: 'In_Use',
    environment: 'Production',
    criticality: calculateCriticality(
      asset.confidentiality,
      asset.integrity,
      asset.availability
    ),
    ownerId: asset.ownerId || 'system',
    supportGroupId: asset.supportContact || null,
    dataQualityScore: calculateDQS(asset),
    discoverySource: 'Import',
    sourceAgentId: null,
    lastDiscoveredAt: null,
    lastReconciliationAt: Timestamp.now(),
    legacyAssetId: asset.id,
    attributes: {
      // Preserve original CIA classification
      originalConfidentiality: asset.confidentiality,
      originalIntegrity: asset.integrity,
      originalAvailability: asset.availability,
      // Hardware attributes
      manufacturer: asset.manufacturer || null,
      model: asset.model || null,
      serialNumber: asset.serialNumber || null,
      primaryIpAddress: asset.ipAddress || null,
      primaryMacAddress: asset.macAddress || null,
      hostname: asset.hostname || null,
      location: asset.location || null,
      category: asset.category || null,
      // Lifecycle
      purchaseDate: asset.purchaseDate || null,
      warrantyEndDate: asset.warrantyEndDate || null,
    },
    createdAt: asset.createdAt || Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: asset.createdBy || 'migration',
    updatedBy: 'migration',
  };

  return ci;
}

// =============================================================================
// MIGRATION LOGIC
// =============================================================================

async function migrateAssets(): Promise<MigrationResult> {
  console.log('🚀 Starting Asset → CI Migration');
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  if (ORG_FILTER) {
    console.log(`   Organization filter: ${ORG_FILTER}`);
  }

  // Initialize Firebase
  const serviceAccountPath = path.join(__dirname, '../functions/.env.sentinel-grc-a8701');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ Service account file not found');
    process.exit(1);
  }

  initializeApp({
    projectId: 'sentinel-grc-a8701',
  });

  const db = getFirestore();
  const result: MigrationResult = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Get all assets
    let query = db.collection('assets').orderBy('createdAt', 'asc');
    if (ORG_FILTER) {
      query = db.collection('assets')
        .where('organizationId', '==', ORG_FILTER)
        .orderBy('createdAt', 'asc');
    }

    const assetsSnapshot = await query.get();
    result.total = assetsSnapshot.size;

    console.log(`\n📊 Found ${result.total} assets to migrate\n`);

    if (result.total === 0) {
      console.log('✅ No assets to migrate');
      return result;
    }

    // Check for existing CIs with legacyAssetId
    const existingCIsSnapshot = await db.collection('cmdb_cis')
      .where('legacyAssetId', '!=', null)
      .select('legacyAssetId')
      .get();

    const existingLegacyIds = new Set(
      existingCIsSnapshot.docs.map(doc => doc.data().legacyAssetId)
    );
    console.log(`   Found ${existingLegacyIds.size} already migrated assets\n`);

    // Process in batches
    let batch: WriteBatch = db.batch();
    let batchCount = 0;

    for (const doc of assetsSnapshot.docs) {
      const asset = { id: doc.id, ...doc.data() } as Asset;

      // Skip if already migrated
      if (existingLegacyIds.has(asset.id)) {
        result.skipped++;
        continue;
      }

      // Skip non-migratable types
      if (!ASSET_TYPE_TO_CI_CLASS[asset.type]) {
        console.log(`   ⚠️ Skipping ${asset.name}: Unknown type "${asset.type}"`);
        result.skipped++;
        continue;
      }

      try {
        const ci = mapAssetToCI(asset);

        if (!DRY_RUN) {
          const ciRef = db.collection('cmdb_cis').doc();
          batch.set(ciRef, ci);
          batchCount++;

          // Commit batch when full
          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            console.log(`   ✓ Committed batch of ${batchCount} CIs`);
            batch = db.batch();
            batchCount = 0;
          }
        }

        result.migrated++;
        console.log(`   ✓ ${DRY_RUN ? '[DRY RUN] ' : ''}Migrated: ${asset.name} → ${ci.ciClass}/${ci.ciType}`);

      } catch (error) {
        const errorMsg = `Failed to migrate ${asset.id}: ${error}`;
        result.errors.push(errorMsg);
        console.error(`   ❌ ${errorMsg}`);
      }
    }

    // Commit remaining batch
    if (!DRY_RUN && batchCount > 0) {
      await batch.commit();
      console.log(`   ✓ Committed final batch of ${batchCount} CIs`);
    }

    return result;

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   SENTINEL GRC - Asset to CI Migration');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const result = await migrateAssets();

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   MIGRATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Total Assets:     ${result.total}`);
  console.log(`   Migrated:         ${result.migrated}`);
  console.log(`   Skipped:          ${result.skipped}`);
  console.log(`   Errors:           ${result.errors.length}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (result.errors.length > 0) {
    console.log('\n⚠️ Errors:');
    result.errors.forEach(e => console.log(`   - ${e}`));
  }

  if (DRY_RUN) {
    console.log('\n📝 This was a DRY RUN. No changes were made.');
    console.log('   Run without --dry-run to perform the actual migration.\n');
  }

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
