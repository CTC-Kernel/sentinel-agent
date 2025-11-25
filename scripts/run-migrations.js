/**
 * Script de migration pour mettre à jour toutes les données
 * Usage: node scripts/run-migrations.js
 */

const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable, connectFunctionsEmulator } = require('firebase/functions');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, getDocs, doc, updateDoc, setDoc } = require('firebase/firestore');

// Configuration Firebase (depuis votre firebase.ts)
const firebaseConfig = {
  apiKey: "AIzaSyDJQQHWKfGqxVGxQXgPXOXQCXQXQXQXQXQ",
  authDomain: "sentinel-grc-a8701.firebaseapp.com",
  projectId: "sentinel-grc-a8701",
  storageBucket: "sentinel-grc-a8701.firebasestorage.app",
  messagingSenderId: "728667422032",
  appId: "1:728667422032:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runMigrations() {
  log('\n🚀 Démarrage des migrations...', 'cyan');
  log('=====================================\n', 'cyan');

  try {
    // Étape 1: Se connecter en tant qu'admin
    log('📝 Étape 1: Authentification...', 'blue');
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'password';
    
    log(`   Connexion avec: ${email}`, 'yellow');
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    log('   ✅ Authentification réussie\n', 'green');

    // Étape 2: Appeler fixAllUsers
    log('📝 Étape 2: Migration des utilisateurs (fixAllUsers)...', 'blue');
    const fixAllUsers = httpsCallable(functions, 'fixAllUsers');
    
    try {
      const result = await fixAllUsers();
      log('   ✅ Migration des utilisateurs réussie', 'green');
      log(`   📊 Résultats:`, 'cyan');
      log(`      - Total: ${result.data.results.total}`, 'yellow');
      log(`      - Corrigés: ${result.data.results.fixed}`, 'green');
      log(`      - Déjà OK: ${result.data.results.alreadyOk}`, 'green');
      log(`      - Erreurs: ${result.data.results.errors.length}`, result.data.results.errors.length > 0 ? 'red' : 'green');
      
      if (result.data.results.errors.length > 0) {
        log('\n   ⚠️  Erreurs détectées:', 'yellow');
        result.data.results.errors.forEach(err => {
          log(`      - User ${err.userId}: ${err.error}`, 'red');
        });
      }
    } catch (error) {
      log(`   ❌ Erreur lors de la migration des utilisateurs: ${error.message}`, 'red');
      if (error.code === 'functions/permission-denied') {
        log('   ℹ️  Vous devez être admin pour exécuter cette migration', 'yellow');
      }
    }

    log('\n📝 Étape 3: Vérification des organisations...', 'blue');
    const orgsSnapshot = await getDocs(collection(db, 'organizations'));
    log(`   📊 ${orgsSnapshot.size} organisation(s) trouvée(s)`, 'cyan');
    
    let orgsFixed = 0;
    for (const orgDoc of orgsSnapshot.docs) {
      const orgData = orgDoc.data();
      const updates = {};
      
      // Vérifier et ajouter les champs manquants
      if (!orgData.slug) {
        updates.slug = orgData.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        log(`   ⚠️  Organisation "${orgData.name}" - slug manquant, ajout: ${updates.slug}`, 'yellow');
      }
      
      if (!orgData.updatedAt) {
        updates.updatedAt = orgData.createdAt || new Date().toISOString();
        log(`   ⚠️  Organisation "${orgData.name}" - updatedAt manquant`, 'yellow');
      }
      
      // Vérifier la subscription
      if (orgData.subscription) {
        const subUpdates = {};
        if (orgData.subscription.cancelAtPeriodEnd === undefined) {
          subUpdates.cancelAtPeriodEnd = false;
        }
        if (!orgData.subscription.stripeCustomerId) {
          subUpdates.stripeCustomerId = null;
        }
        if (!orgData.subscription.stripeSubscriptionId) {
          subUpdates.stripeSubscriptionId = null;
        }
        if (!orgData.subscription.currentPeriodEnd) {
          subUpdates.currentPeriodEnd = null;
        }
        
        if (Object.keys(subUpdates).length > 0) {
          updates.subscription = { ...orgData.subscription, ...subUpdates };
          log(`   ⚠️  Organisation "${orgData.name}" - subscription incomplète`, 'yellow');
        }
      }
      
      // Appliquer les mises à jour
      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'organizations', orgDoc.id), updates);
        orgsFixed++;
        log(`   ✅ Organisation "${orgData.name}" mise à jour`, 'green');
      }
    }
    
    if (orgsFixed > 0) {
      log(`\n   ✅ ${orgsFixed} organisation(s) corrigée(s)`, 'green');
    } else {
      log(`\n   ✅ Toutes les organisations sont déjà à jour`, 'green');
    }

    // Étape 4: Vérifier les utilisateurs
    log('\n📝 Étape 4: Vérification des utilisateurs...', 'blue');
    const usersSnapshot = await getDocs(collection(db, 'users'));
    log(`   📊 ${usersSnapshot.size} utilisateur(s) trouvé(s)`, 'cyan');
    
    let usersWithoutOrg = 0;
    let usersOk = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      if (!userData.organizationId) {
        usersWithoutOrg++;
        log(`   ⚠️  Utilisateur ${userData.email} sans organisation`, 'yellow');
      } else {
        usersOk++;
      }
    }
    
    log(`\n   📊 Résumé utilisateurs:`, 'cyan');
    log(`      - Avec organisation: ${usersOk}`, 'green');
    log(`      - Sans organisation: ${usersWithoutOrg}`, usersWithoutOrg > 0 ? 'yellow' : 'green');

    // Résumé final
    log('\n=====================================', 'cyan');
    log('✅ Migrations terminées avec succès !', 'green');
    log('=====================================\n', 'cyan');

  } catch (error) {
    log(`\n❌ Erreur lors des migrations: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Exécution
log('\n🔧 Script de Migration - Sentinel GRC', 'cyan');
log('=====================================', 'cyan');

runMigrations()
  .then(() => {
    log('✅ Script terminé avec succès', 'green');
    process.exit(0);
  })
  .catch((error) => {
    log(`❌ Erreur fatale: ${error.message}`, 'red');
    process.exit(1);
  });
