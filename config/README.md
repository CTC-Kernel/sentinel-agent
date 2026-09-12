# Configuration du Sentinel GRC Agent

Ce repertoire contient les fichiers de configuration d'exemple pour le Sentinel GRC Agent.

## Fichiers de configuration

- `agent.example.json` - Exemple de configuration minimale
- `agent.full.example.json` - Configuration complete avec toutes les options

## Chemins specifiques par plateforme

L'agent determine automatiquement les chemins en fonction du systeme d'exploitation :

### Windows

| Type de chemin | Emplacement |
|----------------|-------------|
| Fichier de configuration | `C:\ProgramData\Sentinel\agent.json` |
| Base de donnees | `C:\ProgramData\Sentinel\data\agent.db` |
| Logs | `C:\ProgramData\Sentinel\logs\` |

### Linux

| Type de chemin | Emplacement |
|----------------|-------------|
| Fichier de configuration | `/etc/sentinel/agent.json` |
| Base de donnees | `/var/lib/sentinel-grc/agent.db` |
| Logs | `/var/log/sentinel-grc/` |

### macOS

| Type de chemin | Emplacement |
|----------------|-------------|
| Fichier de configuration | `~/Library/Application Support/SentinelGRC/agent.json` |
| Base de donnees | `~/Library/Application Support/SentinelGRC/agent.db` |
| Logs | `~/Library/Application Support/SentinelGRC/logs/` |

## Variables d'environnement

Toutes les valeurs de premier niveau peuvent etre surchargees via des variables d'environnement avec le prefixe `SENTINEL_` suivi du nom du champ en majuscules :

| Variable d'environnement | Champ de configuration | Exemple |
|--------------------------|------------------------|---------|
| `SENTINEL_STANDALONE` | `standalone` (mode autonome, sans plateforme) | `true` |
| `SENTINEL_SERVER_URL` | `server_url` | `https://grc.votre-domaine.com/fn/agentApi` |
| `SENTINEL_ENROLLMENT_TOKEN` | `enrollment_token` | `<orgId>:<token>` |
| `SENTINEL_CA_CERT_PATH` | `ca_cert_path` | `/etc/sentinel/ca.pem` |
| `SENTINEL_CHECK_INTERVAL_SECS` | `check_interval_secs` | `3600` |
| `SENTINEL_HEARTBEAT_INTERVAL_SECS` | `heartbeat_interval_secs` | `60` |
| `SENTINEL_LOG_LEVEL` | `log_level` | `debug` |
| `SENTINEL_ACTIVE_FRAMEWORKS` | `active_frameworks` (liste, separateur `,`) | `ISO27001,NIST-CSF` |
| `SENTINEL_DATA_DIR` | repertoire de donnees et de configuration | `/opt/sentinel-data` |

Les champs imbriques sont mappes explicitement :

| Variable d'environnement | Champ de configuration |
|--------------------------|------------------------|
| `SENTINEL_PROXY_URL` | `proxy.url` |
| `SENTINEL_PROXY_USERNAME` | `proxy.username` |
| `SENTINEL_PROXY_PASSWORD` | `proxy.password` |
| `SENTINEL_LLM_ENABLED` | `llm.enabled` |
| `SENTINEL_LLM_MODEL` | `llm.model` |

## Priorite de configuration

La configuration est chargee dans cet ordre (les sources ulterieures ecrasent les precedentes) :

1. **Valeurs par defaut** - Valeurs par defaut codees en dur
2. **Fichier JSON** - Chemin specifique a la plateforme ou chemin personnalise
3. **Variables d'environnement** - Prefixe `SENTINEL_*`

## Mode autonome (standalone)

L'agent peut proteger un poste **sans aucune plateforme** : detection (EDR),
integrite des fichiers, conformite, analyse de vulnerabilites, inventaire et
reseau restent actifs et toutes les donnees restent sur le poste. Aucun
enrolement, aucun heartbeat, aucun envoi, aucune commande distante ni mise a
jour distante. C'est le mode destine aux particuliers et aux postes qui ont
seulement besoin d'une protection locale.

```json
{
  "standalone": true
}
```

- Activation : au choix a l'installation (dialogue du MSI, `INSTALLMODE=STANDALONE`,
  `SENTINEL_STANDALONE=1` pour le `.deb` et le `.pkg`), depuis l'assistant de
  premier lancement (« Protection locale »), ou en ligne de commande :
  `sentinel-agent standalone` (droits administrateur requis : couper ou
  rétablir la remontée vers la plateforme n'est pas à la portée d'un simple
  utilisateur).
- Retour vers une plateforme : bouton « Connecter a une plateforme » dans les
  reglages de l'interface, `sentinel-agent enroll` (desactive le mode
  autonome en cas de succes) ou `sentinel-agent standalone --disable`.
- `server_url` n'est pas verifie en mode autonome ; `enrollment_token` est
  ignore. Les identifiants d'une plateforme deja enregistres sont conserves
  mais inutilises tant que `standalone` vaut `true`.

## Mode developpement

Pour le developpement, placez `agent.json` dans le repertoire de travail courant. L'agent utilisera ce fichier si aucune configuration au niveau systeme n'existe.

## Plateforme on-premise (self-hosted)

En mode self-hosted, la plateforme Sentinel GRC expose l'API agents derriere le
reverse proxy Nginx sous le prefixe `/fn/agentApi` (pont Cloud Functions,
ADR-013). Le `server_url` doit donc pointer sur ce prefixe, **pas** sur la
racine du domaine :

```json
{
  "server_url": "https://grc.votre-domaine.com/fn/agentApi",
  "ca_cert_path": "/etc/sentinel/ca.pem"
}
```

- `server_url` : `https://<APP_BASE_URL>/fn/agentApi` (l'agent ajoute lui-meme
  `/v1/agents/...`). Le schema `https://` est obligatoire en build release.
- `ca_cert_path` : requis si la plateforme utilise un certificat auto-signe ou
  une PKI interne qui n'est pas dans le magasin de confiance du systeme.
  L'agent utilise le magasin systeme (Windows/macOS/`/etc/ssl/certs`) ; un CA
  deploye par GPO/MDM fonctionne sans ce champ.
- TLS 1.3 minimum : le Nginx fourni avec la plateforme le supporte ; un
  equipement intermediaire limite a TLS 1.2 bloquera l'agent.
- Enrolement en ligne de commande : `sentinel-agent enroll --server
  https://grc.votre-domaine.com/fn/agentApi` enregistre l'URL dans `agent.json`
  afin que le service demarre sur la meme instance.
- Windows (MSI) : `msiexec /i sentinel-agent.msi /qn
  SERVERURL=https://grc.votre-domaine.com/fn/agentApi ENROLLMENTTOKEN=<token>`.

Verification rapide depuis un poste :

```bash
curl -sS https://grc.votre-domaine.com/fn/agentApi/v1/health
```

La reponse doit etre un JSON (`{"status":"ok",...}`) et non la page HTML du
tableau de bord.
