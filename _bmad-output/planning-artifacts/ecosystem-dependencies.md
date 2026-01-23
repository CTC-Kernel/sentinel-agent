# Sentinel GRC Ecosystem - Carte des Dependances

**Version:** 1.0
**Date:** 2026-01-23
**Auteur:** Audit de coherence automatise

---

## Vue d'Ensemble

L'ecosysteme Sentinel GRC comprend **7 initiatives** interconnectees. Ce document cartographie les dependances techniques et fonctionnelles entre elles.

```
                    +---------------------------+
                    |   STRATEGIE EUROPEENNE    |
                    |   (PRD European Leader)   |
                    +-------------+-------------+
                                  |
                                  | pilote
                                  v
+---------------+     +------------------------+     +------------------+
|   AGENT GRC   |<--->|   PLATEFORME SAAS     |<--->|   MODULE VOXEL   |
|   (Rust)      |     |   (React/Firebase)     |     |   (R3F/Three.js) |
+-------+-------+     +----------+-------------+     +--------+---------+
        |                        |                            |
        | sync                   | donnees                    | visualise
        v                        v                            v
+---------------+     +------------------------+     +------------------+
|   ENDPOINTS   |     |   MODULES METIER       |     |   ASSETS/RISQUES |
|   Windows/    |     | - EBIOS-RM             |     |   /CONTROLES     |
|   Linux       |     | - Coffre-fort Doc      |     +------------------+
+---------------+     | - DORA ICT Register    |
                      | - TPRM                 |
                      | - Homologation ANSSI   |
                      +------------------------+
```

---

## Matrice des Dependances

### 1. Plateforme SaaS GRC (CORE)

| Depend de | Type | Description |
|-----------|------|-------------|
| Firebase | Infrastructure | Auth, Firestore, Storage, Functions |
| Aucun module interne | - | C'est la base |

| Est requis par | Type | Description |
|----------------|------|-------------|
| Agent GRC | API | API REST pour sync donnees, auth tokens |
| Module Voxel | Donnees | Assets, Risques, Controles pour visualisation |
| EBIOS-RM | Module | Integration dans module Risques existant |
| Coffre-fort | Module | Integration document management |
| European Leader | Feature | Toutes les features multi-framework |

**Status:** Partiellement implemente (14 modules existants, 377 composants)

---

### 2. Agent GRC Sentinel

| Depend de | Type | Description |
|-----------|------|-------------|
| **Plateforme SaaS** | CRITIQUE | API pour sync, auth, dashboard |
| Firebase Auth | Auth | Token d'authentification agent |
| Firebase Functions | Backend | Endpoints API agent |
| Firestore | Data | Stockage resultats checks |

| Est requis par | Type | Description |
|----------------|------|-------------|
| European Leader | Feature | Validation technique endpoint |
| Module Voxel (futur) | Donnees | Assets endpoints pour visualisation |

**Status:** En cours (Epic 1 done, Epics 2-5 in-progress)

**Risque dependance:** ELEVE - Ne peut pas fonctionner sans la plateforme SaaS

---

### 3. Module Voxel

| Depend de | Type | Description |
|-----------|------|-------------|
| **Plateforme SaaS** | CRITIQUE | Donnees Assets, Risques, Controles |
| React | Framework | Composants UI |
| Three.js / R3F | 3D Engine | Rendu WebGL |
| Zustand | State | Gestion etat 3D |

| Est requis par | Type | Description |
|----------------|------|-------------|
| European Leader | Feature | Differentiation competitive |
| SCADA/ICS (Epic 14) | Visualisation | Vue IT/OT Voxel mapping |

**Status:** Planifie (documentation complete)

**Pre-requis:** Plateforme SaaS avec donnees Assets/Risques existantes

---

### 4. European Leader Strategy

