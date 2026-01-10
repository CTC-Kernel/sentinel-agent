---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
inputDocuments: ['_bmad-output/planning-artifacts/prd.md', '_bmad-output/planning-artifacts/research/comprehensive-grc-research-2026-01-10.md', '_bmad-output/analysis/brainstorming-session-2026-01-10.md']
workflowType: 'ux-design'
lastStep: 14
workflow_completed: true
---

# UX Design Specification - Sentinel-GRC

**Author:** Thibaultllopis
**Date:** 2026-01-10

---

## Executive Summary

### Project Vision

Sentinel-GRC vise à devenir la référence UX dans le domaine GRC européen. Contrairement aux solutions américaines techniques (Vanta, Drata), Sentinel-GRC cible les **non-experts** avec une expérience **Apple-like**: simple, intuitive, professionnelle.

**Ambition UX clé:** "Je vois exactement ce dont j'ai besoin" dès le premier login.

**Contexte produit:**
- Application SaaS multi-tenant existante (brownfield)
- 14 modules fonctionnels, 377 composants React
- Stack: React 19 + Firebase + TypeScript
- Multi-framework: ISO 27001, NIS2, DORA, RGPD

### Target Users

#### Personas Primaires

| Persona | Rôle | Besoin UX Principal | Niveau Tech |
|---------|------|---------------------|-------------|
| **Philippe** | Dirigeant/CEO | Score synthétique, 0 jargon | Faible |
| **Sarah** | RSSI | Vue opérationnelle, multi-framework | Élevé |
| **Marc** | Auditeur externe | Preuves organisées, efficacité | Moyen |
| **Julie** | Project Manager | Suivi avancement, coordination | Moyen |

#### Personas Secondaires

| Persona | Rôle | Besoin UX Principal | Niveau Tech |
|---------|------|---------------------|-------------|
| **Thomas** | Admin tenant | Configuration simple, gestion users | Élevé |
| **Emma** | Support CTC | Diagnostic rapide, accès limité | Élevé |

### Key Design Challenges

1. **Complexité vs Simplicité** - Progressive disclosure, dashboards par rôle
2. **Validation Formulaires** - Config locale centralisée, mode brouillon, validation live
3. **Personnalisation par Rôle** - Dashboards configurables, widgets pertinents
4. **Onboarding Conformité** - Wizard SMSI guidé pas-à-pas

---

## Core User Experience

### Experience Principles

1. **"Clarity Over Completeness"** - L'essentiel d'abord, les détails à la demande
2. **"Save Everything Automatically"** - Jamais de perte de travail
3. **"Role-First Navigation"** - L'interface s'adapte au rôle
4. **"Feedback Is Instant"** - Chaque action a une réponse visuelle
5. **"Guide, Don't Block"** - Aider à réussir, pas empêcher d'avancer

### Core Loop

1. **Consulter** - Voir l'état actuel (dashboard)
2. **Agir** - Traiter un item (risque, action, preuve)
3. **Valider** - Confirmer la progression (score augmente)
4. **Répéter** - Retour au dashboard, cycle suivant

---

## Emotional Response

### Desired Emotional Outcomes

| Moment | Émotion Cible | Design Trigger |
|--------|---------------|----------------|
| Premier login | Confiance, clarté | Dashboard épuré, score visible |
| Création réussie | Satisfaction, progression | Animation positive, feedback |
| Erreur de validation | Guidance, pas frustration | Message clair, suggestion fix |
| Audit ready | Fierté, confiance | Checklist complète, félicitations |
| Score up | Accomplissement | Animation célébration subtile |

### Emotional Design Principles

- **Confiance:** Interface professionnelle, pas de surprise
- **Contrôle:** L'utilisateur décide du rythme, jamais bloqué
- **Progression:** Visualisation constante de l'avancement
- **Reconnaissance:** Célébration des accomplissements

---

## Design Inspiration

### Références Visuelles

| Produit | Ce qu'on emprunte | Application |
|---------|-------------------|-------------|
| **Apple Health** | Score circulaire, tendance | Dashboard score global |
| **Linear** | Navigation sidebar, shortcuts | Module navigation |
| **Notion** | Blocs modulaires | Rapports personnalisables |
| **Stripe** | Clarté data, tableaux élégants | Listes et détails |
| **Figma** | Collaboration temps réel | Commentaires, mentions |

### Anti-Patterns à Éviter

- ❌ Dashboards surchargés (Jira)
- ❌ Menus profonds >3 niveaux (SAP)
- ❌ Formulaires interminables (legacy GRC)
- ❌ Messages d'erreur techniques (Oracle)

---

## Design System

