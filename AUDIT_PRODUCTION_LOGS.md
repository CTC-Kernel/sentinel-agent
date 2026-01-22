# Audit des Logs de Production - Cloud Functions

**Date :** 22 Janvier 2026
**Statut :** ANALYSIÉ (Sentinel-Core Production Audit)
**Périmètre :** Logs d'exécution GCP (Runtime), Erreurs NIS2, Intégration IA.

## 1. Anomalies de Production Détectées

| Élément | Type | Description | Impact | Cause Racine |
| :--- | :--- | :--- | :--- | :--- |
| **Notification Retry** | 🔴 ERROR | `Update() requires either a single JavaScript object...` | **CRITIQUE** | `deliveryInfo.headers` contient des objets non-POJO (Plain Old JavaScript Object) lors de l'échec de retry, bloquant l'envoi d'emails. |
| **Generative AI** | 🔴 ERROR | `Model gemini-1.5-flash-002 is not supported for API version v1beta` | **HAUT** | Le SDK `GoogleGenerativeAI` n'utilise pas la version d'API correcte (`v1alpha` vs `v1beta`) selon le modèle demandé. |
| **NIS2 Compliance** | 🟡 WARNING | `No admin/rssi found for org [ID]` | **MOYEN** | Workflow bloqué (Impasse métier) : Des calculs NIS2 tournent pour des orgs sans contact de sécurité configuré. |
| **Rate Limiting** | 🟢 INFO | `Cleaned up X expired rate limit entries` | **SAIN** | Maintenance automatique des limites de requêtes opérationnelle. |

---

## 2. Analyse Technique & Correctifs Proposés

### 2.1 Correction Serialization Email (`functions/notifications/index.js`)
L'erreur de serialization Firestore survient car les headers retournés par SendGrid ne sont pas toujours transformés en objets simples.
**Correction :** Utiliser une conversion JSON stricte pour garantir la compatibilité Firestore.
```javascript
// Remplacer le bloc complexe de conversion des headers par :
const headersObj = JSON.parse(JSON.stringify(response.headers || {}));
```

### 2.2 Correction Versioning AI (`functions/ai/index.js`)
La fonction `getGeminiClientForUser` ignore actuellement le paramètre `apiVersion`.
**Correction :** Configurer le SDK avec la version d'API demandée.
```javascript
// Mettre à jour getGeminiClientForUser pour accepter les options :
return new GoogleGenerativeAI(apiKey, { apiVersion });
```

### 2.3 Correction NIS2 Dead-Ends
Le checker NIS2 doit alerter le Super Admin si une organisation est active mais n'a pas de contact sécurité défini.
**Correction :** Ajouter un log spécifique dans `system_logs` (type `AUDIT_MISSING_CONTACT`) pour que le Super Admin puisse intervenir.

---

## 3. Rapport d'Intégrité (Sentinel-Core)

*   **Audit Trail :** Les logs d'audit sont présents mais l'erreur de serialization dans les retries montre une fragilité dans la persistance des preuves d'échec.
*   **Performance :** De nombreux "Cold Starts" observés sur l'API, suggérant l'activation de `minInstances: 1` pour les modules critiques (Auth/API).
*   **Sécurité :** Les tentatives de connexion hors-sso sont bien journalisées dans `auth_audit_logs`.

> [!WARNING]
> **Alerte Régression :** L'impossibilité de retrier les emails en erreur (due à la serialization) peut entraîner une rupture de service sur les notifications NIS2 obligatoires (délais légaux de 24h/72h).

---

Souhaitez-vous que j'applique ces correctifs immédiatement pour stabiliser la production ?