| Depend de | Type | Description |
|-----------|------|-------------|
| **Plateforme SaaS** | CRITIQUE | Base technique |
| Agent GRC | Feature | Validation endpoint |
| Module Voxel | Feature | Differentiation |
| Multi-framework | Feature | NIS2, DORA, RGPD, AI Act |

| Est requis par | Type | Description |
|----------------|------|-------------|
| Aucun | - | Document strategique transverse |

**Status:** Planifie (PRD strategique)

**Nature:** Pas un module technique mais une roadmap business qui pilote les priorites

---

### 5. EBIOS-RM + ISO27003

| Depend de | Type | Description |
|-----------|------|-------------|
| **Plateforme SaaS** | CRITIQUE | Module Risques existant |
| Module Risques | Integration | Extension methodologie |

| Est requis par | Type | Description |
|----------------|------|-------------|
| Homologation ANSSI | Lien | EBIOS-Homologation link (Story 16.4) |
| Clients Public | Feature | Methodologie ANSSI officielle |

**Status:** Planifie (architecture + epics)

---

### 6. Coffre-fort Documentaire

| Depend de | Type | Description |
|-----------|------|-------------|
| **Plateforme SaaS** | CRITIQUE | Document module existant |
| Firebase Storage | Infrastructure | Stockage fichiers |

| Est requis par | Type | Description |
|----------------|------|-------------|
| Audit Evidence | Feature | Stockage preuves audit |
| Homologation | Feature | Dossiers homologation |

**Status:** Planifie (PRD + architecture + epics)

---

### 7. Voxel Intelligence Engine (OBSOLETE)

**Status:** ARCHIVE - Remplace par Module Voxel 2026-01-22

Voir: `ARCHIVED-voxel-intelligence-engine.md`

---

## Ordre d'Implementation Recommande

### Phase 1 : Fondations (Actuel)

```
1. Plateforme SaaS    [EXISTANT - 47% complete]
   |
   +---> 2. Agent GRC  [EN COURS - Epic 1 done]
```

### Phase 2 : Enrichissement

```
3. Module Voxel       [PLANIFIE - apres donnees SaaS]
   |
   +---> Integration assets/risques
```

### Phase 3 : Modules Metier

```
4. EBIOS-RM           [PLANIFIE]
5. Coffre-fort        [PLANIFIE]
6. DORA ICT (Epic 13) [URGENT - deadline passee]
7. TPRM (Epic 15)     [EN COURS]
8. Homologation ANSSI [EN COURS]
```

### Phase 4 : Verticalisation

```
9. SCADA/ICS (Epic 14)
10. Quantification financiere (Epic 17)
```

---

## Risques de Dependance

| Risque | Niveau | Mitigation |
|--------|--------|------------|
| Agent GRC sans API SaaS | CRITIQUE | Prioriser API endpoints |
| Voxel sans donnees | ELEVE | S'assurer donnees peuplees |
| EBIOS sans module Risques | MOYEN | Module Risques existe |
| Homologation sans EBIOS | MOYEN | Lien optionnel |

---

## APIs Inter-Modules

### API Agent GRC <-> SaaS

| Endpoint | Direction | Description |
|----------|-----------|-------------|
| `/api/agent/register` | Agent -> SaaS | Enregistrement agent |
| `/api/agent/heartbeat` | Agent -> SaaS | Etat periodique |
| `/api/agent/rules` | SaaS -> Agent | Regles de checks |
| `/api/agent/results` | Agent -> SaaS | Resultats checks |
| `/api/agent/config` | SaaS -> Agent | Configuration |

### API Module Voxel <-> SaaS

| Source | Description |
|--------|-------------|
| `assets` collection | Noeuds assets 3D |
| `risks` collection | Noeuds risques 3D |
| `controls` collection | Noeuds controles 3D |
| `relationships` | Arcs connexions 3D |

---

## Changelog

| Date | Version | Modification |
|------|---------|--------------|
| 2026-01-23 | 1.0 | Creation initiale |

---

*Document genere lors de l'audit de coherence du 2026-01-23*
