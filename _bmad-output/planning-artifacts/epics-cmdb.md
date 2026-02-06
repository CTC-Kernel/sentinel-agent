# Epics & Stories : Module CMDB - Sentinel GRC v2

---

**Document Version:** 1.0
**Date:** 2026-02-06
**Référence PRD:** `prd-cmdb.md`
**Référence ADR:** `adr-009-cmdb-architecture.md`

---

## Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CMDB MODULE EPICS                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 1 (8 semaines)                                                    │
│  ├── EPIC-CMDB-001: Modèle de Données CI              [P0] [Sprint 1-2] │
│  ├── EPIC-CMDB-002: Moteur de Réconciliation (IRE)    [P0] [Sprint 3-4] │
│  └── EPIC-CMDB-003: Discovery Dashboard               [P0] [Sprint 5-6] │
│                                                                          │
│  PHASE 2 (6 semaines)                                                    │
│  ├── EPIC-CMDB-004: Relations CMDB                    [P0] [Sprint 9-10]│
│  ├── EPIC-CMDB-005: Graphe de Dépendances             [P1] [Sprint 11]  │
│  └── EPIC-CMDB-006: Analyse d'Impact                  [P0] [Sprint 12]  │
│                                                                          │
│  PHASE 3 (6 semaines)                                                    │
│  ├── EPIC-CMDB-007: Enrichissement Agent              [P1] [Sprint 15-16│
│  ├── EPIC-CMDB-008: Gestion des Licences              [P2] [Sprint 17]  │
│  └── EPIC-CMDB-009: API CMDB                          [P1] [Sprint 19-20│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## PHASE 1 : Fondations

---

### EPIC-CMDB-001: Modèle de Données CI

**Objectif:** Implémenter le modèle de données Configuration Item et migrer les Assets existants.

**Valeur Business:** Fondation pour toutes les fonctionnalités CMDB, conformité ITIL 4.

**Sprint:** 1-2 | **Story Points Total:** 34

---

#### Story CMDB-001-01: Définition Types TypeScript CI

**En tant que** développeur
**Je veux** avoir des types TypeScript stricts pour les CIs
**Afin de** garantir la cohérence des données dans toute l'application

**Critères d'Acceptation:**
- [ ] Type `ConfigurationItem` avec tous les attributs définis dans ADR-009
- [ ] Type `CIFingerprint` pour l'identification
- [ ] Types `CIClass`, `CIStatus`, `CIEnvironment`, `CICriticality`
- [ ] Types spécifiques par classe : `HardwareCIAttributes`, `SoftwareCIAttributes`, `ServiceCIAttributes`
- [ ] Schémas Zod correspondants avec validation
- [ ] Export depuis `src/types/cmdb.ts`

**Story Points:** 3
**Priorité:** P0

**Tâches Techniques:**
```
[ ] Créer src/types/cmdb.ts avec tous les types
[ ] Créer src/schemas/cmdbSchema.ts avec validation Zod
[ ] Ajouter tests unitaires pour les schémas
[ ] Documenter les types avec JSDoc
```

---

#### Story CMDB-001-02: Collection Firestore cmdb_cis

**En tant que** développeur
**Je veux** une collection Firestore optimisée pour les CIs
**Afin de** stocker et requêter efficacement les Configuration Items

**Critères d'Acceptation:**
- [ ] Collection `cmdb_cis` créée avec structure définie
- [ ] Index composites pour :
  - `organizationId` + `ciClass` + `status`
  - `organizationId` + `fingerprint.serialNumber`
  - `organizationId` + `fingerprint.primaryMacAddress`
  - `organizationId` + `fingerprint.hostname`
- [ ] Security rules avec isolation `organizationId`
- [ ] Seed data pour tests

**Story Points:** 3
**Priorité:** P0

**Tâches Techniques:**
```
[ ] Créer indexes dans firestore.indexes.json
[ ] Mettre à jour firestore.rules pour cmdb_cis
[ ] Créer script de seed pour environnement de test
[ ] Documenter la structure dans README
```

---

#### Story CMDB-001-03: Service CRUD CI

**En tant que** développeur
**Je veux** un service complet pour les opérations CRUD sur les CIs
**Afin de** manipuler les Configuration Items de manière cohérente

**Critères d'Acceptation:**
- [ ] `CMDBService.createCI(orgId, ci)` avec validation Zod
- [ ] `CMDBService.getCI(orgId, ciId)` avec gestion d'erreur
- [ ] `CMDBService.updateCI(orgId, ciId, updates)` avec audit trail
- [ ] `CMDBService.deleteCI(orgId, ciId)` (soft delete → status: Retired)
- [ ] `CMDBService.listCIs(orgId, filters, pagination)` avec support filtering
- [ ] `CMDBService.searchCIs(orgId, query)` recherche full-text
- [ ] Toutes les opérations loggées dans audit log

**Story Points:** 5
**Priorité:** P0

**Tâches Techniques:**
```
[ ] Créer src/services/CMDBService.ts
[ ] Implémenter toutes les méthodes CRUD
[ ] Ajouter logging avec logAction()
[ ] Créer tests unitaires (mock Firestore)
[ ] Créer tests d'intégration
```

---

#### Story CMDB-001-04: Hook useCMDBCIs

**En tant que** développeur frontend
**Je veux** un hook React pour interagir avec les CIs
**Afin de** gérer l'état et les opérations CI dans les composants

**Critères d'Acceptation:**
- [ ] Hook `useCMDBCIs(filters)` avec React Query
- [ ] Support pagination (infinite scroll)
- [ ] Mutations pour create/update/delete avec optimistic updates
- [ ] Gestion d'erreur avec toast notifications
- [ ] Invalidation de cache appropriée

**Story Points:** 5
**Priorité:** P0

**Tâches Techniques:**
```
[ ] Créer src/hooks/cmdb/useCMDBCIs.ts
[ ] Configurer React Query avec cache strategy
[ ] Implémenter mutations avec optimistic updates
[ ] Ajouter error handling avec ErrorLogger
[ ] Tests avec @testing-library/react-hooks
```

---

#### Story CMDB-001-05: Migration Assets vers CIs

**En tant qu'** administrateur
**Je veux** que les Assets existants soient migrés vers des CIs
**Afin de** ne pas perdre les données d'inventaire existantes

**Critères d'Acceptation:**
- [ ] Script de migration Node.js/TypeScript
- [ ] Mapping complet Asset → CI (voir ADR-009 AD-006)
- [ ] Conservation du lien `legacyAssetId`
- [ ] Mise à jour de l'Asset original avec `migratedToCIId`
- [ ] Rapport de migration (succès, erreurs, warnings)
- [ ] Mode dry-run pour test avant exécution
- [ ] Rollback possible (script inverse)

**Story Points:** 8
**Priorité:** P0

**Tâches Techniques:**
```
[ ] Créer scripts/migrate-assets-to-cis.ts
[ ] Implémenter mapping functions
[ ] Ajouter mode dry-run
[ ] Créer script de rollback
[ ] Test sur copie de production
[ ] Documentation migration
```

---

#### Story CMDB-001-06: Zustand Store CMDB

**En tant que** développeur frontend
**Je veux** un store Zustand pour l'état CMDB
**Afin de** partager l'état entre composants sans prop drilling

**Critères d'Acceptation:**
- [ ] Store `cmdbStore` avec état défini dans ADR-009 AD-008
- [ ] Selectors fine-grained pour éviter over-subscription
- [ ] Actions pour toutes les mutations d'état
- [ ] Persistence optionnelle des filtres

**Story Points:** 3
**Priorité:** P0

**Tâches Techniques:**
```
[ ] Créer src/stores/cmdbStore.ts
[ ] Implémenter tous les selectors
[ ] Ajouter tests unitaires
[ ] Intégrer avec hooks existants
```

---

#### Story CMDB-001-07: Data Quality Score Calculator

**En tant qu'** administrateur
**Je veux** que chaque CI ait un score de qualité des données
**Afin de** identifier les CIs nécessitant enrichissement

**Critères d'Acceptation:**
- [ ] Calcul DQS (0-100) basé sur :
  - Complétude des champs obligatoires (40%)
  - Freshness (lastDiscoveredAt < 7j) (30%)
  - Relations mappées (20%)
  - Validation status (10%)
- [ ] Recalcul automatique à chaque update
- [ ] Affichage visuel (badge couleur)

**Story Points:** 5
**Priorité:** P1

**Tâches Techniques:**
```
[ ] Créer calculateDataQualityScore() dans CMDBService
[ ] Ajouter trigger Cloud Function pour recalcul
[ ] Créer composant DQSBadge
[ ] Tests unitaires pour le calcul
```

---

### EPIC-CMDB-002: Moteur de Réconciliation (IRE)

**Objectif:** Implémenter le moteur d'identification et réconciliation automatique.

**Valeur Business:** Réduction de 80% du temps de création d'inventaire.

**Sprint:** 3-4 | **Story Points Total:** 34

---

#### Story CMDB-002-01: Fingerprint Generator

**En tant que** système
**Je veux** générer un fingerprint normalisé pour chaque donnée agent
**Afin de** pouvoir matcher avec les CIs existants

**Critères d'Acceptation:**
- [ ] Fonction `generateFingerprint(agentData): CIFingerprint`
- [ ] Normalisation MAC (lowercase, format xx:xx:xx:xx:xx:xx)
- [ ] Normalisation hostname (lowercase, trim domain)
- [ ] Génération OS fingerprint (type-version-arch)
- [ ] Gestion des valeurs manquantes
- [ ] Tests unitaires exhaustifs

**Story Points:** 3
**Priorité:** P0

**Tâches Techniques:**
```
[ ] Créer functions/src/cmdb/fingerprint.ts
[ ] Implémenter normalization functions
[ ] Ajouter tests pour tous les edge cases
[ ] Documenter le format de fingerprint
```

---

#### Story CMDB-002-02: Règles d'Identification Configurables

**En tant qu'** administrateur
**Je veux** configurer les règles de matching par organisation
**Afin de** adapter la réconciliation à mon contexte

**Critères d'Acceptation:**
- [ ] Collection `cmdb_identification_rules` par organisation
- [ ] Structure : priority, name, matchCriteria[], ciClass, enabled
- [ ] Règles par défaut créées à l'onboarding
- [ ] UI de configuration (Phase 2 acceptable)
- [ ] API pour CRUD des règles

**Story Points:** 5
**Priorité:** P0

**Tâches Techniques:**
```
[ ] Créer collection et types pour rules
[ ] Implémenter service CMDBReconciliationService
[ ] Créer règles par défaut (voir ADR-009)
[ ] Tests unitaires
```

---

#### Story CMDB-002-03: Matcher Engine

**En tant que** système
**Je veux** matcher un fingerprint contre les CIs existants
**Afin d'** identifier si le device est déjà connu

**Critères d'Acceptation:**
- [ ] Fonction `matchCI(orgId, fingerprint, rules): MatchResult`
- [ ] Évaluation des règles par priorité
- [ ] Calcul du score de confiance (0-100)
- [ ] Support multi-match avec sélection du meilleur
- [ ] Performance < 500ms pour 100k CIs
- [ ] Logging des décisions de matching

**Story Points:** 8
**Priorité:** P0

**Tâches Techniques:**
```
[ ] Créer functions/src/cmdb/matcher.ts
[ ] Implémenter priority-based matching
[ ] Optimiser queries avec indexes
[ ] Tests avec datasets variés
[ ] Benchmarks performance
```

---

#### Story CMDB-002-04: Cloud Function onAgentSync

**En tant que** système
**Je veux** déclencher la réconciliation à chaque sync agent
**Afin de** maintenir la CMDB à jour automatiquement

**Critères d'Acceptation:**
- [ ] Trigger Firestore onCreate/onUpdate sur `agent_heartbeats`
- [ ] Workflow complet : fingerprint → match → action
- [ ] Actions : update CI / create CI / add to queue
- [ ] Respect des seuils de confiance configurés
- [ ] Gestion des erreurs avec retry
- [ ] Métriques de performance

**Story Points:** 8
**Priorité:** P0

**Tâches Techniques:**
```
[ ] Créer functions/src/cmdb/reconciliation.ts
[ ] Implémenter Cloud Function v2
[ ] Ajouter error handling et retry
[ ] Tests d'intégration
[ ] Monitoring avec Cloud Logging
```

---

#### Story CMDB-002-05: Queue de Validation

**En tant qu'** administrateur
**Je veux** une queue des CIs en attente de validation
**Afin de** valider manuellement les matchs incertains

**Critères d'Acceptation:**
- [ ] Collection `cmdb_reconciliation_queue`
- [ ] Structure : agentData, fingerprint, matchResult, status, assignedTo
- [ ] API pour lister, approuver, rejeter
- [ ] Notification au owner assigné
- [ ] Expiration après 30 jours (auto-create si configuré)

**Story Points:** 5
**Priorité:** P0

**Tâches Techniques:**
```
[ ] Créer collection et service
[ ] Implémenter workflow approve/reject
[ ] Ajouter notifications
[ ] Cloud Function pour expiration
[ ] Tests
```

---

#### Story CMDB-002-06: Configuration Réconciliation par Org

**En tant qu'** administrateur
**Je veux** configurer le comportement de réconciliation
**Afin de** l'adapter à mes besoins

**Critères d'Acceptation:**
- [ ] Settings : autoCreateCI, autoMatchThreshold, requireValidation
- [ ] UI de configuration dans Settings
- [ ] Valeurs par défaut sensibles
- [ ] Validation des valeurs

**Story Points:** 3
**Priorité:** P1

**Tâches Techniques:**
```
[ ] Ajouter champs dans organization settings
[ ] Créer UI section dans Settings
[ ] Documenter les options
```

---

### EPIC-CMDB-003: Discovery Dashboard

**Objectif:** Interface utilisateur pour la découverte et validation des CIs.

**Valeur Business:** Visibilité temps réel sur l'état de la CMDB.

**Sprint:** 5-6 | **Story Points Total:** 29

---

#### Story CMDB-003-01: Page Discovery Dashboard

**En tant qu'** administrateur
**Je veux** un dashboard de découverte CMDB
**Afin de** voir l'état de découverte en temps réel

**Critères d'Acceptation:**
- [ ] Route `/cmdb/discovery`
- [ ] KPI cards : Discovered, Pending, Matched, Missing
- [ ] Refresh automatique (polling 30s)
- [ ] Responsive design
- [ ] Skeleton loading

**Story Points:** 5
**Priorité:** P0

**Tâches Techniques:**
```
[ ] Créer src/components/cmdb/DiscoveryDashboard.tsx
[ ] Ajouter route dans App.tsx
[ ] Créer composants KPI cards
[ ] Implémenter polling avec React Query
[ ] Tests composants
```

---

#### Story CMDB-003-02: Validation Queue UI

**En tant qu'** administrateur
**Je veux** voir et traiter la queue de validation
**Afin de** approuver/rejeter les CIs en attente

**Critères d'Acceptation:**
- [ ] Table avec : CI découvert, Match proposé, Confiance, Actions
- [ ] Actions : Approve (✓), Reject (✗), Merge (⇄)
- [ ] Preview du CI et du match côte à côte
- [ ] Bulk actions (sélection multiple)
- [ ] Filtres : confiance, date, source

**Story Points:** 8
**Priorité:** P0

**Tâches Techniques:**
```
[ ] Créer src/components/cmdb/ValidationQueue.tsx
[ ] Implémenter DataTable avec actions
[ ] Créer modal de preview/comparaison
[ ] Ajouter bulk actions
[ ] Tests E2E
```

---

#### Story CMDB-003-03: CI Inspector (Détail)

**En tant qu'** utilisateur
**Je veux** voir le détail complet d'un CI
**Afin de** comprendre sa configuration et ses relations

**Critères d'Acceptation:**
- [ ] Panel slide-over (comme AssetInspector)
- [ ] Tabs : Details, Relations, History, Impact
- [ ] Édition inline des attributs (si permission)
- [ ] Actions : Edit, Delete, Analyze Impact
- [ ] Affichage DQS badge

**Story Points:** 8
**Priorité:** P0

**Tâches Techniques:**
```
[ ] Créer src/components/cmdb/CIInspector.tsx
[ ] Réutiliser InspectorLayout existant
[ ] Créer sous-composants par tab
[ ] Intégrer avec useInspector hook
[ ] Tests
```

---

#### Story CMDB-003-04: Activity Feed

**En tant qu'** administrateur
**Je veux** voir l'activité récente de découverte
**Afin de** suivre les changements en temps réel

**Critères d'Acceptation:**
- [ ] Timeline des événements récents (24h)
- [ ] Types : sync, approval, creation, update, missing
- [ ] Filtering par type
- [ ] Auto-refresh
- [ ] Click pour naviguer vers CI

**Story Points:** 5
**Priorité:** P1

**Tâches Techniques:**
```
[ ] Créer composant ActivityFeed
[ ] Query audit logs filtrés CMDB
[ ] Implémenter timeline UI
[ ] Tests
```

---

#### Story CMDB-003-05: Notifications Discovery

**En tant qu'** administrateur
**Je veux** être notifié des événements importants
**Afin de** réagir rapidement aux changements

**Critères d'Acceptation:**
- [ ] Notification in-app pour : nouveaux CIs pending, CIs missing > 7j
- [ ] Email digest optionnel (quotidien)
- [ ] Configuration des préférences par user
- [ ] Badge count dans navigation

**Story Points:** 3
**Priorité:** P1

**Tâches Techniques:**
```
[ ] Intégrer avec système de notifications existant
[ ] Ajouter préférences utilisateur
[ ] Créer template email
[ ] Tests
```

---

## PHASE 2 : Relations & Impact

---

### EPIC-CMDB-004: Relations CMDB

**Objectif:** Implémenter le modèle de relations typées entre CIs.

**Valeur Business:** Cartographie des dépendances, préparation analyse d'impact.

**Sprint:** 9-10 | **Story Points Total:** 29

---

#### Story CMDB-004-01: Types et Collection Relationships

**En tant que** développeur
**Je veux** un modèle de données pour les relations CMDB
**Afin de** stocker les dépendances entre CIs

**Critères d'Acceptation:**
- [ ] Type `CMDBRelationship` (voir ADR-009 AD-002)
- [ ] Tous les `RelationshipType` supportés
- [ ] Collection `cmdb_relationships` avec indexes
- [ ] Security rules avec isolation org

**Story Points:** 3
**Priorité:** P0

**Tâches Techniques:**
```
[ ] Ajouter types dans src/types/cmdb.ts
[ ] Créer collection et indexes
[ ] Mettre à jour security rules
[ ] Schémas Zod
```

---

#### Story CMDB-004-02: Service CRUD Relationships

**En tant que** développeur
**Je veux** un service pour gérer les relations
**Afin de** créer et manipuler les dépendances

**Critères d'Acceptation:**
- [ ] `CMDBRelationshipService.create(orgId, rel)` avec validation cohérence
- [ ] `CMDBRelationshipService.delete(orgId, relId)`
- [ ] `CMDBRelationshipService.getRelationshipsForCI(orgId, ciId, direction)`
- [ ] Création automatique de relation inverse si bidirectional
- [ ] Validation matrice de relations valides

**Story Points:** 5
**Priorité:** P0

**Tâches Techniques:**
```
[ ] Créer src/services/CMDBRelationshipService.ts
[ ] Implémenter validation matrix
[ ] Ajouter inverse relationship logic
[ ] Tests unitaires
```

---

#### Story CMDB-004-03: UI Création de Relation

**En tant qu'** utilisateur
**Je veux** créer des relations entre CIs
**Afin de** documenter les dépendances

**Critères d'Acceptation:**
- [ ] Modal de création depuis CIInspector
- [ ] Sélecteur de CI cible avec recherche
- [ ] Dropdown type de relation (filtré par classes)
- [ ] Sélecteur criticité
- [ ] Preview avant création

**Story Points:** 5
**Priorité:** P0

**Tâches Techniques:**
```
[ ] Créer composant CreateRelationshipModal
[ ] Implémenter CI search/select
[ ] Filtrage dynamique des types valides
[ ] Tests
```

---

#### Story CMDB-004-04: Tab Relations dans CIInspector

**En tant qu'** utilisateur
**Je veux** voir les relations d'un CI
**Afin de** comprendre ses dépendances

**Critères d'Acceptation:**
- [ ] Liste des relations entrantes et sortantes
- [ ] Groupement par type de relation
- [ ] Actions : voir CI lié, supprimer relation
- [ ] Indicateur de confiance pour relations inférées
- [ ] Bouton "Add Relationship"

**Story Points:** 5
**Priorité:** P0

**Tâches Techniques:**
```
[ ] Créer CIInspectorRelations.tsx
[ ] Implémenter hook useRelationships
[ ] UI groupée par type
[ ] Tests
```

---

#### Story CMDB-004-05: Inférence Automatique de Relations

**En tant que** système
**Je veux** détecter automatiquement certaines relations
**Afin de** réduire le travail manuel de mapping

**Critères d'Acceptation:**
- [ ] Détection `runs_on` : process découvert → host CI
- [ ] Détection `connects_to` : connexions réseau actives
- [ ] Création avec `discoveredBy: 'Inference'` et `confidence`
- [ ] Status `Pending_Validation` pour review
- [ ] Configurable on/off par org

**Story Points:** 8
**Priorité:** P1

**Tâches Techniques:**
```
[ ] Créer Cloud Function pour inférence
[ ] Analyser données agent pour relations
[ ] Implémenter scoring de confiance
[ ] Tests avec données réelles
```

---

#### Story CMDB-004-06: Validation Cohérence Relations

**En tant que** système
**Je veux** valider la cohérence des relations
**Afin d'** éviter les erreurs de modélisation

**Critères d'Acceptation:**
- [ ] Validation : Software ne peut pas `contains` Hardware
- [ ] Validation : pas de self-reference
- [ ] Validation : pas de duplicate relations
- [ ] Warning : cycles de dépendances
- [ ] Error messages clairs

**Story Points:** 3
**Priorité:** P1

**Tâches Techniques:**
```
[ ] Implémenter validation matrix
[ ] Ajouter détection de cycles
[ ] Tests exhaustifs
```

---

### EPIC-CMDB-005: Graphe de Dépendances

**Objectif:** Visualisation interactive du graphe de relations.

**Valeur Business:** Compréhension visuelle de l'infrastructure.

**Sprint:** 11 | **Story Points Total:** 18

---

#### Story CMDB-005-01: Intégration VoxelEngine pour CMDB

**En tant qu'** utilisateur
**Je veux** visualiser le graphe de dépendances en 3D
**Afin de** comprendre visuellement les relations

**Critères d'Acceptation:**
- [ ] Réutilisation de VoxelEngine existant
- [ ] Nodes = CIs, Edges = Relations
- [ ] Couleurs par CI class
- [ ] Épaisseur edge par criticité
- [ ] Navigation zoom/pan/rotate
- [ ] Click sur node → ouvre CIInspector

**Story Points:** 8
**Priorité:** P1

**Tâches Techniques:**
```
[ ] Adapter VoxelEngine pour données CMDB
[ ] Créer mapper CI → VoxelNode
[ ] Créer mapper Relationship → VoxelEdge
[ ] Implémenter interaction click
[ ] Tests visuels
```

---

#### Story CMDB-005-02: Filtrage Graphe

**En tant qu'** utilisateur
**Je veux** filtrer le graphe par critères
**Afin de** me concentrer sur un sous-ensemble

**Critères d'Acceptation:**
- [ ] Filtre par CI class
- [ ] Filtre par type de relation
- [ ] Filtre par criticité
- [ ] "Focus mode" : CI sélectionné + N hops
- [ ] Highlight path entre deux CIs

**Story Points:** 5
**Priorité:** P1

**Tâches Techniques:**
```
[ ] Ajouter panneau de filtres
[ ] Implémenter filtering logic
[ ] Focus mode avec BFS
[ ] Path highlighting
[ ] Tests
```

---

#### Story CMDB-005-03: Export Graphe

**En tant qu'** utilisateur
**Je veux** exporter le graphe
**Afin de** l'inclure dans des rapports

**Critères d'Acceptation:**
- [ ] Export PNG (screenshot canvas)
- [ ] Export SVG (vecteur)
- [ ] Export données JSON (nodes + edges)
- [ ] Bouton dans toolbar graphe

**Story Points:** 3
**Priorité:** P2

**Tâches Techniques:**
```
[ ] Implémenter canvas screenshot
[ ] Conversion SVG
[ ] Export JSON formatter
[ ] Tests
```

---

#### Story CMDB-005-04: Fallback 2D

**En tant qu'** utilisateur sur device sans WebGL
**Je veux** une vue 2D du graphe
**Afin de** visualiser les relations quand même

**Critères d'Acceptation:**
- [ ] Détection WebGL unavailable
- [ ] Vue 2D avec D3.js ou similar
- [ ] Mêmes fonctionnalités de base (zoom, click)
- [ ] Message informatif

**Story Points:** 2
**Priorité:** P2

**Tâches Techniques:**
```
[ ] Ajouter détection WebGL
[ ] Créer composant Graph2D fallback
[ ] Tests
```

---

### EPIC-CMDB-006: Analyse d'Impact

**Objectif:** Calculer et visualiser l'impact d'un CI down.

**Valeur Business:** Réduction MTTR de 30%, planification maintenance.

**Sprint:** 12 | **Story Points Total:** 26

---

#### Story CMDB-006-01: Impact Analysis Engine

**En tant que** système
**Je veux** calculer le blast radius d'un CI
**Afin de** fournir l'analyse d'impact

**Critères d'Acceptation:**
- [ ] Fonction `calculateImpact(ciId, scenario, depth)` (voir ADR-009 AD-005)
- [ ] Traversal BFS avec limit depth
- [ ] Calcul impact level par hop et criticité
- [ ] Identification services métier impactés
- [ ] Performance < 2s pour 1000 relations

**Story Points:** 8
**Priorité:** P0

**Tâches Techniques:**
```
[ ] Créer src/services/CMDBImpactService.ts
[ ] Implémenter BFS traversal
[ ] Ajouter impact scoring
[ ] Optimisation performance
[ ] Tests avec graphes variés
```

---

#### Story CMDB-006-02: Tab Impact dans CIInspector

**En tant qu'** utilisateur
**Je veux** voir l'impact potentiel d'un CI
**Afin de** comprendre son importance

**Critères d'Acceptation:**
- [ ] Sélecteur scenario : Down, Maintenance, Decommission
- [ ] Sélecteur profondeur : 1-5 hops
- [ ] Bouton "Calculate"
- [ ] Affichage résultats structurés
- [ ] Loading state pendant calcul

**Story Points:** 5
**Priorité:** P0

**Tâches Techniques:**
```
[ ] Créer CIInspectorImpact.tsx
[ ] Intégrer avec CMDBImpactService
[ ] UI résultats
[ ] Tests
```

---

#### Story CMDB-006-03: Blast Radius Visualization

**En tant qu'** utilisateur
**Je veux** visualiser le blast radius graphiquement
**Afin de** comprendre l'étendue de l'impact

**Critères d'Acceptation:**
- [ ] Vue graphe centré sur CI source
- [ ] Rings concentriques par hop
- [ ] Couleur par impact level (Critical=rouge, High=orange, etc.)
- [ ] Tooltip avec détails CI
- [ ] Animation d'expansion

**Story Points:** 5
**Priorité:** P1

**Tâches Techniques:**
```
[ ] Créer composant BlastRadiusGraph
[ ] Adapter VoxelEngine ou créer vue dédiée
[ ] Implémenter rings layout
[ ] Animation
[ ] Tests visuels
```

---

#### Story CMDB-006-04: Impact Summary Report

**En tant qu'** utilisateur
**Je veux** un résumé textuel de l'impact
**Afin de** communiquer aux stakeholders

**Critères d'Acceptation:**
- [ ] Card summary : total CIs, par level, users estimés
- [ ] Liste services métier impactés avec criticité
- [ ] Recommandations (ex: "Schedule during low usage")
- [ ] Export PDF

**Story Points:** 5
**Priorité:** P1

**Tâches Techniques:**
```
[ ] Créer composant ImpactSummary
[ ] Générer recommandations basiques
[ ] Implémenter export PDF
[ ] Tests
```

---

#### Story CMDB-006-05: Simulation de Changement

**En tant qu'** administrateur
**Je veux** simuler un changement avant exécution
**Afin de** planifier avec connaissance de l'impact

**Critères d'Acceptation:**
- [ ] Action "Simulate Change" depuis CIInspector
- [ ] Types : Maintenance, Update, Decommission
- [ ] Durée estimée (optionnel)
- [ ] Rapport d'impact complet
- [ ] Suggestion de fenêtre de maintenance

**Story Points:** 3
**Priorité:** P2

**Tâches Techniques:**
```
[ ] Ajouter modal SimulateChange
[ ] Intégrer avec Impact Engine
[ ] Logique suggestion fenêtre
[ ] Tests
```

---

## PHASE 3 : Enrichissement

---

### EPIC-CMDB-007: Enrichissement Agent

**Objectif:** Collecter des données hardware détaillées via l'agent Rust.

**Valeur Business:** CMDB plus complète, meilleure réconciliation.

**Sprint:** 15-16 | **Story Points Total:** 21

---

#### Story CMDB-007-01: Hardware Inventory Agent (Rust)

**En tant que** développeur agent
**Je veux** collecter les specs hardware détaillées
**Afin d'** enrichir les CIs hardware

**Critères d'Acceptation:**
- [ ] Struct `HardwareInventory` (voir Product Brief section 8.1)
- [ ] Collection CPU info (model, cores, frequency)
- [ ] Collection Memory info (type, size, slots)
- [ ] Collection Storage info (type, size, serial, health)
- [ ] Collection BIOS info (vendor, version, serial)
- [ ] Support Windows, macOS, Linux

**Story Points:** 13
**Priorité:** P1

**Tâches Techniques:**
```
[ ] Créer crate agent-hardware ou étendre agent-scanner
[ ] Implémenter collectors par OS
[ ] Tests sur chaque plateforme
[ ] Documentation
```

---

#### Story CMDB-007-02: Sync Hardware vers CMDB

**En tant que** système
**Je veux** synchroniser les données hardware avec les CIs
**Afin de** maintenir les specs à jour

**Critères d'Acceptation:**
- [ ] Cloud Function pour traiter hardware data
- [ ] Mapping vers CI attributes
- [ ] Update incrémental (seulement si changé)
- [ ] Logging des changements hardware

**Story Points:** 5
**Priorité:** P1

**Tâches Techniques:**
```
[ ] Créer/étendre Cloud Function sync
[ ] Mapping hardware → CI attributes
[ ] Tests
```

---

#### Story CMDB-007-03: UI Specs Hardware dans CIInspector

**En tant qu'** utilisateur
**Je veux** voir les specs hardware d'un CI
**Afin de** connaître sa configuration

**Critères d'Acceptation:**
- [ ] Section "Hardware Specifications" dans Details tab
- [ ] Affichage CPU, RAM, Storage, BIOS
- [ ] Indicateur santé storage si disponible
- [ ] Timestamp dernière collecte

**Story Points:** 3
**Priorité:** P1

**Tâches Techniques:**
```
[ ] Créer composant HardwareSpecs
[ ] Intégrer dans CIInspectorDetails
[ ] Tests
```

---

### EPIC-CMDB-008: Gestion des Licences

**Objectif:** Tracker les licences logicielles associées aux CIs.

**Valeur Business:** Conformité licensing, optimisation coûts.

**Sprint:** 17 | **Story Points Total:** 15

---

#### Story CMDB-008-01: Modèle de Données License

**En tant que** développeur
**Je veux** un modèle pour les licences logicielles
**Afin de** les tracker séparément des CIs

**Critères d'Acceptation:**
- [ ] Type `SoftwareLicense` avec : vendor, product, type, count, expiry
- [ ] Collection `cmdb_licenses`
- [ ] Relation License ↔ Software CIs

**Story Points:** 3
**Priorité:** P2

**Tâches Techniques:**
```
[ ] Créer types et collection
[ ] Service CRUD
[ ] Tests
```

---

#### Story CMDB-008-02: UI Gestion Licences

**En tant qu'** administrateur
**Je veux** gérer les licences logicielles
**Afin de** suivre la conformité

**Critères d'Acceptation:**
- [ ] Page `/cmdb/licenses`
- [ ] Table : Software, Vendor, Type, Owned, Used, Expiry
- [ ] Indicateurs : Over-licensed, Under-licensed, Expiring soon
- [ ] CRUD operations

**Story Points:** 8
**Priorité:** P2

**Tâches Techniques:**
```
[ ] Créer page LicenseManagement
[ ] Implémenter calcul usage
[ ] Alertes expiration
[ ] Tests
```

---

#### Story CMDB-008-03: Compliance Licensing Report

**En tant qu'** administrateur
**Je veux** un rapport de conformité licensing
**Afin de** préparer les audits

**Critères d'Acceptation:**
- [ ] Rapport : compliance par vendor
- [ ] Détail : licences vs installations
- [ ] Recommandations optimisation
- [ ] Export PDF/CSV

**Story Points:** 4
**Priorité:** P2

**Tâches Techniques:**
```
[ ] Créer composant LicenseComplianceReport
[ ] Export
[ ] Tests
```

---

### EPIC-CMDB-009: API CMDB

**Objectif:** Exposer une API RESTful pour intégrations externes.

**Valeur Business:** Interopérabilité, automatisation.

**Sprint:** 19-20 | **Story Points Total:** 21

---

#### Story CMDB-009-01: API REST CIs

**En tant que** développeur externe
**Je veux** une API REST pour les CIs
**Afin d'** intégrer avec d'autres outils

**Critères d'Acceptation:**
- [ ] `GET /api/v1/cmdb/cis` - List avec pagination et filtres
- [ ] `GET /api/v1/cmdb/cis/:id` - Get single
- [ ] `POST /api/v1/cmdb/cis` - Create
- [ ] `PUT /api/v1/cmdb/cis/:id` - Update
- [ ] `DELETE /api/v1/cmdb/cis/:id` - Delete
- [ ] Authentication via API key
- [ ] Rate limiting

**Story Points:** 8
**Priorité:** P1

**Tâches Techniques:**
```
[ ] Créer Cloud Functions HTTP endpoints
[ ] Implémenter auth API key
[ ] Rate limiting
[ ] Documentation OpenAPI
[ ] Tests
```

---

#### Story CMDB-009-02: API REST Relationships

**En tant que** développeur externe
**Je veux** une API REST pour les relations
**Afin de** gérer les dépendances programmatiquement

**Critères d'Acceptation:**
- [ ] `GET /api/v1/cmdb/cis/:id/relationships` - List relations
- [ ] `POST /api/v1/cmdb/relationships` - Create
- [ ] `DELETE /api/v1/cmdb/relationships/:id` - Delete
- [ ] Documentation OpenAPI

**Story Points:** 5
**Priorité:** P1

**Tâches Techniques:**
```
[ ] Créer endpoints
[ ] Documentation
[ ] Tests
```

---

#### Story CMDB-009-03: API Impact Analysis

**En tant que** développeur externe
**Je veux** une API pour l'analyse d'impact
**Afin de** l'intégrer dans mes workflows

**Critères d'Acceptation:**
- [ ] `GET /api/v1/cmdb/cis/:id/impact?scenario=down&depth=3`
- [ ] Réponse JSON structurée
- [ ] Cache des résultats (TTL 5min)
- [ ] Documentation OpenAPI

**Story Points:** 3
**Priorité:** P1

**Tâches Techniques:**
```
[ ] Créer endpoint
[ ] Caching
[ ] Documentation
[ ] Tests
```

---

#### Story CMDB-009-04: Documentation API Interactive

**En tant que** développeur externe
**Je veux** une documentation API interactive
**Afin de** tester facilement l'API

**Critères d'Acceptation:**
- [ ] Swagger UI hosted
- [ ] Tous les endpoints documentés
- [ ] Exemples de requêtes/réponses
- [ ] Try-it-out fonctionnel

**Story Points:** 3
**Priorité:** P2

**Tâches Techniques:**
```
[ ] Générer spec OpenAPI
[ ] Déployer Swagger UI
[ ] Tests documentation
```

---

#### Story CMDB-009-05: Webhooks CMDB Events

**En tant que** développeur externe
**Je veux** recevoir des webhooks sur événements CMDB
**Afin de** réagir aux changements

**Critères d'Acceptation:**
- [ ] Configuration webhooks par org
- [ ] Events : ci.created, ci.updated, ci.deleted, relationship.created
- [ ] Payload JSON standardisé
- [ ] Retry mechanism
- [ ] Logs des deliveries

**Story Points:** 5
**Priorité:** P2

**Tâches Techniques:**
```
[ ] Créer système de webhooks
[ ] UI configuration
[ ] Delivery avec retry
[ ] Logs
[ ] Tests
```

---

## Résumé par Phase

### Phase 1 - Fondations (8 semaines)

| Epic | Stories | Points | Sprints |
|------|---------|--------|---------|
| CMDB-001: Modèle CI | 7 | 34 | 1-2 |
| CMDB-002: IRE | 6 | 34 | 3-4 |
| CMDB-003: Discovery UI | 5 | 29 | 5-6 |
| **Total Phase 1** | **18** | **97** | **6** |

### Phase 2 - Relations & Impact (6 semaines)

| Epic | Stories | Points | Sprints |
|------|---------|--------|---------|
| CMDB-004: Relations | 6 | 29 | 9-10 |
| CMDB-005: Graphe | 4 | 18 | 11 |
| CMDB-006: Impact | 5 | 26 | 12 |
| **Total Phase 2** | **15** | **73** | **4** |

### Phase 3 - Enrichissement (6 semaines)

| Epic | Stories | Points | Sprints |
|------|---------|--------|---------|
| CMDB-007: Agent HW | 3 | 21 | 15-16 |
| CMDB-008: Licenses | 3 | 15 | 17 |
| CMDB-009: API | 5 | 21 | 19-20 |
| **Total Phase 3** | **11** | **57** | **4** |

---

### Grand Total

| Métrique | Valeur |
|----------|--------|
| **Epics** | 9 |
| **Stories** | 44 |
| **Story Points** | 227 |
| **Sprints** | 14 (+ 6 buffer) |
| **Durée estimée** | 20 semaines |

---

**Document Status:** READY FOR SPRINT PLANNING
**Prochaine étape:** Priorisation et affectation Sprint 1
