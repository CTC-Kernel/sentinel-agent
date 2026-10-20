<h1 align="center">JOURNAL DES MODIFICATIONS</h1>

<p align="center">
  <strong>Registre Historique d'Évolution du Sentinel GRC Agent</strong>
</p>

---

Tous les changements notables apportés au projet **Sentinel GRC Agent** sont consignés dans ce document, conformément aux standards du [Versionnage Sémantique](https://semver.org/).

## 🚀 [Non publié]

### 🔒 Socket des actions privilégiées : un client non vérifié est refusé

- **Refus par défaut** : le service d'assistance root n'exécute plus que les
  demandes de root ou de l'application Sentinel identifiée avec certitude. Un
  client dont le système ne donnait pas le programme (processus déjà terminé,
  exécutable remplacé par une mise à jour, information indisponible) était
  servi ; il est refusé, et le refus journalisé avec la demande.
- **Une identité que la réutilisation d'un PID ne trompe pas** : sous macOS,
  le client est désigné par le jeton d'audit du socket (`LOCAL_PEERTOKEN`),
  qui change à chaque `exec`, et son code doit satisfaire l'exigence de
  signature du service lui-même. Sous Linux, par un pidfd (`SO_PEERPIDFD`
  depuis Linux 6.5, `pidfd_open` avant), qui confirme que ce qui est lu dans
  `/proc` porte sur ce processus.
- **Défi par connexion** : une fois le client identifié, le service lui envoie
  un défi aléatoire que la demande doit reprendre, et le client doit être le
  même processus, avec le même programme, une fois la demande lue. Le
  protocole change : une application de bureau restée ouverte pendant la mise
  à jour doit être relancée.
- **Linux** : le service d'assistance reçoit `CAP_SYS_PTRACE`, sans lequel il
  ne pouvait pas lire le programme d'un client d'un autre utilisateur, ni donc
  le vérifier.
- **Limites** : sous Linux, la vérification reste faillible face à un
  programme du même utilisateur (bibliothèque chargée dans l'exécutable
  Sentinel, processus qui partage la connexion) et, avant Linux 6.5, face à
  un PID réutilisé entre la connexion et son examen ; le groupe du socket y
  reste la barrière principale. Le profil AppArmor livré n'autorise toujours
  ni capacités ni `ptrace` (voir plus bas).

### 🛰️ Inventaire du poste envoyé à la plateforme

- **L'inventaire quitte le poste**, comme le syscollector de Wazuh remonte au
  serveur : fiche du système, comptes (avec ceux qui administrent la
  machine), groupes et leurs membres, services, ports en écoute (locaux ou
  ouverts au réseau), correctifs Windows, conteneurs et ce qui affaiblit leur
  isolement. Envoi par le client authentifié de l'agent, sur
  `POST /v1/agents/{id}/system-inventory`.
- **Quand** : l'inventaire entier au démarrage de l'agent, puis une fois par
  jour ; entre les deux, seulement les parties qui ont changé (un compte
  créé envoie la liste des comptes, rien d'autre), au plus une fois par
  relevé de dix minutes, et rien quand rien n'a changé. L'heure de démarrage
  de la machine, relue à la seconde près sur Windows, et les quelques Mo de
  mémoire que réserve un nouveau noyau ne comptent pas comme un changement.
- **Bornes** : 5 000 entrées et 512 Kio par partie, 500 membres listés par
  groupe (le nombre réel est donné), textes coupés à la longueur que la
  plateforme accepte : une partie tient toujours dans un document Firestore,
  l'envoi entier sous les 5 Mo d'une requête. Une partie coupée le dit.
- **En cas d'échec** : nouvel essai après 10 minutes, puis 20, 40… jusqu'à
  6 heures ; une plateforme qui ne connaît pas encore cette route (404)
  n'est signalée qu'une fois dans le journal. La plateforme peut demander
  l'inventaire entier quand elle n'a pas de quoi compléter un envoi partiel.
- **Mode autonome** : rien n'est envoyé ; l'inventaire et la page
  Système & comptes sont inchangés.
- **À faire côté plateforme** : la route, le schéma et le stockage
  (`organizations/{org}/agents/{id}/inventory/{partie}`) restent à ajouter
  dans sentinel-grc-v2-prod ; d'ici là l'agent essaie de loin en loin. Les
  changements, eux, arrivaient déjà comme événements SIEM
  (`inventory_user_added`…) et incidents.

### 🎯 Règles de détection : un jeu par défaut prêt à l'emploi, des réponses qui agissent

- **19 règles par défaut**, installées actives au premier démarrage de
  l'agent (Windows, macOS, Linux), chacune rattachée à ses techniques MITRE
  ATT&CK : vol d'identifiants (Mimikatz, mémoire de LSASS, base SAM), vol de
  mots de passe sur macOS (fausse fenêtre AppleScript, trousseau), shell
  inversé, minage de cryptomonnaie, PowerShell encodé ou chargé depuis
  Internet, programmes de Windows détournés (certutil, regsvr32, mshta…),
  suppression des sauvegardes et des clichés instantanés, effacement des
  journaux, désactivation des protections (Defender, pare-feu, Gatekeeper,
  SELinux, auditd), outils d'attaque connus, reconnaissance de l'annuaire,
  groupe des administrateurs modifié, tâche planifiée ou service créé,
  fichiers d'authentification, bibliothèque imposée (`ld.so.preload`),
  programme ajouté au démarrage, fichier hosts, ports d'outils d'attaque,
  trafic acheminé par Tor.
- **Des règles comme les autres** : on les désactive, les modifie ou les
  supprime dans l'onglet Règles ou sur la plateforme, qui les reçoit. Elles
  détectent et notifient sans agir ; une réponse s'ajoute en les modifiant.
  Une version suivante de l'agent qui en améliore une la met à jour, sauf si
  elle a été modifiée ; une règle supprimée ne revient que par « Restaurer
  les règles par défaut ».
- **Les réponses d'une règle s'exécutent enfin** : le formulaire exigeait au
  moins une action, qu'aucune correspondance ne déclenchait. Arrêter le
  processus, mettre le fichier en quarantaine, bloquer l'adresse (plus
  longtemps en cas de récidive), isoler le poste, alerter le SIEM externe
  agissent désormais sur ce que la règle a trouvé, ou sont simulées quand la
  simulation des playbooks est active. La notification dit ce qui a été fait.
  Verrouiller un compte et lancer une commande, qui demandent un paramètre,
  restent l'affaire des playbooks et ne sont plus proposés pour une règle.
- **Compteur de correspondances** : il restait à zéro. Chaque correspondance
  est comptée sur le poste, avec la date de la dernière, et l'onglet se met à
  jour aussitôt.
- **SIEM** : chaque correspondance est enregistrée comme les détections des
  moteurs (pour la plateforme, et pour le SIEM externe quand il y en a un),
  avec le processus, l'adresse ou le fichier trouvé.
- **Onglet Règles** : modification d'une règle existante (mode administrateur,
  comme la désactivation), filtres « Par défaut » et « Personnalisées »,
  recherche (nom, technique ATT&CK, indicateur), description et réponse de
  chaque règle, conditions regroupées par type. Une condition qui ne pourrait
  jamais correspondre (port illisible, sévérité inconnue) ne s'enregistre
  plus. Le test porte aussi sur les connexions.
- **Notifications en français** : « Règle « X » déclenchée », et ce qui a été
  trouvé (« Processus mimikatz.exe (PID 4120) : … »).

### ⚡ Processus évalués à leur lancement

- **Réglable dans l'interface** : « Processus évalués à leur lancement »
  rejoint Paramètres › Détection et conformité. Sans elle, les règles ne
  voient que les processus encore en cours au balayage de cinq minutes : une
  commande brève (`vssadmin delete shadows`, `certutil -urlcache`…) leur
  échappe. L'onglet Règles le signale tant qu'elle est coupée.
- **Linux** : la source (connecteur de processus du noyau) n'était compilée
  dans aucune version. Elle l'est, et a été essayée sur un vrai noyau Ubuntu
  24.04 : un `sh -c` de quelques millisecondes est vu, et la réponse d'une
  règle arrête le processus trouvé. Dans un conteneur qui partage le noyau
  d'un autre système, elle peut manquer : le balayage périodique reste.

### 🕳️ Rootkits : modules noyau connus, signatures récentes

- **Modules noyau de rootkits publiés** : un module chargé sous le nom de
  Diamorphine, Reptile, Suterusu, KoviD, Nuk3Gh0st, Puszek, Syslogk,
  Adore-ng, Knark, Rooty, Enyelkm ou KBeast est un incident critique, même
  quand il ne se cache pas (un module qui se cache l'était déjà).
- **Fichiers de menaces récentes** : BPFDoor, Kinsing, XorDdos, Winnti et
  Syslogk rejoignent la liste des fichiers laissés par des rootkits connus.

### 🖥️ Journaux : sortie de commandes surveillée

- **Commandes surveillées** (`command_monitors`), comme les sources
  `command` et `full_command` de Wazuh : un programme déclaré (les ports en
  écoute, les dernières connexions, un contrôle maison) est lancé à
  intervalle régulier (5 minutes par défaut, 1 minute au plus souvent).
- **Règles sur la sortie** : chaque ligne devient un événement du service
  qui porte le nom de la commande ; une règle Sigma `logsource: service:
  <nom>` s'y applique comme à un journal.
- **Changement de sortie** : quand la sortie diffère du passage précédent,
  un incident donne les lignes retirées et ajoutées (`report_changes`, actif
  par défaut). La dernière sortie est conservée dans le dossier de données,
  lisible par l'agent seul : un changement fait pendant l'arrêt de l'agent
  est signalé à son premier passage.
- **Mêmes garde-fous que les commandes de réponse** : nom en minuscules,
  chemin absolu, lancé sans interpréteur, programme appartenant à root ou au
  compte de l'agent et modifiable par personne d'autre, vérifié de nouveau
  avant chaque lancement ; une minute et 256 Kio de sortie au plus, dans une
  tâche de fond qui ne retarde jamais la réponse.
- **Vérifié** sur une Ubuntu 24.04 réelle, avec `ss -tlnH` surveillé toutes
  les minutes et une règle Sigma maison (`logsource: service:
  listening-ports`, `message|contains: ':4444 '`) : la première sortie sert
  de référence ; un écouteur ouvert ensuite sur le port 4444 donne, au
  passage suivant, l'incident « Sortie de commande modifiée :
  listening-ports » puis, une seconde après, l'alerte Sigma « Port de porte
  dérobée en écoute ». La sortie conservée est en `0600`, l'agent s'arrête
  en 4 s.

### 🐳 Conteneurs Docker et Podman surveillés

- **Événements des conteneurs** (Linux), comme le Docker listener de
  Wazuh, et pour Podman en plus (le moteur de RHEL et Fedora, que Wazuh ne
  suit pas) : l'agent suit `docker events` et `podman events` (création,
  démarrage, `exec`, arrêt, manque de mémoire, suppression ; pas les
  contrôles de santé, trop bavards) et les donne aux règles des journaux
  (service `containers`, ou `docker` et `podman` pour un seul moteur). Un
  moteur est suivi dès qu'il apparaît, Docker de nouveau après le
  redémarrage de son démon ; aucun réglage. Un `docker` qui n'est que le
  relais de Podman (`podman-docker`) n'est suivi qu'une fois.
- **Démarrage examiné** : chaque conteneur qui démarre est décrit par
  `inspect` : mode privilégié, espaces de noms de l'hôte, capacités
  ajoutées, profils seccomp ou AppArmor retirés, périphériques et chemins de
  l'hôte montés, compte qui l'exécute.
- **Règles livrées** (`containers.yml`) : conteneur privilégié, qui monte la
  racine de l'hôte, qui monte le socket du moteur de conteneurs, doté de
  capacités qui permettent d'en sortir, avec un disque de l'hôte en accès
  direct, dans l'espace des processus de l'hôte, sans profil de sécurité
  (incidents, T1610/T1611) ; shell interactif ouvert dans un conteneur
  (événement SIEM, T1609 ; Docker seulement, Podman ne dit pas ce qu'un
  `exec` lance). Deux conteneurs privilégiés font deux incidents.
- **Onglet « Conteneurs »** (Système & comptes, quand Docker ou Podman est
  là) : chaque conteneur de l'hôte, en cours ou arrêté, avec son moteur, son
  image, son état, le
  compte qui l'exécute et ce qui affaiblit son isolation ; l'onglet compte
  ceux qui peuvent prendre l'hôte. Il couvre ce que les événements ne voient
  pas : un conteneur dangereux démarré avant l'agent. Les événements et
  l'inventaire lisent `inspect` au même endroit et jugent pareil.
- **Vérifié** sur une Ubuntu 24.04 réelle (noyau 6.8 sous QEMU) avec
  Docker 27 : l'agent suit les événements une minute après son démarrage ;
  un conteneur ordinaire (`docker run alpine sleep`, puis `docker exec
  /bin/sh -c true`) ne lève rien ; `docker run --privileged --pid=host -v
  /:/host` lève « Conteneur privilégié démarré », « Conteneur qui monte la
  racine de l'hôte » et « Conteneur dans l'espace des processus de l'hôte » ;
  l'agent s'arrête en 2 s. Le shell interactif, qui ne donne qu'un événement
  SIEM, n'est vérifié que par les tests. L'inventaire du même hôte liste ses
  quatre conteneurs (en cours et créé) : `--privileged --pid=host -v /:/host`
  d'un côté, `--cap-add SYS_ADMIN` et le socket Docker monté de l'autre.
  Avec Podman 4.9 installé à côté de Docker, les deux moteurs sont suivis
  ensemble : `podman run --privileged -v /:/host` lève « Conteneur
  privilégié démarré » et « Conteneur qui monte la racine de l'hôte »,
  `docker run --privileged` son propre incident, un conteneur Podman
  ordinaire rien ; l'inventaire liste les conteneurs des deux moteurs.

### 🧾 Inventaire : système, matériel et correctifs Windows

- **Fiche du système** (premier onglet de Système & comptes), comme le
  syscollector de Wazuh : nom de la machine, système et version, noyau,
  architecture, date de démarrage ; fabricant, modèle, numéro de série
  (copiable), processeur, cœurs physiques et logiques, mémoire. Sources :
  `/etc/os-release` et DMI (ou l'arbre de périphériques d'une carte ARM) sous
  Linux, `system_profiler` sous macOS, CIM sous Windows.
