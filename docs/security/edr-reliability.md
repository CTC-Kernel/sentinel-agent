# Exigence de maturité EDR

Date : 27 septembre 2026. Objectif produit : des fonctions de détection et de réponse pertinentes, puissantes et fiables, évaluées face à Wazuh, CrowdStrike Falcon et Microsoft Defender for Endpoint. Aucune parité n'est démontrée à ce jour. Ces produits servent de références fonctionnelles ; leurs périmètres et architectures diffèrent.

## Références officielles

- [Wazuh Active Response](https://documentation.wazuh.com/current/user-manual/capabilities/active-response/index.html) : réponses déclenchées par des règles, réponses temporaires et retour à l'état initial.
- [Microsoft Defender EDR](https://learn.microsoft.com/en-us/defender-endpoint/overview-endpoint-detection-response) : télémétrie comportementale, investigation et regroupement des alertes en incidents.
- [Falcon Insight XDR](https://www.crowdstrike.com/content/dam/crowdstrike/www/en-us/wp/2022/10/crowdstrike-falcon-insight-xdr-data-sheet.pdf) : visibilité endpoint, détection, investigation et réponse. Fiche historique de 2022, pas une vérification de toutes les capacités actuelles.

## Corrections de cette livraison

Dans `crates/agent-core/src/threat_pipeline.rs` :

- Rejet des conditions vides, des ports non numériques et des seuils de sévérité inconnus ; suppression du repli d'un port invalide vers une recherche textuelle.
- Lecture des arguments réellement fournis par `cmdline` ou `command_line`. Le chemin de l'exécutable n'est plus présenté comme une ligne de commande.
- Conservation des incidents avec preuves de processus valides, notamment malware, vol d'identifiants et élévation de privilèges.
- Conversion contrôlée des PID ; rejet des identités absentes, vides, réservées ou hors plage, sans troncature numérique.
- Classification IA consultative : le verdict déterministe et son score sont conservés. L'annotation expose séparément la confiance du modèle ; une classification faible ne supprime plus l'alerte avant notification/synchronisation.

Les tests de régression utilisent des preuves synthétiques et n'exécutent aucune action de réponse sur le poste.

## Écarts prioritaires constatés dans le code

| Priorité | Constat | Critère de sortie |
| --- | --- | --- |
| P0 | Corrigé dans la suite de fiabilité : pipeline disponible sans `gui`, DTO partagés sans rendu. Recette OS encore requise. | Les mêmes événements et règles produisent les mêmes verdicts en service sans GUI et en mode desktop. |
| P0 | `evaluate_playbook` déduit des actions destructrices des conditions, sans résoudre les actions configurées du playbook. | Un playbook de notification ne peut jamais tuer, bloquer ou mettre en quarantaine ; chaque action est explicitement autorisée par sa configuration et liée à la preuve correspondante. |
| P0 | La confiance IA intervient encore dans l'évaluation des playbooks. | L'IA ne peut seule autoriser une réponse destructive ; décisions déterministes, politique explicite et audit pour chaque exécution. |
| P1 | Le pipeline quitte avant l'évaluation des playbooks si aucune règle personnalisée ne correspond. | Sémantique de déclenchement explicite et testée pour les playbooks autonomes ; éviter de libérer cette voie avant correction des actions implicites. |
| P1 | Les règles personnalisées lisent des processus déjà signalés, pas toute la télémétrie ; les correspondances utilisent `find`. | Mesurer les événements manqués, traiter les entités distinctes, définir déduplication et limites sans perte silencieuse. |
| P1 | Les règles personnalisées ont une sémantique implicite « une condition suffit ». | Opérateurs explicites, corrélation sur une même entité, fenêtres temporelles, tests positifs et négatifs versionnés. |
| P1 | Le score déterministe des règles personnalisées reste fixe à 0,7. | Mesure de précision par règle et corpus documenté ; ne pas présenter ce score comme une probabilité calibrée. |

## Validation nécessaire avant toute affirmation d'équivalence

1. Matrice Windows/Linux/macOS : sources de télémétrie, privilèges, événements perdus, capacités réellement disponibles et état dégradé visible.
2. Corpus bénin et simulations ATT&CK en laboratoire isolé : résultats attendus par technique, faux positifs, faux négatifs et latence de détection. Pas de pourcentage de couverture sans corpus et dénominateur publiés.
3. Réponse : liaison PID/heure de création contre la réutilisation de PID, quarantaine et restauration intègres, isolation réseau avec canal de gestion préservé, expiration des blocages après redémarrage, journal d'audit.
4. Résilience : disque plein, arrêt brutal, panne réseau, saturation de la file et reprise ; mesurer les pertes et doublons, tester les mises à jour interrompues et l'intégrité des règles.
5. Charge : CPU/RAM/E/S et latences p50/p95/p99 sur profils de postes représentatifs, puis pilote prolongé. Fixer les budgets d'acceptation avant mesure.
6. Investigation : chronologie persistante, arbre des processus, preuves structurées, liens réseau/fichiers, export SIEM et rétention contrôlée.

Les correctifs locaux constituent une première étape de fiabilisation. Ils ne remplacent ni les capteurs système, ni la validation multi-OS, ni un benchmark comparatif indépendant.
