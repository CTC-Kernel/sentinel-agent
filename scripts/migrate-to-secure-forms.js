#!/usr/bin/env node

/**
 * Script de migration automatique vers useSecureForm
 *
 * Ce script analyse les fichiers TypeScript/React et propose des modifications
 * pour migrer les formulaires vers useSecureForm
 *
 * Usage:
 *   node scripts/migrate-to-secure-forms.js --dry-run
 *   node scripts/migrate-to-secure-forms.js --apply
 *   node scripts/migrate-to-secure-forms.js --file src/components/MyForm.tsx
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || !args.includes('--apply');
const specificFile = args.find(arg => arg.startsWith('--file='))?.split('=')[1];

console.log('🔍 Migration Script: react-hook-form → useSecureForm');
console.log('Mode:', isDryRun ? 'DRY RUN (simulation)' : 'APPLY (modifications réelles)');
console.log('');

// Patterns à détecter
const patterns = {
  useFormImport: /import\s+{\s*useForm[^}]*}\s+from\s+['"]react-hook-form['"]/,
  useFormCall: /const\s+{\s*([^}]+)\s*}\s*=\s*useForm<([^>]+)>\s*\(/,
  zodResolverImport: /import\s+{\s*zodResolver[^}]*}\s+from\s+['"]@hookform\/resolvers\/zod['"]/,
};

// Stats
const stats = {
  filesScanned: 0,
  filesWithForms: 0,
  filesMigrated: 0,
  errors: 0
};

/**
 * Trouve tous les fichiers TypeScript/React
 */
function findFormFiles(dir = 'src', files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Ignorer certains dossiers
      if (!['node_modules', 'dist', 'build', '.git'].includes(entry.name)) {
        findFormFiles(fullPath, files);
      }
    } else if (entry.name.match(/\.(tsx|ts)$/)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Analyse un fichier pour détecter les formulaires
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  stats.filesScanned++;

  // Vérifier si le fichier utilise useForm
  if (!patterns.useFormImport.test(content)) {
    return null;
  }

  stats.filesWithForms++;

  // Extraire les informations du formulaire
  const useFormMatch = content.match(patterns.useFormCall);
  if (!useFormMatch) {
    return null;
  }

  const formFields = useFormMatch[1];
  const formType = useFormMatch[2];

  // Vérifier si Zod est utilisé
  const usesZod = patterns.zodResolverImport.test(content);

  return {
    filePath,
    content,
    formFields,
    formType,
    usesZod
  };
}

/**
 * Génère le code migré
 */
function generateMigratedCode(analysis) {
  let newContent = analysis.content;

  // 1. Ajouter l'import useSecureForm
  const secureFormImport = analysis.usesZod
    ? "import { useSecureFormWithZod } from '@/hooks/useSecureForm';"
    : "import { useSecureForm } from '@/hooks/useSecureForm';";

  // Insérer après les imports existants
  const lastImportIndex = newContent.lastIndexOf('import ');
  const nextLineIndex = newContent.indexOf('\n', lastImportIndex);
  newContent = newContent.slice(0, nextLineIndex + 1) + secureFormImport + '\n' + newContent.slice(nextLineIndex + 1);

  // 2. Remplacer useForm par useSecureForm
  if (analysis.usesZod) {
    // Avec Zod
    newContent = newContent.replace(
      /const\s+{\s*([^}]+)\s*}\s*=\s*useForm<([^>]+)>\s*\(\s*{\s*resolver:\s*zodResolver\(([^)]+)\)[^}]*}\s*\);/,
      (match, fields, type, schema) => {
        return `const form = useSecureFormWithZod<${type}>({
  schema: ${schema},
  initialValues: {
    // TODO: Définir les valeurs initiales
  },
  onSubmit: async (data) => {
    // TODO: Implémenter la logique de soumission
  }
});`;
      }
    );
  } else {
    // Sans Zod
    newContent = newContent.replace(
      /const\s+{\s*([^}]+)\s*}\s*=\s*useForm<([^>]+)>\s*\(/,
      `const form = useSecureForm<${analysis.formType}>({
  initialValues: {
    // TODO: Définir les valeurs initiales
  },
  onSubmit: async (data) => {
    // TODO: Implémenter la logique de soumission
  },
  validate: (values) => {
    const errors: Record<string, string> = {};
    // TODO: Ajouter la logique de validation
    return errors;
  }`
    );
  }

  // 3. Ajouter des commentaires TODO pour les modifications manuelles
  const todoComment = `
// ⚠️ MIGRATION AUTOMATIQUE: Vérifications nécessaires
// TODO: 1. Remplacer les références aux champs (register, control, etc.) par form.values
// TODO: 2. Utiliser form.handleChange pour onChange
// TODO: 3. Utiliser form.handleBlur pour onBlur
// TODO: 4. Utiliser form.errors et form.touched pour l'affichage d'erreurs
// TODO: 5. Vérifier et tester le formulaire complet
// Voir: QUICK_START_INTEGRATION.md pour des exemples
`;

  // Insérer le commentaire après la déclaration du form
  newContent = newContent.replace(
    /const form = useSecureForm/,
    todoComment + '\nconst form = useSecureForm'
  );

  return newContent;
}

