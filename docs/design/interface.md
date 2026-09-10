# Sentinel — centre de contrôle

La page d’accueil rassemble l’état de sécurité, les indicateurs du poste,
les tendances et l’assistant. La navigation et la barre supérieure utilisent
le système visuel partagé avec les autres écrans.

Le bandeau d’organisation présente la connexion et la dernière synchronisation
sur deux lignes adaptatives. Les actions d’analyse et de synchronisation restent
dans la barre dédiée. L’identifiant du poste peut être copié directement.
La carte de sécurité ouvre les menaces, les vulnérabilités ou la conformité
selon les constats ; son pourcentage est explicitement libellé « Conformité ».

## Intégration avec le système visuel

La refonte utilise les polices Inter et JetBrains Mono, les surfaces, les cartes,
la navigation adaptative et les composants partagés présents sur `origin/main`.
Elle conserve la recherche dans les données, les tiroirs et les autres écrans
enrichis par les changements distants. Les correctifs de dépendances du dépôt
distant sont également conservés.

Les champs proposent un effacement rapide et signalent les filtres actifs par
une coche.
Les filtres passent à la ligne lorsque la largeur diminue et l’effacement
rend le focus à la recherche. Leur sélection est exposée aux outils d’accessibilité.
Le champ actif affiche un contour de focus ; Échap efface une recherche remplie
sans quitter le champ. La pagination compacte donne le numéro de page et le
nombre total, avec des commandes indisponibles exclues du parcours clavier.
Les notifications suspendent leur expiration pendant le survol ou lorsque
leur bouton de fermeture possède le focus.
La palette recherche sans accents, actualise immédiatement ses résultats
et suit la sélection au clavier. Les boutons partagés exposent leurs
libellés aux outils d’accessibilité. Les actions indisponibles ne reçoivent ni
clic ni focus clavier.

## États et données

Les boutons principaux utilisent un bleu saphir dont le texte atteint 7:1
de contraste au repos, au survol et à l’appui. Les boutons secondaires et les
lignes de tableau animent uniquement leurs transitions de survol, en respectant
la réduction des mouvements. Le tri actif dispose d’un fond distinct ; la sélection
de ligne reste signalée par une barre latérale. Les colonnes automatiques occupent
la largeur disponible et se contractent sans dépasser le tableau.

Les captures `previews/components-dark.png` et `previews/components-light.png`
proviennent des composants réels, rendus avec `visual_review --components`.

Un score absent n’est pas présenté comme une protection confirmée. Les ratios
de remédiation ne sont pas affichés à 100 % lorsque la liste est vide. Les courbes
utilisent les historiques reçus ; les valeurs inconnues apparaissent avec un tiret.
Les nombres et pourcentages de ressources utilisent le format français partagé.

## Vérification

```sh
cargo test -p agent-gui --lib --locked
cargo check -p agent-gui --examples --locked
cargo run -p agent-gui --example visual_review -- /tmp/sentinel-dark.png
cargo run -p agent-gui --example visual_review -- /tmp/sentinel-light.png --light
cargo run -p agent-gui --example visual_review -- /tmp/sentinel-compact.png --compact --empty
```

La suite intégrée vérifie notamment les contrats de contraste du système
visuel, l’activation clavier et les seuils de l’état de sécurité, y compris
l’absence de score. Ces tests ne constituent pas une
certification d’accessibilité de tous les parcours.

`visual_review` rend la véritable application avec des événements synthétiques
identifiés « DÉMONSTRATION », sans runtime de sécurité ni enregistrement des
préférences. Il applique les dimensions après la transition de démarrage.
Les captures conservées sont dans `previews/`.
