---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - technical-voxel-3d-visualization-grc-research-2026-01-22.md
  - product-brief-sentinel-grc-2026-01-20.md
  - UI_UX_AUDIT_REPORT.md
date: 2026-01-22
author: Thibaultllopis
status: complete
completedAt: 2026-01-22T16:45:00Z
---

# Product Brief: Module Voxel - Cockpit 3D Immersif

## Executive Summary

Le **Module Voxel** transforme la gestion des risques cyber d'un exercice bureaucratique en une **expérience de pilotage immersive**. Face à des outils GRC jugés obsolètes, non-prédictifs et incapables de révéler les risques cachés, Voxel propose une rupture : un **Digital Twin 3D du Système d'Information** permettant de naviguer visuellement dans l'écosystème complet (assets, risques, contrôles, conformité) et d'identifier instantanément les menaces invisibles aux approches traditionnelles.

**Vision :** Donner aux RSSI et équipes GRC le pouvoir de *voir l'invisible* — les interdépendances critiques, les chemins d'attaque latents, les failles de conformité émergentes — à travers une interface aussi intuitive qu'un jeu vidéo et aussi puissante qu'un cockpit de pilotage.

**Différenciation clé :** Aucune plateforme GRC du marché ne propose de visualisation 3D immersive. Voxel est un océan bleu.

---

## 1. Vision Produit

### 1.1 Énoncé de Vision

> **"Voxel révèle l'invisible. Là où les outils traditionnels montrent des listes et des tableaux, Voxel fait émerger les patterns, les corrélations cachées et les risques latents dans un espace 3D navigable — transformant chaque RSSI en pilote de sa sécurité."**

### 1.2 Problème Adressé

#### Le Statu Quo : L'Aveuglement Structurel

| Symptôme | Impact |
|----------|--------|
| Outils GRC = dashboards 2D statiques | Impossibilité de voir les interdépendances |
| Analyse manuelle des corrélations | 3 semaines pour identifier un chemin d'attaque |
| Pas de vue macro ET micro simultanée | Décisions prises sans contexte complet |
| Interfaces datées et non-engageantes | Adoption faible, données incomplètes |
| Approche réactive vs prédictive | Toujours un temps de retard sur les menaces |

#### Ce qui Reste Invisible Aujourd'hui

- **Corrélations cachées** : Un asset critique non-couvert lié à 15 autres
- **Chemins de propagation** : Comment un incident sur un fournisseur impacte la conformité DORA
- **Anomalies structurelles** : Clusters de risques non-détectés par les analyses traditionnelles
- **Points de défaillance unique** : Assets sur-connectés créant des SPOF invisibles

### 1.3 Solution Proposée

#### Le Digital Twin 3D du SI

Voxel crée une **représentation spatiale vivante** de l'ensemble du périmètre GRC :

| Dimension | Représentation Voxel |
|-----------|---------------------|
| **Assets** | Noeuds 3D avec taille = criticité |
| **Risques** | Halos colorés pulsants selon gravité |
| **Contrôles** | Boucliers visuels couvrant les assets |
| **Conformité** | Overlay par framework (NIS2, DORA, ISO...) |
| **Connexions** | Arcs animés montrant dépendances et flux |
| **Anomalies** | Alertes visuelles dynamiques (glow, particules) |

#### Modes de Navigation

| Mode | Usage | Expérience |
|------|-------|------------|
| **Exploration Libre** | Découverte, audit, présentation | Navigation FPS style jeu vidéo |
| **Navigation Guidée** | Alertes, incidents, priorisation | Le système met en avant les points critiques |
| **Zoom Sémantique** | Analyse contextuelle | Macro (galaxie) ↔ Micro (détails techniques) |

#### Abstraction Intelligente

- **Vue Métier** : Scores, impacts business, statuts conformité
- **Vue Technique** : Logs, CVE, configurations, evidence
- **Transition Fluide** : "Plonger" d'un niveau à l'autre en un clic

### 1.4 Proposition de Valeur Unique

