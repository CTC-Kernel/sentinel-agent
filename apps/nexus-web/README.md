# Sentinel Nexus Web

Interface SaaS React de pilotage SSI. Cette application complète l’agent natif Rust avec une expérience multi-tenant destinée aux équipes SOC, RSSI, GRC et direction.

## Démarrage

```bash
npm ci
npm run dev
```

`package-lock.json` fixe les versions : `npm ci` installe exactement celles qui ont été vérifiées.

### Données de démonstration

Les indicateurs, incidents et matrices affichés sont encore des exemples statiques (`src/data.ts` et les pages) ; un badge « Démonstration » le signale dans la barre du haut. Seuls le lancement de workflows, l'historique des exécutions et l'assistant interrogent la passerelle.

Une erreur de la passerelle est toujours affichée telle quelle : un refus (401, 403, MFA manquante, rôle insuffisant) n'est jamais présenté comme un succès. Pour une démonstration sans passerelle, construisez avec `VITE_DEMO_MODE=true` : une passerelle injoignable est alors remplacée par une simulation annoncée comme telle (« Simulation DÉMO-… : aucune exécution réelle »).

### En-têtes de sécurité

Le build de production ajoute une Content-Security-Policy stricte en `<meta>` (`vite.config.ts`) : tout vient de l'origine Sentinel, aucun script inline. Le thème est appliqué avant le premier affichage par `public/theme-init.js` pour cette raison. Certaines directives ne sont pas prises en compte dans un `<meta>` ; le serveur qui sert `dist/` doit envoyer :

```
Content-Security-Policy: frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## Architecture de sécurité n8n

Le navigateur **ne contacte jamais n8n directement** et ne reçoit aucune clé n8n. Il appelle uniquement le gateway Sentinel via `/api/orchestration` avec une session sécurisée HttpOnly.

1. Le gateway valide la session JWT/OIDC, le MFA, le tenant et le rôle.
2. Les droits `view`, `execute`, `edit` et `approve` sont vérifiés pour le workflow demandé.
3. Les paramètres sont validés contre le schéma du workflow. Les secrets sont résolus dans Vault côté serveur.
4. Le backend appelle l’API REST du n8n auto-hébergé sur son réseau privé.
5. Chaque action produit un événement d’audit immuable avec identité, tenant, workflow, empreinte des paramètres et résultat.
6. Les webhooks entrants doivent inclure timestamp, nonce et signature HMAC-SHA256. Le backend rejette les signatures invalides et les replays avant toute transmission métier.

L’interface couvre le lancement paramétré, la planification, l’historique, les approbations humaines, le marketplace interne, les connecteurs, la gouvernance RBAC et les propositions de workflows par LLM.

## Intelligence multi-modèle

Le navigateur sélectionne une capacité (`Kimi K2`, `OpenAI`, `Azure OpenAI` ou `Nexus Local`) mais ne reçoit jamais les credentials du fournisseur. Le gateway `/api/intelligence` applique les politiques du tenant, expurge les secrets, enrichit la demande avec le contexte autorisé et route vers le modèle choisi. Les appels disposent d’un timeout, de retries exponentiels, de l’annulation et d’un transport SSE pour le streaming.

Toute action proposée par un modèle est une proposition typée : elle doit repasser par le RBAC, les contrôles métier et, pour les actions sensibles, une approbation humaine. Le contenu généré ne peut donc pas appeler directement n8n ni les connecteurs de sécurité.

## Résilience et plateformes

- Error boundary global avec repli explicite en mode dégradé sécurisé.
- Raccourcis clavier `Cmd/Ctrl + K` et `Escape`, navigation responsive et reprise de la dernière page de la session.
- PWA installable sur Windows, macOS, Linux, iOS et Android.
- Service worker limité au shell statique : les routes `/api/*` et les données tenant ne sont jamais mises en cache.

## Noyau sécurisé du gateway

Le répertoire `server/` contient le cœur testable du gateway d’orchestration. Il reçoit uniquement une identité déjà vérifiée par l’adaptateur OIDC, impose simultanément le tenant et le rôle, valide les variables, exige l’approbation des workflows sensibles puis transmet à l’adaptateur n8n. Les erreurs n8n sont converties en réponses stables sans exposer les détails internes.

Les webhooks utilisent une signature HMAC-SHA256 calculée sur `timestamp.nonce.body`, une comparaison en temps constant, une fenêtre de cinq minutes et un nonce à usage unique. Le journal d’audit forme une chaîne SHA-256 afin de rendre toute altération détectable.

Les exécutions sont également protégées par une clé d’idempotence scoped par tenant et utilisateur, une limitation de débit à fenêtre glissante, un schéma dynamique de variables et une exigence MFA pour les workflows à impact élevé. L’adaptateur OIDC doit vérifier cryptographiquement le JWT avant de transmettre ses claims au noyau, qui contrôle ensuite issuer, audience, durée de vie, tenant, rôles et niveau d’authentification.

Le moteur d’exécution applique une machine à états stricte, une pagination par curseur, l’isolation des historiques par tenant et le principe des quatre yeux : le demandeur ne peut pas approuver sa propre action. Une reprise après approbation requiert un responsable SOC authentifié en MFA. Les callbacks tardifs reçus après un état terminal sont ignorés de façon idempotente.

```bash
npm run test:gateway
```
