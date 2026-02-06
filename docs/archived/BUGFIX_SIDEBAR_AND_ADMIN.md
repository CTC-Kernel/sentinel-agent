# Corrections des Bugs - Sidebar Dupliquée et Admin Management

**Date:** 2026-01-09
**Problèmes identifiés:**
1. Deux menus (Sidebar) s'affichent lors de la connexion
2. Page /admin_management non accessible

---

## 🐛 Problème 1: Sidebar Dupliquée

### Localisation
**Fichier:** `src/App.tsx`
**Lignes:** 155-161

### Code Actuel (INCORRECT)
```tsx
<div>
    <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
</div>

<div>
    <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
</div>
```

### Cause
Duplication accidentelle du composant Sidebar dans le `AppLayout`.

### Solution
Supprimer l'une des deux occurrences.

### Code Corrigé
```tsx
<div>
    <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
</div>
```

---

## 🐛 Problème 2: Page /admin_management Non Accessible

### Localisation
**Fichiers:**
- `src/App.tsx` (lignes 268-276)
- `src/components/auth/SuperAdminGuard.tsx` (ligne 30)

### Code Actuel
```tsx
// App.tsx
<Route path="/admin_management" element={
    <SuperAdminGuard>
        <NotificationProvider>
            <AppLayout />
        </NotificationProvider>
    </SuperAdminGuard>
} >
    <Route index element={<AdminDashboard />} />
</Route>

// SuperAdminGuard.tsx
if (user.role !== 'super_admin') {
    return <Navigate to="/" replace />;
}
```

### Cause
La route `/admin_management` nécessite le rôle `super_admin` qui n'existe peut-être pas dans votre base de données, ou vous n'avez pas ce rôle assigné.

### Solutions Possibles

#### Option 1: Autoriser le rôle "admin" (RECOMMANDÉ)
Modifier `SuperAdminGuard.tsx` pour accepter aussi le rôle `admin` :

```tsx
// SuperAdminGuard.tsx - ligne 30
if (user.role !== 'super_admin' && user.role !== 'admin') {
    return <Navigate to="/" replace />;
}
```

#### Option 2: Assigner le rôle super_admin dans Firestore
Si vous voulez garder la restriction stricte, assignez le rôle dans Firestore :

1. Ouvrir Firebase Console
2. Aller dans Firestore Database
3. Collection `users` → Votre document utilisateur
4. Modifier le champ `role` : `"super_admin"`
5. **Aussi modifier les Custom Claims** dans Firebase Authentication

#### Option 3: Créer une route admin séparée
Si vous voulez que tous les admins y accèdent, créer une route dédiée :

```tsx
// App.tsx - Ajouter avant la route admin_management
<Route path="/admin" element={
    <AuthGuard requiredRole="admin">
        <NotificationProvider>
            <AppLayout />
        </NotificationProvider>
    </AuthGuard>
} >
    <Route index element={<AdminDashboard />} />
</Route>
```

---

## 🔧 Application des Corrections

### Étape 1: Corriger la Sidebar Dupliquée

```bash
# Ouvrir le fichier
code src/App.tsx

# Aller à la ligne 155
# Supprimer l'une des deux occurrences de Sidebar (lignes 159-161)
```

### Étape 2: Corriger l'Accès Admin (Option 1 - Recommandé)

```bash
# Ouvrir le fichier
code src/components/auth/SuperAdminGuard.tsx

# Aller à la ligne 30
# Remplacer :
if (user.role !== 'super_admin') {

# Par :
if (user.role !== 'super_admin' && user.role !== 'admin') {
```

### Étape 3: Tester

```bash
# 1. Sauvegarder les fichiers modifiés

# 2. Vérifier en local (si applicable)
npm run dev

# 3. Build et déployer
npm run build
firebase deploy
```

---

## ✅ Validation

### Test 1: Vérifier la Sidebar
- [ ] Se connecter à l'application
- [ ] Vérifier qu'une seule Sidebar s'affiche
- [ ] Tester sur mobile (menu hamburger)

### Test 2: Vérifier Admin Management
- [ ] Se connecter en tant qu'admin
- [ ] Naviguer vers https://app.cyber-threat-consulting.com/#/admin_management
- [ ] Vérifier que la page AdminDashboard s'affiche
- [ ] Vérifier qu'aucune redirection ne se produit

---

## 🎯 Résumé des Changements

| Fichier | Ligne | Changement |
|---------|-------|------------|
| `src/App.tsx` | 159-161 | ❌ Supprimer les lignes (Sidebar dupliquée) |
| `src/components/auth/SuperAdminGuard.tsx` | 30 | ✏️ Ajouter `&& user.role !== 'admin'` |

---

## 🔍 Diagnostic Supplémentaire

Si le problème persiste après ces corrections, vérifier :

### 1. Rôle dans Firestore
```bash
# Firebase Console > Firestore
# users/{votre_user_id}
# Champ "role" : "admin" ou "super_admin"
```

### 2. Custom Claims Firebase
```bash
# Firebase Console > Authentication > Users
# Cliquer sur votre utilisateur
# Vérifier les Custom Claims
# Devrait contenir : { "role": "admin" }
```

### 3. Forcer le Refresh du Token
```tsx
// Dans la console du navigateur (F12)
import { auth } from './firebase';
await auth.currentUser.getIdToken(true);
// Puis recharger la page
```

### 4. Vider le Cache
```bash
# Dans le navigateur
# Ctrl+Shift+Delete
# Cocher : Cookies, Cache, Local Storage
# Puis se reconnecter
```

---

## 📞 Support

Si les problèmes persistent :

1. Vérifier les logs dans la Console (F12)
2. Vérifier les logs Firebase Functions
3. Vérifier que le déploiement est complet
4. Tester en navigation privée (pour exclure le cache)

---

**Corrections créées le:** 2026-01-09
**Status:** Prêt à appliquer
**Temps estimé:** 5 minutes
