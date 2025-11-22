# Déploiement Firebase

Ce guide explique comment déployer l'application Sentinel GRC v2 en production.

## Prérequis

1. Firebase CLI installé : `npm install -g firebase-tools`
2. Compte Firebase avec projet configuré
3. Node.js 18+ installé

## Configuration Firebase

### 1. Initialiser Firebase (si pas déjà fait)

```bash
firebase login
firebase init
```

Sélectionner :
- ✅ Firestore
- ✅ Hosting
- ✅ Storage
- ✅ Functions (optionnel, pour les notifications automatiques)

### 2. Déployer les Règles Firestore

```bash
firebase deploy --only firestore:rules
```

### 3. Déployer les Index Firestore

```bash
firebase deploy --only firestore:indexes
```

### 4. Configurer App Check (Sécurité)

1. Aller dans Firebase Console > App Check
2. Activer reCAPTCHA Enterprise
3. Ajouter `localhost` et votre domaine de production
4. Mettre à jour la clé dans `firebase.ts`

### 5. Build et Déploiement

```bash
# Build de production
npm run build

# Déployer sur Firebase Hosting
firebase deploy --only hosting
```

## Notifications Automatiques (Optionnel)

Pour activer les notifications automatiques, déployez les Cloud Functions :

### 1. Créer le fichier `functions/src/index.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

// Vérifications toutes les 6 heures
export const scheduledNotificationChecks = functions.pubsub
  .schedule('every 6 hours')
  .onRun(async (context) => {
    const db = admin.firestore();
    
    // Récupérer toutes les organisations
    const usersSnapshot = await db.collection('users').get();
    const organizationIds = new Set<string>();
    
    usersSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.organizationId) {
        organizationIds.add(data.organizationId);
      }
    });

    // Exécuter les vérifications pour chaque organisation
    for (const orgId of organizationIds) {
      await runChecksForOrganization(orgId, db);
    }
    
    console.log(`Checks completed for ${organizationIds.size} organizations`);
  });

async function runChecksForOrganization(orgId: string, db: admin.firestore.Firestore) {
  // Vérifier les audits à venir
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  
  const auditsSnapshot = await db.collection('audits')
    .where('organizationId', '==', orgId)
    .where('status', 'in', ['Planifié', 'En cours'])
    .get();
    
  for (const auditDoc of auditsSnapshot.docs) {
    const audit = auditDoc.data();
    const auditDate = new Date(audit.dateScheduled);
    
    if (auditDate <= sevenDaysFromNow && auditDate > new Date()) {
      const daysUntil = Math.ceil((auditDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
      // Trouver l'auditeur
      const auditorSnapshot = await db.collection('users')
        .where('organizationId', '==', orgId)
        .where('displayName', '==', audit.auditor)
        .limit(1)
        .get();
        
      if (!auditorSnapshot.empty) {
        const auditorId = auditorSnapshot.docs[0].id;
        
        await db.collection('notifications').add({
          organizationId: orgId,
          userId: auditorId,
          type: daysUntil <= 3 ? 'danger' : 'warning',
          title: `Audit à venir : ${audit.name}`,
          message: `L'audit est prévu dans ${daysUntil} jour(s)`,
          link: '/audits',
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }
  
  // Ajouter d'autres vérifications (documents, maintenance, risques)...
}
```

### 2. Déployer les Functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

## Variables d'Environnement

Créer un fichier `.env.local` pour le développement :

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_key
```

## Commandes Utiles

```bash
# Développement local
npm run dev

# Build de production
npm run build

# Prévisualiser le build
npm run preview

# Déployer tout
firebase deploy

# Déployer uniquement Hosting
firebase deploy --only hosting

# Déployer uniquement Firestore
firebase deploy --only firestore

# Déployer uniquement Functions
firebase deploy --only functions

# Voir les logs
firebase functions:log
```

## Sécurité

### Règles Firestore

Les règles Firestore sont déjà configurées dans `firestore.rules` avec :
- Authentification obligatoire
- Isolation par organisation
- RBAC (admin, auditor, user)
- Validation des données

### App Check

App Check protège votre backend Firebase contre :
- Abus et trafic non autorisé
- Bots et scrapers
- Attaques DDoS

Assurez-vous de configurer reCAPTCHA Enterprise dans la console Firebase.

## Performance

### Index Firestore

Les index composites sont définis dans `firestore.indexes.json` pour optimiser :
- Requêtes de dashboard
- Recherches multi-critères
- Tri et filtrage avancés

### Caching

L'application utilise :
- Firestore offline persistence
- Service Worker (optionnel)
- Lazy loading des composants

## Monitoring

1. **Firebase Console** : Performances, erreurs, analytics
2. **Firestore Usage** : Lectures/écritures, stockage
3. **Hosting** : Bande passante, requêtes
4. **Functions** : Invocations, erreurs, durée

## Support

Pour toute question :
- Documentation Firebase : https://firebase.google.com/docs
- Support : Cyber Threat Consulting
