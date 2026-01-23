#!/usr/bin/env npx ts-node
/**
 * NIS2 Framework Seed Script
 *
 * This script seeds the Firestore database with NIS2 framework data.
 * It creates the framework definition and all requirements with bilingual content.
 *
 * Usage:
 *   npx ts-node scripts/seed-nis2.ts
 *
 * Or via npm script:
 *   npm run seed:nis2
 *
 * @see Story EU-1.6: Seed NIS2 Framework Data
 */

import {
  NIS2_FRAMEWORK,
  NIS2_REQUIREMENTS,
  ISO27001_CONTROL_TEMPLATES,
  getNIS2RequirementCount,
} from './nis2-seed-data';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ============================================================================
// Firestore Data Structures
// ============================================================================

interface FirestoreFramework {
  code: string;
  name: string;
  localizedNames?: Record<string, string>;
  description?: string;
  localizedDescriptions?: Record<string, string>;
  version: string;
  effectiveDate: any;
  isActive: boolean;
  requirementCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface FirestoreRequirement {
  frameworkId: string;
  frameworkCode: string;
  articleRef: string;
  category: string;
  criticality: string;
  title: Record<string, string>;
  description: Record<string, string>;
  keywords: string[];
  isMandatory: boolean;
  suggestedControlCodes: string[];
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

interface FirestoreControlTemplate {
  code: string;
  name: Record<string, string>;
  frameworkMappings: string[]; // Framework codes that reference this control
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Seed Functions
// ============================================================================

/**
 * Prepares NIS2 framework document for Firestore
 */
function prepareFrameworkDocument(): FirestoreFramework {
  const now = new Date();
  const { name, localizedNames, version, effectiveDate, isActive } = NIS2_FRAMEWORK;
  return {
    code: 'NIS2',
    name,
    localizedNames,
    version,
    effectiveDate,
    isActive,
    requirementCount: getNIS2RequirementCount(),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Prepares NIS2 requirement documents for Firestore
 */
function prepareRequirementDocuments(frameworkId: string): FirestoreRequirement[] {
  const now = new Date();

  return NIS2_REQUIREMENTS.map((req, index) => ({
    frameworkId,
    frameworkCode: 'NIS2',
    articleRef: req.articleRef,
    category: req.category,
    criticality: req.criticality,
    title: req.title,
    description: req.description,
    keywords: req.keywords,
    isMandatory: req.isMandatory,
    suggestedControlCodes: req.suggestedControls,
    orderIndex: index,
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * Prepares ISO 27001 control template documents for Firestore
 */
function prepareControlTemplateDocuments(): FirestoreControlTemplate[] {
  const now = new Date();

  // Build mapping of which controls are referenced by NIS2
  const nis2ControlCodes = new Set<string>();
  NIS2_REQUIREMENTS.forEach(req => {
    req.suggestedControls.forEach(code => nis2ControlCodes.add(code));
  });

  return ISO27001_CONTROL_TEMPLATES.map(control => ({
    code: control.code,
    name: control.name,
    frameworkMappings: nis2ControlCodes.has(control.code) ? ['NIS2'] : [],
    createdAt: now,
    updatedAt: now,
  }));
}

// ============================================================================
// JSON Output for Manual Import or Cloud Function
// ============================================================================

function generateSeedJSON(): {
  framework: FirestoreFramework;
  requirements: FirestoreRequirement[];
  controlTemplates: FirestoreControlTemplate[];
} {
  const frameworkId = 'nis2-framework';

  return {
    framework: prepareFrameworkDocument(),
    requirements: prepareRequirementDocuments(frameworkId),
    controlTemplates: prepareControlTemplateDocuments(),
  };
}

// ============================================================================
// Main Execution
// ============================================================================

function main() {
  console.log('🇪🇺 NIS2 Framework Seed Data Generator');
  console.log('=====================================\n');

  const seedData = generateSeedJSON();

  console.log(`📋 Framework: ${seedData.framework.name}`);
  console.log(`   Version: ${seedData.framework.version}`);
  console.log(`   Effective Date: ${seedData.framework.effectiveDate}`);
  console.log('');

  console.log(`📝 Requirements: ${seedData.requirements.length}`);

  // Count by category
  const categoryCount: Record<string, number> = {};
  seedData.requirements.forEach(req => {
    categoryCount[req.category] = (categoryCount[req.category] || 0) + 1;
  });
  Object.entries(categoryCount).forEach(([cat, count]) => {
    console.log(`   - ${cat}: ${count}`);
  });
  console.log('');

  // Count by criticality
  const criticalityCount: Record<string, number> = {};
  seedData.requirements.forEach(req => {
    criticalityCount[req.criticality] = (criticalityCount[req.criticality] || 0) + 1;
  });
  console.log('📊 Criticality Distribution:');
  Object.entries(criticalityCount).forEach(([crit, count]) => {
    const emoji = crit === 'high' ? '🔴' : crit === 'medium' ? '🟡' : '🟢';
    console.log(`   ${emoji} ${crit}: ${count}`);
  });
  console.log('');

  console.log(`🔗 Control Templates: ${seedData.controlTemplates.length}`);
  const mappedControls = seedData.controlTemplates.filter(c => c.frameworkMappings.length > 0);
  console.log(`   Mapped to NIS2: ${mappedControls.length}`);
  console.log('');

  // Output JSON
  console.log('📄 Seed data JSON written to: scripts/nis2-seed-output.json');
  console.log('');

  // Write to file
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outputPath = path.join(__dirname, 'nis2-seed-output.json');
  fs.writeFileSync(outputPath, JSON.stringify(seedData, null, 2));

  console.log('✅ Seed data generation complete!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Import nis2-seed-output.json into Firestore via Admin SDK or Console');
  console.log('2. Or run the Cloud Function: seedNIS2Framework()');
  console.log('');
}

// Run if executed directly
const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  main();
}

export {
  generateSeedJSON,
  prepareFrameworkDocument,
  prepareRequirementDocuments,
  prepareControlTemplateDocuments,
};
