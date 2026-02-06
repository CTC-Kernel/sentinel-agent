# 🚀 Guide de Migration - Sentinel GRC

**Date** : 25 Novembre 2025  
**Objectif** : Migrer toutes les données existantes pour les rendre conformes

---

## 📋 Ce qui sera migré

### 1. Organisations
- ✅ Ajout du champ `slug` (si manquant)
- ✅ Ajout du champ `updatedAt` (si manquant)
- ✅ Complétion de l'objet `subscription` (tous les champs)

### 2. Utilisateurs
- ✅ Assignation à l'organisation par défaut (si sans org)
- ✅ Mise à jour des custom claims Firebase Auth
- ✅ Vérification de l'intégrité référentielle

---

## 🎯 Méthode 1 : Via Firebase Console (Recommandé)

### Étape 1 : Accéder à la Console

1. Allez sur https://console.firebase.google.com/project/sentinel-grc-a8701/functions
2. Trouvez la fonction `fixAllUsers`
3. Cliquez sur les 3 points > **Test function**

### Étape 2 : Exécuter la Migration

1. Dans le champ de test, entrez :
   ```json
   {}
   ```

2. Cliquez sur **Test the function**

3. Attendez le résultat (30-60 secondes)

### Étape 3 : Vérifier les Résultats

Le résultat affichera :
```json
{
  "success": true,
  "results": {
    "total": 10,
    "fixed": 3,
    "alreadyOk": 7,
    "errors": []
  }
}
```

**Interprétation** :
- `total` : Nombre total d'utilisateurs
- `fixed` : Utilisateurs migrés
- `alreadyOk` : Utilisateurs déjà conformes
- `errors` : Liste des erreurs (devrait être vide)

---

## 🎯 Méthode 2 : Via l'Application

### Étape 1 : Se Connecter en Admin

1. Allez sur https://sentinel-grc-a8701.web.app
2. Connectez-vous avec un compte **admin**

### Étape 2 : Ouvrir la Console Développeur

1. Appuyez sur `F12` (Chrome/Firefox) ou `Cmd+Option+I` (Mac)
2. Allez dans l'onglet **Console**

### Étape 3 : Exécuter le Script

Copiez-collez ce code dans la console :

```javascript
// Importer les fonctions Firebase
import { getFunctions, httpsCallable } from 'firebase/functions';

// Appeler fixAllUsers
const functions = getFunctions();
const fixAllUsers = httpsCallable(functions, 'fixAllUsers');

console.log('🚀 Démarrage de la migration...');

fixAllUsers()
  .then(result => {
    console.log('✅ Migration réussie !');
    console.log('📊 Résultats:', result.data);
    console.log(`   - Total: ${result.data.results.total}`);
    console.log(`   - Corrigés: ${result.data.results.fixed}`);
    console.log(`   - Déjà OK: ${result.data.results.alreadyOk}`);
    console.log(`   - Erreurs: ${result.data.results.errors.length}`);
    
    if (result.data.results.errors.length > 0) {
      console.error('⚠️  Erreurs:', result.data.results.errors);
    }
  })
  .catch(error => {
    console.error('❌ Erreur:', error);
    if (error.code === 'functions/permission-denied') {
      console.error('⚠️  Vous devez être admin pour exécuter cette migration');
    }
  });
```

---

## 🎯 Méthode 3 : Via Firebase CLI

### Prérequis

```bash
# S'authentifier
firebase login

# Vérifier le projet
firebase use sentinel-grc-a8701
```

### Exécution

```bash
# Appeler la fonction
firebase functions:call fixAllUsers
```

---

## 🔍 Vérification Post-Migration

### 1. Vérifier les Organisations

1. Allez dans Firebase Console > Firestore
2. Collection `organizations`
3. Vérifiez qu'une organisation `default-organization` existe
4. Vérifiez que toutes les organisations ont :
   - `slug`
   - `updatedAt`
   - `subscription` complet

### 2. Vérifier les Utilisateurs

1. Collection `users`
2. Vérifiez que tous les utilisateurs ont :
   - `organizationId`
   - `organizationName`
   - `role`

### 3. Vérifier les Custom Claims

Dans la console :

```javascript
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;

user.getIdTokenResult().then(token => {
  console.log('Custom Claims:', token.claims);
  console.log('Organization ID:', token.claims.organizationId);
  console.log('Role:', token.claims.role);
});
```

---

## 📊 Résultats Attendus

### Avant Migration

| Élément | État |
|---------|------|
| Organisations sans slug | ⚠️ Possible |
| Organisations sans updatedAt | ⚠️ Possible |
| Subscription incomplète | ⚠️ Possible |
| Utilisateurs sans org | ⚠️ Possible |
| Claims manquants | ⚠️ Possible |

### Après Migration

| Élément | État |
|---------|------|
| Organisations sans slug | ✅ Aucune |
| Organisations sans updatedAt | ✅ Aucune |
| Subscription incomplète | ✅ Aucune |
| Utilisateurs sans org | ✅ Aucun |
| Claims manquants | ✅ Aucun |

---

## 🐛 Dépannage

### Erreur : "Permission Denied"

**Cause** : Vous n'êtes pas admin

**Solution** :
1. Connectez-vous avec un compte admin
2. Ou modifiez votre rôle dans Firestore :
   ```
   users/VOTRE_UID/role = "admin"
   ```

### Erreur : "Organization not found"

**Cause** : L'organisation par défaut n'a pas été créée

**Solution** :
1. La fonction `fixAllUsers` crée automatiquement l'organisation
2. Si l'erreur persiste, créez-la manuellement dans Firestore

### Erreur : "Function not found"

**Cause** : La fonction n'est pas déployée

**Solution** :
```bash
firebase deploy --only functions:fixAllUsers
```

---

## 📝 Logs de Migration

Pour voir les logs de la migration :

```bash
firebase functions:log --only fixAllUsers
```

Ou dans Firebase Console > Functions > fixAllUsers > Logs

---

## ✅ Checklist Post-Migration

- [ ] Fonction `fixAllUsers` exécutée avec succès
- [ ] Aucune erreur dans les résultats
- [ ] Organisation `default-organization` créée
- [ ] Tous les utilisateurs ont un `organizationId`
- [ ] Toutes les organisations ont un `slug`
- [ ] Toutes les subscriptions sont complètes
- [ ] Custom claims mis à jour
- [ ] Test de connexion réussi
- [ ] Test du portail Stripe réussi

---

## 🎊 Conclusion

Une fois la migration terminée :

1. ✅ Toutes les données sont conformes
2. ✅ Le système multi-tenant est cohérent
3. ✅ Plus d'erreur "Organization not found"
4. ✅ Le portail Stripe fonctionne
5. ✅ L'application est prête pour la production

**La migration est une opération sûre et idempotente** : vous pouvez l'exécuter plusieurs fois sans risque.
