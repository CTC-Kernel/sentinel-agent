# Sentinel Nexus Web

Interface SaaS React de pilotage SSI. Cette application complète l’agent natif Rust avec une expérience multi-tenant destinée aux équipes SOC, RSSI, GRC et direction.

## Démarrage

```bash
npm install
npm run dev
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
