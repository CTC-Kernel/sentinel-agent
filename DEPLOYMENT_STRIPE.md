# Configuration Stripe pour Sentinel GRC

Pour activer le système de paiement et d'abonnement en production, suivez ces étapes.

## 1. Obtenir les Clés Stripe

1.  Créez un compte sur [Stripe Dashboard](https://dashboard.stripe.com/).
2.  Allez dans **Développeurs > Clés API**.
3.  Notez votre **Clé publique** (pk_live_...) et votre **Clé secrète** (sk_live_...).
4.  Allez dans **Développeurs > Webhooks** et ajoutez un endpoint :
    *   URL : `https://us-central1-<YOUR-PROJECT-ID>.cloudfunctions.net/stripeWebhook`
    *   Events à écouter :
        *   `customer.subscription.created`
        *   `customer.subscription.updated`
        *   `customer.subscription.deleted`
    *   Notez le **Secret de signature Webhook** (whsec_...).

## 2. Créer les Produits dans Stripe

Créez deux produits dans votre catalogue Stripe :

### Produit : Professional
*   Nom : **Sentinel GRC Professional**
*   Prix Mensuel : **199 €** (ID: `price_professional_monthly_id`)
*   Prix Annuel : **1910 €**

### Produit : Enterprise
*   Nom : **Sentinel GRC Enterprise**
*   Prix Mensuel : **499 €** (ID: `price_enterprise_monthly_id`)
*   Prix Annuel : **4790 €**

> **IMPORTANT** : Une fois les prix créés, copiez les IDs (ex: `price_1Pxyz...`) et mettez-les à jour dans le fichier `functions/index.js` à la ligne 139.

## 3. Configurer Firebase Functions

Exécutez ces commandes dans votre terminal pour sécuriser vos clés :

```bash
firebase functions:config:set stripe.secret="sk_live_..." stripe.webhook_secret="whsec_..."
```

Puis redéployez les fonctions :

```bash
firebase deploy --only functions
```

## 4. Configuration Frontend (Optionnel)

Si vous utilisez Stripe Elements côté client (pas le cas actuellement, on utilise Stripe Checkout), ajoutez la clé publique dans `.env.production` :

```
VITE_STRIPE_PUBLIC_KEY=pk_live_...
```

## 5. Tester

1.  Créez une organisation gratuite.
2.  Allez sur "Plans & Facturation".
3.  Cliquez sur "Professional".
4.  Vous devriez être redirigé vers Stripe Checkout.
5.  Après paiement, vous revenez sur l'application et votre statut est mis à jour (grâce au Webhook).
