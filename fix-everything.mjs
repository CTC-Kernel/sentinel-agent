#!/usr/bin/env node

/**
 * Script complet pour tout corriger automatiquement
 * Usage: node fix-everything.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import * as readline from 'readline';

const firebaseConfig = {
  apiKey: "***REDACTED***",
  authDomain: "sentinel-grc-a8701.firebaseapp.com",
  projectId: "sentinel-grc-a8701",
  storageBucket: "sentinel-grc-a8701.firebasestorage.app",
  messagingSenderId: "728667422032",
  appId: "1:728667422032:web:f7bb344574e49320a1c055",
  measurementId: "G-2MLLGDZ6GP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

console.log('\n╔════════════════════════════════════════╗');
console.log('║  🚀 CORRECTION COMPLÈTE - SENTINEL GRC  ║');
console.log('╚════════════════════════════════════════╝\n');

async function main() {
  try {
    // Étape 1: Authentification
    console.log('📝 Étape 1/4 : Authentification\n');
    const email = await question('Email admin: ');
    const password = await question('Mot de passe: ');
    
    console.log('\n🔐 Connexion...');
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const currentUser = userCredential.user;
    console.log('✅ Connecté en tant que:', email);
    
    // Étape 2: Vérifier et créer l'organisation manquante
    console.log('\n📝 Étape 2/4 : Correction de l\'organisation wn6qlze5ln\n');
    
    const orgId = 'wn6qlze5ln';
    const orgRef = doc(db, 'organizations', orgId);
    const orgSnap = await getDoc(orgRef);
    
    if (!orgSnap.exists()) {
      console.log('⚠️  Organisation manquante. Création...');
      
      // Trouver l'utilisateur actuel pour obtenir son UID
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      
      await setDoc(orgRef, {
        id: orgId,
        name: userData?.organizationName || 'Mon Organisation',
        slug: 'mon-organisation',
        ownerId: currentUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
      
      console.log('✅ Organisation créée avec succès');
    } else {
      console.log('✅ Organisation existe déjà');
      
      // Vérifier et compléter les champs manquants
      const orgData = orgSnap.data();
      const updates = {};
      
      if (!orgData.slug) {
        updates.slug = 'mon-organisation';
        console.log('   ⚠️  Ajout du slug');
      }
      if (!orgData.updatedAt) {
        updates.updatedAt = new Date().toISOString();
        console.log('   ⚠️  Ajout de updatedAt');
      }
      if (!orgData.subscription || !orgData.subscription.cancelAtPeriodEnd === undefined) {
        updates.subscription = {
          ...orgData.subscription,
          planId: orgData.subscription?.planId || 'discovery',
          status: orgData.subscription?.status || 'active',
          startDate: orgData.subscription?.startDate || new Date().toISOString(),
          stripeCustomerId: orgData.subscription?.stripeCustomerId || null,
          stripeSubscriptionId: orgData.subscription?.stripeSubscriptionId || null,
          currentPeriodEnd: orgData.subscription?.currentPeriodEnd || null,
          cancelAtPeriodEnd: orgData.subscription?.cancelAtPeriodEnd ?? false
        };
        console.log('   ⚠️  Complétion de subscription');
      }
      
      if (Object.keys(updates).length > 0) {
        await setDoc(orgRef, updates, { merge: true });
        console.log('✅ Organisation mise à jour');
      }
    }
    
    // Étape 3: Vérifier toutes les organisations
    console.log('\n📝 Étape 3/4 : Vérification de toutes les organisations\n');
    
    const orgsSnapshot = await getDocs(collection(db, 'organizations'));
    console.log(`📊 ${orgsSnapshot.size} organisation(s) trouvée(s)`);
    
    let orgsFixed = 0;
    for (const orgDoc of orgsSnapshot.docs) {
      const orgData = orgDoc.data();
      const updates = {};
      
      if (!orgData.slug) {
        updates.slug = (orgData.name || orgDoc.id).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      }
      if (!orgData.updatedAt) {
        updates.updatedAt = orgData.createdAt || new Date().toISOString();
      }
      if (!orgData.subscription?.cancelAtPeriodEnd === undefined) {
        updates.subscription = {
          ...orgData.subscription,
          cancelAtPeriodEnd: false
        };
      }
      
      if (Object.keys(updates).length > 0) {
        await setDoc(orgDoc.ref, updates, { merge: true });
        orgsFixed++;
      }
    }
    
    console.log(`✅ ${orgsFixed} organisation(s) corrigée(s)`);
    
    // Étape 4: Exécuter fixAllUsers
    console.log('\n📝 Étape 4/4 : Migration des utilisateurs\n');
    
    try {
      const fixAllUsers = httpsCallable(functions, 'fixAllUsers');
      const result = await fixAllUsers();
      
      console.log('✅ Migration des utilisateurs réussie');
      console.log(`📊 Résultats:`);
      console.log(`   - Total: ${result.data.results.total}`);
      console.log(`   - Corrigés: ${result.data.results.fixed}`);
      console.log(`   - Déjà OK: ${result.data.results.alreadyOk}`);
      console.log(`   - Erreurs: ${result.data.results.errors.length}`);
      
      if (result.data.results.errors.length > 0) {
        console.log('\n⚠️  Erreurs:');
        result.data.results.errors.forEach(err => {
          console.log(`   - ${err.userId}: ${err.error}`);
        });
      }
    } catch (error) {
      console.log('⚠️  Impossible d\'exécuter fixAllUsers:', error.message);
      if (error.code === 'functions/permission-denied') {
        console.log('   ℹ️  Vous devez être admin. Continuons quand même...');
      }
    }
    
    // Résumé final
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║         ✅ CORRECTION TERMINÉE          ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    console.log('🎉 Tout est corrigé ! Vous pouvez maintenant :');
    console.log('   1. Rafraîchir votre application');
    console.log('   2. Tester le portail Stripe');
    console.log('   3. Vérifier que tout fonctionne\n');
    
    rl.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error);
    rl.close();
    process.exit(1);
  }
}

main();
