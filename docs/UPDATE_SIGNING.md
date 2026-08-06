# Signature des mises à jour de l'agent

L'auto-update de l'agent télécharge un paquet depuis le serveur de release et
vérifie son **SHA-256**. Le checksum étant servi par le même serveur que le
paquet, cela garantit l'intégrité en transit mais **pas** l'authenticité : un
serveur de release compromis peut servir un paquet malveillant avec un hash
cohérent.

La signature ed25519 ferme cet écart. Une signature détachée (`<paquet>.sig`)
est vérifiée côté agent contre une **clé publique embarquée dans le binaire au
build**. Sans la clé privée correspondante (conservée hors du serveur de
release, en secret CI), un attaquant ne peut pas produire de signature valide.

## Modèle de confiance

- **Clé publique** : embarquée dans le binaire de l'agent au moment du build via
  la variable d'environnement `SENTINEL_UPDATE_PUBKEY` (hex, 32 octets).
- **Clé privée** : PKCS#8 ed25519, stockée en secret CI `SENTINEL_UPDATE_KEY`.
  Ne jamais la committer.
- **Vérification** : `crates/agent-core/src/update_manager.rs`. Si une clé
  publique est embarquée, le paquet **doit** porter une `<paquet>.sig` valide,
  sinon la mise à jour est refusée. Si aucune clé n'est embarquée (build de dev,
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

3. Embarquer la clé publique dans les builds de release en exportant
   `SENTINEL_UPDATE_PUBKEY=<clé publique hex>` au moment de la compilation (dans
   les jobs de build de `release.yml`, aux côtés des autres variables
   `SENTINEL_*`).

Une fois `SENTINEL_UPDATE_KEY` présent, l'étape « Sign and upload latest
packages » de `release.yml` signe automatiquement les paquets `latest` et pousse
les `.sig` dans le bucket. Tant que le secret est absent, l'étape est ignorée.

## Signer manuellement

```bash
# via le secret exporté
SENTINEL_UPDATE_KEY="$(cat sentinel-update-key.hex)" cargo xtask sign chemin/vers/paquet.pkg
# ou via un fichier de clé
cargo xtask sign chemin/vers/paquet.pkg --key sentinel-update-key.hex
```

Produit `chemin/vers/paquet.pkg.sig` : la signature ed25519 (64 octets)
encodée en hex, sur les octets bruts du paquet — exactement le format que
l'agent vérifie.

## Rotation de clé

La clé publique étant embarquée dans le binaire, une rotation nécessite un
nouveau build de l'agent avec la nouvelle `SENTINEL_UPDATE_PUBKEY`. Séquence
sans coupure : publier d'abord une version signée avec l'ancienne clé qui
embarque la **nouvelle** clé publique, laisser les agents migrer, puis basculer
le secret de signing.
