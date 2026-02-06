# 🔧 Correction de l'erreur "Missing organization ID" - Agent Rust

## 📋 Problème
L'agent Rust affichait l'erreur :
```
ERREUR : network error: Heartbeat failed: 401 Unauthorized - {"error":"Missing organization ID"}
```

## 🎯 Root Cause
L'agent Rust n'envoyait pas l'en-tête `X-Organization-Id` requis par l'API heartbeat dans `functions/agents/api.js`.

## ✅ Corrections apportées

### 1. **Ajout du champ organization_id à ApiClient**
```rust
// crates/agent-core/src/api_client.rs
pub struct ApiClient {
    client: Client,
    base_url: String,
    agent_id: Option<String>,
    client_certificate: Option<String>,
    client_key: Option<String>,
    organization_id: Option<String>, // ✅ NOUVEAU
}
```

### 2. **Ajout de la méthode set_organization_id**
```rust
pub fn set_organization_id(&mut self, organization_id: String) {
    self.organization_id = Some(organization_id);
}
```

### 3. **Mise à jour de la fonction authenticate**
```rust
fn authenticate(&self, builder: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
    let mut builder = if let Some(ref cert) = self.client_certificate {
        builder.header("X-Agent-Certificate", cert)
    } else {
        builder
    };

    // ✅ Ajout de l'en-tête X-Organization-Id
    if let Some(ref org_id) = self.organization_id {
        builder = builder.header("X-Organization-Id", org_id);
    }

    builder
}
```

### 4. **Stockage de l'organization_id après enrollment**
```rust
// crates/agent-core/src/lib.rs - fonction enroll
let response = client.enroll(request).await?;

// ✅ Stocker l'organization_id dans l'API client
{
    let mut api_client = self.api_client.write().await;
    if let Some(client) = api_client.as_mut() {
        client.set_organization_id(response.organization_id.clone());
    }
}
```

### 5. **Restauration de l'organization_id au démarrage**
```rust
// crates/agent-core/src/lib.rs - fonction ensure_enrolled
if let Some(ref agent_id) = self.config.agent_id {
    client.set_agent_id(agent_id.clone());
    
    // ✅ Restaurer l'organization_id depuis les credentials stockés
    if let Some(ref db) = self.db {
        let auth_client = agent_sync::AuthenticatedClient::new(self.config.clone(), db.clone());
        if let Ok(organization_id) = auth_client.organization_id().await {
            client.set_organization_id(organization_id.to_string());
            info!("Restored organization ID: {}", organization_id);
        }
    }
    
    info!("Using existing agent ID: {}", agent_id);
    return Ok(());
}
```

## 🔄 Flux de correction

1. **Premier enrollment** : L'agent reçoit `organization_id` de la réponse d'enrollment et le stocke
2. **Heartbeat** : Chaque requête heartbeat inclut maintenant l'en-tête `X-Organization-Id`
3. **Redémarrage** : L'agent restaure l'`organization_id` depuis les credentials stockés localement

## 🧪 Test
```bash
cd sentinel-agent
cargo check  # ✅ Compilation réussie
```

## 📝 Notes importantes

- L'en-tête `X-Organization-Id` est **obligatoire** pour toutes les requêtes d'agent
- L'agent fallback vers Firestore direct si l'API échoue (mobile)
- L'agent Rust utilise uniquement l'API REST
- La correction est rétrocompatible avec les agents existants

## 🎉 Résultat attendu
Après déploiement de la version corrigée de l'agent Rust :
- ✅ Plus d'erreur "Missing organization ID"
- ✅ Heartbeats réussis avec authentification complète
- ✅ Synchronisation normale des données de conformité
