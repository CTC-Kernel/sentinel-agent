# ✅ Checklist de Configuration - Sentinel GRC

## 📋 État Actuel de la Configuration

### ✅ Variables SMTP (Configurées)

| Variable | Valeur | État |
|----------|--------|------|
| `SMTP_HOST` | smtp.gmail.com | ✅ OK |
| `SMTP_PORT` | 465 | ✅ OK |
| `SMTP_USER` | contact@cyber-threat-consulting.com | ✅ OK |
| `SMTP_PASS` | recw qbmo dwke twud | ✅ OK |

### ⚠️ Variables Stripe (À Compléter)

| Variable | Valeur Actuelle | État | Action Requise |
|----------|----------------|------|----------------|
| `STRIPE_SECRET_KEY` | sk_live_51SXC... (hardcodée) | ⚠️ Présente mais hardcodée | Configurer via Firebase Secrets |
| `STRIPE_WEBHOOK_SECRET` | ❌ Manquante | ❌ À CONFIGURER | **BLOQUANT** |

---

## 🚨 CE QUI MANQUE (CRITIQUE)

### 1. **STRIPE_WEBHOOK_SECRET** ❌ BLOQUANT

**Pourquoi c'est critique ?**
- Sans ce secret, les webhooks Stripe ne peuvent pas être vérifiés
- Les mises à jour d'abonnement ne fonctionneront pas
- Risque de sécurité (webhooks non authentifiés)

**Comment l'obtenir ?**

1. Allez sur https://dashboard.stripe.com/webhooks
2. Cliquez sur "Add endpoint"
3. URL du webhook : `https://us-central1-sentinel-grc-a8701.cloudfunctions.net/stripeWebhook`
4. Sélectionnez ces événements :
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
5. Cliquez sur "Add endpoint"
6. Copiez le "Signing secret" (commence par `whsec_`)

**Où le configurer ?**

```bash
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# Collez la valeur quand demandé
```

---

## 📝 Configuration Complète - Étapes

### Étape 1 : Configurer les Secrets Stripe

```bash
# 1. Webhook Secret (MANQUANT - CRITIQUE)
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# Entrez: whsec_VOTRE_SECRET_ICI

# 2. Secret Key (optionnel, déjà hardcodée)
firebase functions:secrets:set STRIPE_SECRET_KEY
# Entrez: ***REDACTED***
```

### Étape 2 : Configurer SMTP (Déjà fait ✅)

```bash
firebase functions:config:set smtp.host="smtp.gmail.com"
firebase functions:config:set smtp.port="465"
firebase functions:config:set smtp.user="contact@cyber-threat-consulting.com"
firebase functions:config:set smtp.pass="recw qbmo dwke twud"
```

### Étape 3 : Déployer les Functions

```bash
cd functions
firebase deploy --only functions
```

### Étape 4 : Vérifier le Déploiement

```bash
firebase functions:log
```

---

## 🔍 Vérification Rapide

### Test 1 : Vérifier les Secrets

```bash
firebase functions:secrets:access STRIPE_WEBHOOK_SECRET
```

**Résultat attendu :** Affiche votre secret webhook

### Test 2 : Vérifier la Config SMTP

```bash
firebase functions:config:get
```

**Résultat attendu :**
```json
{
  "smtp": {
    "host": "smtp.gmail.com",
    "port": "465",
    "user": "contact@cyber-threat-consulting.com",
    "pass": "recw qbmo dwke twud"
  }
}
```

### Test 3 : Tester les Functions

```bash
cd functions
node test-functions.js
```

**Résultat attendu :** Toutes les vérifications passent ✅

---

## 📊 Récapitulatif

### Variables Configurées ✅

- ✅ SMTP_HOST
- ✅ SMTP_PORT
- ✅ SMTP_USER
- ✅ SMTP_PASS
- ✅ STRIPE_SECRET_KEY (hardcodée, à migrer vers secrets)

### Variables Manquantes ❌

- ❌ **STRIPE_WEBHOOK_SECRET** (CRITIQUE - BLOQUANT)

### Actions Immédiates Requises

1. **🚨 PRIORITÉ 1** : Configurer `STRIPE_WEBHOOK_SECRET`
   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   ```

2. **📝 PRIORITÉ 2** : Déployer les functions
   ```bash
   firebase deploy --only functions
   ```

3. **✅ PRIORITÉ 3** : Tester le portail Stripe
   - Aller dans Settings
   - Cliquer sur "Gérer l'abonnement"
   - Vérifier la redirection vers Stripe

---

## 🎯 Après Configuration

Une fois `STRIPE_WEBHOOK_SECRET` configuré et déployé :

✅ Les utilisateurs pourront gérer leurs abonnements
✅ Les webhooks Stripe seront vérifiés
✅ Les mises à jour d'abonnement seront synchronisées
✅ L'application sera 100% fonctionnelle

---

## 📞 Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs : `firebase functions:log`
2. Vérifiez le dashboard Stripe : https://dashboard.stripe.com/webhooks
3. Consultez `DEPLOYMENT_FUNCTIONS.md`
4. Consultez `functions/CHANGELOG.md`

---

## 🔐 Sécurité

⚠️ **IMPORTANT** : Le fichier `functions/.env` contient des secrets sensibles.

- ❌ NE JAMAIS commiter ce fichier dans Git
- ✅ Utiliser Firebase Secrets pour la production
- ✅ Le fichier `.gitignore` doit contenir `.env`

Vérifiez :
```bash
cat functions/.gitignore | grep .env
```

Si absent, ajoutez :
```bash
echo ".env" >> functions/.gitignore
```