> **Pour** les RSSI et équipes GRC qui gèrent une complexité cyber croissante
> **Qui** ne peuvent pas identifier les risques cachés et corrélations avec les outils actuels
> **Voxel est** un cockpit 3D immersif de pilotage du SI
> **Qui** révèle visuellement les interdépendances, prédit les menaces et guide vers l'action
> **Contrairement à** tous les outils GRC du marché (dashboards 2D, listes, tableaux)
> **Notre module** offre une expérience de visualisation inédite, style jeu vidéo, prédictive et engageante

### 1.5 Différenciateurs Clés

| Différenciateur | Détail |
|-----------------|--------|
| **Visualisation 3D unique** | Aucun concurrent GRC ne propose cette approche |
| **UX style jeu vidéo** | Engagement utilisateur radicalement supérieur |
| **Prédictif par design** | IA intégrée pour détection anomalies |
| **Zoom sémantique** | Macro ↔ Micro sans perte de contexte |
| **Double mode navigation** | Libre + Guidé selon le besoin |

### 1.6 Hors Scope (V1)

| Feature | Statut | Horizon |
|---------|--------|---------|
| VR/AR immersif (casques) | Exclu | V2+ (2027) |
| Collaboration multi-user temps réel | Exclu | V2+ (2027) |

---

## 2. Utilisateurs Cibles

### 2.1 Utilisateur Principal : Le RSSI Pilote

```
NOM: Sophie Marchand
TITRE: RSSI / Directrice Cybersécurité
ORGANISATION: ETI ou Grand Compte (500-10,000 employés)
CONTEXTE: Multi-réglementaire (NIS2, DORA, ISO 27001)

PROFIL:
- 35-50 ans
- Background technique + évolution management
- Équipe réduite (2-8 ETP)
- Pression constante conformité + menaces

USAGE VOXEL:
- Quotidien: Vue macro pour monitoring global
- Hebdo: Analyse des évolutions et nouveaux risques
- Mensuel: Préparation reporting COMEX
- Ponctuel: Investigation incidents, audits

MOMENT "WOW" ATTENDU:
"En 30 secondes je vois ce qui prenait 3 jours à compiler :
les interdépendances critiques et où concentrer mes efforts."

FRUSTRATIONS ACTUELLES:
- "Je navigue entre 5 outils pour avoir une vue d'ensemble"
- "Je ne vois pas les corrélations cachées"
- "Mon Excel ne montre pas les chemins de propagation"
- "Je ne peux pas montrer visuellement les risques au COMEX"

CRITÈRES DE SUCCÈS:
1. Identification anomalies < 1 minute
2. Préparation audit visuelle < 30 minutes
3. Présentation COMEX impactante
4. Adoption par l'équipe > 80%
```

### 2.2 Utilisateurs Secondaires

#### Analyste SOC - L'Investigateur

| Attribut | Détail |
|----------|--------|
| **Profil** | Technicien 25-35 ans, certifié (CEH, OSCP) |
| **Usage Voxel** | Investigation incidents, traçage propagation |
| **Fréquence** | Quotidien, intensif lors d'incidents |
| **Besoin clé** | Drill-down technique rapide (logs, CVE, configs) |
| **Moment Wow** | "Je vois le chemin d'attaque en 3D et je trace instantanément" |

#### Risk Manager - Le Cartographe

| Attribut | Détail |
|----------|--------|
| **Profil** | Profil GRC 30-45 ans, certification ISO/EBIOS |
| **Usage Voxel** | Cartographie risques, analyse d'impact, scénarios |
| **Fréquence** | Hebdomadaire, intensif avant audits |
| **Besoin clé** | Vue macro des interdépendances, simulation what-if |
| **Moment Wow** | "Je modélise l'impact d'un risque sur tout l'écosystème" |

#### Auditeur - Le Vérificateur

