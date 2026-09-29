# Assistant IA : latence et stabilité

29 septembre 2026. Retour terrain : « l'IA est très longue à répondre par message ».

## Causes mesurées

Banc `crates/agent_llm/examples/llm_bench.rs`, modèle Qwen2.5-0.5B-Instruct Q4_K_M, VM Linux 4 cœurs, CPU seul. Les valeurs absolues d'un modèle 7B sont plus élevées ; les rapports restent comparables.

| Scénario | Avant | Après |
|---|---:|---:|
| 1er mot, question avec contexte Sentinel (~2 000 car.), cache froid | 102,5 s | 70,7 s (AVX2) |
| 1er mot, question suivante, même contexte | — (préfixe invalidé) | **1,1 à 2,0 s** |
| 1er mot, 1re question après pré-calcul du contexte à l'ouverture | 70 à 100 s | **2,0 s** |
| 1er mot d'une question pendant une analyse d'arrière-plan | attente de la fin de l'analyse | **3,2 s** (analyse suspendue puis reprise) |
| Arrêt d'une réponse | impossible | 2,5 s, moteur réutilisable aussitôt |
| Affichage | réponse complète en fin de génération | mot à mot, tous les ~50 ms |

1. **Aucun streaming** : l'opérateur attendait la réponse entière (souvent 60 à 120 s sur CPU pour 640 tokens).
2. **Prompt défavorable au cache** : la question était placée avant le contexte et le prompt système contenait le domaine (déduit de chaque question). Le cache de préfixe de mistral.rs ne servait jamais : tout le contexte était recalculé à chaque message.
3. **Concurrence avec l'arrière-plan** : après chaque scan, toutes les vulnérabilités hautes/critiques étaient analysées une à une (512 tokens chacune), en concurrence directe avec les questions.
4. **Premier chargement au premier message**, et chargements concurrents possibles (mémoire doublée).
5. **Délai global de 90 s** suivi d'un déchargement/rechargement complet et d'un nouvel essai : jusqu'à plusieurs minutes avant une erreur.

## Corrections

- Streaming de bout en bout (`ModelEngine::infer_stream`, événement `LlmChatDelta`), lecture vocale phrase par phrase pendant la génération (`VoiceService::speak_stream`).
- Annulation (`GuiCommand::LlmCancel`, bouton « Arrêter la réponse ») : l'abandon du flux annule proprement la séquence mistral.rs, sans rechargement.
- Prompt système fixe ; contexte stable d'abord, valeurs volatiles (ressources, conversation) puis question et domaine en fin de message. Contexte allégé (6 contrôles, 6 vulnérabilités, 4 processus/incidents/alertes réseau, 3 alertes FIM, extraits de conversation de 400 caractères).
- Priorités : requêtes `Interactive` / `Background`. Une requête d'arrière-plan attend qu'aucune question ne soit en cours et est suspendue puis relancée si une question arrive. Analyse automatique limitée à 5 vulnérabilités par scan (critiques d'abord), 200 tokens.
- Préchargement à l'ouverture de l'assistant (`LlmWarmUp`) : chargement unique du modèle (verrou), puis pré-calcul du contexte en arrière-plan pendant la saisie.
- Délais : 240 s minimum pour le premier mot (visible et interruptible), puis 60 s sans progression. Plus de rechargement ni de nouvel essai.
- Réponses écrites concises par défaut (200 mots au plus, sauf rapport demandé).
- Mac Apple Silicon : calcul sur GPU (Metal) avec repli CPU automatique. Non mesurable dans cet environnement Linux ; la compilation est vérifiée par la CI macOS.

## Décision ouverte : AVX2 sur Windows/Linux x86_64

Les noyaux quantifiés de candle ne sont vectorisés AVX2 que si le binaire est compilé avec cette extension. Mesuré ici : +35 % en génération, −31 % sur le temps de premier mot. Activer `-C target-cpu=x86-64-v3` rendrait l'agent inutilisable (arrêt immédiat, instruction illégale) sur les processeurs sans AVX2 (Celeron/Pentium/Atom anciens, CPU antérieurs à 2013). Non activé : à décider selon le parc cible, ou via un binaire séparé.

## Reproduire

```sh
LLM_BENCH_MODEL=/chemin/modele.gguf cargo run --release -p agent_llm --example llm_bench
cargo test -p agent_llm --lib
cargo test -p agent-core --lib --features gui
cargo test -p agent-gui --lib --all-features
```
