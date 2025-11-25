#!/usr/bin/env node

/**
 * Script de migration des données - Sentinel GRC
 * Corrige toutes les organisations et utilisateurs existants
 * 
 * Usage: node scripts/migrate-data.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Initialiser Firebase Admin
try {
  // Essayer de charger le service account key
  const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    log('✅ Firebase Admin initialisé avec service account', 'green');
  } catch (e) {
    // Fallback: utiliser les credentials par défaut
    admin.initializeApp();
    log('✅ Firebase Admin initialisé avec credentials par défaut', 'green');
  }
} catch (error) {
  log(`❌ Erreur d'initialisation Firebase: ${error.message}`, 'red');
  process.exit(1);
}

const db = admin.firestore();

async function migrateOrganizations() {
  log('\n📝 Migration des Organisations', 'blue');
  log('================================', 'blue');
  
  try {
    const orgsSnapshot = await db.collection('organizations').get();
    log(`\n📊 ${orgsSnapshot.size} organisation(s) trouvée(s)\n`, 'cyan');
    
    let fixed = 0;
    let alreadyOk = 0;
    const errors = [];
    
    for (const orgDoc of orgsSnapshot.docs) {
      const orgData = orgDoc.data();
      const orgId = orgDoc.id;
      const updates = {};
      
      log(`\n🔍 Vérification: ${orgData.name || orgId}`, 'cyan');
      
      // 1. Vérifier slug
      if (!orgData.slug) {
        updates.slug = (orgData.name || orgId)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        log(`   ⚠️  slug manquant → ${updates.slug}`, 'yellow');
      }
      
      // 2. Vérifier updatedAt
      if (!orgData.updatedAt) {
        updates.updatedAt = orgData.createdAt || new Date().toISOString();
        log(`   ⚠️  updatedAt manquant`, 'yellow');
      }
      
      // 3. Vérifier subscription
      if (orgData.subscription) {
        const sub = orgData.subscription;
        const subUpdates = {};
        
        if (sub.cancelAtPeriodEnd === undefined) {
          subUpdates.cancelAtPeriodEnd = false;
          log(`   ⚠️  subscription.cancelAtPeriodEnd manquant`, 'yellow');
        }
        if (sub.stripeCustomerId === undefined) {
          subUpdates.stripeCustomerId = null;
          log(`   ⚠️  subscription.stripeCustomerId manquant`, 'yellow');
        }
        if (sub.stripeSubscriptionId === undefined) {
          subUpdates.stripeSubscriptionId = null;
          log(`   ⚠️  subscription.stripeSubscriptionId manquant`, 'yellow');
        }
        if (sub.currentPeriodEnd === undefined) {
          subUpdates.currentPeriodEnd = null;
          log(`   ⚠️  subscription.currentPeriodEnd manquant`, 'yellow');
        }
        
        if (Object.keys(subUpdates).length > 0) {
          updates.subscription = { ...sub, ...subUpdates };
        }
      } else {
        // Créer une subscription par défaut
        updates.subscription = {
          planId: 'discovery',
          status: 'active',
          startDate: orgData.createdAt || new Date().toISOString(),
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false
        };
        log(`   ⚠️  subscription manquante → création par défaut`, 'yellow');
      }
      
      // Appliquer les mises à jour
      if (Object.keys(updates).length > 0) {
        try {
          await orgDoc.ref.update(updates);
          fixed++;
          log(`   ✅ Mise à jour appliquée`, 'green');
        } catch (error) {
          errors.push({ orgId, error: error.message });
          log(`   ❌ Erreur: ${error.message}`, 'red');
        }
      } else {
        alreadyOk++;
        log(`   ✅ Déjà conforme`, 'green');
      }
    }
    
    log('\n================================', 'blue');
    log(`📊 Résultats:`, 'cyan');
    log(`   - Total: ${orgsSnapshot.size}`, 'cyan');
    log(`   - Corrigées: ${fixed}`, fixed > 0 ? 'green' : 'cyan');
    log(`   - Déjà OK: ${alreadyOk}`, 'green');
    log(`   - Erreurs: ${errors.length}`, errors.length > 0 ? 'red' : 'green');
    
    if (errors.length > 0) {
      log('\n⚠️  Erreurs détaillées:', 'yellow');
      errors.forEach(err => {
        log(`   - ${err.orgId}: ${err.error}`, 'red');
      });
    }
    
    return { total: orgsSnapshot.size, fixed, alreadyOk, errors };
    
  } catch (error) {
    log(`\n❌ Erreur lors de la migration des organisations: ${error.message}`, 'red');
    throw error;
  }
}

async function migrateUsers() {
  log('\n\n📝 Migration des Utilisateurs', 'blue');
  log('================================', 'blue');
  
  try {
    // 1. Créer l'organisation par défaut si nécessaire
    const defaultOrgId = 'default-organization';
    const defaultOrgRef = db.collection('organizations').doc(defaultOrgId);
    const defaultOrgSnap = await defaultOrgRef.get();
    
    if (!defaultOrgSnap.exists()) {
      log('\n🏢 Création de l\'organisation par défaut...', 'yellow');
      await defaultOrgRef.set({
        id: defaultOrgId,
        name: 'Organisation par Défaut',
        slug: 'default-organization',
        ownerId: 'system',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        subscription: {
          planId: 'discovery',
          status: 'active',
          startDate: new Date().toISOString(),
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false
        }
      });
      log('   ✅ Organisation par défaut créée', 'green');
    } else {
      log('\n✅ Organisation par défaut existe déjà', 'green');
    }
    
    // 2. Migrer les utilisateurs
    const usersSnapshot = await db.collection('users').get();
    log(`\n📊 ${usersSnapshot.size} utilisateur(s) trouvé(s)\n`, 'cyan');
    
    let fixed = 0;
    let alreadyOk = 0;
    const errors = [];
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      log(`\n🔍 Vérification: ${userData.email || userId}`, 'cyan');
      
      if (!userData.organizationId) {
        try {
          // Assigner à l'organisation par défaut
          await userDoc.ref.update({
            organizationId: defaultOrgId,
            organizationName: 'Organisation par Défaut'
          });
          
          // Mettre à jour les custom claims
          try {
            await admin.auth().setCustomUserClaims(userId, {
              organizationId: defaultOrgId,
              role: userData.role || 'user'
            });
            log(`   ✅ Assigné à l'organisation par défaut + claims mis à jour`, 'green');
          } catch (claimError) {
            log(`   ⚠️  Assigné à l'organisation mais erreur claims: ${claimError.message}`, 'yellow');
          }
          
          fixed++;
        } catch (error) {
          errors.push({ userId, error: error.message });
          log(`   ❌ Erreur: ${error.message}`, 'red');
        }
      } else {
        // Vérifier que l'organisation existe
        const orgRef = db.collection('organizations').doc(userData.organizationId);
        const orgSnap = await orgRef.get();
        
        if (!orgSnap.exists()) {
          log(`   ⚠️  Organisation ${userData.organizationId} n'existe pas!`, 'red');
          errors.push({ userId, error: 'Organization not found' });
        } else {
          // S'assurer que les claims sont à jour
          try {
            await admin.auth().setCustomUserClaims(userId, {
              organizationId: userData.organizationId,
              role: userData.role || 'user'
            });
            log(`   ✅ Claims mis à jour`, 'green');
          } catch (claimError) {
            log(`   ⚠️  Erreur mise à jour claims: ${claimError.message}`, 'yellow');
          }
          alreadyOk++;
        }
      }
    }
    
    log('\n================================', 'blue');
    log(`📊 Résultats:`, 'cyan');
    log(`   - Total: ${usersSnapshot.size}`, 'cyan');
    log(`   - Corrigés: ${fixed}`, fixed > 0 ? 'green' : 'cyan');
    log(`   - Déjà OK: ${alreadyOk}`, 'green');
    log(`   - Erreurs: ${errors.length}`, errors.length > 0 ? 'red' : 'green');
    
    if (errors.length > 0) {
      log('\n⚠️  Erreurs détaillées:', 'yellow');
      errors.forEach(err => {
        log(`   - ${err.userId}: ${err.error}`, 'red');
      });
    }
    
    return { total: usersSnapshot.size, fixed, alreadyOk, errors };
    
  } catch (error) {
    log(`\n❌ Erreur lors de la migration des utilisateurs: ${error.message}`, 'red');
    throw error;
  }
}

async function runAllMigrations() {
  log('\n╔════════════════════════════════════════╗', 'magenta');
  log('║   🚀 MIGRATION COMPLÈTE - SENTINEL GRC  ║', 'magenta');
  log('╚════════════════════════════════════════╝\n', 'magenta');
  
  const startTime = Date.now();
  
  try {
    // Migration des organisations
    const orgResults = await migrateOrganizations();
    
    // Migration des utilisateurs
    const userResults = await migrateUsers();
    
    // Résumé final
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    log('\n\n╔════════════════════════════════════════╗', 'magenta');
    log('║         📊 RÉSUMÉ FINAL                ║', 'magenta');
    log('╚════════════════════════════════════════╝', 'magenta');
    
    log('\n🏢 Organisations:', 'cyan');
    log(`   - Total: ${orgResults.total}`, 'cyan');
    log(`   - Corrigées: ${orgResults.fixed}`, 'green');
    log(`   - Déjà OK: ${orgResults.alreadyOk}`, 'green');
    log(`   - Erreurs: ${orgResults.errors.length}`, orgResults.errors.length > 0 ? 'red' : 'green');
    
    log('\n👥 Utilisateurs:', 'cyan');
    log(`   - Total: ${userResults.total}`, 'cyan');
    log(`   - Corrigés: ${userResults.fixed}`, 'green');
    log(`   - Déjà OK: ${userResults.alreadyOk}`, 'green');
    log(`   - Erreurs: ${userResults.errors.length}`, userResults.errors.length > 0 ? 'red' : 'green');
    
    log(`\n⏱️  Durée totale: ${duration}s`, 'cyan');
    
    const totalErrors = orgResults.errors.length + userResults.errors.length;
    if (totalErrors === 0) {
      log('\n✅ Migration terminée avec succès !', 'green');
      log('   Toutes les données sont maintenant conformes.\n', 'green');
    } else {
      log(`\n⚠️  Migration terminée avec ${totalErrors} erreur(s)`, 'yellow');
      log('   Consultez les détails ci-dessus.\n', 'yellow');
    }
    
    process.exit(totalErrors > 0 ? 1 : 0);
    
  } catch (error) {
    log(`\n❌ Erreur fatale: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Exécution
runAllMigrations();