| Attribut | Détail |
|----------|--------|
| **Profil** | Auditeur interne/externe, certification CISA |
| **Usage Voxel** | Revue conformité visuelle, preuve de couverture |
| **Fréquence** | Ponctuel (campagnes d'audit) |
| **Besoin clé** | Vue overlay par framework, export evidence |
| **Moment Wow** | "Je vérifie la couverture des contrôles visuellement" |

#### Direction (DG/DSI) - Le Décideur

| Attribut | Détail |
|----------|--------|
| **Profil** | C-Level, peu de temps, besoin d'impact |
| **Usage Voxel** | Présentation board, validation budget |
| **Fréquence** | Mensuel/trimestriel |
| **Besoin clé** | Vue métier simple, KPIs visuels, storytelling |
| **Moment Wow** | "Enfin je comprends notre posture cyber en 2 minutes" |

### 2.3 Parcours Utilisateur Type

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PARCOURS RSSI AVEC VOXEL                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  DÉCOUVERTE          ONBOARDING           USAGE QUOTIDIEN            │
│  ──────────          ──────────           ───────────────            │
│                                                                      │
│  Démo commerciale    Tutorial guidé       Vue macro chaque matin     │
│  "Wow effect" 3D     Import données       Alertes visuelles          │
│  Compréhension       Premier vol libre    Navigation intuitive       │
│  immédiate           dans son SI          Investigation drill-down   │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  MOMENT AHA!         ADOPTION ÉQUIPE      VALEUR LONG TERME          │
│  ───────────         ──────────────       ─────────────────          │
│                                                                      │
│  "Je vois enfin      SOC adopte pour      Outil de référence         │
│  les corrélations    investigations       Présentation board         │
│  cachées!"           Risk Manager pour    Anticipation vs réaction   │
│                      cartographie         Confiance équipe           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.4 Matrice Usage par Profil

| Profil | Mode Navigation | Vue Préférée | Fréquence | Action Principale |
|--------|-----------------|--------------|-----------|-------------------|
| **RSSI** | Libre + Guidé | Macro → Micro | Quotidien | Monitoring, décision |
| **Analyste SOC** | Libre | Technique | Quotidien | Investigation |
| **Risk Manager** | Guidé | Macro | Hebdo | Cartographie |
| **Auditeur** | Guidé | Framework overlay | Ponctuel | Vérification |
| **Direction** | Guidé | Métier simplifié | Mensuel | Présentation |

---

## 3. Métriques de Succès

### 3.1 Métriques Utilisateur

| Métrique | Baseline (Sans Voxel) | Target (Avec Voxel) | Mesure |
|----------|----------------------|---------------------|--------|
| **Temps identification anomalie** | 3 jours | < 5 minutes | Logs plateforme |
| **Temps préparation audit visuel** | 1 semaine | < 2 heures | Feedback utilisateur |
| **Temps création rapport COMEX** | 4 heures | < 30 minutes | Usage tracking |
| **Compréhension posture cyber** | "Floue" | "Claire en 2 min" | Survey qualitative |
| **Visibilité interdépendances** | 15% estimé | 100% cartographié | Couverture données |

### 3.2 Métriques d'Adoption

| Métrique | Target M3 | Target M6 | Target M12 |
|----------|-----------|-----------|------------|
| **Utilisateurs actifs Voxel / tenant** | 40% | 60% | 80% |
| **Sessions Voxel / semaine / user** | 2 | 4 | 5+ |
| **Temps moyen par session** | 5 min | 10 min | 15 min |
| **Features utilisées** | Navigation | +Filtres | +Alertes+Export |
| **NPS Module Voxel** | 30 | 45 | 60+ |

### 3.3 Métriques Business

| Métrique | Impact Attendu | Mesure |
|----------|----------------|--------|
| **Taux conversion démo → trial** | +30% (effet "Wow") | CRM funnel |
| **Taux conversion trial → paid** | +15% | CRM funnel |
| **Réduction churn** | -20% (facteur stickiness) | Cohort analysis |
| **Justification pricing premium** | +20% ARPU | Revenue par client |
| **Mentions presse/social** | 10+/trimestre | Media monitoring |
| **Demandes entrantes "j'ai vu Voxel"** | 15% des leads | Attribution CRM |

### 3.4 KPIs Techniques

| KPI | Minimum Acceptable | Target Optimal | Mesure |
|-----|-------------------|----------------|--------|
| **FPS (frames per second)** | 30 fps | 60 fps | Performance monitoring |
| **Temps chargement initial** | < 5s | < 2s | Lighthouse/RUM |
| **Noeuds supportés (fluide)** | 10,000 | 50,000+ | Load testing |
| **Temps réponse interaction** | < 200ms | < 100ms | APM |
| **Disponibilité** | 99.5% | 99.9% | Uptime monitoring |
| **Bugs critiques/mois** | < 2 | 0 | Bug tracking |
| **Score Lighthouse Performance** | 70 | 90+ | Audit auto |

### 3.5 Métriques par Persona

| Persona | Métrique Clé | Target |
|---------|--------------|--------|
| **RSSI** | Temps insight → décision | < 10 min |
| **Analyste SOC** | Temps traçage incident | -70% vs actuel |
| **Risk Manager** | Couverture cartographie | 100% assets |
| **Auditeur** | Temps vérification conformité | < 1h/framework |
| **Direction** | Compréhension présentation | "Immédiate" |

### 3.6 North Star Metric

> **"Temps moyen pour identifier une corrélation cachée critique"**
>
> - **Baseline** : 3+ jours (si détectée)
> - **Target** : < 5 minutes
> - **Pourquoi** : Capture l'essence de la valeur Voxel — révéler l'invisible rapidement

---

## 4. Scope & Roadmap

### 4.1 MVP Core (Phase 1) - Fondations

**Objectif :** Démontrer la valeur de la visualisation 3D avec les données existantes.

| Feature | Description | Priorité | Effort |
|---------|-------------|----------|--------|
| **Canvas R3F** | Intégration React Three Fiber dans Sentinel | P0 | M |
| **Noeuds Assets** | Visualisation 3D des assets (taille = criticité) | P0 | M |
| **Noeuds Risques** | Visualisation des risques (couleur = gravité) | P0 | S |
| **Noeuds Contrôles** | Visualisation contrôles liés aux assets | P0 | S |
| **Arcs Connexions** | Liens visuels entre entités | P0 | M |
| **Navigation Orbit** | Rotation, zoom, pan (OrbitControls) | P0 | S |
| **Filtres Basiques** | Par type d'entité, par framework | P0 | S |
| **Palette Risque** | Couleurs sémantiques (rouge→vert) | P0 | XS |
| **Tooltip Hover** | Info au survol d'un noeud | P0 | S |
| **Click → Détail** | Ouvrir panneau détail au clic | P0 | M |

**Critères de succès MVP Core :**
- [ ] Rendu fluide (30+ FPS) avec 1,000 noeuds
- [ ] Données temps réel Firestore affichées
- [ ] Navigation intuitive sans formation
- [ ] "Wow effect" lors de la première démo

**Estimation :** 4-6 semaines

---

### 4.2 MVP+ (Phase 2) - Expérience Complète

**Objectif :** Différenciation maximale et adoption utilisateur.

| Feature | Description | Priorité | Effort |
|---------|-------------|----------|--------|
| **Zoom Sémantique** | Transition fluide macro ↔ micro | P1 | L |
| **Alertes Visuelles** | Pulsation, glow pour risques critiques | P1 | M |
| **Mode Guidé** | Navigation auto vers points critiques | P1 | M |
| **Clustering Auto** | Regroupement par domaine/département | P1 | L |
| **Minimap** | Vue globale pour orientation | P1 | M |
| **Légende Interactive** | Toggle visibilité par type | P1 | S |
| **Recherche Noeud** | Trouver et zoomer sur un asset | P1 | S |
| **Overlay Framework** | Vue par NIS2, DORA, ISO... | P1 | M |
| **Animations Transitions** | Morphing fluide entre vues | P1 | M |
| **Performance 10K+** | InstancedMesh, LOD, culling | P1 | L |

**Critères de succès MVP+ :**
- [ ] Rendu fluide (60 FPS) avec 10,000 noeuds
- [ ] Temps identification anomalie < 5 min
- [ ] NPS Module > 30
- [ ] Adoption > 40% des utilisateurs du tenant

**Estimation :** 6-8 semaines (après MVP Core)

---

### 4.3 Hors Scope MVP (V2+)

| Feature | Raison du Report | Horizon |
|---------|------------------|---------|
| **Détection Anomalies IA** | Nécessite données d'entraînement | V2 (Q3 2026) |
| **Simulation What-If** | Complexité modélisation | V2 (Q3 2026) |
| **Export PNG/PDF** | Nice-to-have, pas core | V2 (Q3 2026) |
| **Mode Présentation** | Après validation usage | V2 (Q4 2026) |
| **VR/AR** | Technologie émergente | V3 (2027) |
| **Multi-user temps réel** | Infrastructure complexe | V3 (2027) |
| **Intégration SIEM** | Dépendances externes | V2+ |
| **API Voxel publique** | Après stabilisation | V3 |

---

### 4.4 Stack Technique MVP

```
┌─────────────────────────────────────────────────────────────────┐
│                    VOXEL MVP STACK                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  RENDERING           STATE              DATA                     │
│  ─────────           ─────              ────                     │
│  React Three Fiber   Zustand            Firestore (existant)     │
│  @react-three/drei   React Query        Real-time subscriptions  │
│  Three.js            (existant)                                  │
│                                                                  │
│  INTERACTIONS        ANIMATIONS         PERFORMANCE              │
│  ────────────        ──────────         ───────────              │
│  OrbitControls       React Spring       InstancedMesh (Phase 2)  │
│  Raycasting          Framer Motion      LOD (Phase 2)            │
│  use-gesture         (existant)         Web Workers (Phase 2)    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4.5 Roadmap Visuelle

```
        Q1 2026              Q2 2026              Q3 2026              Q4 2026
           │                    │                    │                    │
    ┌──────┴──────┐      ┌──────┴──────┐      ┌──────┴──────┐      ┌──────┴──────┐
    │  MVP CORE   │      │   MVP+      │      │    V2.0     │      │   V2.5      │
    │             │      │             │      │             │      │             │
    │ • Canvas R3F│      │ • Zoom sém. │      │ • IA Detect │      │ • Mode Prés │
    │ • Assets 3D │      │ • Alertes   │      │ • What-If   │      │ • Export    │
    │ • Risques   │      │ • Mode guidé│      │ • SIEM      │      │ • API       │
    │ • Connexions│      │ • Minimap   │      │             │      │             │
    │ • Navigation│      │ • Perf 10K+ │      │             │      │             │
    └─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘
          │                    │                    │                    │
          ▼                    ▼                    ▼                    ▼
    ✓ Validation         ✓ Adoption           ✓ Intelligence      ✓ Écosystème
      concept              utilisateur          prédictive          complet
```

---

### 4.6 Risques & Mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Performance insuffisante** | Moyenne | Élevé | InstancedMesh dès Phase 2, tests charge continus |
| **Complexité UX** | Moyenne | Moyen | Tests utilisateurs itératifs, mode guidé |
| **Données incomplètes** | Faible | Moyen | Fallback gracieux, onboarding données |
| **Compatibilité navigateurs** | Faible | Moyen | Tests cross-browser, fallback Canvas 2D |
| **Temps de dev sous-estimé** | Moyenne | Moyen | Buffer 20%, scope négociable |

---

### 4.7 Décision Go/No-Go

**Critères pour passer de MVP Core → MVP+ :**

| Critère | Seuil Go | Mesure |
|---------|----------|--------|
| Performance | 30+ FPS avec données réelles | Benchmark auto |
| Feedback utilisateur | "Utile" > 70% | Survey beta |
| Bugs critiques | 0 bloquant | Bug tracker |
| Adoption beta | > 50% users actifs | Analytics |

**Si No-Go :** Itérer sur MVP Core avant d'ajouter features.

---

<!-- Step 6 content will be appended below -->
