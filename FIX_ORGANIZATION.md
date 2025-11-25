# 🔧 Correction - Organization Not Found

## 🐛 Problème Identifié

L'erreur "Organization not found" indique que :
1. L'utilisateur n'a pas d'`organizationId` dans son profil
2. OU l'organisation n'existe pas dans Firestore

## 🔍 Diagnostic

### Vérifier l'utilisateur dans Firestore

1. Allez dans Firebase Console : https://console.firebase.google.com/project/sentinel-grc-a8701/firestore
2. Collection `users`
3. Trouvez votre utilisateur (par email)
4. Vérifiez les champs :
   - `organizationId` : Doit être présent
   - `organizationName` : Doit être présent
   - `role` : Doit être `admin` ou `owner`

### Vérifier l'organisation dans Firestore

1. Collection `organizations`
2. Cherchez le document avec l'ID = `organizationId` de l'utilisateur
3. Vérifiez les champs :
   - `name` : Nom de l'organisation
   - `ownerId` : UID du propriétaire
   - `subscription` : Objet avec les infos d'abonnement

## ✅ Solutions

### Solution 1 : Créer l'organisation manuellement

**Dans Firebase Console > Firestore :**

1. Créez un document dans `organizations` avec un ID unique (ex: `org-123`)
2. Ajoutez les champs :
   ```json
   {
     "name": "Mon Organisation",
     "ownerId": "VOTRE_USER_UID",
     "createdAt": "2025-11-25T20:00:00Z",
     "subscription": {
       "planId": "discovery",
       "status": "active"
     }
   }
   ```

3. Mettez à jour votre utilisateur dans `users/VOTRE_UID` :
   ```json
   {
     "organizationId": "org-123",
     "organizationName": "Mon Organisation",
     "role": "admin"
   }
   ```

### Solution 2 : Utiliser la fonction fixAllUsers

**Via Firebase Console > Functions :**

1. Allez dans Functions
2. Trouvez `fixAllUsers`
3. Testez-la avec votre compte admin

**OU via code :**

```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

const fixUsers = httpsCallable(functions, 'fixAllUsers');
fixUsers().then(result => {
  console.log('Migration result:', result.data);
});
```

### Solution 3 : Script de création automatique

Créez ce fichier `scripts/create-organization.js` :

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createOrganization(userId, userEmail) {
  const orgId = `org-${Date.now()}`;
  
  // Créer l'organisation
  await db.collection('organizations').doc(orgId).set({
    name: `Organisation de ${userEmail}`,
    ownerId: userId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    subscription: {
      planId: 'discovery',
      status: 'active'
    }
  });
  
  // Mettre à jour l'utilisateur
  await db.collection('users').doc(userId).update({
    organizationId: orgId,
    organizationName: `Organisation de ${userEmail}`,
    role: 'admin'
  });
  
  console.log(`✅ Organisation créée: ${orgId}`);
  console.log(`✅ Utilisateur mis à jour: ${userId}`);
}

// Remplacez par votre UID et email
const USER_ID = 'VOTRE_UID';
const USER_EMAIL = 'votre-email@example.com';

createOrganization(USER_ID, USER_EMAIL)
  .then(() => {
    console.log('✅ Terminé !');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });
```

**Exécution :**
```bash
node scripts/create-organization.js
```

## 🚀 Après Correction

1. Redéployez les functions avec les logs améliorés :
   ```bash
   firebase deploy --only functions:createPortalSession
   ```

2. Redéployez le frontend :
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

3. Testez à nouveau le portail Stripe

## 📋 Checklist de Vérification

- [ ] L'utilisateur a un `organizationId` dans Firestore
- [ ] L'organisation existe dans Firestore
- [ ] L'utilisateur a le rôle `admin` ou est le `ownerId`
- [ ] L'organisation a un objet `subscription`
- [ ] Les functions sont redéployées
- [ ] Le frontend est redéployé

## 🔍 Logs pour Déboguer

Après redéploiement, vérifiez les logs :

```bash
firebase functions:log --only createPortalSession
```

Vous devriez voir :
- `Fetching organization: org-xxx`
- Si erreur : `Organization not found: org-xxx`

## 💡 Prévention Future

Pour éviter ce problème à l'avenir, assurez-vous que :

1. Chaque nouvel utilisateur est automatiquement associé à une organisation
2. La fonction `setUserClaims` crée l'organisation si elle n'existe pas
3. Le processus d'inscription crée l'organisation par défaut

## 📞 Support

Si le problème persiste :
1. Vérifiez les logs : `firebase functions:log`
2. Vérifiez Firestore Console
3. Vérifiez que l'utilisateur est bien authentifié
