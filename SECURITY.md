# Politique de securite

## Versions supportees

| Version | Supportee          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |

## Signaler une vulnerabilite

Si vous decouvrez une vulnerabilite de securite dans Sentinel GRC Agent, veuillez la signaler de maniere responsable :

1. **NE creez PAS** de ticket GitHub public
2. Envoyez un email a : ***REMOVED***
3. Incluez une description detaillee et les etapes de reproduction
4. Accordez un delai de 90 jours pour la remediation avant toute divulgation publique

## Analyse de securite

### Verifications automatisees

Ce projet utilise les outils de securite automatises suivants :

#### cargo-audit

Analyse les dependances par rapport a la [base de donnees d'avis RustSec](https://rustsec.org/).

```bash
# Installation
cargo install cargo-audit

# Execution locale
cargo audit
```

**Integration CI** : Execute a chaque PR via `rustsec/audit-check@v2`

#### cargo-deny

Verificateur complet de dependances pour :
- **Avis de securite** : Vulnerabilites de securite de RustSec
- **Licences** : S'assure que seules les licences approuvees sont utilisees
- **Interdictions** : Bloque les crates problematiques connues
- **Sources** : Valide les sources des registres de crates

```bash
# Installation
cargo install cargo-deny

# Executer toutes les verifications
cargo deny check

# Executer des verifications specifiques
cargo deny check advisories
cargo deny check licenses
cargo deny check bans
cargo deny check sources
```

**Integration CI** : Execute a chaque PR via `EmbarkStudios/cargo-deny-action@v2`

### Licences autorisees

Les licences suivantes sont approuvees pour les dependances :

- MIT
- Apache-2.0
- Apache-2.0 WITH LLVM-exception
- MPL-2.0
- BSD-2-Clause, BSD-3-Clause
- ISC
- Zlib, 0BSD
- Unicode-DFS-2016, Unicode-3.0
- CC0-1.0, BSL-1.0
- OpenSSL (pour les bibliotheques de cryptographie)
- CDLA-Permissive-2.0 (pour les donnees de certificats)

## Ajouter de nouvelles dependances

Avant d'ajouter une nouvelle dependance :

1. **Verifier la licence** : S'assurer qu'elle figure dans la liste approuvee ci-dessus
2. **Verifier les vulnerabilites** : Executer `cargo audit` apres l'ajout
3. **Verifier la source** : Seul crates.io est autorise
4. **Examiner la crate** : Verifier l'etat de maintenance et l'historique de securite

```bash
# Apres l'ajout d'une dependance
cargo deny check
cargo audit
```

### Ajouter des exceptions de licence

Si une nouvelle dependance necessite une licence non presente dans la liste approuvee :

1. Evaluer la compatibilite de la licence
2. L'ajouter a `deny.toml` sous `[licenses].allow`
3. Documenter la raison dans la PR
4. Obtenir l'approbation de l'equipe securite

## Crates interdites

Certaines crates sont explicitement interdites pour des raisons de securite ou d'architecture :

| Crate | Raison |
|-------|--------|
| (aucune actuellement) | - |

Pour ajouter une interdiction, mettre a jour `deny.toml` :

```toml
[bans]
deny = [
    { crate = "nom-de-la-crate", reason = "Description du probleme de securite" },
]
```

## Reponse aux vulnerabilites

### Lorsqu'une vulnerabilite est decouverte

1. **Triage** : Evaluer la severite en utilisant CVSS
2. **Attenuation** : Appliquer une solution de contournement temporaire si necessaire
3. **Mise a jour** : Mettre a niveau vers la version corrigee quand elle est disponible
4. **Verification** : Executer la suite complete d'analyse de securite
5. **Publication** : Deployer le correctif avec un avis de securite

### Ignorer des avis de securite

Dans les rares cas ou aucun correctif n'est disponible :

1. Documenter l'identifiant de l'avis et la raison dans `deny.toml`
2. Creer un ticket de suivi
3. Definir une date limite de revision

```toml
[advisories]
ignore = [
    "RUSTSEC-XXXX-XXXX", # Raison + lien vers le ticket de suivi
]
```

## Securite CI/CD

### Securite du pipeline

- Toutes les verifications de securite s'executent a chaque PR
- Les PR ne peuvent pas etre fusionnees si les verifications de securite echouent
- Les dependances sont mises en cache mais verifiees
- Les artefacts de build sont signes (prevu)

### Portes de qualite

| Verification | Action en cas d'echec |
|--------------|----------------------|
| cargo-audit | Blocage de la fusion |
| cargo-deny advisories | Blocage de la fusion |
| cargo-deny licenses | Blocage de la fusion |
| cargo-deny bans | Blocage de la fusion |
| cargo-deny sources | Blocage de la fusion |

## Bonnes pratiques

### Securite du code

- Utiliser `#[forbid(unsafe_code)]` dans la mesure du possible
- Preferer les abstractions sures a la manipulation directe de pointeurs
- Utiliser des comparaisons a temps constant pour les secrets
- Ne jamais journaliser de donnees sensibles

### Securite des dependances

- Verrouiller les versions exactes dans Cargo.lock
- Examiner les changelogs avant de mettre a jour
- Preferer les crates bien maintenues avec des politiques de securite
- Minimiser le nombre de dependances transitives

### Scanner de securite de l'agent

L'agent inclut des capacites d'analyse de securite integrées :

- **Scan de vulnerabilites** : Detection periodique des vulnerabilites CVE sur les paquets installes
- **Surveillance des processus** : Detection des processus suspects et des evenements lies a la securite
- **Surveillance de l'integrite des fichiers (FIM)** : Alertes sur les modifications non autorisees des fichiers systeme critiques

### Securite a l'execution

- Executer avec les privileges minimaux
- Valider toutes les entrees externes
- Utiliser des valeurs par defaut securisees (TLS, chiffrement)
- Implementer une gestion d'erreur appropriee (pas de panic en production)