/**
 * Génère un rapport de migration
 */
function generateReport(analysis) {
  return `
📄 Fichier: ${analysis.filePath}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Type du formulaire: ${analysis.formType}
Utilise Zod: ${analysis.usesZod ? 'Oui' : 'Non'}
Champs détectés: ${analysis.formFields}

Modifications suggérées:
1. ✅ Import de useSecureForm ajouté
2. ✅ useForm remplacé par ${analysis.usesZod ? 'useSecureFormWithZod' : 'useSecureForm'}
3. ⚠️  Adaptation du JSX nécessaire (voir TODOs dans le code)

Actions manuelles requises:
- Remplacer les références register() par form.values/form.handleChange
- Adapter les gestionnaires d'événements
- Vérifier la logique de validation
- Tester le formulaire

Référence: src/integrations/AssetFormSecurityExample.tsx
`;
}

/**
 * Migration d'un fichier
 */
function migrateFile(filePath) {
  try {
    const analysis = analyzeFile(filePath);

    if (!analysis) {
      return null;
    }

    const migratedCode = generateMigratedCode(analysis);
    const report = generateReport(analysis);

    console.log(report);

    if (!isDryRun) {
      // Créer un backup
      const backupPath = filePath + '.backup';
      fs.copyFileSync(filePath, backupPath);
      console.log(`✅ Backup créé: ${backupPath}`);

      // Écrire le nouveau code
      fs.writeFileSync(filePath, migratedCode, 'utf-8');
      console.log(`✅ Fichier migré: ${filePath}`);

      stats.filesMigrated++;
    } else {
      console.log(`🔍 [DRY RUN] Pas de modification appliquée`);
    }

    console.log('');
    return analysis;

  } catch (error) {
    console.error(`❌ Erreur lors de la migration de ${filePath}:`, error.message);
    stats.errors++;
    return null;
  }
}

/**
 * Main
 */
function main() {
  const startTime = Date.now();

  if (specificFile) {
    // Migrer un fichier spécifique
    console.log(`Migration d'un fichier spécifique: ${specificFile}\n`);
    migrateFile(specificFile);
  } else {
    // Migrer tous les fichiers
    console.log('Recherche des formulaires dans src/...\n');
    const files = findFormFiles();

    for (const file of files) {
      migrateFile(file);
    }
  }

  // Rapport final
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 RAPPORT DE MIGRATION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Fichiers scannés:        ${stats.filesScanned}`);
  console.log(`Formulaires détectés:    ${stats.filesWithForms}`);
  console.log(`Fichiers migrés:         ${stats.filesMigrated}`);
  console.log(`Erreurs:                 ${stats.errors}`);
  console.log(`Durée:                   ${duration}s`);
  console.log('═══════════════════════════════════════════════════════════');

  if (isDryRun && stats.filesWithForms > 0) {
    console.log('');
    console.log('💡 Pour appliquer les migrations, relancez avec --apply:');
    console.log('   node scripts/migrate-to-secure-forms.js --apply');
  }

  if (stats.filesMigrated > 0) {
    console.log('');
    console.log('⚠️  IMPORTANT: Actions manuelles requises');
    console.log('Les fichiers ont été migrés automatiquement, mais vous devez:');
    console.log('1. Vérifier les TODOs dans chaque fichier migré');
    console.log('2. Adapter le JSX (values, onChange, onBlur)');
    console.log('3. Tester chaque formulaire');
    console.log('4. Consulter: QUICK_START_INTEGRATION.md');
    console.log('');
    console.log('💾 Des backups ont été créés (.backup)');
  }
}

// Exécution
main();
