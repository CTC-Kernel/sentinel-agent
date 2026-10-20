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

`C:\ProgramData\Sentinel` est reserve a SYSTEM et aux Administrateurs
(proprietaire Administrateurs, heritage de `ProgramData` coupe, aucun droit
pour les autres comptes) : l'installateur l'applique, et le service a chaque
demarrage. L'application de bureau s'ouvre donc avec les droits
d'administrateur (demande d'elevation). Le jeton d'enrolement donne a
l'installateur (`ENROLLMENTTOKEN`) est remis a l'agent dans une valeur du
registre que seuls SYSTEM et les Administrateurs peuvent lire
(`HKLM\SOFTWARE\Sentinel\Agent\Enrollment`), jamais sur une ligne de commande.

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

## Reponse : verrouillage de compte et commandes de reponse

Deux actions de playbook s'ajoutent a l'arret de processus, a la quarantaine,
au blocage d'adresse et a l'isolement :

- **Verrouiller le compte** : verrouille le compte designe par l'alerte (le
  compte d'une session ouverte apres une force brute), pour la duree donnee en
  parametre (secondes ; vide : une heure ; `0` : jusqu'a intervention). root,
  les comptes systeme, le compte de l'agent et le dernier administrateur sont
  refuses.
- **Commande de reponse** : lance un programme declare ici, que le playbook
  demande par son nom (parametre de l'action).

Un blocage d'adresse dure ce que dit le parametre de l'action (secondes ;
vide : une heure ; `0` : sans fin). Une adresse bloquee automatiquement de
nouveau dans la journee l'est deux fois plus longtemps que la fois precedente,
jusqu'a une semaine (recidive, comme `repeated_offenders` chez Wazuh).

```json
"response_commands": [
  { "name": "open-ticket", "program": "/usr/local/bin/sentinel-ticket",
    "args": ["--queue", "soc"], "timeout_secs": 30 }
]
```

| Champ | Role | Defaut |
|-------|------|--------|
| `name` | Nom demande par les playbooks (minuscules, chiffres, `-`, `_`) | requis |
| `program` | Chemin absolu du programme, lance sans interpreteur | requis |
| `args` | Arguments, tels que declares | aucun |
| `timeout_secs` | Secondes accordees avant arret (600 au plus) | `60` |

Le programme recoit sur son entree standard un document JSON (playbook,
conditions reconnues, processus, adresses, fichiers et comptes vises) et
reussit en sortant avec le code 0. Sous Unix il doit appartenir a root ou au
compte de l'agent et n'etre modifiable par personne d'autre ; sous Windows,
appartenir a SYSTEM, aux Administrateurs ou a TrustedInstaller et n'etre
modifiable par aucun autre compte. Un playbook ne peut que nommer une commande
declaree : rien de ce qu'il contient n'est execute.

## Commandes surveillees

Des programmes lances a intervalle regulier, dont la sortie est surveillee
(comme les sources `command` et `full_command` de Wazuh) :

```json
"command_monitors": [
  { "name": "listening-ports", "program": "/usr/bin/ss", "args": ["-tlnH"],
    "interval_secs": 600 }
]
```

| Champ | Role | Defaut |
|-------|------|--------|
| `name` | Nom de la commande, et du service Sigma de ses lignes (minuscules, chiffres, `-`, `_`) | requis |
| `program` | Chemin absolu du programme, lance sans interpreteur | requis |
| `args` | Arguments, tels que declares | aucun |
| `interval_secs` | Secondes entre deux lancements (60 au moins) | `300` |
| `report_changes` | Signaler un changement de la sortie, avec les lignes changees | `true` |

Chaque ligne de la sortie passe aux regles des journaux comme un evenement du
service `name` : une regle Sigma `logsource: service: listening-ports` s'y
applique. Le programme suit les regles des commandes de reponse (proprietaire
root ou le compte de l'agent, modifiable par personne d'autre) ; il a une
minute et 256 Kio de sortie au plus. La derniere sortie est gardee dans
`commands/` du dossier de donnees.

## Inventaire du poste

`"system_inventory": true` (defaut) releve toutes les dix minutes le systeme
et le materiel (version, noyau, fabricant, modele, numero de serie,
processeur, memoire), les comptes, les groupes, les services, les ports en
ecoute et, sous Windows, les correctifs installes (`Get-HotFix`). Il signale ce
qui change : compte cree, compte ajoute a un groupe d'administration, service
installe, port ouvert sur le reseau leve un incident ; un changement du
systeme, du materiel ou des correctifs est enregistre. Le premier inventaire
sert de reference. `sentinel-agent inventory` affiche l'inventaire courant en
JSON. Sous Linux, le numero de serie n'est lisible que par root.

## Politiques de conformite (SCA)

- Les politiques YAML deposees dans `sca.d` (dossier de donnees de l'agent)
  sont toujours executees. Le format est celui des politiques SCA de Wazuh ;
  voir `config/sca.example.yml`.
- `"hardening_benchmark": true` execute en plus le socle de durcissement livre
  avec l'agent pour le systeme du poste (environ 90 controles sous Linux, 30
  sous macOS, 45 sous Windows). Desactive par defaut : ces controles entrent
  dans le score de conformite.
- Un controle qui ne peut pas etre evalue (fichier absent, outil non installe)
  est « non applicable » et ne compte pas dans le score.

## Detection de rootkits

`"rootkit_detection": true` (defaut) recherche ce que le systeme cache :
processus, ports d'ecoute et modules noyau caches, bibliotheque imposee a tous
les programmes, interface en mode promiscuite, fichiers ordinaires dans `/dev`,
programmes masques dans les dossiers temporaires. Une fois par heure, chaque
port TCP est lie un instant pour verifier qu'il n'est pas occupe a l'insu du
systeme ; `false` desactive l'ensemble. Linux et macOS seulement.

## Analyse de journaux

Les regles de detection (celles livrees avec l'agent et celles de `sigma.d`)
sont evaluees sur les journaux du systeme, lus en temps reel, et sur les
fichiers declares.

| Champ | Role | Defaut |
|-------|------|--------|
| `log_analysis` | Evalue les regles sur les journaux | `true` |
| `log_analysis_all_programs` | Lit les lignes de tous les programmes du journal systeme, et non des seuls programmes lies a la securite (connexion, sudo, comptes, cron). Necessaire aux regles `service: syslog` ecrites pour d'autres programmes ; plus couteux sur un serveur bavard | `false` |
| `log_files` | Fichiers de journaux a suivre en plus | aucun |

```json
"log_files": [
  { "path": "/var/log/nginx/access.log", "format": "web", "service": "nginx" },
  { "path": "/var/log/myapp/app.json", "format": "json" }
]
```

| Champ | Role | Defaut |
|-------|------|--------|
| `path` | Chemin absolu du fichier | requis |
| `format` | `syslog`, `json` (un objet par ligne), `web` (journal d'acces commun ou combine), `audit` (journal auditd), `text` | `syslog` |
| `service` | Nom que les regles donnent a ce fichier (`service: nginx`) | nom du fichier sans extension |

- Un fichier suivi pour la premiere fois est lu depuis sa fin ; sa position est
  ensuite conservee, y compris pendant l'arret de l'agent.
- Ne declarez pas un fichier dont le journal systeme contient deja les lignes
  (`/var/log/auth.log` sur un systeme a journal systemd) : chaque ligne serait
  comptee deux fois.
- Sous Linux, le compte du service doit pouvoir lire le journal (groupe
  `systemd-journal`). Sous macOS, `log stream` demande un compte administrateur.
- Pour ajuster une regle livree, deposez dans `sigma.d` une regle portant le
  meme `id`. Pour la desactiver, inscrivez son `id` dans
  `sigma.d/disabled-rules.txt`.
- Champs disponibles dans les regles : voir `crates/agent-siem/src/decode.rs`.

### Conteneurs Docker et Podman

Sous Linux, quand Docker tourne (socket `/var/run/docker.sock`) ou que Podman
est installe, l'agent lit aussi les evenements de leurs conteneurs (`docker
events`, `podman events` ; service `containers`, ou `docker` et `podman`) :
creation, demarrage, `exec`, arret, manque de memoire, suppression. Le
demarrage d'un conteneur est complete par `inspect` : mode privilegie,
espaces de noms de l'hote, capacites ajoutees, profils de securite retires,
peripheriques et chemins de l'hote montes. Aucun reglage : il suffit que
l'analyse de journaux soit active, et un moteur est suivi des qu'il apparait.

Regles livrees (fichier `crates/agent-scanner/rules/containers.yml`) :
conteneur privilegie, qui monte la racine de l'hote, qui monte le socket du
moteur de conteneurs, dote de capacites qui permettent d'en sortir, avec un
disque de l'hote en acces direct, dans l'espace des processus de l'hote, sans
profil de securite (incidents), et shell interactif ouvert dans un conteneur
(evenement SIEM seulement, Docker seulement : Podman ne dit pas ce qu'un
`exec` lance). Les moteurs sans root (conteneurs d'un utilisateur) ne sont
pas suivis. L'inventaire du poste liste aussi les conteneurs, avec ce qui
affaiblit leur isolation (onglet « Conteneurs » de Systeme & comptes).

## Integrite des fichiers

| Champ | Role | Defaut |
|-------|------|--------|
| `fim_watched_paths` | Dossiers ou fichiers surveilles. **Remplace** la liste par defaut : reprenez-y `/etc` et les autres chemins systeme que vous voulez garder | configuration systeme, programmes systeme et emplacements de demarrage automatique |
| `fim_ignore_patterns` | Exclusions (`*.log`, `cache/**`, ou un fragment de chemin), ajoutees aux exclusions par defaut | `*.log`, `*.tmp`, `*.swp`, `.git/**` |

- La base de reference est conservee dans `fim/baseline.json` du dossier de
  donnees. Au demarrage, les fichiers sont compares a cette base : ce qui a
  change pendant l'arret de l'agent est signale.
- Une analyse complete a lieu toutes les 6 heures, en plus de la surveillance
  temps reel.
- Un chemin surveille pour la premiere fois est adopte sans alerte ; ses
  fichiers ne sont signales comme nouveaux qu'a partir du demarrage suivant.
- Evitez les arborescences volumineuses ou tres actives (`/home`, `/var/log`) :
  100 000 fichiers sont suivis au plus, et chaque changement leve une alerte.
- `"fim_report_changes": true` (defaut) donne les lignes retirees et ajoutees
  d'un petit fichier texte. Le dernier contenu est conserve pour cela, mais
  jamais celui d'un fichier que ses droits reservent a certains comptes.
- L'auteur d'un changement est indique quand l'audit du systeme le donne
  (Windows : audit d'acces aux objets sur le fichier) ou, a defaut et s'il y a
  lieu, d'apres les processus vus demarrer (`process_event_telemetry`).
- `"fim_whodata": true` (Linux, desactive par defaut) : l'agent ajoute a
  auditd une regle par chemin surveille (`auditctl -w <chemin> -p wa -k
  sentinel_fim`), lit `/var/log/audit/audit.log` et retire ses regles a
  l'arret. L'alerte nomme alors exactement le compte et le programme. Demande
  auditd en marche, l'agent en root et l'analyse de journaux active. A peser
  sur un systeme tres actif (une mise a jour produit beaucoup
  d'enregistrements) ou dont l'audit arrete la machine quand son tampon
  deborde (`auditctl -f 2`).
- Sous Windows, les valeurs de registre de demarrage automatique (`Run`,
  `Winlogon`, `Image File Execution Options`...) sont surveillees de la meme
  facon. `"registry_keys"` y ajoute les cles de l'organisation (reglages d'une
  application, cle de strategie), dont toutes les valeurs sont relues a chaque
  analyse : `"registry_keys": ["HKLM\\SOFTWARE\\Contoso\\Agent"]` (`HKLM`
  vaut `HKEY_LOCAL_MACHINE`). Une valeur ajoutee ou modifiee y est signalee
  comme une modification du registre (T1112).

## Flux d'indicateurs de compromission

`threat_intel_feeds` liste des sources d'adresses, de domaines et de fichiers
malveillants. Adresses et domaines sont ajoutés à ce que le détecteur réseau
connaît déjà (y compris ce que la plateforme pousse) ; les SHA-256 sont
comparés aux fichiers que la surveillance d'intégrité signale comme créés ou
modifiés. Aucune source n'est contactée par défaut.

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
| `format` | `text` (une adresse, un domaine, une URL ou un SHA-256 par ligne ; CSV et fichiers hosts acceptes), `stix` (bundle STIX 2.1), `taxii` (objets d'une collection TAXII 2.1) | `text` |
| `authorization` | Valeur de l'en-tete `Authorization` (`Bearer …`, `Basic …`, cle MISP) | aucun |
| `refresh_hours` | Heures entre deux telechargements (1 au minimum) | `12` |

- Les flux sont telecharges en entier : rien du poste n'est envoye.
- Les adresses non routables (privees, locales) sont refusees : un flux ne
  peut pas faire signaler le reseau interne.
- Un flux en echec garde ses derniers indicateurs, aussi conserves sur disque
  pour le prochain demarrage.
- MISP : utilisez son export texte ou STIX avec la cle dans `authorization`.
- Fichiers : seul le SHA-256 est compare (pas le MD5 ni le SHA-1). Un fichier
  dont l'empreinte est listee leve un incident critique ; un playbook peut y
  repondre avec une condition « changement de fichier » de valeur
  `malicious_hash`.

## Fichiers leurres anti-ransomware

`"ransomware_canaries": true` (ou `SENTINEL_RANSOMWARE_CANARIES=true`, ou le
reglage dans Parametres) depose un dossier masque de faux documents dans le
dossier personnel et le dossier Documents de chaque utilisateur. Un leurre
reecrit ou renomme leve un incident critique. Desactive par defaut ; la
desactivation supprime les leurres intacts.

## Simulation des playbooks

`"playbook_simulation": true` fait tourner les playbooks de reponse a blanc :
leurs conditions sont evaluees sur l'activite reelle du poste et chaque action
qu'ils auraient menee est consignee, prefixee par `[Simulation]`, dans le
journal des playbooks et la piste d'audit. Rien n'est arrete, mis en
quarantaine, bloque ni isole, et aucune notification ou alerte SIEM ne part.
Les cibles sont controlees et la limite d'actions destructrices s'applique
comme lors d'une execution reelle : le journal montre aussi ce qui serait
refuse.

A utiliser pour eprouver un playbook quelques jours avant de l'armer, puis
repasser a `false`. Desactive par defaut. Un playbook lance a la main depuis la
console agit toujours.

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

Les dossiers de regles (`checks.d`, `sca.d`, `sigma.d`, `yara.d`) et leurs
fichiers suivent la meme regle que les programmes des commandes de reponse :
sous Windows, un fichier dont le proprietaire n'est ni SYSTEM, ni les
Administrateurs, ni TrustedInstaller est ignore, avec la raison dans le
journal. Un fichier cree par un administrateur sur un poste client appartient
a son compte : le donner au groupe avec
`icacls <fichier> /setowner *S-1-5-32-544`. Le service ne change pas le
proprietaire de ce qui se trouve dans ces dossiers : un fichier ecrit par un
autre compte reste refuse.

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
