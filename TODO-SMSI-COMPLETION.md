# TODO - Module SMSI (ISO 27003) - Éléments Manquants

## 📋 Analyse Complète

Le module SMSI est partiellement implémenté. Les Stories 20.1-20.5 sont fonctionnelles, mais les Stories 20.6-20.9 ont des composants manquants ou incomplets.

## ✅ Stories Implémentées (20.1-20.5)
- ✅ Story 20.1: Création programme SMSI
- ✅ Story 20.2: Définition des jalons  
- ✅ Story 20.3: Attribution des responsables
- ✅ Story 20.4: Attribution des responsables
- ✅ Story 20.5: Alertes et rapports automatiques

## ❌ Stories Incomplètes (20.6-20.9)

### Story 20.6 - Workshops Incomplets
- **Workshop 2 (Sensibilisation)**: `Workshop2Content.tsx` **MANQUANT**
  - Devrait contenir : campagnes de formation, simulations phishing, suivi awareness
  - Fonctionnalités manquantes : création de campagnes, tracking des formations

- **Workshop 3 (Audit Interne)**: `Workshop3Content.tsx` **MANQUANT**  
  - Devrait contenir : checklist d'audit, rapports de conformité, planning audits
  - Fonctionnalités manquantes : génération rapports, historique d'audits

- **Workshop 4 (Indicateurs & Métriques)**: `Workshop4Content.tsx` **MANQUANT**
  - Devrait contenir : tableaux de bord, KPIs sécurité, indicateurs de performance
  - Fonctionnalités manquantes : dashboards métriques, export rapports

### Story 20.7 - Workshops Incomplets  
- **Workshop 5 (Traitement du Risque)**: Partiellement implémenté
  - ✅ Composant présent : `Workshop5Content.tsx`
  - ❌ **Fonctionnalités manquantes** :
    - Calcul automatique du risque résiduel
    - Workflow d'acceptation formelle des risques
    - Matrice de criticité
    - Plans de traitement personnalisés

### Story 20.8 - Rapports & Certification
- ✅ Rapport de progression implémenté
- ❌ **Fonctionnalités manquantes** :
  - Rapport final de certification SMSI
  - Génération automatique du rapport d'audit
  - Export multi-formats (PDF, Excel)
  - Préparation audit externe

### Story 20.9 - Amélioration Continue
- ❌ **Fonctionnalités manquantes** :
  - Tableau de bord de maturité SMSI
  - Recommandations automatiques d'amélioration
  - Historique des versions du programme
  - Benchmarking vs standards ANSSI

## 🎯 Priorités de Développement

### **Phase 1 - Complétions Critiques (1-2 semaines)**
1. **Créer les 3 composants manquants** :
   - `Workshop2Content.tsx` - Sensibilisation
   - `Workshop3Content.tsx` - Audit Interne  
   - `Workshop4Content.tsx` - Indicateurs & Métriques

2. **Compléter Workshop 5** :
   - Ajouter le calcul de risque résiduel
   - Implémenter le workflow d'acceptation
   - Ajouter la matrice de criticité

3. **Finaliser Story 20.8** :
   - Rapport de certification SMSI
   - Export multi-formats
   - Préparation audit externe

### **Phase 2 - Améliorations (3-4 semaines)**
1. **Tableau de bord SMSI** :
   - Indicateurs de maturité
   - Recommandations auto
   - Historique versions

2. **Intégrations** :
   - Lien avec module Suppliers pour les fournisseurs de services SMSI
   - Lien avec module Risks pour les risques liés
   - Notifications automatiques

## 🛠️ Tests à Implémenter

- Tests unitaires pour chaque composant workshop
- Tests d'intégration E2E entre workshops
- Tests de workflow de traitement des risques
- Tests de génération de rapports

## 📁 Fichiers à Créer

```
src/components/ebios/workshops/
├── Workshop2Content.tsx          # À créer
├── Workshop3Content.tsx          # À créer  
├── Workshop4Content.tsx          # À créer
└── Workshop5Content.tsx          # À compléter

src/services/ebiosService.ts
└── Ajouter méthodes de calcul de risque

src/types/ebios.ts
└── Ajouter types pour traitement des risques
```

## 🔗 Dépendances Existantes

Le module peut réutiliser :
- `EbiosReportService` pour les rapports
- `RiskContext` et `TargetedObjective` pour les données
- Composants UI existants (GlassCard, Badge, etc.)
- Logique de navigation entre workshops déjà présente

## ⚠️ Risques Techniques

- **Complexité** : Les calculs de risque résiduel peuvent être complexes
- **Performance** : Les tableaux de bord nécessitent des requêtes optimisées
- **Cohérence** : Assurer l'uniformité des données entre tous les workshops

---

**Statut actuel** : Module SMSI à ~60% de complétion
**Effort estimé** : 3-4 semaines pour finalisation complète