- **Correctifs Windows** (`Get-HotFix`) : onglet « Correctifs » (KB, type,
  date d'installation), le plus récent rappelé sur la fiche du système.
- **Changements enregistrés** : système mis à jour, noyau, matériel, numéro
  de série (une autre machine sous la même identité d'agent), mémoire
  (comptée en Gio entiers : les quelques Mo que réserve un nouveau noyau ne
  sont pas un changement), correctif installé ou plus installé. Ils vont au
  SIEM et à la liste des changements, sans incident : un correctif cumulatif
  remplacé par le suivant quitte aussi la liste. Un champ que le système ne
  donne pas cette fois (le numéro de série d'un agent lancé sans root) garde
  sa valeur précédente.
- **Corrigé** : une partie de l'inventaire que le premier relevé n'avait pas
  pu lire (un outil en échec) faisait paraître tout son contenu nouveau au
  relevé suivant, jusqu'à 15 incidents « compte créé » ou « port en
  écoute ». Sa première liste lue lui sert désormais de référence.
- **Vérifié** sur macOS (MacBook Pro M2 Pro : système, modèle, numéro de
  série, processeur, mémoire) et sur une Ubuntu 24.04 ARM sous OrbStack
  (« Ubuntu 24.04.5 LTS », noyau, processeurs, mémoire, en root comme sous un
  compte ordinaire ; cette machine virtuelle n'a ni DMI ni arbre de
  périphériques, fabricant et modèle restent inconnus et la fiche le
  montre), sur une Ubuntu 24.04 sous QEMU, qui a un DMI (fabricant « QEMU »,
  modèle « QEMU Virtual Machine », pas de numéro de série, comme QEMU), et
  sur le Windows Server de la CI : le script PowerShell, lancé
  pour de vrai, donne les comptes, les services, le nom du système, le
  fabricant ou le modèle, et la liste des correctifs (identifiants KB, dates
  d'installation lisibles).

### 🗣️ Incidents et alertes en français

- **Titres et descriptions en français** pour les détecteurs qui parlaient
  encore anglais dans une interface française : processus suspects et outils
  connus (mineurs, vol d'identifiants, post-exploitation), commandes
  encodées, shells inversés, pare-feu et antivirus désactivés, Gatekeeper,
  connexion SSH de root, nouveaux administrateurs, signes de rootkit,
  registre Windows, inventaire, fichiers malveillants connus, YARA et Sigma
  sans description, et les alertes réseau (C2, balises, domaines générés,
  minage, Tor, IRC, connexions et ports suspects). Les titres des règles
  Sigma et YARA restent ceux des règles.
- **Une seule formulation des changements d'inventaire** : l'interface, le
  SIEM et la plateforme reçoivent la même phrase française.
- **Autoriser un incident n'autorise plus tout son type** : depuis la fiche
  d'un incident système, « Autoriser cet incident » crée une règle sur son
  titre. Elle portait sur son type, qui couvre bien plus : autoriser un
  compte de sauvegarde créé faisait taire toute valeur de registre ajoutée,
  toute bibliothèque imposée aux programmes, tout nouvel administrateur
  (tous « changement non autorisé »). Une règle pour un type entier reste
  possible, écrite dans les autorisations.
- **Autorisations écrites avec un titre anglais** : une autorisation saisie à
  la main qui citait un ancien titre (« Suspicious process detected: … »,
  « Hidden listening port (… ») couvre toujours l'incident, comparée aussi
  au titre français. Celles qui portent sur un type ne changent pas.

### 📦 Paquets Linux : toutes les distributions maintenues, x64 et ARM64

- **Debian 12 refusait le .deb** : le lien de téléchargement
  `linux_deb/sentinel-agent_latest_amd64.deb` servait encore le paquet 2.0.0
  de janvier 2026 (dépendances `libc6 (>= 2.39)` et paquets `t64`
  d'Ubuntu 24.04). Aucune release ne le remplaçait : l'alias partait dans
  `linux-deb/` et la vérification se contentait d'un code 200. Chaque
  release le remplace désormais, et la vérification compare le SHA-256 du
  fichier servi.
- **Mise à jour automatique Debian/Ubuntu** : le paquet qu'elle télécharge
  (`linux_deb/sentinel-agent-latest-amd64.deb`) n'était jamais publié ; il
  l'est, comme son équivalent ARM64.
- **glibc 2.28** : le binaire Linux était compilé sur Ubuntu 24.04 et
  exigeait glibc 2.38, donc ne démarrait ni sur Debian 12, ni sur Ubuntu
  22.04, ni sur RHEL 9. Il est compilé sur AlmaLinux 8, et la release
  échoue s'il exige plus que glibc 2.28. Distributions visées : Debian 11+,
  Ubuntu 20.04+, RHEL / AlmaLinux / Rocky 8+, Fedora.
- **ARM64** : `.deb` et `.rpm` ARM64 à chaque release.
- **Dépendances** : plus de `libssl3` (OpenSSL est intégré au binaire) ni de
  `libxdo3` (il ne servait qu'aux entrées de menu Copier/Coller, absentes de
  nos menus ; RHEL ne le fournit que dans EPEL). La bibliothèque du plateau
  système (`libayatana-appindicator3-1`) est recommandée et non plus exigée :
  seul le plateau du mode bureau l'ouvre, pas le service.
- **Installation** : `sudo apt install ./sentinel-agent_*.deb` ou
  `sudo dnf install ./sentinel-agent-*.rpm`, qui installent aussi les
  dépendances, au lieu de `dpkg -i` / `rpm -i`.
- **Mises à jour rapprochées** : chaque mise à jour du .deb ou du .rpm
  démarrait deux fois l'assistant privilégié (le script le redémarrait, puis
  le redémarrage de l'agent le relançait). Trois mises à jour en moins de
  10 secondes atteignaient la limite de systemd (5 démarrages en 10 s) :
  l'assistant restait en échec et l'agent tournait sans lui. Le script ne
  redémarre plus que l'agent, et l'assistant suit.
- **Conteneurs et images système** : l'installation n'échoue plus sans
  systemd en marche (conteneur, chroot de construction d'image) ; le service
  est activé et démarre au prochain boot.
- **Mise à jour du .rpm** : elle laissait l'agent arrêté. rpm exécute le
  `%post` du nouveau paquet (qui redémarre le service) avant le `%preun` de
  l'ancien, et celui-ci arrêtait le service. Il ne l'arrête plus que pour une
  désinstallation, et un `%posttrans` relance le service quand la version
  mise à jour l'arrête encore (4.0.52 et avant). Le .deb ne change pas.

### 🏁 Détection et réponse : chaînes vérifiées de bout en bout, tout se règle dans l'interface

- **Le modèle de playbook « Brute-force » se déclenche enfin** : sa condition
  cherchait le texte `brute_force` dans la description de l'alerte, alors
  qu'une force brute SSH vue dans les journaux s'intitule « Attaque par force
  brute SSH ». Il ne pouvait jamais agir. Chaque alerte donnée aux playbooks
  porte désormais un type stable : celui du détecteur réseau
  (`data_exfiltration`, `c2_communication`…) et, pour une détection dans les
  journaux, `brute_force` quand ses techniques ATT&CK sont T1110 (essais de
  mots de passe, pulvérisation comprise), `log_detection` sinon.
- **Paramètres des actions** : le formulaire de création de playbook n'avait
  aucun champ pour eux ; une commande de réponse ne pouvait pas être nommée,
  ni une durée de blocage ou de verrouillage, ni le texte d'une
  notification. Chaque action a maintenant son champ et une ligne qui dit ce
  qu'il signifie en exécution automatique et à la main ; les conditions
  disent quelles valeurs existent.
- **Durée de blocage** : celle de l'action s'applique aussi aux exécutions
  automatiques (c'était toujours une heure). Une adresse nommée par
  plusieurs alertes est bloquée une fois.
- **Récidivistes** : une adresse bloquée automatiquement de nouveau dans la
  journée l'est deux fois plus longtemps que la fois précédente, jusqu'à une
  semaine (comme l'option `repeated_offenders` de Wazuh). Un blocage sans
  fin le reste ; un blocage demandé par un opérateur dure ce qu'il a demandé.
- **Notification** : sans texte, elle dit ce qui a déclenché le playbook (elle
  arrivait vide).
- **Deux modèles** : « Compte pris par force brute » (bloque l'adresse et
  verrouille le compte pris) et « Fichier malveillant connu » (quarantaine du
  fichier dont un flux liste l'empreinte).
- **Détection et conformité dans les paramètres** : analyse des journaux,
  détection de rootkits, inventaire du poste, socle de durcissement, lignes
  modifiées et auteur exact des changements s'activent depuis l'interface (ils
  ne se réglaient que dans le fichier de configuration). Le réglage est
  enregistré et pris en compte au prochain démarrage de l'agent, ce que
  l'interface dit ; en désactiver un demande le mode administrateur.
- **Fiche d'un contrôle de conformité** : elle montre ce qui est vérifié,
  pourquoi, et comment corriger (description, justification et correction
  des politiques SCA), la correction en premier quand le contrôle échoue.
- **Système & comptes** (Actifs & inventaire) : l'inventaire du poste a son
  écran. Comptes (qui peut ouvrir une session, qui est administrateur),
  groupes et membres, services, ports en écoute (locaux ou exposés au
  réseau), et les changements depuis le démarrage de l'agent avec l'incident
  que chacun a levé.
- **Clés de registre de l'organisation** (`registry_keys`, Windows) : elles
  s'ajoutent aux emplacements de démarrage automatique surveillés ; toutes
  leurs valeurs sont relues à chaque analyse, et une valeur ajoutée ou
  modifiée est signalée comme modification du registre (T1112), comme le
  permet la surveillance de registre de Wazuh.
- **Auteur exact d'un changement de fichier** (`fim_whodata`, Linux,
  désactivé par défaut) : l'agent ajoute à auditd une règle par chemin
  surveillé, sous sa propre clé, lit le journal d'audit et retire ses règles à
  l'arrêt. L'alerte d'intégrité nomme alors le compte et le programme. Sans
  auditd, rien n'est ajouté et l'alerte garde l'auteur probable. Désactivé
  par défaut : sur un système très actif, une mise à jour produit beaucoup
  d'enregistrements, et une politique d'audit qui arrête la machine quand
  son tampon déborde relève de l'administrateur.
- **Trois défauts trouvés en faisant tourner l'agent sur une vraie Ubuntu
  24.04, et corrigés** :
  - **mémoire du scan de vulnérabilités** : l'agent gagnait environ 30 Mo par
    seconde pendant l'interrogation d'OSV pour 475 paquets, de 80 Mo à 4 Go
    en deux minutes et 6 Go en six, jusqu'à saturer la machine. Chaque avis
    était gardé en entier pendant tout le scan, des milliers à la fois, avec
    toutes les versions concernées et, sous Ubuntu, tous les paquets binaires
    de la source. Chaque avis est désormais réduit dès sa réception à ce que
    le résultat utilise, et aux seuls paquets interrogés ; les résultats sont
    inchangés. Mesuré après correction sur la même machine : le scan va au
    bout (4120 vulnérabilités sur 831 paquets, en moins de quatre minutes) et
    la mémoire plafonne vers 280 Mo, stable ensuite ;
  - **notification d'un poste sans interface** : elle échouait faute de
    destination, et chaque déclenchement de playbook était compté en échec
    partiel sur un serveur. Elle part maintenant dans les enregistrements SIEM
    (onglet SIEM de la plateforme, SIEM externe s'il est configuré) ; sans
    aucune destination elle échoue toujours, jamais réussie par simple
    écriture dans le journal ;
  - **collecteur de journaux** : quand `journalctl` n'avait rien de nouveau,
    il relisait les 500 dernières lignes du fichier de journal et les
    renvoyait au SIEM à chaque passage, et cherchait sous Ubuntu un
    `/var/log/messages` qui n'existe pas (un avertissement par minute). Le
    journal fait foi quand il répond ; sans journal, le fichier de la
    distribution est lu depuis l'endroit où la lecture précédente s'était
    arrêtée ;
  - **fichiers de verrou des comptes** : verrouiller un compte levait quatre
    alertes d'intégrité pour `passwd.lock` et `shadow.lock`, créés puis
    supprimés en une fraction de seconde par les outils de comptes. Ils sont
    exclus par défaut, par leur nom exact ; la modification de la base de
    comptes elle-même reste signalée.
- **Vérifié** : force brute SSH réelle contre l'agent fusionné, en service
  sans interface, sur une Ubuntu 24.04 (OrbStack) : huit mauvais mots de
  passe depuis une adresse de test, « Échecs d'authentification répétés sur
  un compte » puis « Attaque par force brute SSH » levés, le playbook « Compte
  pris par force brute » déclenché, l'adresse bloquée dans iptables (entrée
  et sortie) pour 600 s, le second blocage compté comme la même récidive ;
  l'attaquant est coupé net. Second essai, playbook de verrouillage seul :
  après la force brute, la connexion réussie avec le bon mot de passe lève
  « Connexion SSH réussie après une attaque par force brute », le compte pris
  est verrouillé pour 600 s (verrouillé et expiré, ce qui refuse aussi les clés
  SSH), la session ouverte est fermée, et les notifications de ce poste sans
  interface sont toutes délivrées. Code propre à Windows d'`agent-scanner` et
  d'`agent-common` contrôlé pour la cible Windows (types et clippy) ; tests de
  tout l'espace de travail sous macOS. L'auteur exact (`fim_whodata`) sur un
  vrai auditd, dans une Ubuntu 24.04 (noyau 6.8) sous QEMU : la règle
  `-w /srv/whodata -p wa -k sentinel_fim` est posée au démarrage, un ajout
  fait par le compte `tester` donne « Modified on /srv/whodata/notes.txt by
  /usr/bin/bash (uid tester) », sans « probable », et la règle est retirée à
  l'arrêt (en 3 s). **Non vérifié** : les clés de registre et le reste du
  code Windows ailleurs que dans la CI ; l'interface n'a été vue que dans son
  aperçu, avec des données d'exemple.

### 🐧 Linux : les journaux du service dans `/var/log/sentinel-grc`

- **Le service écrit enfin ses journaux là où le paquet les attend** : il
  visait `/var/log/sentinel`, en lecture seule sous `ProtectSystem=strict`,
  et retombait sur son `/tmp` privé, vidé à chaque redémarrage. Il écrit
  maintenant `/var/log/sentinel-grc/agent.log`, le dossier que créent les
  paquets deb et rpm et qu'ouvrent l'unité systemd, AppArmor et l'application
  de bureau. macOS (`/var/log/sentinel`) et Windows ne changent pas.
- **logrotate prend ce fichier** : un seul `agent.log`, tourné chaque jour,
  compressé, gardé 14 jours (les noms datés `agent.log.AAAA-MM-JJ` lui
  échappaient). Il le copie puis le vide sur place (`copytruncate`), en tant
  que `sentinel-grc` (`su`) : l'agent n'a pas de rechargement, et l'ancien
  `systemctl reload` échouait sans bruit.
- **Un processus root n'écrit plus dans ce dossier** : il appartient au compte
  du service, qui pourrait y remplacer un fichier par un lien. L'assistant
  privilégié et les commandes lancées en root gardent le journal système et
  leur dossier de repli (`/root/.local/share/sentinel/logs`) ; le service ne
  trouve jamais un `agent.log` à root qu'il ne pourrait pas ouvrir.
- **Vérifié** sur Ubuntu 24.04 et Fedora 43 (machines OrbStack isolées,
  protections systemd actives) : avant, dossier vide et journaux dans le
  `/tmp` privé ; après, installation neuve et mise à jour, `agent.log` au
  compte `sentinel-grc` dans un dossier 0700 ; `logrotate.service` le tourne
  (copie identique, l'agent continue au début du fichier vidé, compression à
  la rotation suivante). **Non vérifié** : AppArmor (absent du noyau
  OrbStack), amd64, paquet construit en profil release avec l'interface.

### 🔒 Réponse : verrouillage de compte et commande de réponse

- **Verrouiller un compte** (action de playbook « Verrouiller le compte ») :
  le compte nommé par l'alerte est verrouillé (`usermod --lock --expiredate
  1` sous Linux, ce qui refuse aussi les clés SSH ; `;DisabledUser;` sous
  macOS ; `net user … /active:no` sous Windows) et ses sessions sont fermées.
  Il est déverrouillé à la fin de la durée demandée (une heure par défaut, 0
  pour « jusqu'à intervention »), y compris après un redémarrage de l'agent.
- **Quel compte** : celui d'une session ouverte que l'alerte désigne (le
  compte pris après une force brute), jamais les comptes simplement essayés,
  et seulement si le playbook comporte l'action.
- **Refusé** : root et l'administrateur intégré, les comptes système, le
  compte sous lequel tourne l'agent, le compte qui utilise le Mac à ce
  moment, le dernier compte capable d'administrer le poste, un compte
  inexistant. Un compte déjà verrouillé est laissé tel quel, et l'agent ne
  déverrouille que ce qu'il a verrouillé.
- **Commande de réponse** (`response_commands`, action « Commande de
  réponse ») : un programme de l'organisation (ouvrir un ticket, prévenir
  l'astreinte) qu'un playbook demande par son nom. Il reçoit sur son entrée
  un document JSON : le playbook, ce qu'il a reconnu, les processus,
  adresses, fichiers et comptes visés. Un playbook, qui vient de la
  plateforme, ne peut que nommer une commande déclarée dans la configuration
  locale ; rien de ce qu'il porte n'est exécuté. Programme donné par chemin
  absolu, lancé sans interpréteur, refusé s'il n'appartient pas à root ou au
  compte de l'agent ou si d'autres peuvent l'écrire.
- Les deux actions comptent dans la limite d'actions destructrices par
  exécution et sont décrites sans être lancées en mode simulation.
- **Vérifié** : verrouillage et déverrouillage exercés sur un compte de test
  d'une Ubuntu 24.04 réelle (état `P` → `L` → `P`, expiration remise à
  « jamais », refus de root). **Non vérifié** : macOS et Windows (commandes
  construites et testées, non lancées) ; pas de modèle de playbook dans
  l'interface, les deux actions s'y choisissent dans la liste.

### 🧬 Intégrité des fichiers : lignes modifiées, auteur du changement, registre Windows

- **Lignes modifiées** : pour un petit fichier texte, l'alerte donne les
  lignes retirées et ajoutées (`-ancienne`, `+nouvelle`, sous `@@ line N`).
  Le dernier contenu connu est conservé dans le dossier de données, à une
  condition : que le fichier soit lisible par tous les comptes du poste. Un
  fichier que ses droits réservent (`/etc/shadow`, une clé privée,
  `/etc/sudoers`) n'est jamais copié, et la copie d'un fichier qui devient
  privé est supprimée. 256 Kio par fichier, 256 Mio au total. Réglage
  `fim_report_changes` (actif par défaut).
- **Auteur du changement**, quand quelque chose le dit :
  - exact, d'après l'audit du système : enregistrements auditd sous Linux
    (`auditctl -w /etc -p wa`), événements 4663 sous Windows (avec une entrée
    d'audit sur le fichier) ;
  - probable, d'après les processus vus démarrer
    (`process_event_telemetry`) : un programme lancé dans les dix minutes
    précédentes avec le fichier sur sa ligne de commande (`sed -i …
    /etc/hosts`).
  Sans l'un ni l'autre, l'alerte dit ce qui a changé, pas qui : rien n'est
  inventé. L'agent n'installe pas lui-même de règle d'audit.
- **Registre Windows** : les valeurs qu'un programme utilise pour démarrer
  seul (`Run`, `RunOnce` machine et utilisateurs, `Winlogon`, `AppInit_DLLs`,
  paquets LSA, `BootExecute`, `AppCertDlls`, `Image File Execution Options`,
  association des `.exe`) sont relues à chaque analyse de sécurité ; une
  valeur ajoutée ou modifiée est signalée, avec sa technique ATT&CK. La
  première lecture sert de référence, conservée entre deux exécutions.
- **Non vérifié** : le registre est lu par `reg query`, dont la lecture est
  testée sur des exemples de sortie mais qui n'a pas tourné sous Windows.
  L'attribution par audit est testée sur des enregistrements d'exemple.

### 🧾 Inventaire du poste : comptes, groupes, services, ports en écoute

- **Inventaire toutes les dix minutes** : comptes (identifiant, shell, peut
  ouvrir une session ou non), groupes et leurs membres, services (unités
  systemd, éléments de lancement de `/Library`, services Windows avec leur
  commande), ports en écoute avec le programme qui les tient.
- **Ce qui change est signalé** : compte créé (critique s'il porte
  l'identifiant de root), compte recevant l'identifiant de root ou un shell,
  compte ajouté à un groupe d'administration, service installé ou dont la
  commande change, port ouvert sur le réseau et pas vu depuis une semaine.
  Les suppressions, les ports locaux et les ports déjà connus sont
  enregistrés (événements SIEM) sans lever d'incident. Le premier inventaire
  sert de référence.
- **Une source en échec ne supprime rien** : une commande qui ne répond pas
  donne une liste vide, qui n'est pas prise pour la suppression de tous les
  comptes.
- `sentinel-agent inventory` affiche l'inventaire courant en JSON. Réglage
  `system_inventory` (actif par défaut).
- **Constat sur macOS 15 et suivants** : `netstat` ne renvoie rien à un
  programme sans l'autorisation « Réseau local ». L'inventaire lit donc les
  ports avec `lsof` (ceux du compte de l'agent, tous s'il est root), et le
  contrôle des ports cachés est sauté quand la liste complète n'est pas
  disponible, plutôt que mené sur une liste partielle.
- **Vérifié** : collecte exercée sur un Mac réel (133 comptes, 11 ports ;
  trois défauts corrigés au passage : comptes et groupes en double dans la
  réponse du service d'annuaire, ports non lus) et sur une Ubuntu 24.04
  réelle (25 comptes, 140 services). **Non vérifié** : la collecte Windows
  (PowerShell) n'a pas tourné ; sa lecture est testée sur un exemple. Pas
  d'envoi de l'inventaire à la plateforme ni de page dans l'interface.

### 📋 Conformité : politiques au format SCA et socle de durcissement

- **Politiques au format SCA** (`sca.d`) : un fichier YAML décrit des
  contrôles par des règles sur le contenu d'un fichier, les entrées d'un
  dossier, un processus, la sortie d'une commande ou une valeur du registre
  Windows, combinées par `all`, `any` ou `none`, avec comparaison numérique
  (`n:… compare <= 365`). Le format est celui des politiques SCA de Wazuh :
  une politique écrite pour Wazuh se dépose telle quelle, dialecte
  d'expressions régulières OSSEC compris (`regex_type: pcre2` accepté).
  Chaque contrôle est exécuté, noté et remonté comme les contrôles intégrés.
- **Contrôle non applicable** : un contrôle dont une règle ne peut pas être
  évaluée (fichier absent, outil non installé) n'est ni réussi ni échoué ; il
  ne compte pas dans le score. Ce statut manquait : un tel contrôle était une
  erreur ou un échec.
- **Socle de durcissement livré** : 169 contrôles (90 pour Linux, 32 pour
  macOS, 47 pour Windows), en français, avec leur remédiation et leur
  rattachement ISO 27001 et CIS : réglages du noyau et du réseau, comptes et
  mots de passe, sudo, SSH, droits des fichiers système, services hérités,
  journalisation ; Gatekeeper, SIP, FileVault, mises à jour, services de
  partage ; SMB, NTLM, LSA, WDigest, UAC, Bureau à distance, WinRM,
  PowerShell, Defender. Activé par `hardening_benchmark` (désactivé par
  défaut : ces contrôles entrent dans le score de conformité, que leur
  activation modifie donc).
- **Vérifié** : la politique macOS a tourné sur un Mac réel (29 contrôles
  conformes, 3 écarts, tous avérés ; un faux écart corrigé au passage :
  macOS livre un `/etc/hosts.equiv` vide) et la politique Linux sur une
  Ubuntu 24.04 réelle (48 conformes, 30 écarts, 12 non applicables faute de
  sshd ; neuf règles corrigées après le premier passage, qui donnaient
  « non applicable » ou « échec » pour un fichier absent). **Non vérifié** :
  la politique Windows repose sur la commande `reg query`, dont la lecture
  est testée sur un exemple de sortie mais qui n'a pas tourné sous Windows.

### 🕳️ Détection de rootkits : ce que le système cache

- **Processus cachés** : chaque numéro de processus est sondé ; un processus
  qui répond sans figurer dans la liste du système est signalé (incident
  critique). Les fils d'exécution et les processus tout juste lancés ne sont
  pas confondus avec un processus caché.
- **Ports d'écoute cachés** : chaque port TCP est lié un instant ; un port
  occupé, absent de la liste du système et qui accepte une connexion est
  signalé (critique).
- **Modules noyau cachés** (Linux) : module présent dans `/sys/module` mais
  absent de `/proc/modules`.
- **Bibliothèque imposée à tous les programmes** : `/etc/ld.so.preload`,
  `LD_PRELOAD` dans `/etc/environment` (Linux), `DYLD_INSERT_LIBRARIES` dans
  un élément de lancement (macOS).
- **Interface en mode promiscuité**, hors interfaces virtuelles et ports de
  pont.
- **Fichiers là où il n'en faut pas** : fichiers ordinaires dans `/dev`,
  programmes au nom masqué dans les dossiers temporaires.
- **Processus dont le programme a été supprimé** après avoir été lancé depuis
  un dossier temporaire ou depuis la mémoire (Linux).
- **Fichiers de rootkits connus** (Linux) : une trentaine de chemins laissés
  par des rootkits publiés.
- Chaque constat est signalé une fois par jour. Les sondes de processus et de
  ports tournent une fois par heure (environ une seconde) ; le reste à chaque
  analyse de sécurité. Réglage `rootkit_detection` (actif par défaut).
- **Limites** : ces contrôles s'exécutent en espace utilisateur, avec les
  réponses que donne le noyau ; un rootkit noyau qui falsifie les deux façons
  de poser la question n'est pas vu. Un port caché lié à une seule adresse
  externe n'est pas détecté (la vérification se fait sur la boucle locale,
  pour ne pas signaler un port simplement réservé). Windows n'est pas couvert.
- **Vérifié** : exécuté sur un Mac réel et sur une Ubuntu 24.04 réelle,
  sans faux positif après correction de ceux que les premiers essais ont
  montrés (ports du pont Thunderbolt sous macOS ; sous Linux, périphériques
  montés sur un fichier d'attente, que la liste du dossier donnait pour des
  fichiers ordinaires). Aucun rootkit réel n'a servi d'essai : la détection
  elle-même est testée sur des systèmes simulés.

### 📜 Analyse de journaux : règles Sigma sur les journaux, corrélations, lecture en temps réel

- **Les règles Sigma s'appliquent aux journaux**, plus seulement aux
  processus : règles écrites pour un service (`sshd`, `auth`, `sudo`,
  `syslog`, `cron`, `security`, `system`, `powershell`…) ou pour la catégorie
  `webserver`. Les règles de la communauté SigmaHQ pour ces sources se
  déposent telles quelles dans `sigma.d`.
- **Règles de corrélation Sigma** (`correlation:`) : `event_count` (N
  correspondances), `value_count` (N valeurs distinctes d'un champ),
  `temporal` et `temporal_ordered` (plusieurs règles, dans l'ordre ou non),
  par groupe (`group-by`) et par fenêtre de temps. Une corrélation peut en
  compter une autre. Plusieurs documents par fichier, modificateur `cidr`.
- **Décodeurs** : les lignes de sshd, sudo, su, PAM, useradd/usermod/gpasswd,
  passwd, du pare-feu du noyau (iptables, nftables, ufw), d'auditd, du partage
  d'écran macOS, des journaux d'accès web et des événements Windows sont
  traduites en champs fixes (`action`, `user`, `src_ip`, `command`…), les
  mêmes d'un système à l'autre.
- **Lecture en temps réel** : `log stream` sous macOS, `journalctl --follow`
  sous Linux, canaux d'événements Windows relus depuis le dernier
  enregistrement lu (données de l'événement comprises, plus seulement son
  message). Sous macOS, les lignes de sudo et de sshd ne sont jamais
  conservées par le système : elles ne peuvent être lues qu'à leur passage,
  ce que la lecture par fenêtre d'une minute ne faisait pas.
- **Fichiers de journaux déclarés** (`log_files`) : journal d'accès d'un
  serveur web, journal JSON d'une application, fichier syslog ou auditd.
  Lecture depuis la fin à la première fois, position conservée entre deux
  exécutions, rotation et troncature suivies.
- **48 règles livrées** (35 règles, 13 corrélations), en français, avec leurs
  techniques ATT&CK : force brute et pulvérisation de mots de passe SSH,
  connexion réussie après une force brute, sudo refusé, su, comptes créés
  (dont UID 0) ou ajoutés à un groupe privilégié, mode promiscuité, balayage
  de ports interne, attaques web (traversée de répertoire aboutie, Log4Shell,
  balayage, énumération, force brute), événements Windows (journal effacé,
  force brute, compte ajouté aux administrateurs, service suspect, Bureau à
  distance depuis Internet, Defender). Une règle de `sigma.d` portant le même
  `id` remplace celle livrée ; un `id` inscrit dans
  `sigma.d/disabled-rules.txt` la désactive.
- **Réponse** : une détection qui nomme une adresse distante est présentée aux
  playbooks comme une alerte réseau ; un playbook peut donc bloquer l'adresse
  d'une force brute.
- **Pas d'avalanche** : une même règle, pour un même groupe (adresse, compte),
  lève un incident par quart d'heure ; 20 incidents au plus par passe. Les
  règles de niveau `low` et `informational` deviennent des événements SIEM,
  pas des incidents.
- Les deux anciens compteurs que ces règles remplacent (« cinq lignes
  contenant failed », « trois lignes contenant sudo ») sont retirés quand
  l'analyse est active : ils signalaient deux fois la même activité, et
  l'usage ordinaire de sudo comme une élévation de privilèges critique.
- Réglages : `log_analysis` (actif par défaut), `log_analysis_all_programs`,
  `log_files`.
- **Vérifié** : lecture réelle sous macOS (`log stream`, ligne sudo
  réelle, qui a fait corriger le décodeur) ; sous une Ubuntu 24.04 réelle,
  tests passés et `journalctl` démarré avec ses filtres. **Non vérifié** :
  le script PowerShell des canaux Windows n'a pas tourné ; les règles Linux
  et Windows sont testées sur des lignes et des événements d'exemple. Sous
  Linux, le compte du service doit appartenir au groupe `systemd-journal` ;
  à défaut, `/var/log/auth.log` ou `/var/log/secure` sont suivis s'ils sont
  lisibles. Les `aliases` des corrélations et les conditions d'absence (`lt`,
  `eq`…) ne sont pas pris en charge. Les règles pour d'autres catégories
  (`network_connection`, `registry_set`, `dns_query`…) restent non évaluées.

### 🗂️ Intégrité des fichiers : base conservée, analyses complètes, détail des changements

- **Changements faits agent arrêté** : la base de référence n'existait qu'en
  mémoire et était reconstruite à chaque démarrage à partir des fichiers tels
  qu'ils étaient. Arrêter l'agent, modifier `/etc/sudoers` et le relancer ne
  laissait aucune trace. La base est maintenant conservée dans le dossier de
  données (`fim/baseline.json`, lisible par le seul compte de l'agent) et
  comparée au disque à chaque démarrage : fichiers créés, modifiés ou
  supprimés pendant l'arrêt sont signalés, avec la mention « au démarrage ».
  Une base conservée illisible est signalée dans le journal, jamais remplacée
  en silence.
- **Analyse complète périodique** (toutes les 6 h, `rescan_interval_secs` de
  la politique, 0 pour désactiver) : retrouve ce que le système n'a pas
  signalé (file d'événements saturée, limite de surveillance atteinte,
  dossier remplacé d'un bloc). Un changement vu à la fois par la surveillance
  temps réel et par l'analyse n'est signalé qu'une fois.
- **Permissions et propriétaire** : l'alerte dit ce qui a changé, avec les
  valeurs avant et après (`permissions 644 → 4755`, `propriétaire 0:0 →
  501:20`). Un changement qui ouvre le fichier (écriture pour le groupe ou
  tous, bit set-user-ID, autre propriétaire) est de gravité haute. Un
  événement de métadonnées sans changement réel (date d'accès, attribut
  étendu) ne lève plus d'alerte « permissions modifiées ».
- **Fichiers illisibles par l'agent** (`/etc/shadow`, `/etc/sudoers` pour un
  service non root) : ils n'étaient pas suivis. Leur taille, leur date de
  modification, leurs permissions et leur propriétaire le sont maintenant.
- **Fichier remplacé par un lien symbolique** : la disparition du fichier
  surveillé est signalée ; seule la cible du lien l'était.
- **État final des fichiers écrits en plusieurs fois** : les événements
  arrivés pendant l'intervalle anti-rebond étaient ignorés, et la base gardait
  l'empreinte d'un fichier partiel. Le fichier est relu une fois la rafale
  terminée.
- **`fim_watched_paths` et `fim_ignore_patterns` appliqués** : ces deux champs
  de la configuration locale étaient lus mais jamais transmis au moteur, qui
  démarrait toujours avec les chemins par défaut.
- **Chemins par défaut étendus** aux emplacements de persistance : unités
  systemd, `/boot`, `/bin`, `/sbin`, `/usr/local/bin` et `/usr/local/sbin`
  (Linux) ; `StartupItems`, `PrivilegedHelperTools`, `SecurityAgentPlugins`,
  `/usr/local/bin` (macOS) ; dossier de démarrage commun, tâches planifiées
  et scripts de stratégie de groupe (Windows). 100 000 fichiers suivis au
  plus, 32 niveaux de profondeur (5 auparavant).
- **SHA-256 dans chaque alerte** de création ou de modification (interface,
  plateforme, SIEM), calculé pour les seuls fichiers qui ont changé.
- **Interface** : la fiche d'une alerte indique l'origine de la détection, le
  détail du changement et le SHA-256 ; l'export CSV aussi.

### 🧪 Détection : fichiers malveillants connus par leur empreinte

- Les flux `threat_intel_feeds` fournissent aussi des **SHA-256 de fichiers
  malveillants** : listes texte, CSV (l'empreinte est lue dans n'importe
  quelle colonne), STIX et TAXII (`file:hashes.'SHA-256'`). Un fichier créé ou
  modifié dont l'empreinte est listée lève un incident critique « fichier
  malveillant connu » et peut déclencher un playbook (type de changement
  `malicious_hash`).
- Seul le SHA-256 est comparé : un flux qui ne donne que du MD5 ou du SHA-1
  n'apporte aucun indicateur de fichier. Un fichier déjà présent avant
  l'arrivée de son empreinte dans un flux n'est comparé qu'à sa prochaine
  modification.
- **Vérifié** : tests et essai réel sous macOS (FSEvents) et sur une Ubuntu
  24.04 réelle (inotify). **Non vérifié** : Windows (chemins par défaut,
  ReadDirectoryChanges). La base conservée n'est pas signée : un compte
  capable de la réécrire peut aussi arrêter l'agent.

### 🛡️ Réponse : actions fiabilisées, socket privilégié durci, mises à jour suivies

- **Blocage d'adresse IP dans les deux sens** : le blocage ne retenait que le
  trafic entrant. Sous macOS et Windows, le poste restait libre de joindre
  l'adresse bloquée (canal de commande, exfiltration) ; sous Linux, la règle
  ajoutée en fin de chaîne passait derrière celles d'ufw ou de firewalld et
  ignorait IPv6. Le trafic sortant est maintenant coupé aussi (pf, `iptables`
  et `ip6tables` en tête de chaîne, règle `dir=out` du pare-feu Windows). Un
  blocage posé par une version précédente se lève toujours.
- **Garde-fous du blocage** : refus de bloquer le résolveur DNS ou une
  passerelle du poste, ce qui le couperait du réseau, plateforme comprise. Une
  adresse IPv4 écrite en IPv6 (`::ffff:127.0.0.1`) est traitée comme l'adresse
  IPv4 qu'elle est.
- **Arrêt de processus lié à son identité** : juste avant le signal, l'agent
  vérifie que le PID porte encore le nom du processus détecté. Un PID réutilisé
  par un autre programme n'est plus arrêté à la place du processus disparu.
- **Socket des actions privilégiées** : appartenir au groupe des
  administrateurs ne suffit plus. Le service demande au système quel programme
  est connecté et refuse tout autre que l'application Sentinel : un programme
  lancé par un administrateur ne peut plus lever un isolement ou débloquer une
  adresse en écrivant sur le socket. Délai de 5 s pour recevoir une requête et
  8 requêtes simultanées au plus.
- **Incidents conservés hors ligne** : un incident que la plateforme n'a pas
  reçu était seulement journalisé. Il est placé dans la file locale et renvoyé
  toutes les minutes. L'envoi direct attend 5 s au plus (30 s auparavant) et,
  après un échec, les incidents suivants vont droit dans la file pendant une
  minute : une plateforme injoignable ne retarde plus les playbooks.
- **Mode simulation des playbooks** (`playbook_simulation`, désactivé par
  défaut) : les playbooks sont évalués sur l'activité réelle et consignent ce
  qu'ils auraient fait, sans rien arrêter, bloquer ni isoler.
- **Mises à jour** :
  - manifeste signé liant la version au paquet, exigé dès qu'une clé de
    signature est embarquée : un ancien paquet authentique ne peut plus être
    servi sous un nouveau numéro de version (`cargo xtask manifest`,
    `docs/UPDATE_SIGNING.md`) ;
  - le résultat réel est signalé au redémarrage (« terminée » si l'agent est
    dans la version visée, « échouée » sinon) ; l'état « terminée » n'était
    jamais envoyé, l'agent s'arrêtant avant ;
  - après un échec, la vérification planifiée attend 24 h avant de retenter la
    même version, au lieu de télécharger et de s'arrêter à chaque passage.
- **Linux** :
  - le service répond au watchdog systemd (`WatchdogSec=120` était déclaré
    sans qu'aucun signal de vie soit envoyé). Le signal est lié à la boucle
    principale : il cesse si elle reste muette 30 minutes ;
  - paquets deb et rpm : le service d'assistance root (pare-feu, isolement) est
    livré et activé, et il écoute sur un second socket réservé au compte du
    service, qui n'est pas administrateur ;
  - droits du service : `CAP_KILL` pour arrêter un processus d'un autre
    utilisateur, répertoires personnels lisibles pour l'analyse, limite de
    tâches portée de 64 à 512 ;
  - scripts de paquet : les arguments numériques de rpm sont compris (la
    désinstallation d'un rpm échouait) ;
  - le service packagé ne peut pas lancer `dpkg` ou `rpm` : il signale la
    version disponible au lieu de tenter l'installation.
- **Outillage** : compilateur figé (`rust-toolchain.toml`), outils de CI
  installés avec `--locked`, tests lancés aussi sous macOS et Windows (non
  bloquants pour l'instant), Dependabot pour Cargo, les actions GitHub et npm.
- **Non vérifié** : tout a été compilé et testé sous macOS seulement. Les
  changements Linux et Windows n'ont été ni compilés ni exécutés sur ces
  systèmes ; les unités systemd, les scripts de paquet et l'étape de signature
  de `release.yml` n'ont pas tourné.
- **Reste à faire sous Linux** : le profil AppArmor livré ne correspond pas à
  ce que fait l'agent (aucune capacité, aucune commande autorisée, `/home`
  interdit) et bride la plupart des contrôles et des réponses ; la mise en
  quarantaine reste impossible depuis le service, que son bac à sable empêche
  d'écrire hors de ses répertoires.

### 🛡️ Réponse : la quarantaine refuse les dossiers et protège mieux l'agent

- **Fichiers uniquement** : la mise en quarantaine refuse tout ce qui n'est pas
  un fichier ordinaire. Un playbook visant un dossier (`/etc/sentinel`,
  `/var/lib`, un dossier personnel…) le déplaçait en entier dans la
  quarantaine, avec tout son contenu.
- **Protection de l'agent étendue** : un dossier qui contient un chemin protégé
  est refusé au même titre que ce chemin, à la mise en quarantaine comme à la
  restauration, et tout le dossier de configuration est protégé (plus
  seulement `agent.json`). Un dossier déjà en quarantaine reste restaurable.
- **Destination de restauration toujours vérifiée** : un chemin d'origine
  relatif réduit à un nom de fichier échappait au contrôle de la destination,
  et le fichier était restauré dans le dossier de travail de l'agent — la
  racine du système pour le service. Il est désormais résolu puis contrôlé
  comme les autres, et une destination impossible à résoudre est refusée.

### 🛡️ Sécurité : la surveillance d'intégrité n'ignore plus les fichiers nommés « sentinel »

- **Contournement corrigé** : les exclusions `dossier/**` étaient comparées en
  sous-chaîne, si bien que l'auto-exclusion `sentinel/**` écartait tout chemin
  contenant « sentinel » (`/etc/cron.d/sentinel-update`,
  `/etc/hosts.sentinel-test`…) : ni alerte d'intégrité, ni analyse YARA, ni
  playbook. Elles ne s'appliquent plus qu'au contenu d'un dossier portant
  exactement ce nom ; un fichier nommé `sentinel` reste surveillé.
- **Motifs d'exclusion** : un motif sans joker (`node_modules`) désigne
  désormais un fichier ou un dossier de ce nom, et non plus tout chemin qui le
  contient ; un motif vide n'exclut plus rien (il excluait tout). Les motifs
  `*.ext` sont inchangés.
- **Dossiers de l'agent** : configuration, données, journaux, quarantaine et
  préférences de l'interface restent exclus sous Linux, macOS et Windows ; ils
  sont maintenant listés par leur nom exact. Le binaire Linux
  `/usr/bin/sentinel-agent` et les fichiers de service de l'agent (unité
  systemd, logrotate, AppArmor, LaunchDaemon macOS) n'étaient exclus que par ce
  défaut : ils sont désormais surveillés comme les autres.

### 🎯 Détection : les règles personnalisées s'appliquent à toute l'activité observée

- **Portée** : les conditions « nom de processus », « ligne de commande » et
  « port réseau » sont évaluées sur tous les processus (scan périodique et
  démarrages en temps réel) et sur toutes les connexions ayant un pair distant,
  et plus seulement sur ce que les moteurs natifs ont déjà signalé. Une règle
  « nom de processus contient anydesk » se déclenche donc même si l'agent ne
  juge pas ce processus suspect. Les conditions de chemin de fichier et de
  sévérité sont inchangées.
- **Sans répétition** : une observation est remontée quand elle apparaît, puis
  rappelée au bout de 24 h si elle est toujours là. Plusieurs nouvelles
  observations d'une même condition forment une seule correspondance
  (« (+2 more) »).
- **Garde-fous** : le processus de l'agent n'est jamais évalué, les
  autorisations de triage (motifs de processus, adresses IP) s'appliquent, et
  les playbooks ne s'exécutent toujours que sur des éléments signalés par un
  moteur.
- **Console** : l'agent déclare cette portée quand il récupère ses règles
  (`GET /detection-rules?scope=telemetry`) ; la console n'affiche plus
  l'avertissement de portée restreinte pour cet agent.

### 🧬 Détection : règles YARA sur les fichiers créés ou modifiés

- **Analyse YARA** : les fichiers que la surveillance d'intégrité signale
  comme créés ou modifiés sont confrontés aux règles `*.yar` / `*.yara` du
  dossier `yara.d`. Un fichier correspondant lève un incident « YARA : nom de
  la règle », à la gravité demandée par la règle (`severity` ou `score` de sa
  section `meta`).
- **Moteur YARA-X complet, dans un programme séparé** (`sentinel-yara`,
  sources dans `tools/sentinel-yara`) : compatibilité avec les règles de la
  communauté, modules `pe`, `elf`, `macho`, `math`, `hash` compris. L'agent le
  lance s'il le trouve à côté de son binaire ; l'analyse de fichiers suspects
  se fait ainsi hors du processus de l'agent. Il n'a pas pu être intégré au
  binaire principal : il exige une version de `regex` que la pile LLM refuse.
- **Réponse automatique possible** : modèle de playbook « Fichier malveillant
  (YARA) », qui met le fichier en quarantaine.
- **À faire avant diffusion** : construire `sentinel-yara` pour chaque système
  et l'ajouter aux installeurs (les installeurs ne sont pas modifiés).

### ⚡ Détection : processus évalués dès leur lancement

- **Option `process_event_telemetry`** (désactivée par défaut) : le système
  signale chaque démarrage de processus, aussitôt évalué par les motifs
  intégrés et les règles Sigma. Un processus qui ne vit que quelques secondes
  n'échappe plus à l'analyse périodique.
- **Sources** : événements Endpoint Security via l'outil système `eslogger`
  sous macOS (root et accès complet au disque) ; trace
  `Win32_ProcessStartTrace` sous Windows (administrateur) ; connecteur de
  processus du noyau sous Linux, derrière l'option de compilation
  `proc-connector`.
- **Limites** : `eslogger` n'est pas une interface garantie par Apple, son
  format peut changer (l'agent le signale si les lignes ne sont plus
  comprises) ; un client Endpoint Security natif demande une autorisation à
  obtenir auprès d'Apple. Le code Linux n'a pas été compilé sur Linux et reste
  donc désactivé par défaut. Aucune des trois sources n'a été exercée avec les
  droits administrateur.

### 🎯 Détection : règles Sigma exécutées par l'agent

- **Moteur Sigma natif** : les règles Sigma déposées dans le dossier
  `sigma.d` du dossier de données (sous-dossiers compris) sont évaluées sur
  les processus du poste à chaque analyse de sécurité. Les règles
  `process_creation` de la communauté SigmaHQ s'utilisent telles quelles.
  Un processus qui correspond lève un incident « Sigma : titre de la règle »,
  avec sa gravité, ses techniques MITRE ATT&CK, sa ligne de commande et son
  processus parent.
- **Pris en charge** : cartes de champs, listes de cartes, mots-clés, jokers
  `*` et `?`, modificateurs `contains`, `startswith`, `endswith`, `all`, `re`,
  `cased`, `exists`, `windash`, `base64`, `base64offset`, `wide`, comparaisons
  numériques, `fieldref` ; conditions `and`, `or`, `not`, parenthèses,
  `1 of`, `all of`, `them`.
- **Refus explicite** : une règle utilisant une construction non prise en
  charge (agrégations, corrélation, `cidr`…) est refusée avec sa raison dans
  les journaux, jamais chargée avec un sens différent. Les règles d'une autre
  source de journaux ou d'un autre système sont comptées à part.
- **Windows** : le processus parent est désormais relevé, ce qui permet aux
  règles portant sur le parent de s'appliquer.
- Exemple commenté : `config/sigma.example.yml`. Aucune règle n'est livrée
  avec l'agent.

### 📄 Rapports : export PDF avec empreinte d'intégrité

- **Bouton « Exporter PDF »** sur chaque rapport (synthèse exécutive, audit
  de conformité, incidents), à côté de l'export HTML : pages A4, titres,
  listes, tableaux répartis sur plusieurs pages avec leur en-tête répété,
  numérotation « Page n / total ».
- **Empreinte SHA-256 du contenu imprimée sur chaque page**, et fichier
  `.sha256` écrit à côté du PDF (format `sha256sum`) pour vérifier que le
  fichier n'a pas été modifié. C'est une marque d'intégrité, pas une
  signature : elle ne prouve pas qui a produit le rapport. Une signature par
  certificat reste à ajouter quand un certificat de signature sera choisi.
- Le PDF est écrit directement par l'agent, sans moteur de rendu ni
  dépendance nouvelle ; le même rapport donne toujours le même fichier.

### 🤖 Assistant IA : actions proposées et recherche dans l'historique

- **Actions proposées, jamais exécutées seules** : quand une action de
  l'agent répond à la demande, l'assistant la propose et un bouton apparaît
  sous sa réponse — relancer l'analyse, lancer la découverte du réseau,
  exporter le SBOM, corriger un contrôle en échec, isoler le poste, lever
  l'isolation. Rien n'est lancé avant confirmation de l'opérateur, et
  l'action confirmée est notée dans la conversation.
- **Contrôle côté application** : la liste des actions est fermée ; une
  action inventée, un contrôle inexistant ou déjà conforme, une isolation sur
  un poste déjà isolé ne donnent aucun bouton. Si le modèle cite un domaine
  (« pare-feu ») au lieu de l'identifiant du contrôle, l'application retrouve
  le contrôle quand un seul est en échec dans ce domaine. Aucune action n'est
  proposée en conversation vocale.
- **Recherche dans l'historique** : une question portant sur une période
  (« que s'est-il passé mardi ? », « hier », « la semaine dernière », « il y a
  3 jours », « le 2 octobre », « depuis 6 heures »…) ajoute au contexte les
  événements enregistrés sur cette période : processus suspects, alertes
  réseau, intégrité des fichiers, USB, incidents système, vulnérabilités,
  actions de réponse. Une période sans événement est signalée comme telle,
  avec les dates que l'historique couvre.
- La chronologie forensique et l'assistant s'appuient désormais sur la même
  liste d'événements.

### 🛰️ Flux d'indicateurs de compromission (texte, STIX 2.1, TAXII 2.1)

- **Sources de renseignement configurables** (`threat_intel_feeds`) : listes
  de blocage publiques, bundles STIX 2.1, collections TAXII 2.1 (pagination
  comprise), avec en-tête d'authentification pour un serveur interne (MISP,
  OpenCTI). Leurs adresses et domaines malveillants s'ajoutent à ceux que la
  plateforme pousse ; un agent autonome dispose ainsi de renseignement.
- **Aucune source par défaut** : rien n'est contacté tant qu'un flux n'est
  pas déclaré. HTTPS obligatoire.
- **Garde-fous** : les adresses privées ou locales sont refusées ; les
  indicateurs STIX révoqués ou expirés sont ignorés ; un flux en échec garde
  ses derniers indicateurs, conservés sur disque pour le prochain démarrage.
- Vérifié sur deux listes publiques réelles (Feodo Tracker, URLhaus).

### 📚 Référentiels : notation par contrôle pour NIS 2 et DORA, ajout de HDS

- **NIS 2 et DORA** étaient reconnus comme référentiels actifs, mais sans
  catalogue de contrôles : aucun score par exigence. Ils en ont désormais un.
  NIS 2 : article 21, paragraphe 2, points b, c, e, g, h, i et j. DORA :
  articles 7, 9 (paragraphes 2, 3 et 4, points c, d et f), 10 et 12.
- **HDS (hébergeur de données de santé)** : nouveau référentiel, fondé sur le
  socle ISO/IEC 27001:2022 qu'exige la certification (contrôles de l'annexe A
  vérifiables sur un poste).
- Chaque catalogue indique en tête ce qui n'est pas mesurable par l'agent
  (gouvernance, chaîne d'approvisionnement, exigences contractuelles…). Les
  correspondances sont à faire valider par un auditeur avant d'être opposées
  à un tiers.

### 🧱 Contrôles de conformité personnalisés

- **Contrôles déclarés dans des fichiers TOML**, sans recompiler l'agent :
  chaque fichier du dossier `checks.d` du dossier de données déclare un ou
  plusieurs contrôles, exécutés, notés et remontés comme les contrôles
  intégrés (nom, gravité, catégorie, référentiels, plateformes).
- **Quatre sondes** : présence d'un fichier, contenu d'un fichier (expression
  régulière ligne par ligne), permissions et propriétaire (Unix), commande
  (code de retour et sortie). Les programmes sont lancés par chemin absolu,
  sans interpréteur de commandes, avec un délai maximal.
- **Garde-fous** : l'identifiant commence par `custom_` et ne peut pas
  remplacer un contrôle intégré ; une déclaration invalide est refusée avec
  sa raison, les autres sont chargées ; sous Unix, un fichier ou un dossier
  modifiable par un autre utilisateur est ignoré.
- Exemple commenté : `config/checks.example.toml`.

### 🧩 Inventaire des extensions de navigateur

- **Nouvel onglet « Extensions de navigateur »** dans Logiciels & MDM : les
  extensions de Chrome, Edge, Brave, Chromium et Firefox sont relevées dans
  les profils de chaque utilisateur, à chaque analyse des vulnérabilités, par
  lecture des fichiers sur disque (aucun navigateur n'est lancé).
- **Portée de chaque extension** — étendue, modérée ou limitée — calculée à
  partir des permissions obtenues, avec les raisons en clair : accès à tous
  les sites, lecture des cookies, interception des requêtes, injection de
  scripts, messagerie native, débogueur, proxy… Une extension installée hors
  du magasin du navigateur monte d'un niveau. La portée décrit une capacité,
  pas une malveillance.
- L'inventaire reste local : il n'est pas encore envoyé à la plateforme.

### 📦 Vulnérabilités : distributions RPM, outils de développement et SBOM

- **Distributions RPM** : l'inventaire lit la base RPM et les CVE sont
  recherchées pour AlmaLinux, Rocky Linux, RHEL (dépôts BaseOS et AppStream)
  et openSUSE (Leap, Tumbleweed), avec le nommage propre à chacune (paquet
  binaire ou paquet source, époque incluse). Seul le noyau installé le plus
  récent est évalué. Les autres distributions RPM (Fedora, CentOS Stream,
  Oracle Linux, Amazon Linux, SLES) sont inventoriées sans recherche de CVE,
  faute de base d'avis exploitable.
- **Outils installés hors du gestionnaire de paquets** : paquets Python
  (`pip`, dossiers `site-packages` système et utilisateur), paquets Node.js
  globaux (`npm -g`, nvm) et binaires `cargo install` sont inventoriés et
  confrontés aux CVE (écosystèmes PyPI, npm, crates.io). Lecture directe sur
  disque, sans exécuter d'interpréteur. Les dépendances des projets (fichiers
  de verrouillage, environnements virtuels) ne sont pas couvertes.
- **SBOM CycloneDX 1.5** : bouton « SBOM CycloneDX » dans Logiciels & MDM.
  Chaque paquet y figure avec son identifiant purl ; chaque vulnérabilité
  pointe vers les composants touchés, avec son score, sa priorité et son
  statut d'exploitation (CISA KEV, EPSS). Fichier écrit sur le Bureau.
- Entre deux sources donnant la même faille, celle qui indique la version
  corrigée est conservée.

### 🚧 Isolation réseau du poste

- **Nouvelle action de réponse** : l'agent coupe tout le trafic du poste, sauf
  la plateforme Sentinel GRC (adresses résolues au moment d'isoler), le DNS et
  le DHCP. En mode autonome, seuls le DNS et le DHCP restent ouverts.
- **Trois façons de la déclencher** : action de playbook « Isoler le poste du
  réseau » (paramètre : durée en secondes, `0` jusqu'à levée manuelle, une
  heure par défaut) ; bouton « Isoler le poste » dans Menaces → Réponse ;
  commandes plateforme `isolate_host` et `release_host`.
- **Toujours réversible** : un bandeau « Poste isolé » s'affiche sur toutes
  les pages avec le bouton « Lever l'isolation » ; l'isolation est refusée si
  l'adresse de la plateforme ne peut pas être résolue ; elle est consignée sur
  disque, réappliquée après un redémarrage et levée si sa durée a expiré
  entre-temps.
- **Pare-feu utilisé** : ancre pf `com.apple/sentinel-isolation` sous macOS
  (sans toucher à `/etc/pf.conf`), chaînes `SENTINEL_ISO_IN`/`SENTINEL_ISO_OUT`
  sous Linux (iptables et ip6tables), règles `SentinelIsolation_*` du pare-feu
  Windows (refus explicite si un profil du pare-feu est désactivé).
- **Modèle de playbook « Ransomware (fichiers leurres) »** : isole le poste
  une heure dès qu'un fichier leurre est chiffré.

### 🪤 Fichiers leurres anti-ransomware

- **Détection par leurres** : un dossier masqué de faux documents (tableur,
  PDF, texte, photo) est déposé dans le dossier personnel et le dossier
  Documents de chaque utilisateur. Personne n'ouvre ces fichiers : un leurre
  réécrit, ou renommé sur place (`.locked`…), lève aussitôt un incident
  critique « Ransomware suspecté », avec notification, envoi à la plateforme
  et au SIEM. Une simple suppression (nettoyage manuel) ne lève qu'un
  incident moyen.
- **Réponse automatique possible** : un leurre chiffré est présenté aux
  playbooks comme un changement de fichier de type `ransomware_canary`.
- **Désactivé par défaut**, car l'agent écrit alors dans les dossiers des
  utilisateurs. Activation dans Paramètres → Agent → Protection
  anti-ransomware, par `"ransomware_canaries": true` dans `agent.json`, ou
  par `SENTINEL_RANSOMWARE_CANARIES=true`. La désactivation supprime les
  leurres intacts ; un fichier modifié n'est jamais supprimé.
- **Dépôt sûr quand l'agent tourne en root** : dossiers et fichiers sont
  créés par descripteurs de dossier, sans jamais suivre un lien symbolique,
  puis remis à l'utilisateur ; un dossier qui n'appartient pas à
  l'utilisateur attendu est refusé.
- Un chiffrement survenu pendant que l'agent était arrêté est signalé au
  démarrage ; le dossier touché est conservé comme preuve et un nouveau
  dossier est déposé.

### 🎯 Vulnérabilités : priorité fondée sur l'exploitation réelle (CISA KEV + EPSS)

- **Chaque faille reçoit une priorité de correction** : *immédiate* si elle
  est déjà exploitée (catalogue CISA KEV), *urgente* si son exploitation est
  probable (score EPSS d'au moins 10 %), *planifiée* si elle est critique ou
  élevée sans signal d'exploitation, *courante* sinon. Le CVSS seul ne dit pas
  ce qui est attaqué aujourd'hui.
- **Page Vulnérabilités** : failles triées par priorité, colonne « Priorité »,
  filtre « À corriger d'abord », bandeau résumant ce qui est exploité, section
  « Exploitation » dans le détail (date d'ajout au catalogue, échéance CISA,
  usage par des rançongiciels, probabilité EPSS), colonnes ajoutées à
  l'export CSV. La page indique la version du catalogue et la date des scores
  utilisés, ou qu'une source manquait.
- **Aucune donnée du poste n'est envoyée** : les deux sources sont
  téléchargées en entier, puis filtrées localement. Elles sont conservées sur
  le poste (12 h pour KEV, 24 h pour EPSS) ; hors ligne, la dernière copie
  sert encore et la page le signale. Une source indisponible ne rend pas
  l'analyse partielle : seule la priorité retombe sur la gravité.
- **Assistant IA** : les failles exploitées sont analysées en premier après un
  scan, et l'assistant reçoit le statut d'exploitation de chaque faille.
- **Notification de fin de scan** : mentionne le nombre de failles exploitées
  activement.
- Les champs envoyés à la plateforme sont inchangés.

### 🧠 Assistant IA : contexte complet et adaptation automatique au poste

- **L'IA voit enfin le détail des contrôles** : pour chaque domaine (antivirus,
  pare-feu, politique de mots de passe, politique de comptes, chiffrement,
  mises à jour, verrouillage de session, accès distant, journalisation), elle
  reçoit le résultat du contrôle, le constat mesuré et, en cas d'échec ou
  d'erreur, les valeurs relevées sur le poste qui en expliquent la cause. Un
  domaine sans contrôle est signalé « non évalué » au lieu d'être présenté
  comme une information manquante.
- **Autres contrôles en échec ou en erreur** listés avec leur cause ;
  **menaces ouvertes uniquement** (hors acquittées ou autorisées), avec la
  ligne de commande des processus suspects, la description des incidents et
  les adresses des alertes réseau.
- **Adaptation automatique au processeur** : un seul binaire pour tous les
  postes. Les instructions AVX2/FMA sont utilisées quand le processeur les
  possède, et le code générique sinon (processeurs anciens, Celeron, Atom),
  sans plantage. Un thread de calcul par cœur physique, pour garder le poste
  réactif. Le mode de calcul utilisé (GPU Metal, CPU AVX2 ou CPU de base) est
  affiché dans « Modèle & diagnostic ».

### ⚡ Assistant IA : réponses en direct, plus rapides et plus stables

- **Réponse affichée mot à mot** (streaming) au lieu d'attendre la fin de la
  génération ; en conversation vocale, la lecture commence dès la première
  phrase terminée.
- **Bouton « Arrêter la réponse »** : la génération s'interrompt aussitôt et
  le texte déjà produit est conservé.
- **Premier mot jusqu'à 50 fois plus rapide sur les questions suivantes** :
  le prompt système est désormais fixe et le contexte Sentinel est placé
  avant la question, ce qui permet au cache de préfixe du moteur de réutiliser
  les calculs d'une question à l'autre (mesuré : 102 s → 2 s avant le premier
  mot sur CPU).
- **Les questions passent avant les analyses automatiques** : l'analyse IA des
  vulnérabilités après un scan est suspendue dès qu'une question est posée,
  puis reprise ; elle est limitée à 5 vulnérabilités (critiques d'abord) et à
  200 tokens par analyse.
- **Modèle préchargé** à l'ouverture de l'assistant (et une seule fois, même
  si plusieurs demandes arrivent en même temps).
- **Mac Apple Silicon : calcul sur le GPU (Metal)**, avec repli automatique sur
  le CPU si le GPU n'est pas utilisable.
- **Stabilité** : plus de rechargement complet du modèle ni de nouvel essai en
  cas de lenteur ; le délai d'attente porte sur l'arrivée du premier mot puis
  sur l'absence de progression (60 s), pas sur la durée totale d'une longue
  réponse. Réponses plus concises par défaut (200 mots au plus, sauf demande
  de rapport détaillé).

### 🎙️ Assistant IA : conversation vocale fiable et réglages complets

- **Réponses lues en entier** : la réponse est découpée en phrases et lue
  groupe par groupe ; le micro ne se rouvre qu'à la fin réelle de la lecture.
  Corrige les réponses longues coupées (limite de 850 caractères et délai de
  35 s qui rouvrait le micro en pleine phrase) et le faux message « Voix
  indisponible ». Mode « Résumé » au choix. Moteur système recréé
  automatiquement s'il échoue.
- **Mode conversation mains libres** (bouton « Parler ») : écoute, envoi
  automatique, réponse vocale puis nouvelle écoute ; « J'ai fini » pour
  envoyer tout de suite, « Interrompre et parler » pour couper la réponse,
  pause automatique après deux tours sans parole. Le micro ne s'ouvre jamais
  tout seul au démarrage.
- **Dictée qui ne perd plus rien** : « Terminer la dictée » transcrit ce qui a
  été dit (au lieu de l'effacer). Dictée jusqu'à 2 minutes, silence de fin de
  phrase réglable (1,2 s par défaut contre 0,7 s), vocabulaire cyber pour
  Whisper, calcul multi-cœur.
- **Installation de la dictée depuis l'interface** : modèles Whisper Tiny /
  Base / Small téléchargés depuis une URL figée et vérifiés par SHA-256 avant
  installation. Chargés sans redémarrage. Au lieu de « modèle Whisper non
  chargé », l'interface propose « Installer la dictée ».
- **Réglages vocaux** : voix système (la meilleure voix française est choisie
  automatiquement), vitesse, volume, réponse complète ou résumé, langue parlée,
  modèle de dictée, bouton « Tester la voix », seuil des alertes vocales
  (avertissement / élevée / critique). Réglages conservés entre les sessions.
- **Réponses pensées pour l'oral** : en conversation vocale, l'IA répond en
  3 à 6 phrases courtes sans Markdown (réponse plus rapide) ; le raisonnement
  `<think>` des modèles DeepSeek-R1 n'est jamais lu. Bouton « conversation »
  dans l'assistant flottant ; ses réglages ramènent la fenêtre principale.

### 🏠 Mode autonome (standalone), choisi à l'installation

- **Un agent sans plateforme** : `"standalone": true` (ou `SENTINEL_STANDALONE`,
  ou `sentinel-agent standalone`) coupe tout ce qui parle à la plateforme —
  enrôlement, heartbeat, envoi des résultats de conformité, des vulnérabilités,
  des logiciels, des incidents et des instantanés réseau, commandes distantes,
  renouvellement de certificat et mise à jour distante. Aucun client HTTP n'est
  créé. EDR, intégrité des fichiers, conformité, analyse de vulnérabilités,
  inventaire et surveillance réseau tournent en local et les données restent
  sur le poste. Destiné aux particuliers et aux postes qui n'ont besoin que
  d'une protection locale, gratuitement.
- **Choix à l'installation** : le MSI Windows ajoute un dialogue « Comment
  protéger ce poste ? » (plateforme / protection locale), la propriété
  `INSTALLMODE=STANDALONE` en silencieux, un `agent.json` autonome et un
  raccourci « Tableau de bord » réservé au mode plateforme. Le `.deb` honore
  `SENTINEL_STANDALONE=1` au `dpkg -i`, le `.pkg` macOS se construit avec
  `SENTINEL_STANDALONE=1`.
- **Assistant de premier lancement** : deux cartes, « Rejoindre une
  plateforme » ou « Protection locale ». Le parcours autonome ne demande qu'un
  mot de passe administrateur optionnel, en quatre étapes, et se termine par
  « Protection activée ».
- **Interface en mode autonome** : bandeau « Mode autonome · Protection locale
  active », pastille et pied de barre latérale dédiés, page Synchronisation et
  bouton « Synchroniser » retirés, carte « Plateforme » dans les réglages.
  Le menu de la barre système grise « Synchroniser » et « Console », et la
  carte « Maintenance et mises à jour » propose le téléchargement du dernier
  paquet plutôt qu'une vérification qui ne contacterait aucun serveur.
  Partout, un bouton « Connecter à une plateforme » rouvre l'assistant ;
  l'enrôlement réussi désactive le mode autonome et l'étape finale propose
  « Redémarrer maintenant » (l'agent se relance de lui-même, l'ancienne
  instance libère d'abord le verrou d'instance unique et la base) ou « Plus
  tard » (la synchronisation démarre au prochain lancement, une notification
  le rappelle).
- **Ligne de commande** : `sentinel-agent standalone` / `--disable`
  (droits administrateur requis) ; `sentinel-agent enroll` réussi désactive
  lui aussi le mode autonome. Si `SENTINEL_STANDALONE` est définie dans
  l'environnement, la commande et l'assistant préviennent qu'elle prime sur le
  fichier.
- **Documentation** : `config/README.md` (section et variable
  `SENTINEL_STANDALONE`), exemples JSON, README, guide utilisateur, README du
  preview (`PREVIEW_STANDALONE=1`, étapes `standalone-*`).

### 🔌 Communication avec la plateforme on-premise

- **Variables d'environnement `SENTINEL_*` réellement prises en compte** :
  `SENTINEL_SERVER_URL`, `SENTINEL_ENROLLMENT_TOKEN`, `SENTINEL_CA_CERT_PATH`,
  etc. étaient silencieusement ignorées (le séparateur `_` les transformait en
  clés imbriquées `server.url`). Les champs de premier niveau sont désormais
  mappés à plat, les champs imbriqués (`proxy.*`, `llm.*`) explicitement, et
  les listes acceptent des valeurs séparées par des virgules. Tests ajoutés
  avec environnement injecté.
- **`sentinel-agent enroll --server <URL>` persiste l'URL** dans `agent.json`
  (en conservant les autres clés et les permissions du fichier). Auparavant le
  service redémarrait sur l'URL SaaS compilée par défaut après un enrôlement
  réussi sur une instance on-premise.
- **macOS** : le `postinstall` écrivait `agent.json` dans `SentinelGRC/config/`
  alors que l'agent le lit dans `SentinelGRC/` ; l'URL serveur intégrée au
  paquet n'était donc jamais appliquée. De plus, `SENTINEL_SERVER_URL` était
  évaluée sur le poste cible (heredoc non interpolé) et non au build : elle est
  maintenant injectée dans le `.pkg` au moment de la construction.
- **Documentation** : section on-premise dans `config/README.md` (URL
  `https://<domaine>/fn/agentApi`, `ca_cert_path`, TLS 1.3, commande de
  vérification) et rappel dans le guide utilisateur.

### 🧱 Tableaux, champs de recherche et défilement

- **La page défile à nouveau partout** : chaque tableau `egui_extras` créait
  son propre conteneur défilant, borné à la place restante dans la fenêtre ;
  la molette était capturée dès que le pointeur survolait une liste (registre
  des paquets, journal SIEM, inventaire…) et la page semblait bloquée. Les
  tableaux ne défilent plus par eux-mêmes (`vscroll(false)`) — la page est le
  seul conteneur qui défile, les listes restant paginées. Le journal SIEM perd
  son puits de 450 px au profit de la pagination (`AUTO` suit la dernière
  page). Une sonde headless (`examples/scroll_probe.rs`) rend chaque page,
  envoie un cran de molette sur une grille de positions et échoue si une
  position ne défile pas.
- **Module `widgets::table`** : colonnes fluides (`Col::fluid(min, part)`,
  `Col::fixed`) calculées sur la largeur disponible et toujours coupées, en-têtes
  et cellules partagés (`header_cell`, `cell`, `cell_mono`, `cell_stack`,
  `cell_link`, `cell_number`, `cell_empty`…), `row_interaction` pour le curseur,
  la barre d'accent et le clic de ligne. Les 18 tableaux des 14 pages
  (vulnérabilités, logiciels ×2, FIM, journal d'audit, réseau ×2, Shadow IT,
  synchronisation, inventaire, risques, rapports, conformité ×2, notifications
  ×2, terminal, assistant IA, journal SIEM) y sont passés.
- **Plus de débordement** : les colonnes non coupées poussaient les tableaux
  au-delà de leur carte (10 à 30 px à 1360 px de large) et les valeurs longues
  peignaient sur la colonne voisine. Une cellule tient sur une ligne, tronquée
  avec une ellipse et la valeur complète en infobulle ; les cellules à deux
  lignes (paquet + date d'installation, chemin + empreinte, CVE + date de
  découverte) imposent une hauteur de ligne de 44 px au lieu de 36 px, où
  elles se chevauchaient. Les colonnes sont dimensionnées pour tenir dans la
  fenêtre minimale (960 px) ; les lignes de redimensionnement ont disparu.
- **Vulnérabilités** : la colonne « Analyse et correctifs » (description
  repliée sur plusieurs lignes + badges + date, coupée par la ligne) est
  éclatée en colonnes CORRECTIF (version cible) et DESCRIPTION ; la date de
  découverte passe sous l'identifiant, le faux positif en badge « FP ».
  Shadow IT : IP et MAC empilées, statut dans sa colonne, export CSV sur la
  ligne de recherche. Conformité : date d'exécution dans sa colonne,
  référentiels au-delà du troisième repliés en « +N ».
- **Un seul champ de recherche** (`widgets::SearchInput`) : cadre, loupe, anneau
  de focus, bouton d'effacement à emplacement réservé, Échap pour vider sans
  quitter le champ, texte qui défile sous la loupe. Il remplace le champ de la
  barre de filtres (désormais fluide : 42 % de la ligne entre 240 et 460 px,
  au lieu de 260 px fixes qui coupaient l'indication), les `TextEdit` nus du
  journal SIEM et du terminal, et le champ de la palette de commandes.
- **Un seul champ de conversation** (`widgets::ChatInput`) pour Jarvis sur le
  tableau de bord et l'assistant : cadre, icône, bouton d'envoi rond
  (inactif tant qu'il n'y a rien à envoyer, curseur « interdit »), rotor pendant
  le traitement, Entrée envoie sans perdre le focus.
- **Curseur main sur tout ce qui se clique** : `Visuals::interact_cursor`
  fixé au niveau du thème, au lieu d'appels dispersés que la moitié des
  contrôles oubliaient. Les rayures des tableaux `egui_extras` utilisent le
  même mélange opaque que `DataTable` (fini la bande grise translucide).
- **Banc de rendu** : `PREVIEW_OUT=<png>` écrit une capture rendue hors
  écran, identique à celle de la fenêtre, qui fonctionne écran verrouillé, en
  veille ou fenêtre masquée (`PREVIEW_WINDOW=1` capture la vraie fenêtre, qui
  doit alors être visible) ; la taille demandée (`PREVIEW_W`/`PREVIEW_H`)
  n'est plus écrasée par la géométrie mémorisée de la session précédente.
- **Gel à l'ouverture d'une modale** : la boîte de confirmation (mise en
  quarantaine, arrêt de processus, blocage d'IP, suppression) relisait le
  numéro de passe egui *pendant* qu'elle tenait le verrou mémoire du
  contexte — verrou non réentrant, application figée dès le premier clic
  sur « Confirmer ». Le numéro est lu avant la prise du verrou ; test de
  non-régression qui rend une modale ouverte sur plusieurs frames.
- Recherche d'IOC (Menaces › Investigation) sur le champ de recherche
  partagé ; historique de synchronisation dans les fixtures du banc de rendu
  (la table de la page Synchronisation est enfin rendue) ; fondu du bas de la
  barre latérale allongé pour que la dernière entrée ne semble plus coupée par
  le pied ; le banc capture aussi le splash et l'assistant d'enrôlement.
- **Barre d'onglets étroite** : quand les libellés ne tiennent plus (sept
  onglets Menaces à 960 px), les onglets non sélectionnés se replient sur
  leur icône (libellé en infobulle, badge conservé) avant de recourir à la
  bande défilante qui coupait « Règles » et « Chronologie ». Un badge à zéro
  n'est plus affiché.
- **Squelettes de chargement** : les lignes fantômes des tableaux se
  répartissent sur la largeur réelle de la carte (proportions conservées) au
  lieu de déborder de 50 px à droite sur Vulnérabilités et Risques.
- **Formulaires de création** (`widgets::form`) : une colonne de libellés
  commune (`form::row`) aligne les champs des formulaires Nouvel actif,
  Nouveau playbook et Nouvelle règle de détection, dont chaque contrôle
  partait d'un x différent ; les formulaires Règle d'alerte et Webhook
  passent en champs empilés qui se replient (`form::fields`/`form::field`)
  au lieu de déborder de la carte à 1360 px avec « Activé » plié lettre par
  lettre, et leurs listes déroulantes natives egui sont remplacées par le
  menu du produit. Le banc de rendu ouvre ces formulaires
  (`PREVIEW_DRAWER=asset-form|rule-form|webhook-form|playbook-form|detection-form`)
  et accepte un pointeur (`POINTER="x y"`) pour capturer les états au survol.
- **Cartographie** : chaque cran de molette sur la page zoomait aussi la carte
  qu'il faisait défiler. Le zoom passe sur Ctrl/⌘ + molette (et le pincement)
  avec le pointeur sur la carte, la molette seule fait défiler la page ; le
  raccourci est indiqué sous l'indicateur de zoom.
- **Champ secret** (`widgets::PasswordInput`) : cadre, cadenas, valeur masquée,
  œil pour la révéler, anneau de focus, Entrée pour valider. Il remplace les
  `TextEdit` nus (une ligne soulignée à côté d'un bouton flottant) du jeton
  d'enrôlement, du mot de passe administrateur de l'assistant et du dialogue
  de déverrouillage des paramètres, lequel perd sa barre de titre egui pour
  la surface de dialogue du produit.
- **Listes déroulantes** : le menu s'ouvrait vers le haut dès que le contrôle
  était dans la moitié basse de la fenêtre, recouvrant les champs au-dessus ;
  il s'ouvre vers le bas tant qu'il y tient, et ne bascule que faute de place.
- Correctif au passage : la liste des paquets appelait deux fois la navigation
  clavier, faisant sauter deux lignes par flèche et déréglant la pagination
  de l'onglet Applications.

### 🎨 Refonte complète de l'interface (GUI / UI / UX)

#### Fondations du design system
- **Typographie embarquée** : Inter (interface, 4 graisses) et JetBrains Mono NL
  (données techniques, 2 graisses), sous-ensemblées à 312 Ko au total — moins que
  le seul fichier Font Awesome déjà présent. Chiffres tabulaires figés dans les
  fontes : les cartes de métriques et les colonnes de tableaux ne « sautent »
  plus quand les valeurs changent.
- **Échelle typographique sémantique** (`font_display` → `font_micro`) : la taille
  et la graisse voyagent ensemble, à la place des `FontId::proportional()` posés
  au cas par cas.
- **Palette recalibrée** : six surfaces régulièrement espacées par thème formant
  une véritable échelle d'élévation ; chaque couleur sémantique dispose d'une
  variante mode clair calibrée à la main. `border()` porte les contours de
  contrôles (≥3:1), `border_subtle()` les filets décoratifs.
- **Élévation à deux couches** (ombre ambiante + ombre de contact) avec liseré
  supérieur éclairé.
- **Contrat d'accessibilité vérifié par tests** : AAA pour les textes primaire et
  secondaire, AA pour le tertiaire et toutes les couleurs sémantiques, 3:1 pour
  les bordures de contrôles, lisibilité des badges et des avatars, monotonie de
  l'échelle de surfaces. Deux affirmations des anciens commentaires ne tenaient
  pas et ont été corrigées.

#### Chrome applicatif
- **Barre supérieure** reconstruite : marque, bascule de la navigation, fil
  d'Ariane, recherche globale (raccourci propre à la plateforme), santé de
  l'agent, contexte du workspace et action principale.
- **Barre latérale** reconstruite : suppression du bloc de marque redondant qui
  consommait ~190 px avant la première entrée, rail d'icônes repliable et
  persistant, lignes plus denses, sections déclarées en données, pied de page
  unifié (synchronisation, analyse, workspace).
- **Largeur de contenu bornée** puis centrée au-delà, pour préserver une longueur
  de ligne lisible sur écran large.

#### Composants
- Cartes : élévation correcte (l'ombre était peinte par-dessus le contenu),
  empilement vertical garanti, variantes plate / danger / accentuée ; suppression
  du miroitement d'angle dessiné à la main.
- Tableaux : texte de cellule tronqué proprement (il débordait sur les colonnes
  voisines), survol neutre et sélection accentuée distincts, filets discrets.
- Champs de saisie : posés une marche au-dessus de leur surface au lieu du fond
  du terminal, dans lequel ils devenaient invisibles.
- Onglets, badges, curseurs, tiroirs de détail, modales, palette de commandes,
  info-bulles : alignés sur les nouveaux jetons ; ordre de dessin des ombres
  corrigé sur le tiroir et les onglets encadrés.
- État « rien à signaler » redessiné : médaillon sobre à la place de douze
  cercles empilés qui s'accumulaient en tache verte pulsant deux fois par seconde.
- En-têtes de page : suppression du filet dégradé animé qui forçait un
  rafraîchissement toutes les 100 ms sur chaque page.

#### Langue et cohérence
- Casse de phrase pour tout ce qui est cliquable ou lu (libellés d'action,
  intitulés d'onglets, filtres, états vides, lignes d'introduction des pages) ;
  les intitulés de section en petites capitales sont conservés.
- Points de suspension typographiques dans les textes d'interface.

#### Corrections
- Correction d'un plantage au démarrage : le thème nommait des familles de
  graisses dans la même frame que leur enregistrement, alors que `set_fonts`
  ne prend effet qu'à la frame suivante.
- L'écran de démarrage teintait son logo avec la couleur de texte, ce qui le
  noircissait en thème clair au lieu de le faire apparaître en fondu.
- Les grilles responsives plafonnent leur nombre de colonnes au nombre
  d'éléments, au lieu de laisser des colonnes vides.

#### Surfaces superposées
- Modale : suppression de la barre colorée supérieure qui s'arrêtait avant le
  bord droit (allouée à la largeur nominale alors que le cadre débordait) ;
  largeur du message bornée explicitement ; médaillon et titre sur les jetons.
- Palette de commandes : ligne sélectionnée en lavis opaque au lieu d'un accent
  translucide qui rendait en bleu plein ; raccourcis épelés selon la plateforme
  (`⌘R` sur macOS, `Ctrl R` ailleurs).
- Toasts : contour neutre — la barre latérale et l'icône portent déjà le niveau,
  quatre toasts empilés à contour coloré faisaient un feu tricolore.
- Alertes : le bouton de fermeture (32 px) débordait de 8 px de la colonne et
  élargissait tout ce qui suivait.

#### Clavier
- Les raccourcis de page (`⌘1`…`⌘8`) apparaissent dans les info-bulles de la
  barre latérale ; un raccourci qu'on ne peut pas découvrir n'existe pas.

#### Consommation au repos
- L'interface se rafraîchissait dix fois par seconde en permanence pour
  scruter les canaux d'événements. Des threads relais réveillent désormais le
  contexte à l'arrivée d'un message ; le filet de sécurité passe à 1 s. Un agent
  d'endpoint qui repeint à 10 Hz sans raison chauffe le portable qu'il protège.
  Comportement couvert par deux tests.

#### Outillage
- `cargo run -p agent-gui --all-features --example preview` : banc de rendu du
  chrome, de la galerie de composants et des pages réelles, sans runtime agent.
  `PREVIEW_PAGE=overlays` rend modale, toasts, alertes, progression, squelettes
  et états vides ; `PREVIEW_PAGE=palette` ouvre la palette de commandes.
  `PREVIEW_DATA=1` peuple toutes les pages de données réalistes et
  déterministes (`examples/preview/fixtures.rs`) ; `PREVIEW_DRAWER=vuln|threat|
  asset|package|connection|risk|fim|notification|log` ouvre le tiroir de détail ;
  `PREVIEW_LIGHT`, `PREVIEW_RAIL`, `PREVIEW_W`/`PREVIEW_H` pilotent thème,
  rail et taille de fenêtre ; `PREVIEW_PAGE=splash|enrollment` et
  `PREVIEW_STEP=welcome|token|admin|progress|done|failed` rendent le premier
  lancement. Le banc dispose les pages avec la colonne du shell
  (`app::page_column`), pour que la capture mesure ce que l'application montre.

#### Vues peuplées — revue de 44 rendus
- Notifications : les lignes non lues posaient un fond plein jaune, brun ou
  bleu (accent translucide composité en linéaire). Elles reposent désormais sur
  un lavis opaque de leur sévérité avec une barre d'accent sur le bord d'attaque,
  colonne de badge à largeur fixe pour aligner les titres, survol visible.
- Journal SIEM : cellules qui se rétractaient sur leur contenu, si bien que les
  messages flottaient d'une ligne à l'autre ; colonnes texte alignées à gauche
  et largeurs garanties.
- Alertes réseau : types en français lisible (« SORTIE TOR », « DHCP PIRATE »)
  à la place des clés brutes ; lavis opaque sur les lignes d'alerte.
- Tableau de bord : les huit cartes d'indicateurs partagent une hauteur et les
  graphes CPU / mémoire remplissent la leur ; jauge SLA corrigée (la fraction
  était divisée deux fois, l'arc affichait 1 %) ; score et delta du héros
  centrés sous le titre (« 87 % ▲ 4,3 ») ; la tendance des KPI se termine sur
  le score de la carte de synthèse.
- Grilles : dernière ligne équilibrée — 4 cartes à 3 colonnes donnent 2 + 2,
  7 à 5 donnent 4 + 3 — au lieu d'un orphelin.
- Barres de progression : suppression du reflet qui balayait les barres
  déterminées ; une mesure qui scintille se lit comme une activité en cours.
- Matrice des risques : cases vides en teinte discrète, cases occupées en
  couleur pleine avec le compte en texte primaire ; libellé d'axe dégagé.
- Séparateurs entre cartes supprimés (risques, intégrité des fichiers) ; journal
  d'audit dimensionné par ses lignes plutôt qu'à la hauteur de la fenêtre ;
  export CSV posé sur la ligne de recherche (logiciels) ou à droite (audit),
  comme sur les autres pages ; le bouton de découverte Shadow IT n'est plus
  seul dans une carte.
- L'icône ▶ précède le libellé des boutons d'analyse sur toutes les pages ;
  elle le suivait sur six d'entre elles.
- Modale : voile bleu nuit en thème sombre, neutre en clair. Un flou
  d'arrière-plan réel n'est pas à la portée du peintre immédiat d'egui sans
  passe de rendu dédiée ; le voile et l'élévation à deux couches jouent ce rôle.

#### Formatage français
- Nouveau module `format` : milliers groupés par espace fine insécable
  (« 1 284 »), virgule décimale (« 87,4 »), « % » précédé d'une espace fine,
  unités d'octets (« 1,2 Mo »), durées compactes (« 3 j 05 h »), temps relatifs
  (« il y a 5 min ») et pluriels accordés (« 3 échecs », « 1 résultat ») à la
  place des « (s) ». Appliqué aux cartes, tableaux, tiroirs et rapports ; les
  exports CSV gardent le format machine. Couvert par tests.

#### Réactivité
- Sous 1 120 px de large, la barre latérale se replie en rail d'icônes ; le
  bouton de menu la déploie le temps d'une navigation sans toucher à la
  préférence enregistrée.

#### Premier lancement
- Assistant d'enrôlement : colonne unique de 520 px centrée (la carte s'étirait
  sur toute la largeur de la fenêtre et son stepper collait au bord gauche),
  stepper numéroté avec coches, sélecteur Jeton / QR code en pilules, actions
  alignées à droite comme dans toute boîte de dialogue, états de fin sur le
  médaillon commun aux états vides ; vocabulaire unifié sur « jeton
  d'enrôlement ».
- Écran de démarrage extrait en widget (`widgets::splash_screen`) et rendu
  dans le banc.

#### Onglets secondaires — revue de 16 rendus supplémentaires
- Le banc accepte `PREVIEW_TAB=<n>` et les fixtures couvrent désormais la
  réponse (file d'actions, quarantaine, journal), les playbooks, les règles de
  détection, les règles d'alerte, les webhooks et l'historique de l'assistant :
  six onglets Menaces, deux onglets Notifications, les statistiques SIEM, les
  quatre onglets Rapports, les trois onglets IA et la matrice de conformité
  ont été rendus peuplés pour la première fois.
- Zébrures de tableau : le blanc à 4 % composité en linéaire donnait une
  dalle de gris moyen sur une ligne sur deux (événements, chronologie,
  playbooks, règles). Remplacé par un pas opaque de l'échelle de surfaces.
- Événements : colonnes « SÉVÉRI… », « PROCESS… », « 10/09/2026 … » tronquées
  → largeurs à la mesure des mots ; recherche et menu déroulant remplacés par
  la barre de recherche à puces du design system.
- Règles d'alerte et webhooks : un bouton rouge plein par ligne pour supprimer
  faisait un mur de danger ; icône discrète en couleur d'erreur, avec
  info-bulle.
- Cartes de modèles de playbook à hauteur commune ; jauge de l'assistant
  légendée « SCORE IA » (elle disait « CONFORMITÉ » sous 57 %) ; tailles de
  modèles et mémoire en français (« 5,2 Go », « 4 210 Mo »).

#### Graphes
- Sparklines repeintes directement : polyligne 1,5 px, aire en dégradé qui
  s'éteint vers la ligne de base, point sur la dernière valeur, axe à zéro.
  La version `egui_plot` posait un remplissage translucide qui, composité en
  linéaire, formait une dalle bleue sous la courbe — et embarquait axes,
  zoom et glisser pour 32 pixels de hauteur.
- Cartes CPU / mémoire du tableau de bord : le graphe remplit la carte.

#### Matrice des risques
- La matrice occupait seule une carte pleine largeur. Elle est désormais
  accompagnée de la légende des niveaux avec le nombre de risques ouverts par
  bande, et des trois risques ouverts au score le plus élevé.

#### Détails
- Sélecteur Jeton / QR code centré dans l'assistant d'enrôlement
  (`TabBar::centered`) ; badge de risque centré sur la carte IA du tableau de
  bord ; la page Logiciels n'affiche plus une barre à un seul onglet sur
  Linux ; export CSV du terminal posé sur la ligne de filtres ; l'état vide
  des rapports porte le bouton « Générer le rapport » au lieu d'y renvoyer.

#### Tiroirs de détail
- Les actions sont épinglées au bas du tiroir, sur leur propre surface avec
  filet et ombre : elles restent à portée quelle que soit la longueur du
  détail, au lieu d'attendre en fin de défilement (sur une fenêtre de 700 px,
  « Appliquer le correctif » n'était pas visible sans faire défiler).
- Les blocs de prose (description, instructions, analyse) passent de `bg_deep`
  — un puits de terminal autour d'une phrase — à un pas de l'échelle de
  surfaces ; les valeurs mono (hash, IP) gardent leur puits.

#### Petites fenêtres
- Barre supérieure : à 800 px, le titre de page se tronquait en « Men » ou
  « Vuln » pendant que la puce d'organisation gardait sa place. Le titre ne se
  tronque plus : le parent du fil d'Ariane s'efface d'abord, puis la puce
  d'organisation cède si le titre et l'icône de recherche en ont besoin.
- Barres d'onglets : sept onglets sur 800 px se superposaient (largeur
  répartie à parts égales) ; quand ils ne tiennent pas, la barre devient une
  bande défilante à largeur naturelle.

#### Mouvement
- Le soulignement de l'onglet actif glisse d'un onglet à l'autre ; le
  marqueur de la page active glisse le long de la barre latérale. Les deux
  respectent la préférence de mouvement réduit. (Les cartes cliquables
  s'élevaient déjà au survol et les boutons ont un état enfoncé.)

#### Clavier
- Sur les listes (vulnérabilités, inventaire, logiciels, connexions
  réseau, risques), ↑ / ↓ déplacent la sélection dans l'ordre affiché et
  changent de page avec elle, Entrée ouvre le tiroir, Échap le ferme.
  Inactif tant qu'un champ de texte a le clavier, qu'un menu est ouvert ou
  qu'une modale est affichée, pour que la recherche ne fasse jamais défiler
  le tableau derrière elle.

#### Palette de commandes
- `⌘K` / `Ctrl K` cherche aussi dans les données : une CVE, un actif (nom
  d'hôte ou IP), un paquet, un processus suspect, un risque. Le résultat
  ouvre la page et le tiroir de l'enregistrement (le processus arrive par la
  recherche de l'onglet Événements, dont la liste est reconstruite à chaque
  image). Plafonné à 200 entrées par famille : une recherche, pas un
  inventaire.

#### Détails qui comptent
- Les valeurs mono des tiroirs (hash, adresse IP, MAC, identifiant CVE) ont
  un bouton de copie à côté du puits — une empreinte est faite pour être
  collée ailleurs, pas sélectionnée à la souris.
- Une cellule de tableau tronquée montre son texte complet au survol, sans
  voler le survol à sa ligne.
- Les dates relatives (« il y a 15 min ») affichent l'horodatage complet au
  survol.
- Navigation clavier étendue aux listes restantes : intégrité des fichiers,
  journal d'audit, Shadow IT, événements et chronologie des menaces,
  notifications.

#### Thème clair
- Revue des 20 pages et de 11 onglets secondaires en thème clair, données
  peuplées : aucune régression relevée après les corrections des phases
  précédentes.

---

## 📦 [2.0.219] - 2026-04-13

### 🔧 Modifié
- Centralisation des constantes de configuration Firebase dans `agent-common`.
- Implémentation de l'utilitaire `silent_command()` pour la suppression des terminaux fantômes sous Windows.

### 🛡️ Sécurité
- Élimination des vecteurs d'authentification statiques dans le code source.
- Migration des secrets de certificats vers un stockage cryptographique d'environnement.
- Nettoyage profond de l'historique Git des données sensibles.
- Transition stratégique vers la licence **MIT**.

### 🛡️ Audit de Sécurité (~20 corrections sur 10 fichiers)

#### Fuites d'information et logging
- Correction de la fuite d'URL serveur dans les logs d'incident (`api_client.rs`) — utilisation de `safe_log_url()`.
- Passage de `warn!` à `error!` pour les échecs d'upload de vulnérabilités et d'incidents (`scanning.rs`).
- Passage de `warn!` à `error!` pour les échecs de lecture DB playbooks/règles (`heartbeat.rs`).
- Passage de `warn!` à `error!` pour le poisonnement de mutex avec message explicite sur la corruption (`heartbeat.rs`).
- Ajout d'un `warn!` quand le fichier config existe mais n'a pas de hash baseline (`self_protection.rs`).

#### Débordements d'entiers
- Protection du cast `i64 → u32` pour `get_pending_sync_count()` avec clamping sécurisé (`heartbeat.rs`).
- Protection du cast `i32 → u32` pour `match_count` (`heartbeat.rs`).
- Protection des casts `u32 → i32` pour `match_count` et `escalation_minutes` (`sync_init.rs`, `orchestrator.rs`).

#### Erreurs silencieuses
- Remplacement de `unwrap_or_default()` par `unwrap_or_else` avec logging pour les erreurs JSON playbooks/règles (`heartbeat.rs`).
- Remplacement de 5 occurrences de `unwrap_or_default()` par `unwrap_or_else` avec logging pour les erreurs de sérialisation JSON (`sync_init.rs`).

#### Corrections de robustesse
- Métrique `disk_kbps` : remplacement de `unwrap_or(u32::MAX)` par `unwrap_or(0)` (`resources.rs`).
- Introduction de l'enum `DirectoryRemoveError` pour une détection d'erreur indépendante de la locale (`cleanup.rs`).

#### Dead code
- Correction des gardes `#[cfg]` pour les fonctions GUI-only : ajout de `feature = "gui"` sur 8 fonctions/constantes (`main.rs`).
- Suppression d'un import `std::process::Command` inutilisé.

### 📖 Documentation
- Ajout des README pour 6 crates manquants (agent-common, agent-fim, agent-gui, agent-siem, agent-persistence, agent_llm).
- Mise à jour du README principal avec index de documentation des crates.
- Mise à jour du CHANGELOG, USER_GUIDE et CONTRIBUTING.

---

## 📦 [2.0.218] - 2026-04-12

### 🩹 Corrigé
- Corrections mineures de stabilité.

---

## 📦 [2.0.217] - 2026-03-29

### ✨ Ajouté
- **CMDB & Asset Sync** : Synchronisation automatique des managed assets vers la plateforme GRC (`asset_sync.rs`).
- **Réconciliation CMDB** : Normalisation criticality (snake_case → PascalCase), device_type → ciType/hardwareType.
- **Promotion d'assets** : Trigger `onManagedAssetSync` pour promouvoir les assets agent vers `cmdb_cis`.
- **Pipeline de menaces autonome** (`threat_pipeline.rs`) : Détection → Classification IA → Réponse automatique.
- **Moteur de Playbooks** (`playbook_engine.rs`) : Évaluation de conditions, déclenchement d'actions avec scoring de confiance IA.
- **Actions EDR** (`edr_actions.rs`) : `kill_process`, `quarantine_file`, `block_ip` avec protection anti-tamper (Anti-Draper).
- **Self-Protection** (`self_protection.rs`) : Vérification intégrité binaire SHA-256, détection debugger, monitoring services.
- **Self-Update** (`self_update.rs`) : Mise à jour automatique avec reporting de statut vers la plateforme.
- **Remédiation GUI** (`remediation_ops.rs`) : Exécution d'actions correctives depuis l'interface avec timeout 5 min.
- 9 tests de sécurité EDR (path traversal, symlinks, system path rejection, loopback IP, shell metacharacters).

### 🔧 Modifié
- **Enrollment** : Credentials migrés du document principal vers sous-collection `credentials/main` (enrollment, re-enrollment, cert renewal).
- **Heartbeat** : Ajout du statut `degraded` dans le schema Zod de la plateforme.
- **Severity enum** : Ajout `#[serde(rename_all = "lowercase")]` pour alignement PascalCase→lowercase avec la plateforme.
- **SelfCheckResult** : Ajout des champs agent dans le schema + normalisation dans le heartbeat handler.
- **SecureConfig** : RAII wrapper pour `AgentConfig` avec auto-zeroize on drop, intégré dans `AgentRuntime`.
- **panic="unwind"** dans Cargo.toml (remplace "abort") pour permettre ZeroizeOnDrop.

### 🛡️ Sécurité
- Correction de la capture `hmac_secret` dans `EnrollmentResponse`.
- Documentation mTLS no-op sur Firebase dans `client.rs` et `api.js`.

---

## 📦 [2.0.169] - 2026-03-14

### ✨ Ajouté
- **Heartbeat avancé** (`heartbeat.rs`) : Communication périodique avec métriques, statut et traitement des commandes serveur.
- **Enrollment automatique** (`enrollment.rs`) : Authentification par token JWT avec extraction `organizationId`.
- **Asset Discovery** : Inventaire automatique des endpoints (IP, hostname, MAC, vendor, device_type, criticality).
- **Audit Trail** (`audit_trail.rs`) : Journalisation complète des actions agent.
- **Risk Generation** (`risk_generation.rs`) : Calcul automatique de score de risque.
- **GUI Bridge** (`gui_bridge.rs`) : Pont de communication entre le runtime et l'interface egui.
- **SIEM Enrichment** (`siem_enrichment.rs`) : Enrichissement des données avant export SIEM.
- **Tracing Layer** (`tracing_layer.rs`) : Observabilité structurée avec tracing-appender.
- **Update Manager** (`update_manager.rs`) : Gestion du cycle de mise à jour logicielle.

### 🔧 Modifié
- Migration vers Rust Edition 2024 avec `rust-version = "1.85"`.
- Optimisation des requêtes réseau avec reqwest 0.13 + rustls.
- Amélioration de la persistence GUI (`agent-persistence`).

---

## 📦 [2.0.113] - 2026-02-09

### ✨ Ajouté
- **Core Orchestration** : Workspace Rust modulaire de 12 crates majeures.
- **Premium GUI** : Interface 19 modules (egui) avec monitoring temps réel.
- **Compliance Engine** : 21 contrôles natifs (ISO 27001, NIS2, DORA).
- **Security Suite** : FIM (BLAKE3), Scan CVE, Détection de menaces (processus/réseau).
- **Interopérabilité** : Moteur SIEM pour Splunk, Sentinel et ELK.
- **Scan de vulnérabilités** : Analyse des paquets système contre les bases CVE.
- **Découverte réseau** : Cartographie L2/L3, mDNS, SSDP, ARP.

---

## 📦 [2.0.112] - 2026-02-08

### 🩹 Corrigé
- Optimisation de la capture d'erreurs `notarytool` lors des cycles de signature macOS.

---

## 📦 [2.0.111] - 2026-02-07

### ✨ Ajouté (Version Initiale)
- Redéfinition des raccourcis Windows vers le binaire natif (`.exe`).
- Déploiement automatisé du certificat Root auto-signé via `install-with-cert.bat`.

---

<p align="center">
  <em>Traçabilité et Transparence.</em>
</p>
