#!/usr/bin/env node

/**
 * Script de migration des données - Sentinel GRC
 * Exécuter depuis le dossier functions: node migrate.cjs
 */

const admin = require('firebase-admin');

// Couleurs
const c = {
  r: '\x1b[0m', g: '\x1b[32m', red: '\x1b[31m', y: '\x1b[33m',
  b: '\x1b[34m', c: '\x1b[36m', m: '\x1b[35m'
};

const log = (msg, col = 'r') => console.log(`${c[col]}${msg}${c.r}`);

// Init Firebase Admin
admin.initializeApp({
  projectId: 'sentinel-grc-a8701'
});
const db = admin.firestore();

async function migrateOrgs() {
  log('\n📝 Migration des Organisations', 'b');
  log('================================', 'b');
  
  const orgs = await db.collection('organizations').get();
  log(`\n📊 ${orgs.size} organisation(s)\n`, 'c');
  
  let fixed = 0, ok = 0, errs = [];
  
  for (const doc of orgs.docs) {
    const d = doc.data();
    const updates = {};
    
    log(`\n🔍 ${d.name || doc.id}`, 'c');
    
    if (!d.slug) {
      updates.slug = (d.name || doc.id).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      log(`   ⚠️  slug → ${updates.slug}`, 'y');
    }
    
    if (!d.updatedAt) {
      updates.updatedAt = d.createdAt || new Date().toISOString();
      log(`   ⚠️  updatedAt`, 'y');
    }
    
    if (d.subscription) {
      const s = d.subscription;
      const su = {};
      if (s.cancelAtPeriodEnd === undefined) su.cancelAtPeriodEnd = false;
      if (s.stripeCustomerId === undefined) su.stripeCustomerId = null;
      if (s.stripeSubscriptionId === undefined) su.stripeSubscriptionId = null;
      if (s.currentPeriodEnd === undefined) su.currentPeriodEnd = null;
      if (Object.keys(su).length) {
        updates.subscription = { ...s, ...su };
        log(`   ⚠️  subscription`, 'y');
      }
    } else {
      updates.subscription = {
        planId: 'discovery', status: 'active',
        startDate: d.createdAt || new Date().toISOString(),
        stripeCustomerId: null, stripeSubscriptionId: null,
        currentPeriodEnd: null, cancelAtPeriodEnd: false
      };
      log(`   ⚠️  subscription créée`, 'y');
    }
    
    if (Object.keys(updates).length) {
      try {
        await doc.ref.update(updates);
        fixed++;
        log(`   ✅ Corrigée`, 'g');
      } catch (e) {
        errs.push({ id: doc.id, err: e.message });
        log(`   ❌ ${e.message}`, 'red');
      }
    } else {
      ok++;
      log(`   ✅ OK`, 'g');
    }
  }
  
  log('\n================================', 'b');
  log(`📊 Total: ${orgs.size} | Corrigées: ${fixed} | OK: ${ok} | Erreurs: ${errs.length}`, 'c');
  return { total: orgs.size, fixed, ok, errs };
}

async function migrateUsers() {
  log('\n\n📝 Migration des Utilisateurs', 'b');
  log('================================', 'b');
  
  const defOrgId = 'default-organization';
  const defOrg = db.collection('organizations').doc(defOrgId);
  const defSnap = await defOrg.get();
  
  if (!defSnap.exists()) {
    log('\n🏢 Création organisation par défaut...', 'y');
    await defOrg.set({
      id: defOrgId, name: 'Organisation par Défaut',
      slug: 'default-organization', ownerId: 'system',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      subscription: {
        planId: 'discovery', status: 'active',
        startDate: new Date().toISOString(),
        stripeCustomerId: null, stripeSubscriptionId: null,
        currentPeriodEnd: null, cancelAtPeriodEnd: false
      }
    });
    log('   ✅ Créée', 'g');
  } else {
    log('\n✅ Organisation par défaut existe', 'g');
  }
  
  const users = await db.collection('users').get();
  log(`\n📊 ${users.size} utilisateur(s)\n`, 'c');
  
  let fixed = 0, ok = 0, errs = [];
  
  for (const doc of users.docs) {
    const d = doc.data();
    log(`\n🔍 ${d.email || doc.id}`, 'c');
    
    if (!d.organizationId) {
      try {
        await doc.ref.update({
          organizationId: defOrgId,
          organizationName: 'Organisation par Défaut'
        });
        try {
          await admin.auth().setCustomUserClaims(doc.id, {
            organizationId: defOrgId,
            role: d.role || 'user'
          });
          log(`   ✅ Assigné + claims`, 'g');
        } catch (e) {
          log(`   ⚠️  Assigné (claims: ${e.message})`, 'y');
        }
        fixed++;
      } catch (e) {
        errs.push({ id: doc.id, err: e.message });
        log(`   ❌ ${e.message}`, 'red');
      }
    } else {
      const orgSnap = await db.collection('organizations').doc(d.organizationId).get();
      if (!orgSnap.exists()) {
        log(`   ⚠️  Org ${d.organizationId} n'existe pas!`, 'red');
        errs.push({ id: doc.id, err: 'Org not found' });
      } else {
        try {
          await admin.auth().setCustomUserClaims(doc.id, {
            organizationId: d.organizationId,
            role: d.role || 'user'
          });
          log(`   ✅ Claims OK`, 'g');
        } catch (e) {
          log(`   ⚠️  Claims: ${e.message}`, 'y');
        }
        ok++;
      }
    }
  }
  
  log('\n================================', 'b');
  log(`📊 Total: ${users.size} | Corrigés: ${fixed} | OK: ${ok} | Erreurs: ${errs.length}`, 'c');
  return { total: users.size, fixed, ok, errs };
}

async function run() {
  log('\n╔════════════════════════════════════════╗', 'm');
  log('║   🚀 MIGRATION - SENTINEL GRC          ║', 'm');
  log('╚════════════════════════════════════════╝\n', 'm');
  
  const start = Date.now();
  
  try {
    const orgRes = await migrateOrgs();
    const userRes = await migrateUsers();
    
    const dur = ((Date.now() - start) / 1000).toFixed(2);
    
    log('\n\n╔════════════════════════════════════════╗', 'm');
    log('║         📊 RÉSUMÉ FINAL                ║', 'm');
    log('╚════════════════════════════════════════╝', 'm');
    
    log('\n🏢 Organisations:', 'c');
    log(`   Total: ${orgRes.total} | Corrigées: ${orgRes.fixed} | OK: ${orgRes.ok} | Erreurs: ${orgRes.errs.length}`, 'c');
    
    log('\n👥 Utilisateurs:', 'c');
    log(`   Total: ${userRes.total} | Corrigés: ${userRes.fixed} | OK: ${userRes.ok} | Erreurs: ${userRes.errs.length}`, 'c');
    
    log(`\n⏱️  Durée: ${dur}s`, 'c');
    
    const totErrs = orgRes.errs.length + userRes.errs.length;
    if (totErrs === 0) {
      log('\n✅ Migration réussie !\n', 'g');
    } else {
      log(`\n⚠️  ${totErrs} erreur(s)\n`, 'y');
    }
    
    process.exit(totErrs > 0 ? 1 : 0);
  } catch (e) {
    log(`\n❌ Erreur: ${e.message}`, 'red');
    console.error(e);
    process.exit(1);
  }
}

run();