### Color Palette

**Primary Colors:**
- `--primary-500`: #2563EB (Blue - action, liens)
- `--primary-600`: #1D4ED8 (Blue dark - hover)
- `--primary-100`: #DBEAFE (Blue light - backgrounds)

**Semantic Colors:**
- `--success-500`: #10B981 (Green - conformité OK)
- `--warning-500`: #F59E0B (Orange - attention)
- `--error-500`: #EF4444 (Red - critique)
- `--info-500`: #3B82F6 (Blue - information)

**Neutral Colors:**
- `--gray-900`: #111827 (Text primary)
- `--gray-600`: #4B5563 (Text secondary)
- `--gray-100`: #F3F4F6 (Background)
- `--white`: #FFFFFF (Cards, surfaces)

### Typography

**Font Family:** Inter (Google Fonts)

| Usage | Size | Weight | Line Height |
|-------|------|--------|-------------|
| H1 | 30px | 700 | 36px |
| H2 | 24px | 600 | 32px |
| H3 | 20px | 600 | 28px |
| Body | 16px | 400 | 24px |
| Small | 14px | 400 | 20px |
| Caption | 12px | 500 | 16px |

### Spacing System

Base unit: 4px

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Inline spacing |
| `--space-2` | 8px | Tight spacing |
| `--space-3` | 12px | Default padding |
| `--space-4` | 16px | Card padding |
| `--space-6` | 24px | Section spacing |
| `--space-8` | 32px | Large gaps |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Buttons, inputs |
| `--radius-md` | 8px | Cards, modals |
| `--radius-lg` | 12px | Large containers |
| `--radius-full` | 9999px | Pills, avatars |

### Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | 0 1px 2px rgba(0,0,0,0.05) | Subtle elevation |
| `--shadow-md` | 0 4px 6px rgba(0,0,0,0.1) | Cards |
| `--shadow-lg` | 0 10px 15px rgba(0,0,0,0.1) | Modals, dropdowns |

---

## Visual Foundation

### Layout Structure

**Desktop (1440px+):**
```
┌─────────────────────────────────────────┐
│ Header (Score | Search | User)    64px  │
├────────┬────────────────────────────────┤
│        │                                │
│ Sidebar│      Main Content Area         │
│  240px │         Fluid width            │
│        │                                │
│        │                                │
└────────┴────────────────────────────────┘
```

**Tablet (768px-1439px):**
- Sidebar collapsible (icons only)
- Content full width

**Mobile (< 768px):**
- Bottom navigation
- Hamburger menu for full nav

### Grid System

- 12 columns
- Gutter: 24px
- Max content width: 1200px

---

## Design Directions

### Direction Retenue: "Professional Clarity"

**Caractéristiques:**
- Clean, spacieux, professionnel
- Couleurs sobres avec accents de couleur
- Typographie lisible et hiérarchisée
- Iconographie simple et cohérente

**Justification:**
- Cible enterprise B2B = besoin de crédibilité
- Non-techniciens = simplicité visuelle
- Ambition Apple-like = épuré et premium

---

## User Journeys UX

### Journey 1: Philippe (Dirigeant) - Check Hebdomadaire

```
Login → Dashboard Dirigeant → Score Global →
[Si alerte] Clic détail → Lecture résumé → Logout
```

**Durée cible:** <5 minutes
**Clics max:** 3

### Journey 2: Sarah (RSSI) - Création Risque

```
Login → Dashboard RSSI → "Nouveau Risque" →
Wizard Étape 1 (Identification) → Étape 2 (Évaluation) →
Étape 3 (Traitement) → Validation → Retour liste
```

**Durée cible:** <10 minutes
**Validation:** Live, non-bloquante

### Journey 3: Marc (Auditeur) - Vérification Audit

```
Email invitation → Portail Auditeur (login limité) →
Checklist domaine → Clic contrôle → Vue preuves →
Annoter/Valider → Contrôle suivant → Export rapport
```

**Durée cible:** Audit complet en 2 jours vs 3

---

## Component Strategy

### Core Components

| Composant | Usage | Variantes |
|-----------|-------|-----------|
| **Button** | Actions primaires/secondaires | Primary, Secondary, Ghost, Danger |
| **Card** | Container d'information | Default, Interactive, Elevated |
| **Input** | Saisie utilisateur | Text, Date, Select, Textarea |
| **Table** | Listes de données | Simple, Sortable, Selectable |
| **Modal** | Overlay d'action | Dialog, Confirmation, Form |
| **Toast** | Notifications | Success, Error, Warning, Info |
| **Badge** | Statuts, compteurs | Status, Count, Label |
| **Avatar** | Identité utilisateur | Image, Initials, Icon |

