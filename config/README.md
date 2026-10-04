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

## Flux d'indicateurs de compromission

`threat_intel_feeds` liste des sources d'adresses et de domaines malveillants,
ajoutés à ce que le détecteur réseau connaît déjà (y compris ce que la
plateforme pousse). Aucune source n'est contactée par défaut.

```json
"threat_intel_feeds": [
  { "name": "feodo-tracker",
    "url": "https://feodotracker.abuse.ch/downloads/ipblocklist.txt" },
  { "name": "taxii-interne",
    "url": "https://cti.example.com/taxii2/api/collections/ID/objects/",
    "format": "taxii", "authorization": "Bearer JETON", "refresh_hours": 6 }
]
```

| Champ | Role | Defaut |
|-------|------|--------|
| `name` | Nom du flux (journaux, copie locale) ; unique | requis |
| `url` | Adresse HTTPS du flux | requis |
| `format` | `text` (une adresse, un domaine ou une URL par ligne ; CSV et fichiers hosts acceptes), `stix` (bundle STIX 2.1), `taxii` (objets d'une collection TAXII 2.1) | `text` |
| `authorization` | Valeur de l'en-tete `Authorization` (`Bearer …`, `Basic …`, cle MISP) | aucun |
| `refresh_hours` | Heures entre deux telechargements (1 au minimum) | `12` |

- Les flux sont telecharges en entier : rien du poste n'est envoye.
- Les adresses non routables (privees, locales) sont refusees : un flux ne
  peut pas faire signaler le reseau interne.
- Un flux en echec garde ses derniers indicateurs, aussi conserves sur disque
  pour le prochain demarrage.
- MISP : utilisez son export texte ou STIX avec la cle dans `authorization`.

## Fichiers leurres anti-ransomware

`"ransomware_canaries": true` (ou `SENTINEL_RANSOMWARE_CANARIES=true`, ou le
reglage dans Parametres) depose un dossier masque de faux documents dans le
dossier personnel et le dossier Documents de chaque utilisateur. Un leurre
reecrit ou renomme leve un incident critique. Desactive par defaut ; la
desactivation supprime les leurres intacts.

## Detection des processus en temps reel

`"process_event_telemetry": true` (ou `SENTINEL_PROCESS_EVENT_TELEMETRY=true`)
fait evaluer chaque processus a son lancement par les regles de detection
(motifs integres et regles Sigma), au lieu d'attendre l'analyse periodique.
Desactive par defaut.

| Systeme | Source | Prerequis |
|---------|--------|-----------|
| macOS | evenements Endpoint Security, via l'outil systeme `eslogger` | root, acces complet au disque |
| Windows | trace `Win32_ProcessStartTrace`, via PowerShell | administrateur |
| Linux | connecteur de processus du noyau (option de compilation `proc-connector`, non activee par defaut) | root |

Si la source ne demarre pas, l'analyse periodique reste seule a detecter.

## Regles YARA

Les regles `*.yar` / `*.yara` du dossier `yara.d` du dossier de donnees sont
appliquees aux fichiers que la surveillance d'integrite signale comme crees
ou modifies. Le moteur (YARA-X) tourne dans un programme separe,
`sentinel-yara`, a construire depuis `tools/sentinel-yara` et a installer a
cote du binaire de l'agent (ou a designer par `SENTINEL_YARA_HELPER`). Sans ce
programme ou sans regles, l'analyse YARA est inactive.

## Regles Sigma

Les regles Sigma (`*.yml`, `*.yaml`, sous-dossiers compris) du dossier
`sigma.d` du dossier de donnees sont evaluees sur les processus du poste a
chaque analyse de securite. Les regles de la communaute SigmaHQ pour
`process_creation` s'utilisent telles quelles. Voir `sigma.example.yml`.

## Controles de conformite personnalises

Les fichiers `*.toml` du dossier `checks.d` du dossier de donnees declarent
des controles supplementaires. Voir `checks.example.toml`.

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
