/**
 * Script de test pour vérifier les Cloud Functions avant déploiement
 * Usage: node test-functions.js
 */

const admin = require('firebase-admin');

// Vérifications de base
console.log('🔍 Vérification des dépendances...\n');

const requiredPackages = [
    'firebase-admin',
    'firebase-functions',
    'stripe',
    'nodemailer'
];

let allDepsOk = true;

requiredPackages.forEach(pkg => {
    try {
        require.resolve(pkg);
        console.log(`✅ ${pkg} - OK`);
    } catch (e) {
        console.log(`❌ ${pkg} - MANQUANT`);
        allDepsOk = false;
    }
});

console.log('\n🔍 Vérification des variables d\'environnement...\n');

const requiredEnvVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS'
];

let allEnvOk = true;

requiredEnvVars.forEach(envVar => {
    if (process.env[envVar]) {
        console.log(`✅ ${envVar} - Défini`);
    } else {
        console.log(`⚠️  ${envVar} - NON DÉFINI (utilisera valeur par défaut)`);
        allEnvOk = false;
    }
});

console.log('\n🔍 Vérification de la syntaxe du code...\n');

try {
    const functions = require('./index.js');
    console.log('✅ Syntaxe JavaScript - OK');
    
    const exportedFunctions = Object.keys(functions);
    console.log(`\n📦 Fonctions exportées (${exportedFunctions.length}):`);
    exportedFunctions.forEach(fn => {
        console.log(`   - ${fn}`);
    });
    
} catch (error) {
    console.log('❌ Erreur de syntaxe:', error.message);
    process.exit(1);
}

console.log('\n🔍 Vérification de la configuration Stripe...\n');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');

// Test de connexion Stripe (si clé valide)
if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
    stripe.products.list({ limit: 1 })
        .then(() => {
            console.log('✅ Connexion Stripe - OK');
        })
        .catch((err) => {
            console.log('❌ Connexion Stripe - ERREUR:', err.message);
        });
} else {
    console.log('⚠️  Clé Stripe non configurée ou invalide');
}

console.log('\n📊 Résumé:\n');

if (allDepsOk && allEnvOk) {
    console.log('✅ Toutes les vérifications sont passées !');
    console.log('🚀 Prêt pour le déploiement: firebase deploy --only functions\n');
    process.exit(0);
} else {
    console.log('⚠️  Certaines vérifications ont échoué.');
    console.log('📝 Consultez DEPLOYMENT_FUNCTIONS.md pour la configuration.\n');
    process.exit(1);
}
