# 🚀 PRÊT À DÉPLOYER !

## ✅ Configuration Complète

Toutes les variables sont maintenant configurées :

### SMTP ✅
- SMTP_HOST: smtp.gmail.com
- SMTP_PORT: 465
- SMTP_USER: contact@cyber-threat-consulting.com
- SMTP_PASS: ✅ Configuré

### Stripe ✅
- STRIPE_SECRET_KEY: ✅ Configuré (hardcodé)
- STRIPE_WEBHOOK_SECRET: ✅ *****REDACTED*****

---

## 🎯 Étapes de Déploiement

### Option 1 : Script Automatique (Recommandé)

```bash
cd functions
./deploy.sh
```

Le script va :
1. ✅ Vérifier tous les prérequis
2. ✅ Tester la syntaxe
3. ✅ Vérifier les secrets
4. ✅ Déployer automatiquement

### Option 2 : Déploiement Manuel

```bash
# 1. Aller dans le dossier functions
cd functions

# 2. Configurer le webhook secret (si pas encore fait)
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# Entrez: ***REDACTED***

# 3. Configurer SMTP (optionnel si déjà fait)
firebase functions:config:set smtp.host="smtp.gmail.com"
firebase functions:config:set smtp.port="465"
firebase functions:config:set smtp.user="contact@cyber-threat-consulting.com"
firebase functions:config:set smtp.pass="recw qbmo dwke twud"

# 4. Déployer
firebase deploy --only functions
```

---

## 📋 Après le Déploiement

### 1. Vérifier les Logs

```bash
firebase functions:log
```

### 2. Tester le Portail Stripe

1. Allez sur votre application : https://sentinel-grc-a8701.web.app
2. Connectez-vous
3. Allez dans **Settings** > Section **Abonnement**
4. Cliquez sur **"Gérer l'abonnement"**
5. Vous devriez être redirigé vers le portail Stripe ✅

### 3. Tester un Abonnement

1. Allez dans **Pricing** ou **Plans**
2. Sélectionnez un plan (Professional ou Enterprise)
3. Cliquez sur **"S'abonner"**
4. Vous devriez être redirigé vers Stripe Checkout ✅

---

## 🔍 Vérifications

### Vérifier que les Functions sont déployées

```bash
firebase functions:list
```

**Résultat attendu :**
```
✔ setUserClaims
✔ refreshUserToken
✔ fixAllUsers
✔ createCheckoutSession
✔ createPortalSession
✔ stripeWebhook
✔ processMailQueue
```

### Vérifier le Webhook Stripe

1. Allez sur https://dashboard.stripe.com/webhooks
2. Vous devriez voir votre webhook avec :
   - URL: `https://us-central1-sentinel-grc-a8701.cloudfunctions.net/stripeWebhook`
   - Status: ✅ Enabled
   - 3 événements écoutés

### Tester le Webhook

Dans le dashboard Stripe :
1. Cliquez sur votre webhook
2. Cliquez sur "Send test webhook"
3. Sélectionnez `customer.subscription.updated`
4. Cliquez "Send test webhook"
5. Vérifiez que le statut est **200 OK** ✅

---

## 🐛 Dépannage

### Erreur 404 sur createPortalSession

**Cause :** Function pas déployée

**Solution :**
```bash
firebase deploy --only functions:createPortalSession
```

### Erreur Webhook Stripe

**Cause :** Secret mal configuré

**Solution :**
```bash
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# Entrez: ***REDACTED***
firebase deploy --only functions:stripeWebhook
```

### Erreur Email

**Cause :** Config SMTP manquante

**Solution :**
```bash
firebase functions:config:set smtp.host="smtp.gmail.com"
firebase functions:config:set smtp.port="465"
firebase functions:config:set smtp.user="contact@cyber-threat-consulting.com"
firebase functions:config:set smtp.pass="recw qbmo dwke twud"
firebase deploy --only functions:processMailQueue
```

---

## 📊 URLs des Functions

Une fois déployées, vos functions seront disponibles à :

- **createPortalSession**: https://us-central1-sentinel-grc-a8701.cloudfunctions.net/createPortalSession
- **createCheckoutSession**: https://us-central1-sentinel-grc-a8701.cloudfunctions.net/createCheckoutSession
- **stripeWebhook**: https://us-central1-sentinel-grc-a8701.cloudfunctions.net/stripeWebhook
- **processMailQueue**: (Trigger automatique sur Firestore)
- **setUserClaims**: (Trigger automatique sur Firestore)

---

## ✅ Checklist Finale

Avant de déployer, vérifiez :

- [x] SMTP configuré
- [x] STRIPE_SECRET_KEY présent
- [x] STRIPE_WEBHOOK_SECRET configuré
- [x] Webhook créé dans Stripe Dashboard
- [x] Code corrigé (HttpsError, permissions)
- [ ] Tests locaux passés (`node test-functions.js`)
- [ ] Firebase CLI connecté (`firebase login`)

---

## 🎊 C'est Parti !

Tout est prêt ! Lancez le déploiement :

```bash
cd functions
./deploy.sh
```

**Temps estimé : 2-3 minutes** ⏱️

Bonne chance ! 🚀
