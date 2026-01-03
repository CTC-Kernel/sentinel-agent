// Tutoriels prédéfinis pour le centre d'aide
export const TUTORIALS_DATA = [
  {
    id: 'first-asset',
    title: 'Créer mon premier actif',
    description: 'Apprenez à créer et configurer votre premier actif dans Sentinel GRC',
    duration: '10 minutes',
    difficulty: 'Débutant' as const,
    audience: 'Tous les utilisateurs',
    steps: [
      {
        title: 'Accéder au module Actifs',
        description: 'Cliquez sur "Actifs" dans le menu de navigation pour accéder à la gestion du patrimoine.',
        action: 'Ouvrir les Actifs'
      },
      {
        title: 'Créer un nouvel actif',
        description: 'Cliquez sur le bouton "Nouvel Actif" pour démarrer la création.',
        action: 'Créer un actif'
      },
      {
        title: 'Remplir les informations',
        description: 'Complétez le formulaire avec le nom, type, propriétaire et criticité de votre actif.',
        action: 'Remplir le formulaire'
      },
      {
        title: 'Associer des contrôles',
        description: 'LieZ votre actif aux contrôles de sécurité pertinents pour sa protection.',
        action: 'Ajouter des contrôles'
      },
      {
        title: 'Valider et enregistrer',
        description: 'Vérifiez toutes les informations et enregistrez votre actif.',
        action: 'Enregistrer l\'actif'
      }
    ]
  },
  {
    id: 'first-risk',
    title: 'Analyser mon premier risque',
    description: 'Maîtrisez l\'analyse de risques avec la méthodologie EBIOS RM',
    duration: '15 minutes',
    difficulty: 'Intermédiaire' as const,
    audience: 'RSSI, Risk Managers',
    steps: [
      {
        title: 'Accéder au module Risques',
        description: 'Naviguez vers le module Risques depuis le tableau de bord.',
        action: 'Ouvrir les Risques'
      },
      {
        title: 'Démarrer une nouvelle analyse',
        description: 'Cliquez sur "Nouvelle Analyse" pour commencer votre évaluation.',
        action: 'Nouvelle analyse'
      },
      {
        title: 'Définir le périmètre',
        description: 'Sélectionnez les actifs et le contexte de votre analyse.',
        action: 'Définir le périmètre'
      },
      {
        title: 'Identifier les menaces',
        description: 'Listez les menaces potentielles pour votre périmètre.',
        action: 'Ajouter des menaces'
      },
      {
        title: 'Évaluer la probabilité',
        description: 'Évaluez la probabilité d\'occurrence de chaque menace.',
        action: 'Évaluer les probabilités'
      },
      {
        title: 'Calculer l\'impact',
        description: 'Déterminez l\'impact potentiel sur votre organisation.',
        action: 'Calculer les impacts'
      },
      {
        title: 'Définir la stratégie',
        description: 'Choisissez la stratégie de traitement pour chaque risque.',
        action: 'Définir les stratégies'
      }
    ]
  },
  {
    id: 'compliance-setup',
    title: 'Mettre en place la conformité ISO 27001',
    description: 'Configurez votre cadre de conformité et générez votre SoA',
    duration: '20 minutes',
    difficulty: 'Avancé' as const,
    audience: 'RSSI, Compliance Managers',
    steps: [
      {
        title: 'Accéder à la conformité',
        description: 'Ouvrez le module Conformité depuis le menu principal.',
        action: 'Ouvrir la Conformité'
      },
      {
        title: 'Sélectionner le cadre',
        description: 'Choisissez ISO 27001 comme cadre normatif.',
        action: 'Sélectionner ISO 27001'
      },
      {
        title: 'Analyser les contrôles',
        description: 'Passez en revue les 93 contrôles de l\'annexe A.',
        action: 'Voir les contrôles'
      },
      {
        title: 'Évaluer l\'applicabilité',
        description: 'Déterminez quels contrôles s\'appliquent à votre contexte.',
        action: 'Évaluer l\'applicabilité'
      },
      {
        title: 'Documenter l\'implémentation',
        description: 'Documentez l\'implémentation de chaque contrôle applicable.',
        action: 'Implémenter les contrôles'
      },
      {
        title: 'Ajouter les preuves',
        description: 'Upload les documents et preuves d\'implémentation.',
        action: 'Ajouter des preuves'
      },
      {
        title: 'Générer le SoA',
        description: 'Générez votre Statement of Applicabilité pour certification.',
        action: 'Générer le SoA'
      }
    ]
  },
  {
    id: 'incident-response',
    title: 'Gérer un incident de sécurité',
    description: 'Apprenez à déclarer et traiter un incident selon les meilleures pratiques',
    duration: '12 minutes',
    difficulty: 'Intermédiaire' as const,
    audience: 'CSIRT, Security Teams',
    steps: [
      {
        title: 'Accéder aux incidents',
        description: 'Ouvrez le module Incidents depuis le menu.',
        action: 'Ouvrir les Incidents'
      },
      {
        title: 'Déclarer l\'incident',
        description: 'Cliquez sur "Nouvel Incident" pour commencer la déclaration.',
        action: 'Déclarer un incident'
      },
      {
        title: 'Qualifier l\'incident',
        description: 'Définissez le type, la criticité et l\'impact initial.',
        action: 'Qualifier l\'incident'
      },
      {
        title: 'Activer le playbook',
        description: 'Sélectionnez le playbook de réponse approprié.',
        action: 'Activer le playbook'
      },
      {
        title: 'Documenter les actions',
        description: 'Suivez le playbook et documentez chaque action.',
        action: 'Documenter les actions'
      },
      {
        title: 'Communiquer',
        description: 'Informez les parties prenantes selon le plan de communication.',
        action: 'Communiquer'
      }
    ]
  }
];
