# 🚀 Déploiement des Cloud Functions

## ⚠️ Problème Actuel

L'erreur `404` sur `createPortalSession` indique que les Cloud Functions ne sont pas déployées sur Firebase.

## 📋 Prérequis

1. **Stripe Account** configuré
2. **Firebase CLI** installé : `npm install -g firebase-tools`
3. **Variables d'environnement** configurées

## 🔧 Configuration

### 1. Variables d'Environnement Stripe

Dans le dossier `functions/`, créez un fichier `.env` :

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-app
```

### 2. Configurer Firebase Functions

```bash
cd functions
npm install
```

### 3. Configurer les Secrets Firebase

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase functions:config:set smtp.host="smtp.gmail.com"
firebase functions:config:set smtp.port="587"
firebase functions:config:set smtp.user="votre-email@gmail.com"
firebase functions:config:set smtp.pass="votre-mot-de-passe-app"
```

## 🚀 Déploiement

### Déployer toutes les fonctions

```bash
firebase deploy --only functions
```

### Déployer une fonction spécifique

```bash
firebase deploy --only functions:createPortalSession
firebase deploy --only functions:createCheckoutSession
```

## 📝 Fonctions Disponibles

### 1. `createCheckoutSession`
- **Usage** : Créer une session de paiement Stripe
- **Paramètres** : `organizationId`, `planId`, `interval`, `successUrl`, `cancelUrl`
- **Retour** : `{ url: string }`

### 2. `createPortalSession`
- **Usage** : Accéder au portail de gestion Stripe
- **Paramètres** : `organizationId`, `returnUrl`
- **Retour** : `{ url: string }`

### 3. `sendEmail`
- **Usage** : Envoyer des emails via SMTP
- **Paramètres** : `to`, `subject`, `html`
- **Retour** : `{ success: boolean }`

### 4. `setUserClaims`
- **Usage** : Définir les claims personnalisés (auto-trigger)
- **Trigger** : Création de document dans `users/{userId}`

### 5. `refreshUserToken`
- **Usage** : Forcer la mise à jour du token utilisateur
- **Paramètres** : Aucun (utilise auth.uid)
- **Retour** : `{ success: boolean }`

## 🔍 Vérification

### Vérifier que les fonctions sont déployées

```bash
firebase functions:list
```

### Tester une fonction

```bash
firebase functions:shell
```

Puis dans le shell :
```javascript
createPortalSession({ organizationId: 'test-org-id', returnUrl: 'http://localhost:5173/settings' })
```

## 🐛 Dépannage

### Erreur 404 sur createPortalSession

**Cause** : La fonction n'est pas déployée

**Solution** :
```bash
cd functions
firebase deploy --only functions:createPortalSession
```

### Erreur de permissions

**Cause** : Stripe API keys non configurées

**Solution** :
```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
```

### Erreur CORS

**Cause** : Domaine non autorisé

**Solution** : Ajouter votre domaine dans Firebase Console > Functions > CORS settings

## 📊 Monitoring

### Voir les logs en temps réel

```bash
firebase functions:log --only createPortalSession
```

### Voir tous les logs

```bash
firebase functions:log
```

## 🔐 Sécurité

- ✅ Toutes les fonctions vérifient l'authentification
- ✅ Les secrets sont stockés dans Firebase Secrets
- ✅ Les webhooks Stripe sont vérifiés
- ✅ CORS configuré pour votre domaine uniquement

## 📈 Coûts

Les Cloud Functions Firebase sont facturées selon :
- **Invocations** : 2M gratuites/mois
- **Temps d'exécution** : 400K GB-secondes/mois gratuits
- **Réseau sortant** : 5GB/mois gratuits

Pour une application GRC, coût estimé : **~5-10€/mois**

## 🎯 Prochaines Étapes

1. ✅ Configurer les variables d'environnement
2. ✅ Déployer les fonctions : `firebase deploy --only functions`
3. ✅ Tester le portail Stripe depuis Settings
4. ✅ Configurer les webhooks Stripe
5. ✅ Tester les paiements en mode test

## 📞 Support

En cas de problème, vérifiez :
1. Les logs Firebase : `firebase functions:log`
2. Le dashboard Stripe : https://dashboard.stripe.com
3. La console Firebase : https://console.firebase.google.com