### Feature Components

| Composant | Usage | Notes |
|-----------|-------|-------|
| **ScoreGauge** | Score global type Apple Health | Animé, couleur selon niveau |
| **RiskCard** | Affichage risque | Actions inline, statut badge |
| **AuditChecklist** | Progression audit | Cochable, preuves liées |
| **WizardStepper** | Formulaires multi-étapes | Progress visible, navigation |
| **DashboardWidget** | Blocs dashboard | Configurable, drag & drop |
| **NotificationBell** | Alertes header | Badge count, dropdown |

---

## UX Patterns

### Navigation Patterns

**Sidebar Navigation:**
- Icônes + labels
- Collapse sur mobile
- Indicateur page active
- Compteurs sur items (ex: 3 risques critiques)

**Breadcrumbs:**
- Toujours visible sur les pages de détail
- Cliquable pour remonter
- Max 3 niveaux affichés

**Search Global:**
- Cmd+K / Ctrl+K shortcut
- Résultats groupés par type
- Recherche récente mémorisée

### Form Patterns

**Validation:**
- Live validation (onChange)
- Messages d'erreur sous le champ
- Icônes de statut (check, warning)
- Bouton submit actif uniquement si valide (mais non-bloquant)

**Auto-save:**
- Indicateur "Saving..." / "Saved"
- Badge "Draft" si non-publié
- Confirmation avant quitter si non-sauvé

**Wizard Multi-étapes:**
- Stepper horizontal en haut
- Étape courante mise en évidence
- Navigation retour possible
- Résumé avant validation finale

### Feedback Patterns

**Loading States:**
- Skeleton pour contenus
- Spinner pour actions
- Progress bar pour uploads

**Success States:**
- Toast notification (3s)
- Animation checkmark
- Redirection appropriée

**Error States:**
- Message clair et actionnable
- Suggestion de résolution
- Retry possible

---

## Responsive & Accessibility

### Breakpoints

| Name | Width | Target |
|------|-------|--------|
| `mobile` | < 768px | Smartphones |
| `tablet` | 768px - 1023px | Tablets portrait |
| `desktop` | 1024px - 1439px | Laptops |
| `large` | ≥ 1440px | Desktops |

### Responsive Behavior

| Component | Mobile | Tablet | Desktop |
|-----------|--------|--------|---------|
| Sidebar | Bottom nav | Collapsed | Full |
| Tables | Card stack | Horizontal scroll | Full |
| Dashboards | Single column | 2 columns | Multi-widget |
| Forms | Full width | 2 columns | Sidebar preview |

### Accessibility Requirements (WCAG 2.1 AA)

**Color & Contrast:**
- Contrast ratio ≥ 4.5:1 pour texte
- Ne pas utiliser couleur seule pour l'information
- Mode focus visible sur tous les interactifs

**Keyboard Navigation:**
- Tab order logique
- Skip to content link
- Shortcuts documentés
- Focus trap dans modals

**Screen Readers:**
- Labels ARIA sur tous les formulaires
- Alt text sur images significatives
- Live regions pour notifications
- Headings hiérarchiques

**Motion:**
- Respect prefers-reduced-motion
- Animations désactivables
- Pas de clignotement >3Hz

---

## Implementation Priorities

### Phase 1: Quick Wins

| Composant | Impact | Effort |
|-----------|--------|--------|
| Config locale FR/EN | Fix bugs validation | Faible |
| Messages erreur humanisés | UX immédiate | Faible |
| Auto-save formulaires | Zero perte données | Moyen |

### Phase 2: Core Experience

| Composant | Impact | Effort |
|-----------|--------|--------|
| Score global Apple Health | Différenciation | Moyen |
| Dashboard par rôle | Personnalisation | Moyen |
| Validation live | UX fluide | Moyen |

### Phase 3: Advanced Features

| Composant | Impact | Effort |
|-----------|--------|--------|
| Wizard SMSI | Innovation majeure | Élevé |
| Widgets configurables | Power users | Élevé |
| Recherche globale | Productivité | Moyen |

---

## Success Metrics

| Métrique | Baseline | Cible | Mesure |
|----------|----------|-------|--------|
| Time to first value | >1h | <30min | Analytics |
| Erreurs validation | Multiple/jour | 0 | Error tracking |
| NPS | Non mesuré | >50 | Survey |
| Temps prise en main | Variable | -50% | User testing |
| Taux completion formulaire | ~70% | >90% | Analytics |

---

*UX Design Specification générée par BMad Method - Create UX Design Workflow*
*Date: 2026-01-10*
