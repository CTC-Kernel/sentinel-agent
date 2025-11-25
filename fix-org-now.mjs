#!/usr/bin/env node

/**
 * Script pour créer l'organisation manquante immédiatement
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDJQQHWKfGqxVGxQXgPXOXQCXQXQXQXQXQ",
  authDomain: "sentinel-grc-a8701.firebaseapp.com",
  projectId: "sentinel-grc-a8701",
  storageBucket: "sentinel-grc-a8701.firebasestorage.app",
  messagingSenderId: "728667422032",
  appId: "1:728667422032:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const orgId = 'wn6qlze5ln';

console.log(`\n🔍 Vérification de l'organisation ${orgId}...\n`);

const orgRef = doc(db, 'organizations', orgId);
const orgSnap = await getDoc(orgRef);

if (orgSnap.exists()) {
  console.log('✅ L\'organisation existe déjà');
  console.log('Données:', orgSnap.data());
} else {
  console.log('⚠️  L\'organisation n\'existe pas. Création...\n');
  
  await setDoc(orgRef, {
    id: orgId,
    name: 'Mon Organisation',
    slug: 'mon-organisation',
    ownerId: 'system',
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
  
  console.log('✅ Organisation créée avec succès !');
  console.log(`   ID: ${orgId}`);
  console.log('   Nom: Mon Organisation');
  console.log('   Plan: Discovery (gratuit)');
}

console.log('\n✅ Terminé ! Vous pouvez maintenant accéder au portail Stripe.\n');
process.exit(0);
