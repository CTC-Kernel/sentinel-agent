# 🚀 Exécution de la Migration - Guide Pas à Pas

**URL ouverte** : https://console.firebase.google.com/project/sentinel-grc-a8701/functions/list

---

## 📋 Instructions Détaillées

### Étape 1 : Trouver la Fonction

Dans la page Firebase Functions qui vient de s'ouvrir :

1. ✅ Cherchez la fonction **`fixAllUsers`** dans la liste
2. ✅ Elle devrait être dans la région **us-central1**
3. ✅ Type : **Callable**

### Étape 2 : Ouvrir le Menu de Test

1. ✅ Cliquez sur les **3 points verticaux** (⋮) à droite de `fixAllUsers`
2. ✅ Sélectionnez **"Test function"** dans le menu déroulant

### Étape 3 : Configurer le Test

Une fenêtre s'ouvre avec un champ de saisie :

1. ✅ Dans le champ **"Authenticated context"** :
   - Laissez vide ou ignorez (la fonction vérifie l'auth)

2. ✅ Dans le champ **"Data (JSON)"** :
   - Entrez simplement : `{}`
   - Ou laissez vide

### Étape 4 : Exécuter

1. ✅ Cliquez sur le bouton **"Test the function"** (ou "Tester la fonction")
2. ✅ Attendez 30-60 secondes (la fonction traite tous les utilisateurs)

### Étape 5 : Vérifier le Résultat

Vous devriez voir un résultat comme :

```json
{
  "success": true,
  "results": {
    "total": 5,
    "fixed": 2,
    "alreadyOk": 3,
    "errors": []
  }
}
```

**Interprétation** :
- ✅ **total** : Nombre total d'utilisateurs dans la base
- ✅ **fixed** : Utilisateurs qui ont été migrés (assignés à une organisation)
- ✅ **alreadyOk** : Utilisateurs déjà conformes
- ✅ **errors** : Liste des erreurs (devrait être vide `[]`)

---

## ✅ Résultats Attendus

### Si `fixed > 0`
```
✅ Migration réussie !
   - X utilisateur(s) ont été assignés à l'organisation par défaut
   - L'organisation "default-organization" a été créée
   - Les custom claims ont été mis à jour
```

### Si `fixed = 0` et `alreadyOk > 0`
```
✅ Tous les utilisateurs sont déjà conformes !
   - Aucune migration nécessaire
   - Toutes les données sont correctes
```

### Si `errors.length > 0`
```
⚠️  Certaines erreurs se sont produites
   - Consultez le détail dans le champ "errors"
   - Vérifiez les logs de la fonction
```

---

## 🔍 Vérification Post-Migration

### 1. Vérifier dans Firestore

**URL** : https://console.firebase.google.com/project/sentinel-grc-a8701/firestore

#### Collection `organizations`
1. ✅ Cherchez le document **`default-organization`**
2. ✅ Vérifiez qu'il contient :
   - `name`: "Organisation par Défaut"
   - `slug`: "default-organization"
   - `subscription`: objet complet

#### Collection `users`
1. ✅ Ouvrez quelques documents utilisateurs
2. ✅ Vérifiez que chaque utilisateur a :
   - `organizationId`: (doit être rempli)
   - `organizationName`: (doit être rempli)
   - `role`: admin/user/auditor

### 2. Vérifier les Logs

**URL** : https://console.firebase.google.com/project/sentinel-grc-a8701/functions/logs

1. ✅ Filtrez par fonction : **fixAllUsers**
2. ✅ Cherchez les messages :
   - "Starting user migration..."
   - "Creating default organization..."
   - "Migration complete"

### 3. Tester l'Application

**URL** : https://sentinel-grc-a8701.web.app

1. ✅ Connectez-vous avec votre compte
2. ✅ Allez dans **Settings** > **Abonnement**
3. ✅ Cliquez sur **"Gérer l'abonnement"**
4. ✅ Vérifiez qu'il n'y a **plus d'erreur 404**

---

## 🐛 Dépannage

### Erreur : "Permission Denied"

**Message** : `functions/permission-denied`

**Cause** : Vous n'êtes pas admin

**Solution** :
1. Allez dans Firestore : `users/VOTRE_UID`
2. Modifiez le champ `role` en `"admin"`
3. Réessayez

### Erreur : "Function not found"

**Message** : `functions/not-found`

**Cause** : La fonction n'est pas déployée

**Solution** :
```bash
firebase deploy --only functions:fixAllUsers
```

### Erreur : "Timeout"

**Message** : La fonction met trop de temps

**Cause** : Beaucoup d'utilisateurs à migrer

**Solution** :
- C'est normal si vous avez beaucoup d'utilisateurs
- Attendez jusqu'à 2 minutes
- Vérifiez les logs pour voir la progression

### Pas de Résultat

**Symptôme** : Rien ne s'affiche après le clic

**Solution** :
1. Vérifiez votre connexion internet
2. Rafraîchissez la page
3. Réessayez
4. Consultez les logs de la fonction

---

## 📊 Exemple de Résultat Complet

### Scénario 1 : Migration Nécessaire

```json
{
  "success": true,
  "results": {
    "total": 10,
    "fixed": 4,
    "alreadyOk": 6,
    "errors": []
  }
}
```

**Signification** :
- 10 utilisateurs au total
- 4 ont été migrés (assignés à default-organization)
- 6 étaient déjà OK
- Aucune erreur

### Scénario 2 : Déjà Conforme

```json
{
  "success": true,
  "results": {
    "total": 10,
    "fixed": 0,
    "alreadyOk": 10,
    "errors": []
  }
}
```

**Signification** :
- Tous les utilisateurs sont déjà conformes
- Aucune migration nécessaire

### Scénario 3 : Avec Erreurs

```json
{
  "success": true,
  "results": {
    "total": 10,
    "fixed": 8,
    "alreadyOk": 1,
    "errors": [
      {
        "userId": "abc123",
        "error": "User not found in Auth"
      }
    ]
  }
}
```

**Signification** :
- 8 utilisateurs migrés avec succès
- 1 utilisateur déjà OK
- 1 erreur (utilisateur existe dans Firestore mais pas dans Auth)

---

## ✅ Checklist Finale

Après avoir exécuté la migration, vérifiez :

- [ ] La fonction a retourné `"success": true`
- [ ] Le nombre `fixed` + `alreadyOk` = `total`
- [ ] Le tableau `errors` est vide `[]`
- [ ] L'organisation `default-organization` existe dans Firestore
- [ ] Tous les utilisateurs ont un `organizationId`
- [ ] Le portail Stripe fonctionne (pas d'erreur 404)
- [ ] Vous pouvez vous connecter normalement

---

## 🎊 Succès !

Si tous les points ci-dessus sont validés :

✅ **La migration est terminée avec succès !**

Votre application Sentinel GRC est maintenant :
- ✅ Conforme au système multi-tenant
- ✅ Prête pour la production
- ✅ Sans erreurs d'organisation
- ✅ Avec toutes les données intègres

**Félicitations ! 🚀**

---

## 📞 Support

Si vous rencontrez des problèmes :

1. **Logs** : https://console.firebase.google.com/project/sentinel-grc-a8701/functions/logs
2. **Firestore** : https://console.firebase.google.com/project/sentinel-grc-a8701/firestore
3. **Documentation** : Consultez `MIGRATION_GUIDE.md`
