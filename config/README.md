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

Toutes les valeurs de configuration peuvent etre surchargees via des variables d'environnement avec le prefixe `SENTINEL_` :

| Variable d'environnement | Champ de configuration | Exemple |
|--------------------------|------------------------|---------|
| `SENTINEL_SERVER_URL` | `server_url` | `https://your-sentinel-server.example.com` |
| `SENTINEL_CHECK_INTERVAL_SECS` | `check_interval_secs` | `3600` |
| `SENTINEL_LOG_LEVEL` | `log_level` | `debug` |
| `SENTINEL_PROXY_URL` | `proxy.url` | `http://proxy:8080` |
| `SENTINEL_PROXY_USERNAME` | `proxy.username` | `user` |
| `SENTINEL_VULNERABILITY_SCAN_INTERVAL_SECS` | `vulnerability_scan_interval_secs` | `21600` |
| `SENTINEL_SECURITY_SCAN_INTERVAL_SECS` | `security_scan_interval_secs` | `300` |
| `SENTINEL_HEARTBEAT_INTERVAL_SECS` | `heartbeat_interval_secs` | `60` |

## Priorite de configuration

La configuration est chargee dans cet ordre (les sources ulterieures ecrasent les precedentes) :

1. **Valeurs par defaut** - Valeurs par defaut codees en dur
2. **Fichier JSON** - Chemin specifique a la plateforme ou chemin personnalise
3. **Variables d'environnement** - Prefixe `SENTINEL_*`

## Mode developpement

Pour le developpement, placez `agent.json` dans le repertoire de travail courant. L'agent utilisera ce fichier si aucune configuration au niveau systeme n'existe.
