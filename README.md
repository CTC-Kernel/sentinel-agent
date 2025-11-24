<div align="center">
<img width="1200" height="475" alt="Sentinel GRC" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Sentinel GRC v2.0

Plateforme professionnelle de gestion de la sécurité des systèmes d'information (SSI) conforme aux normes ISO 27001 et ISO 27005.

## 🎯 Objectifs

- **Gestion des actifs** : Classification, criticité, localisation, maintenance
- **Gestion des risques** : Évaluation selon ISO 27005, plans de traitement
- **Gestion de projet SSI** : Suivi, jalons, responsables, avancement
- **Gestion des audits** : Planification, grilles de vérification, rapports PDF
- **Gestion documentaire** : Versionning, validation, publication
- **Conformité ISO 27001** : Tableaux de bord, SoA automatisé
- **Notifications temps réel** : Alertes persistantes avec Firestore
- **RBAC avancé** : Contrôle d'accès granulaire par rôle/ressource/action

## 🚀 Démarrage rapide

### Prérequis
- Node.js 18+
- Firebase projet configuré
- Navigateur moderne

### Installation

```bash
# Cloner le projet
git clone <repository-url>
cd sentinel-grc-v2-prod

# Installer les dépendances
npm install

# Configurer Firebase
cp .env.example .env.local
# Éditer .env.local avec vos clés Firebase

# Démarrer l'application
npm run dev
```

### Variables d'environnement

```env
VITE_FIREBASE_API_KEY=votre_api_key
VITE_FIREBASE_AUTH_DOMAIN=votre_domaine
VITE_FIREBASE_PROJECT_ID=votre_projet_id
VITE_FIREBASE_STORAGE_BUCKET=votre_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=votre_sender_id
VITE_FIREBASE_APP_ID=votre_app_id
```

## 🧪 Tests

L'application inclut une suite complète de tests unitaires avec Vitest :

```bash
# Lancer tous les tests
npm test

# Tests avec UI
npm run test:ui

# Couverture de code
npm run test:coverage
```

### Tests inclus (63 tests)
- **Permissions** : RBAC, rôles, validation d'accès
- **Notifications** : Service temps réel, persistence Firestore
- **Store** : État global, thème, toasts
- **Logger** : Traçabilité des actions
- **Calendar** : Génération ICS
- **Form Validation** : Validation assets et risques

## 🏗️ Architecture

### Frontend
- **React 18** avec TypeScript
- **Vite** pour le build
- **TailwindCSS** pour le style
- **Zustand** pour l'état global
- **React Router** pour la navigation

### Backend
- **Firebase Firestore** : Base de données
- **Firebase Auth** : Authentification
- **Firebase Storage** : Fichiers
- **Firebase Functions** : Backend serverless

### Sécurité
- **RBAC** : 6 rôles (admin, rssi, auditor, project_manager, direction, user)
- **Permissions granulaires** : Matrice ressource/action
- **Validation stricte** : Types TypeScript, validation formulaire
- **Audit trail** : Journalisation complète des actions

## 📋 Modules fonctionnels

### 1. Gestion des actifs
- **CRUD complet** : Création, lecture, mise à jour, suppression
- **Classification** : Matériel, Logiciel, Données, Service, Humain
- **Criticité** : Confidentialité, Intégrité, Disponibilité
- **Suivi** : Maintenance, amortissement, garantie
- **Import/Export** : CSV avec validation

### 2. Gestion des risques
- **Évaluation ISO 27005** : Menaces, vulnérabilités, probabilité, impact
- **Calcul automatique** : Score de risque (probabilité × impact)
- **Traitement** : Accepter, Atténuer, Transférer, Éviter
- **Historisation** : Suivi des modifications
- **Matrice visuelle** : Heatmap des risques

### 3. Gestion de projet SSI
- **Planning** : Jalons, échéances, responsables
- **Suivi** : Avancement, tâches, commentaires
- **Liens** : Association automatique avec actifs, risques, contrôles
- **Export** : PDF, CSV, calendrier ICS

### 4. Gestion des audits
- **Planification** : Audits internes/externes
- **Checklists** : Grilles conformes ISO 27001
- **Collecte** : Preuves, questionnaires
- **Rapports** : Génération PDF automatique
- **Historique** : Traçabilité complète

### 5. Gestion documentaire
- **Workflow** : Brouillon → Revue → Approbation → Publication
- **Versionning** : Contrôle des versions
- **Signatures** : Validation électronique
- **Liens** : Association avec contrôles, actifs, audits
- **Stockage** : Firebase Storage sécurisé

### 6. Conformité ISO 27001
- **Tableaux de bord** : État par annexe A
- **Contrôles** : Suivi d'implémentation
- **SoA** : Statement of Applicability automatisé
- **Preuves** : Collecte et association
- **Rapports** : Conformité et écarts

## 🔐 Rôles et permissions

| Rôle | Description | Permissions principales |
|------|-------------|------------------------|
| **Admin** | Administrateur système | Accès complet à tout |
| **RSSI** | Responsable sécurité | Gestion risques, actifs, projets, audits, documents |
| **Auditeur** | Auditeur interne/externe | Gestion audits, documents (lecture/écriture), consultation |
| **Chef de Projet** | Project Manager | Gestion projets, documents (lecture/écriture), consultation |
| **Direction** | Direction | Lecture seule sur tous les modules |
| **Utilisateur** | Utilisateur métier | Lecture limitée (documents, actifs) |

## 📊 Notifications temps réel

- **Persistence** : Stockage Firestore
- **Types** : Success, Error, Info, Warning
- **Automatisation** : Checks périodiques (audits, documents, maintenance, risques)
- **Marquage** : Lu/non lu avec synchronisation
- **Filtrage** : Par utilisateur, organisation, type

## 🎨 Personnalisation

- **Thème** : Clair/Sombre avec persistance
- **Langue** : Français (prévu multilingue)
- **Préférences** : Notifications, affichage
- **Export** : Formats personnalisables

## 📈 Monitoring et logs

- **Actions utilisateur** : Traçabilité complète
- **Erreurs** : Capture et logging
- **Performance** : Monitoring des temps de réponse
- **Sécurité** : Journalisation des accès

## 🔧 Déploiement

### Build de production

```bash
# Build optimisé
npm run build

# Preview local
npm run preview

# Déploiement (exemple Firebase Hosting)
firebase deploy --only hosting
```

### Configuration CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: votre-projet-id
```

## 🤝 Contribuer

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/amazing-feature`)
3. Commiter les changements (`git commit -m 'Add amazing feature'`)
4. Pusher la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📝 Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour les détails.

## 🆘 Support

Pour toute question ou support :
- Documentation complète : [USER_GUIDE.md](USER_GUIDE.md)
- Issues GitHub : [Issues](https://github.com/votre-repo/issues)
- Contact : [votre-email@exemple.com]

---

**Sentinel GRC v2.0** - La sécurité au cœur de votre transformation digitale
