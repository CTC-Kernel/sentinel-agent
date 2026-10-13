# Signature des mises à jour de l'agent

L'auto-update de l'agent télécharge un paquet depuis le serveur de release et
vérifie son **SHA-256**. Le checksum étant servi par le même serveur que le
paquet, cela garantit l'intégrité en transit mais **pas** l'authenticité : un
serveur de release compromis peut servir un paquet malveillant avec un hash
cohérent.

La signature ed25519 ferme cet écart. Un **manifeste signé**
(`<paquet>.manifest.json` et sa signature `<paquet>.manifest.json.sig`) est
vérifié côté agent contre une **clé publique embarquée dans le binaire au
build**. Sans la clé privée correspondante (conservée hors du serveur de
release, en secret CI), un attaquant ne peut pas produire de signature valide.

Le manifeste lie quatre informations : la **version**, le nom du paquet, son
SHA-256 et sa taille. Signer le paquet seul prouve qui l'a construit, pas de
quelle version il s'agit : un serveur compromis pourrait annoncer une nouvelle
version et servir un ancien paquet, authentiquement signé et vulnérable.
L'agent n'installe donc une mise à jour que si le manifeste :

1. est signé par la clé embarquée ;
2. porte la version annoncée par `release-info.json` (elle-même supérieure à
   la version installée) ;
3. désigne ce paquet pour cette plateforme ;
4. correspond aux octets réellement téléchargés.

La signature couvre un message reconstruit depuis les champs
(`UpdateManifest::signed_message`, crate `agent-common`), pas le texte du
fichier : le JSON peut être réindenté sans invalider la signature.

## Modèle de confiance

- **Clé publique** : embarquée dans le binaire de l'agent au moment du build via
  la variable d'environnement `SENTINEL_UPDATE_PUBKEY` (hex, 32 octets).
- **Clé privée** : PKCS#8 ed25519, stockée en secret CI `SENTINEL_UPDATE_KEY`.
  Ne jamais la committer.
- **Vérification** : `crates/agent-core/src/update_manager.rs`. Si une clé
  publique est embarquée, le paquet **doit** être accompagné d'un manifeste
  signé valide, sinon la mise à jour est refusée. Si aucune clé n'est embarquée (build de dev,
  canal non encore signé), la vérification est ignorée et l'agent retombe sur le
  SHA-256 seul — le comportement est donc **opt-in par build** et ne casse jamais
  un canal non signé.

## Mise en place (une fois)

1. Générer la paire de clés :

   ```bash
   cargo xtask keygen --out sentinel-update-key.hex
   ```

   La clé publique (hex) est affichée sur stdout ; la clé privée PKCS#8 (hex)
   est écrite dans le fichier `--out`.

2. Enregistrer la clé privée comme secret de dépôt GitHub `SENTINEL_UPDATE_KEY`
   (contenu de `sentinel-update-key.hex`), puis **supprimer le fichier local**.

3. Enregistrer la clé publique (hex) comme **variable** de dépôt GitHub
   `SENTINEL_UPDATE_PUBKEY` (Settings → Secrets and variables → Actions →
   Variables) : elle est publique. `release.yml` l'exporte déjà au moment de la
   compilation de chaque binaire.

> La variable et le secret doivent être configurés **ensemble**. Le premier job
> de `release.yml` échoue si l'un est présent sans l'autre : une clé publique
> seule produirait des agents qui refusent toute mise à jour (non signée), une
> clé privée seule signerait des paquets que personne ne vérifie. Tant que les
> deux sont absents, la release passe avec un avertissement et les agents
> vérifient le seul SHA-256.

Une fois `SENTINEL_UPDATE_KEY` présent, l'étape « Sign and upload latest
packages » de `release.yml` signe automatiquement les paquets `latest` et pousse
dans le bucket, pour chacun, le manifeste signé et la signature du paquet
(`<paquet>.sig`). Tant que le secret est absent, l'étape est ignorée.

La signature du paquet seul reste publiée pour les agents sortis **avant** le
manifeste, qui ne connaissent qu'elle. Elle pourra être retirée quand plus
aucun de ces agents n'est en service.

## Signer manuellement

```bash
# via le secret exporté
SENTINEL_UPDATE_KEY="$(cat sentinel-update-key.hex)" cargo xtask sign chemin/vers/paquet.pkg
# ou via un fichier de clé
cargo xtask sign chemin/vers/paquet.pkg --key sentinel-update-key.hex
```

Produit `chemin/vers/paquet.pkg.sig` : la signature ed25519 (64 octets)
encodée en hex, sur les octets bruts du paquet — le format vérifié par les
agents antérieurs au manifeste.

Le manifeste se produit de la même façon, en donnant la version publiée :

```bash
cargo xtask manifest chemin/vers/SentinelAgent-latest.pkg --version 4.0.44 --key sentinel-update-key.hex
```

Produit `SentinelAgent-latest.pkg.manifest.json` et
`SentinelAgent-latest.pkg.manifest.json.sig`. Le fichier doit porter le nom
sous lequel il est publié : ce nom fait partie de ce qui est signé.

## Suivi d'une mise à jour

L'agent passe la main à l'installeur du système puis s'arrête : il ne voit pas
le résultat. Il laisse donc une trace (`update_attempt.json` dans son répertoire
de données) que lit le processus suivant :

- il est dans la version visée : la mise à jour est signalée **terminée** ;
- il est resté dans l'ancienne : elle est signalée **échouée**, et la
  vérification planifiée attend 24 h avant de retenter cette version (une
  demande manuelle n'attend pas, une version plus récente non plus).

Sous Linux, le service packagé tourne sans privilèges et ne peut pas lancer
`dpkg` ou `rpm` : l'agent signale la version disponible et laisse la mise à jour
au gestionnaire de paquets.

## Rotation de clé

La clé publique étant embarquée dans le binaire, une rotation nécessite un
nouveau build de l'agent avec la nouvelle `SENTINEL_UPDATE_PUBKEY`. Séquence
sans coupure : publier d'abord une version signée avec l'ancienne clé qui
embarque la **nouvelle** clé publique, laisser les agents migrer, puis basculer
le secret de signing.
