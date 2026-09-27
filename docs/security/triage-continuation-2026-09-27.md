# Audit complémentaire : acquittements et résultats IA

## Corrections

- L’acquittement depuis Réseau ne supprime plus l’alerte ni ne décrémente un
  compteur de télémétrie indépendant. La ligne reste consultable et affiche son
  statut ; une alerte déjà acquittée ne propose plus cette action.
- Les acquittements locaux sont inclus dans les préférences sauvegardées par
  l’application. L’identité repose sur le contenu de l’événement et son horodatage,
  sans les champs d’acquittement, d’autorisation ou d’enrichissement IA.
- Les UUID de présentation FIM, recréés par le runtime, ne changent pas cette
  identité. Une nouvelle occurrence horodatée reste à traiter.
- Seules les empreintes sont conservées dans cet historique, limité à 2 000
  entrées ; les commandes et descriptions ne sont pas recopiées dans les préférences.
- Les résultats IA des processus, incidents, alertes réseau et vulnérabilités
  sont rattachés à l’identité demandée, plus à une position de liste mutable.
  Un événement disparu ne transmet pas son résultat à celui qui a pris sa place.
- La demande d’analyse de vulnérabilité recherche également la bonne entrée
  dans le cache du service. La confiance fixe de 85 % et le verdict automatique
  « pas un faux positif » ont été retirés : une réponse textuelle ne les justifie pas.

## Vérifications

Les tests de régression couvrent la sérialisation/restauration des préférences,
le rejeu d’un événement, une nouvelle occurrence, la limite d’historique, les
anciennes préférences, un UUID FIM recréé et le déplacement des cibles IA.

Résultat : **101 tests d’interface réussis**. La compilation du cœur avec
interface et module IA activés passe également.

```sh
cargo test -p agent-gui --lib --offline
cargo check -p agent-core --no-default-features --features gui,llm --offline
```

Cette validation utilise les chemins de restauration et d’événements du code,
avec des données synthétiques. Elle ne correspond pas à un redémarrage de
l’application installée ni à une inférence réelle du modèle.

## Portée de la persistance

Il s’agit du triage **local** sauvegardé avec les préférences eframe, périodiquement
et à la fermeture normale. Une interruption brutale avant sauvegarde peut perdre
les dernières actions. Les entrées au-delà de la limite peuvent être oubliées.
La livraison d’un acquittement au serveur reste distincte ; aucun succès serveur
n’est revendiqué ici. Aucun déploiement ou remplacement de l’application installée
n’a été effectué.
