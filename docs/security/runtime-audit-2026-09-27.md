# Audit de comportement — 27 septembre 2026

## Observations réelles sur macOS

L’application installée fonctionne en mode autonome. Son interface affichait
200 événements, notamment des alertes C2 répétées pour une connexion de Codex
avec un intervalle voisin d’une minute. Les relevés successifs d’une même socket
étaient comptabilisés comme de nouvelles connexions : cela fabriquait un signal
de périodicité. Le correctif suit désormais les sockets entre deux relevés.

Les sondes compilées depuis le code corrigé ont observé 82–83 connexions sur
quatre relevés et 561 processus. Résultat : aucune détection de processus
malveillant, une anomalie réseau de faible confiance (30 %, connexions multiples),
sans qualification d’exfiltration. Cette observation courte ne prouve pas
l’absence de menace et ne remplace pas une validation prolongée.

## Corrections

- Beaconing : suivi des nouvelles sockets, correspondance exacte adresse/port,
  conservation des intervalles irréguliers, domaines autorisés comparés par limites.
- Ports : un port seul ne suffit plus à conclure au minage ou au C2 ; TCP/53 ne
  suffit plus à conclure à un tunnel DNS. Les indicateurs explicites restent détectés.
- Processus : comparaison du nom exécutable, prise en compte des arguments pour
  netcat/socat/procdump/PowerShell, collecte des arguments macOS et remontée des
  erreurs de collecte au lieu d’un faux résultat vide.
- SIEM : un événement rejoué avec le même identifiant ne gonfle plus un compteur
  de corrélation dans sa fenêtre temporelle.
- Interface : les événements USB ordinaires ne sont plus comptés comme menaces ;
  le nombre seul d’événements ne suffit plus à afficher une alerte critique ; les
  événements acquittés/autorisés sont exclus des compteurs à traiter. Une nouvelle
  entrée ferme les détails indexés pour éviter de changer silencieusement de cible.
- Authentification : conservation chiffrée du secret HMAC reçu à l’enrôlement,
  restauration et signature partagée par les deux clients HTTP. Le compteur des
  tentatives de ré-enrôlement est distinct de celui des erreurs de heartbeat.
- Tests de quarantaine : stockage temporaire isolé, sans utilisation du dossier
  de quarantaine de l’utilisateur.

## Authentification : preuve et limites

Des journaux historiques contenaient des erreurs 401 demandant les en-têtes de
signature. Le contrat a été vérifié contre le code du serveur disponible localement,
en lecture seule. Quatre requêtes synthétiques sont vérifiées indépendamment avec
Node.js (`JSON.stringify` et HMAC), dont des nombres et des clés numériques.

Un ancien secret perdu ne peut pas être reconstitué. Aucun ré-enrôlement réel,
changement de credentials, envoi au serveur ou action de remédiation n’a été
effectué pendant cet audit. Le mode connecté reste à valider avec un enrôlement
valide. Les erreurs historiques ne décrivent pas nécessairement l’état actuel.

## Vérifications reproductibles

```sh
cargo test -p agent-network -p agent-scanner -p agent-siem -p agent-sync --lib --offline
cargo test -p agent-network --test detection_regressions --offline
cargo test -p agent-core --no-default-features --features gui --lib --offline
cargo test -p agent-gui --lib --offline
cargo run -p agent-gui --example scroll_probe --offline
cargo run -p agent-sync --example auth_contract_probe --offline > /tmp/sentinel-auth-contract.jsonl
node scripts/verify_auth_contract.mjs /tmp/sentinel-auth-contract.jsonl
cargo run -p agent-network --example live_audit --offline
cargo run -p agent-scanner --example live_process_audit --offline
```

Les sondes système exigent l’accès en lecture aux processus et sockets macOS.
Les 834 tests passent : réseau (76), scanner (319), SIEM (35), synchronisation
(185), régressions réseau (3), cœur (120), interface (96). Les 42 contrôles de la
sonde de défilement et les quatre cas du contrat de signature passent également.

L’application installée n’a pas été remplacée ; ses anciens événements n’ont pas
été supprimés. Les corrections sont dans les sources. Windows, Linux, les actions
destructrices et le fonctionnement connecté de bout en bout ne sont pas validés
par cet audit. D’autres changements étant présents dans le dépôt partagé, ce
document décrit uniquement les corrections et observations de cette intervention.
