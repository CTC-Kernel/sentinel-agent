#!/usr/bin/env node

/**
 * Script pour exécuter la migration immédiatement
 * Usage: node run-migration-now.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Configuration Firebase
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

console.log('\n🚀 Exécution de la migration...\n');

// Demander les credentials
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

readline.question('Email admin: ', (email) => {
  readline.question('Mot de passe: ', async (password) => {
    readline.close();
    
    try {
      // Se connecter
      console.log('\n🔐 Authentification...');
      await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Connecté\n');
      
      // Appeler la fonction
      console.log('📝 Exécution de fixAllUsers...');
      const fixAllUsers = httpsCallable(functions, 'fixAllUsers');
      const result = await fixAllUsers();
      
      console.log('\n✅ Migration terminée !\n');
      console.log('📊 Résultats:');
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
      
      console.log('\n✅ Migration réussie !\n');
      process.exit(0);
      
    } catch (error) {
      console.error('\n❌ Erreur:', error.message);
      if (error.code === 'functions/permission-denied') {
        console.error('⚠️  Vous devez être admin pour exécuter cette migration');
      }
      process.exit(1);
    }
  });
});
