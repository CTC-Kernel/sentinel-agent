# 🚨 CORRECTION URGENTE - Organisation Manquante

**Problème** : L'organisation `wn6qlze5ln` n'existe pas dans Firestore  
**Impact** : Erreur "Organization not found" sur le portail Stripe

---

## ✅ Solution Immédiate (2 minutes)

J'ai ouvert la console Firestore pour vous. Suivez ces étapes :

### Étape 1 : Vérifier si le Document Existe

Dans la page qui vient de s'ouvrir :
- Si le document existe → Passez à l'étape 3
- Si "Document not found" → Continuez à l'étape 2

### Étape 2 : Créer le Document

1. ✅ Cliquez sur **"Start collection"** ou retournez à la collection `organizations`
2. ✅ Cliquez sur **"Add document"**
3. ✅ Dans "Document ID", entrez : `wn6qlze5ln`
4. ✅ Ajoutez les champs suivants :

#### Champs à Ajouter

| Champ | Type | Valeur |
|-------|------|--------|
| `id` | string | `wn6qlze5ln` |
| `name` | string | `Mon Organisation` (ou le nom que vous voulez) |
| `slug` | string | `mon-organisation` |
| `ownerId` | string | `VOTRE_USER_ID` (votre UID Firebase) |
| `createdAt` | string | `2025-11-25T20:30:00.000Z` |
| `updatedAt` | string | `2025-11-25T20:30:00.000Z` |

#### Sous-objet `subscription`

Cliquez sur **"Add field"** et créez un champ de type **map** nommé `subscription` :

| Champ | Type | Valeur |
|-------|------|--------|
| `subscription.planId` | string | `discovery` |
| `subscription.status` | string | `active` |
| `subscription.startDate` | string | `2025-11-25T20:30:00.000Z` |
| `subscription.stripeCustomerId` | null | null |
| `subscription.stripeSubscriptionId` | null | null |
| `subscription.currentPeriodEnd` | null | null |
| `subscription.cancelAtPeriodEnd` | boolean | false |

5. ✅ Cliquez sur **"Save"**

### Étape 3 : Vérifier

1. ✅ Rafraîchissez votre application : https://app.cyber-threat-consulting.com
2. ✅ Allez dans Settings > Abonnement
3. ✅ Cliquez sur "Gérer l'abonnement"
4. ✅ Vérifiez qu'il n'y a plus d'erreur 404

---

## 🎯 Alternative Rapide : Copier-Coller JSON

Si Firestore permet l'import JSON, utilisez ceci :

```json
{
  "id": "wn6qlze5ln",
  "name": "Mon Organisation",
  "slug": "mon-organisation",
  "ownerId": "VOTRE_USER_ID",
  "createdAt": "2025-11-25T20:30:00.000Z",
  "updatedAt": "2025-11-25T20:30:00.000Z",
  "subscription": {
    "planId": "discovery",
    "status": "active",
    "startDate": "2025-11-25T20:30:00.000Z",
    "stripeCustomerId": null,
    "stripeSubscriptionId": null,
    "currentPeriodEnd": null,
    "cancelAtPeriodEnd": false
  }
}
```

**⚠️ Remplacez `VOTRE_USER_ID`** par votre vrai UID (trouvez-le dans `users/VOTRE_EMAIL`)

---

## 🔍 Trouver Votre User ID

1. Dans Firestore, allez à la collection `users`
2. Trouvez votre document (par email)
3. L'ID du document est votre `ownerId`
4. Copiez-le et utilisez-le dans le champ `ownerId` ci-dessus

---

## ✅ Après Création

Une fois l'organisation créée :

1. ✅ L'erreur "Organization not found" disparaîtra
2. ✅ Vous pourrez accéder au portail Stripe
3. ✅ L'application fonctionnera normalement

---

## 🎊 C'est Tout !

Cette correction prend **2 minutes** et résout immédiatement le problème.

Après cela, vous pourrez exécuter la migration `fixAllUsers` pour corriger tous les autres utilisateurs qui pourraient avoir le même problème.
