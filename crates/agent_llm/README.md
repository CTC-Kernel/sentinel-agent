# agent_llm

Inference LLM locale pour l'analyse intelligente de securite.

## Presentation

Cette crate fournit un moteur d'inference IA local pour l'analyse de securite, sans aucune fuite de donnees vers le cloud :

- **Inference locale** : Execution de modeles de langage directement sur l'endpoint via MistralRS
- **Analyse de securite** : Classification automatique des evenements et scoring de risque
- **Remediation assistee** : Recommandations d'actions correctives contextualisees
- **Prompt engineering** : Templates et constructeurs de prompts optimises pour la securite
- **Acceleration materielle** : Apple Silicon (Metal), NVIDIA (CUDA)

## Architecture

```
LLMManager (coordinateur)
  |-- ModelEngine     : Abstraction moteur (MistralEngine via MistralRS)
  |-- LLMAnalyzer     : Analyse des resultats de scan et evaluation de risque
  |-- SecurityClassifier : Classification des evenements de securite
  |-- RemediationAdvisor : Recommandations d'actions correctives
  `-- PromptTemplates : Ingenierie de prompts securite
```

## Modules

| Module | Description |
|--------|-------------|
| `engine` | Trait `ModelEngine` et implementation `MistralEngine` |
| `config` | Configuration LLM, modele, inference, cache, securite |
| `models` | Registre des modeles disponibles (`ModelInfo`, `ModelRegistry`) |
| `analyzer` | Analyse de securite structuree avec scoring de risque |
| `security` | Classification des evenements (ThreatLevel, ThreatType) |
| `remediation` | Plans de remediation avec actions priorisees |
| `prompts` | Templates et constructeur de prompts securite |

## Modeles supportes

| Modele | Type | Acceleration |
|--------|------|-------------|
| Mistral 7B Instruct | Instruction-tuned | CPU, CUDA, Metal |
| Llama (variantes) | General purpose | CPU, CUDA, Metal |

Les modeles sont caches localement dans `crates/agent_llm/cache/llm/`.

## Capacites

### Analyse de securite

```rust
use agent_llm::{LLMManager, AnalysisContext};

let manager = LLMManager::new(config).await?;

let context = AnalysisContext {
    system_info: sys_info,
    scan_results: results,
    compliance_framework: "NIS2",
    // ...
};

let analysis = manager.analyze(context).await?;
// -> AnalysisResult { risk_assessment, priority_issues, compliance_impact, recommendations }
```

### Classification des menaces

```rust
use agent_llm::SecurityClassifier;

let classifier = SecurityClassifier::new(&engine);
let classification = classifier.classify(event).await?;
// -> SecurityClassification { threat_level, threat_type, confidence }
```

### Recommandations de remediation

```rust
use agent_llm::RemediationAdvisor;

let advisor = RemediationAdvisor::new(&engine);
let plan = advisor.recommend(context).await?;
// -> RemediationPlan { actions: [RemediationAction { action_type, priority, description }] }
```

### Types d'actions

- `Manual` : Action necessitant une intervention humaine
- `Automated` : Action executable automatiquement par l'agent
- `Investigation` : Investigation complementaire requise
- `Escalation` : Escalade vers un analyste securite

## Etats du modele

| Statut | Description |
|--------|-------------|
| `Unloaded` | Modele non charge en memoire |
| `Loading` | Chargement en cours |
| `Ready` | Pret pour l'inference |
| `Busy` | Inference en cours |
| `Error` | Erreur de chargement ou d'inference |

## Statistiques

```rust
let stats = manager.get_stats();
// -> ModelStats { model_name, status, inference_count, memory_usage }
```

## Souverainete

- **Zero fuite de donnees** : Aucune donnee de securite ne quitte l'infrastructure
- **Modeles open-source** : Mistral et Llama audites et valides
- **Inference locale** : Pas de dependance aux APIs cloud (OpenAI, Anthropic, etc.)
- **Chiffrement** : Les modeles caches sont proteges par les permissions du systeme de fichiers
