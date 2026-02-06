# Audit de Sécurité - Sentinel GRC v2

**Date:** 17 Décembre 2025
**Statut:** Audit Pré-Mise en Production
**Normes:** ISO 27001, OWASP Top 10, ANSSI, Firebase Security Best Practices

## 1. Synthèse Exécutive

L'application est globalement bien architecturée avec une séparation claire des privilèges via Firebase Authentication et Custom Claims. L'utilisation de `firestore.rules` est modulaire et couvre la majorité des collections. Cependant, **deux vulnérabilités critiques** ont été identifiées qui pourraient permettre à un administrateur malveillant de contourner le système de paiement ou d'élever ses privilèges de manière illégitime.

## 2. Vulnérabilités Critiques (Priorité Immédiate)

### 🔴 2.1. Contournement du Paiement (Payment Bypass)
**Composant:** `firestore.rules` -> `organizations/{orgId}`
**Description:**
Les règles de sécurité actuelles permettent à tout administrateur d'une organisation (ou au propriétaire) de mettre à jour l'intégralité du document de l'organisation, y compris l'objet `subscription`.
**Impact:**
Un utilisateur "Admin" peut modifier manuellement son document `organizations/MY_ORG_ID` pour passer son `planId` de `discovery` à `enterprise` et changer `status` à `active`, contournant ainsi totalement Stripe.
**Preuve dans le code (`firestore.rules`):**
```javascript
// Ligne 83
allow update: if belongsToOrganization(orgId) && (isAdmin() || resource.data.ownerId == request.auth.uid);
```
**Remédiation Recommandée:**
Interdire la modification du champ `subscription` par le client. Ce champ ne doit être modifiable que par les Cloud Functions (backend) suite aux webhooks Stripe.

```javascript
// Correction suggérée dans firestore.rules
allow update: if belongsToOrganization(orgId) && (isAdmin() || resource.data.ownerId == request.auth.uid)
              && (!('subscription' in request.resource.data) || request.resource.data.subscription == resource.data.subscription);
```

### 🔴 2.2. Stockage de Tokens Sensibles (XSS Exposure)
**Composant:** Frontend (`src/components/calendar/CreateEventModal.tsx`, `CalendarDashboard.tsx`)
**Description:**
Le token d'accès Google Calendar (`google_access_token`) est stocké en clair dans le `localStorage` du navigateur.
**Impact:**
En cas de faille XSS (Cross-Site Scripting), même mineure (via une dépendance tierce compromise par exemple), un attaquant peut exfiltrer ce token et accéder/modifier l'agenda Google de l'utilisateur sans son consentement.
**Remédiation Recommandée:**
*   Ne pas stocker de tokens d'accès longue durée côté client si possible.
*   Si nécessaire, utiliser des cookies `HttpOnly` sécurisés ou gérer l'authentification Google via le backend (Cloud Functions) qui agit comme proxy, gardant les tokens côté serveur (cryptés).
*   *Solution rapide (moins sûre):* Nettoyer le token après usage ou utiliser `sessionStorage` (qui s'efface à la fermeture de l'onglet), mais cela nuit à l'UX.

## 3. Risques Élevés (High)

### 🟠 3.1. Divulgation de Données Utilisateurs (Excessive Data Exposure)
**Composant:** `firestore.rules` -> `users/{userId}`
**Description:**
```javascript
allow read: if isAuthenticated() && ( ... || belongsToOrganization(resource.data.organizationId));
```
Tout membre d'une organisation peut lire la totalité des documents `users` des autres membres de la même organisation.
**Impact:**
Si le document `user` contient des données sensibles (PII, tokens, logs privés, métadonnées techniques), elles sont exposées à tous les collègues.
**Remédiation:**
Restreindre la lecture aux champs publics uniquement, ou vérifier qu'aucune donnée sensible n'est stockée à la racine du doc `user`.

## 4. Risques Moyens (Medium)

### 🟡 4.1. Content Security Policy (CSP) Permissive
**Composant:** `firebase.json`
**Description:**
La CSP inclut `'unsafe-inline'` et `'unsafe-eval'` pour `script-src`.
```json
"script-src 'self' 'unsafe-inline' 'unsafe-eval' ..."
```
**Impact:**
Cela désactive une grande partie des protections contre les attaques XSS.
**Remédiation:**
Supprimer `'unsafe-inline'` et `'unsafe-eval'`. Si des librairies (comme certaines versions de libs de charts ou d'utils) le requièrent, chercher des alternatives ou utiliser des nonces/hashes.

### 🟡 4.2. Logique d'Admin "Super Admin" via Email Harcodé
**Composant:** `functions/index.js` -> `verifySuperAdmin`
**Description:**
La vérification se base sur une liste d'emails en dur (`thibault.llopis@gmail.com`).
**Impact:**
Si le compte Google est compromis, l'attaquant devient Super Admin de toute la plateforme.
**Remédiation:**
Migrer vers un système de Custom Claims strict géré en base de données, sans emails en dur dans le code source.

## 5. Bonnes Pratiques & Conformité (Low / Info)

*   **HTML Sanitization:** ✅ L'utilisation de `SafeHTML` avec `DOMPurify` est correcte et protège contre les XSS basiques dans le contenu riche.
*   **Protection des Logs:** ✅ Les collections `system_logs` et `mail_queue` sont correctement verrouillées en écriture ( `allow create: if false` ), garantissant l'intégrité des pistes d'audit (Audit Trails), crucial pour ISO 27001.
*   **Séparation des Rôles:** ✅ L'usage de Custom Claims (`organizationId`, `role`) est la bonne approche pour la performance et la sécurité.

## 6. Plan d'Action Immédiat (Next Steps)

1.  [ ] **Appliquer le correctif `firestore.rules`** pour protéger le champ `subscription` (bloquer l'écriture client).
2.  [ ] **Appliquer le correctif `firestore.rules`** pour protéger les champs sensibles des audits (`approvedBy`, `status` définitif) si nécessaire.
3.  [ ] **Auditer le stockage `localStorage`** et planifier la migration du Google Token vers le backend.
