
export interface RiskTemplate {
 name: string;
 description: string;
 field: string;
 scenario: string;
 threat: string;
 vulnerability: string;
 probability: number;
 impact: number;
 strategy: 'Accepter' | 'Éviter' | 'Transférer' | 'Atténuer';
 framework: string;
 treatment?: {
 strategy: 'Accepter' | 'Éviter' | 'Transférer' | 'Atténuer';
 description: string;
 status: 'Planifié' | 'En cours' | 'Terminé' | 'Annulé';
 estimatedCost: number;
 dueDate: string;
 };
}

export const RISK_TEMPLATES: RiskTemplate[] = [
 // --- ISO 27005 (Gestion des Risques Généraux) ---
 {
 name: 'Ransomware / Extorsion',
 description: 'Chiffrement des données par un logiciel malveillant avec demande de rançon.',
 field: 'Cybercriminalité',
 scenario: 'Un attaquant s\'introduit dans le SI via un accès distant compromis (RDP/VPN), élève ses privilèges, exfiltre des données sensibles puis déploie un ransomware sur les serveurs critiques.',
 threat: 'Logiciel malveillant / Ransomware',
 vulnerability: 'Absence d\'authentification forte (MFA) sur les accès distants et correctifs de sécurité manquants.',
 probability: 4, impact: 5, strategy: 'Atténuer',
 framework: 'ISO27005',
 treatment: {
 strategy: 'Atténuer',
 description: 'Déploiement MFA généralisé, politique de patch management stricte, sauvegarde immuable déconnectée.',
 status: 'Planifié',
 estimatedCost: 15000,
 dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()
 }
 },
 {
 name: 'Fuite de Données Clients',
 description: 'Exposition accidentelle ou malveillante de la base client.',
 field: 'Confidentialité',
 scenario: 'Un bucket S3 ou une base de données est mal configuré(e) et accessible publiquement sur Internet, permettant à un tiers de télécharger l\'intégralité des données personnelles.',
 threat: 'Erreur de configuration / Divulgation',
 vulnerability: 'Absence de revue de configuration cloud et de processus de validation des changements.',
 probability: 3, impact: 5, strategy: 'Atténuer',
 framework: 'ISO27005',
 treatment: {
 strategy: 'Atténuer',
 description: 'Audit de configuration Cloud automatisé (CSPM), chiffrement des bases de données, revue des droits d\'accès.',
 status: 'Planifié',
 estimatedCost: 5000,
 dueDate: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString()
 }
 },
 {
 name: 'Perte d\'accès aux locaux (Incendie/Dégât des eaux)',
 description: 'Indisponibilité des bureaux ou du datacenter suite à un sinistre physique.',
 field: 'Disponibilité',
 scenario: 'Un incendie se déclare dans le datacenter principal ou les bureaux, rendant les serveurs physiques et les postes de travail inaccessibles et détruisant le matériel.',
 threat: 'Sinistre physique majeur',
 vulnerability: 'Infrastructure hébergée sur site unique sans redondance géographique.',
 probability: 2, impact: 5, strategy: 'Atténuer',
 framework: 'ISO27005',
 treatment: {
 strategy: 'Atténuer',
 description: 'Mise en place d\'un PRA (Plan de Reprise d\'Activité) avec réplication des données sur un site distant ou Cloud.',
 status: 'En cours',
 estimatedCost: 50000,
 dueDate: new Date(new Date().setMonth(new Date().getMonth() + 6)).toISOString()
 }
 },
 {
 name: 'Vol de matériel portable',
 description: 'Perte ou vol d\'un ordinateur portable contenant des données sensibles.',
 field: 'Matériel',
 scenario: 'Un ordinateur portable de la direction est volé lors d\'un déplacement. Le disque dur n\'est pas chiffré, permettant au voleur d\'accéder aux documents confidentiels.',
 threat: 'Vol d\'équipement',
 vulnerability: 'Absence de chiffrement intégral du disque (BitLocker/FileVault) sur la flotte mobile.',
 probability: 3, impact: 4, strategy: 'Atténuer',
 framework: 'ISO27005',
 treatment: {
 strategy: 'Atténuer',
 description: 'Activation centralisée du chiffrement des disques et mise en place d\'une solution MDM pour l\'effacement à distance.',
 status: 'Terminé',
 estimatedCost: 2000,
 dueDate: new Date().toISOString()
 }
 },
 {
 name: 'Ingénierie Sociale / Fraude au Président',
 description: 'Manipulation psychologique pour obtenir un virement ou des accès.',
 field: 'Humain',
 scenario: 'Le service comptable reçoit un email urgent semblant provenir du CEO demandant un virement confidentiel immédiat vers un compte étranger.',
 threat: 'Fraude / Ingénierie Sociale',
 vulnerability: 'Manque de sensibilisation du personnel et absence de procédure de validation des virements hors processus.',
 probability: 4, impact: 4, strategy: 'Atténuer',
 framework: 'ISO27005',
 treatment: {
 strategy: 'Atténuer',
 description: 'Campagnes de sensibilisation phishing régulières, procédure de double validation pour les virements > 1k€.',
 status: 'Planifié',
 estimatedCost: 3000,
 dueDate: new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString()
 }
 },

 // --- NIS 2 (Directive Network and Information Security) ---
 {
 name: 'Défaillance d\'un prestataire critique',
 description: 'Interruption de service due à une défaillance de la Chaîne d\'Approvisionnement.',
 field: 'Supply Chain',
 scenario: 'Un fournisseur de services managés (MSP) subit une cyberattaque, coupant l\'accès aux services informatiques gérés pour l\'entité essentielle.',
 threat: 'Défaillance Tiers',
 vulnerability: 'Dépendance forte à un fournisseur unique sans clause de continuité ou solution de repli.',
 probability: 3, impact: 5, strategy: 'Atténuer',
 framework: 'NIS2',
 treatment: {
 strategy: 'Atténuer',
 description: 'Audit de sécurité des fournisseurs, clauses contractuelles de SLA/PRA, stratégie multi-fournisseurs.',
 status: 'En cours',
 estimatedCost: 12000,
 dueDate: new Date(new Date().setMonth(new Date().getMonth() + 4)).toISOString()
 }
 },
 {
 name: 'Non-notification d\'incident majeur',
 description: 'Manquement à l\'obligation de signaler un incident à l\'ANSSI sous 24h.',
 field: 'Conformité / Légal',
 scenario: 'Un incident critique survient un vendredi soir. Faute de procédure d\'astreinte claire, l\'incident n\'est qualifié et notifié que le lundi, exposant l\'entité à des sanctions.',
 threat: 'Non-conformité réglementaire',
 vulnerability: 'Processus de gestion des incidents inadapté aux exigences de délais NIS 2.',
 probability: 3, impact: 4, strategy: 'Atténuer',
 framework: 'NIS2',
 treatment: {
 strategy: 'Atténuer',
 description: 'Mise à jour de la PSSI Gestion des Incidents, mise en place d\'une astreinte décisionnelle, exercices de crise.',
 status: 'Planifié',
 estimatedCost: 8000,
 dueDate: new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString()
 }
 },
 {
 name: 'Compromission réseau industriel (OT)',
 description: 'Attaque naviguant de l\'IT vers l\'OT impactant la production.',
 field: 'Industriel / OT',
 scenario: 'Un malware infecte le réseau bureautique et profite d\'une passerelle mal sécurisée pour se propager au réseau de production (SCADA), arrêtant les chaînes de montage.',
 threat: 'Pivot IT/OT',
 vulnerability: 'Segmentation réseau insuffisante entre l\'IT (bureautique) et l\'OT (industriel).',
 probability: 3, impact: 5, strategy: 'Atténuer',
 framework: 'NIS2',
 treatment: {
 strategy: 'Atténuer',
 description: 'Segmentation réseau stricte (DMZ, Firewalls industriels), sondes de détection passives sur le réseau OT.',
 status: 'Planifié',
 estimatedCost: 40000,
 dueDate: new Date(new Date().setMonth(new Date().getMonth() + 9)).toISOString()
 }
 },

 // --- DORA (Digital Operational Resilience Act) ---
 {
 name: 'Concentration de risque prestataire TIC',
 description: 'Dépendance critique à un fournisseur cloud unique.',
 field: 'Risque Tiers (ICT)',
 scenario: 'L\'institution financière dépend à 100% d\'AWS pour son Core Banking. Une panne région majeure chez AWS paralyse l\'activité financière sans bascule possible.',
 threat: 'Risque de concentration',
 vulnerability: 'Architecture Cloud non-agnostique et absence de stratégie multi-cloud ou sortie.',
 probability: 2, impact: 5, strategy: 'Atténuer',
 framework: 'DORA',
 treatment: {
 strategy: 'Atténuer',
 description: 'Définition d\'une stratégie de sortie (Exit Strategy), conteneurisation des applications pour portabilité.',
 status: 'En cours',
 estimatedCost: 25000,
 dueDate: new Date(new Date().setMonth(new Date().getMonth() + 12)).toISOString()
 }
 },
 {
 name: 'Échec des tests de résilience',
 description: 'Incapacité à récupérer les systèmes dans les délais lors d\'un test.',
 field: 'Résilience Opérationnelle',
 scenario: 'Lors du test annuel de TLPT (Threat Led Penetration Testing), l\'équipe bleue ne détecte pas l\'intrusion et le plan de récupération échoue à restaurer les données intègres.',
 threat: 'Défaillance des processus de réponse',
 vulnerability: 'Scénarios de tests trop statiques et manque d\'entraînement des équipes SOC/CERT.',
 probability: 3, impact: 4, strategy: 'Atténuer',
 framework: 'DORA',
 treatment: {
 strategy: 'Atténuer',
 description: 'Mise en place de tests Red Teaming réguliers, amélioration des playbooks de réponse incidents.',
 status: 'Planifié',
 estimatedCost: 20000,
 dueDate: new Date(new Date().setMonth(new Date().getMonth() + 6)).toISOString()
 }
 },

 // --- GDPR (RGPD) ---
 {
 name: 'Traitement illicite de données personnelles',
 description: 'Collecte de données sans base légale ou consentement.',
 field: 'Juridique / Privacy',
 scenario: 'Le service marketing collecte des données de géolocalisation via l\'application mobile sans consentement explicite ni mention dans la politique de confidentialité.',
 threat: 'Non-respect des droits des personnes',
 vulnerability: 'Absence de Privacy by Design dans les projets et de revue DPO avant mise en production.',
 probability: 4, impact: 4, strategy: 'Atténuer',
 framework: 'GDPR',
 treatment: {
 strategy: 'Atténuer',
 description: 'Intégration systématique du DPO dans les jalons projets (PIA/AIPD), mise à jour de la CMP (Consent Management Platform).',
 status: 'En cours',
 estimatedCost: 5000,
 dueDate: new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString()
 }
 },
 {
 name: 'Non-respect du droit à l\'oubli',
 description: 'Incapacité à supprimer toutes les données d\'un utilisateur.',
 field: 'Juridique / Technique',
 scenario: 'Un client demande la suppression de ses données. Elles sont supprimées du CRM mais persistent dans les sauvegardes et les fichiers Excel d\'export locaux.',
 threat: 'Conservation excessive des données',
 vulnerability: 'Cartographie des données incomplète et absence d\'outils de purge centralisée.',
 probability: 5, impact: 3, strategy: 'Atténuer',
 framework: 'GDPR',
 treatment: {
 strategy: 'Atténuer',
 description: 'Mise en place d\'une cartographie des flux de données, automatisation des scripts de purge sur tous les systèmes.',
 status: 'Planifié',
 estimatedCost: 10000,
 dueDate: new Date(new Date().setMonth(new Date().getMonth() + 5)).toISOString()
 }
 },

 // --- PCI DSS (Payment Card Industry) ---
 {
 name: 'Stockage de données PAN en clair',
 description: 'Numéros de carte bancaire stockés non chiffrés.',
 field: 'Paiement',
 scenario: 'Un fichier de logs applicatifs enregistre par erreur les numéros de carte (PAN) complets lors des transactions échouées.',
 threat: 'Divulgation de données de titulaires',
 vulnerability: 'Logging trop verbeux et absence de masquage des données sensibles dans les logs.',
 probability: 4, impact: 5, strategy: 'Atténuer',
 framework: 'PCI_DSS',
 treatment: {
 strategy: 'Atténuer',
 description: 'Revue des configurations de logs, implémentation de tokenisation pour éviter le stockage des PAN.',
 status: 'Planifié',
 estimatedCost: 15000,
 dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()
 }
 },
 {
 name: 'Accès distant non sécurisé au CDE',
 description: 'Accès au Cardholder Data Environment sans MFA.',
 field: 'Accès',
 scenario: 'Un administrateur accède à la zone CDE (Cardholder Data Environment) pour maintenance via un simple mot de passe, qui est intercepté.',
 threat: 'Accès non autorisé au CDE',
 vulnerability: 'Absence d\'authentification multi-facteurs pour les accès administrateurs au CDE.',
 probability: 3, impact: 5, strategy: 'Atténuer',
 framework: 'PCI_DSS',
 treatment: {
 strategy: 'Atténuer',
 description: 'Déploiement MFA obligatoire pour tout accès au CDE, utilisation de bastions d\'administration.',
 status: 'Terminé',
 estimatedCost: 8000,
 dueDate: new Date().toISOString()
 }
 },

 // --- OWASP (Application Security) ---
 {
 name: 'Injection SQL (A03:2021)',
 description: 'Insertion de code malveillant dans une base de données.',
 field: 'Développement',
 scenario: 'Un attaquant injecte une commande SQL malveillante dans un formulaire de connexion non sécurisé, contournant l\'authentification.',
 threat: 'Injection de Code',
 vulnerability: 'Entrées utilisateurs non validées et non échappées dans les requêtes SQL dynamiques.',
 probability: 4, impact: 5, strategy: 'Atténuer',
 framework: 'OWASP',
 treatment: {
 strategy: 'Atténuer',
 description: 'Utilisation systématique de requêtes paramétrées, validation stricte des entrées, code review.',
 status: 'Planifié',
 estimatedCost: 2000,
 dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()
 }
 },
 {
 name: 'Broken Access Control (A01:2021)',
 description: 'Contournement des restrictions d\'accès.',
 field: 'Architecture Applicative',
 scenario: 'Un utilisateur authentifié modifie l\'ID dans l\'URL (IDOR) pour accéder au profil d\'un autre utilisateur.',
 threat: 'Accès non autorisé',
 vulnerability: 'Contrôles d\'accès manquants côté serveur lors de l\'accès aux objets.',
 probability: 5, impact: 4, strategy: 'Atténuer',
 framework: 'OWASP',
 treatment: {
 strategy: 'Atténuer',
 description: 'Vérification systématique des droits d\'accès à la ressource demandée dans le backend.',
 status: 'En cours',
 estimatedCost: 3000,
 dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()
 }
 },
 {
 name: 'Vulnerable and Outdated Components (A06:2021)',
 description: 'Utilisation de bibliothèques logicielles vulnérables.',
 field: 'Développement',
 scenario: 'L\'application utilise une version de Log4j vulnérable. Un attaquant exploite la faille pour exécuter du code à distance (RCE).',
 threat: 'Exploitation de vulnérabilité connue',
 vulnerability: 'Gestion des dépendances défaillante, absence de scan SCA (Software Composition Analysis).',
 probability: 4, impact: 5, strategy: 'Atténuer',
 framework: 'OWASP',
 treatment: {
 strategy: 'Atténuer',
 description: 'Mise en place d\'un outil SCA dans la CI/CD, processus de veille sur les vulnérabilités.',
 status: 'Planifié',
 estimatedCost: 4000,
 dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()
 }
 },

 // --- EBIOS Risk Manager ---
 {
 name: 'Sabotage par un initié',
 description: 'Action malveillante d\'un employé mécontent.',
 field: 'Menace Interne',
 scenario: 'Un administrateur système sur le départ détruit volontairement les sauvegardes et les serveurs de production avant de quitter l\'entreprise.',
 threat: 'Sabotage',
 vulnerability: 'Absence de séparation des tâches et de principe de moindre privilège.',
 probability: 2, impact: 5, strategy: 'Atténuer',
 framework: 'EBIOS',
 treatment: {
 strategy: 'Atténuer',
 description: 'Revue des droits, procédure de départ (offboarding) avec révocation immédiate, logging des actions admin.',
 status: 'Planifié',
 estimatedCost: 1000,
 dueDate: new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString()
 }
 },
 {
 name: 'Espionnage industriel concurrentiel',
 description: 'Vol de secrets d\'affaires par un concurrent.',
 field: 'Stratégique',
 scenario: 'Un concurrent soudoie un employé pour obtenir les plans R&D du prochain produit phare.',
 threat: 'Vol d\'information stratégique',
 vulnerability: 'Absence de classification de l\'information et de contrôle DLP (Data Loss Prevention).',
 probability: 2, impact: 5, strategy: 'Atténuer',
 framework: 'EBIOS',
 treatment: {
 strategy: 'Atténuer',
 description: 'Classification des données, solution DLP, NDA stricts, surveillance des comportements anormaux (UEBA).',
 status: 'Planifié',
 estimatedCost: 20000,
 dueDate: new Date(new Date().setMonth(new Date().getMonth() + 6)).toISOString()
 }
 },

 // --- SOC 2 (Service Organization Control) ---
 {
 name: 'Modification non autorisée en production',
 description: 'Changement de code impactant la disponibilité ou la sécurité.',
 field: 'Change Management',
 scenario: 'Un développeur pousse du code directement en production sans passer par les environnements de test, introduisant un bug critique.',
 threat: 'Erreur humaine / Procédure',
 vulnerability: 'Absence de pipeline CI/CD verrouillé et de séparation des environnements.',
 probability: 4, impact: 4, strategy: 'Atténuer',
 framework: 'SOC2',
 treatment: {
 strategy: 'Atténuer',
 description: 'Pipeline CI/CD avec approbation obligatoire (Pull Request), interdiction d\'accès direct en écriture à la prod.',
 status: 'En cours',
 estimatedCost: 6000,
 dueDate: new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString()
 }
 },

 // --- NIST CSF (Cybersecurity Framework) ---
 {
 name: 'Non-détection d\'une intrusion persistante',
 description: 'Attaquant présent sur le réseau sans être repéré.',
 field: 'Détection',
 scenario: 'Un attaquant a compromis un serveur et exfiltre des données lentement depuis 6 mois sans déclencher d\'alerte.',
 threat: 'APT (Advanced Persistent Threat)',
 vulnerability: 'Absence de surveillance des logs (SIEM) et de détection comportementale.',
 probability: 3, impact: 5, strategy: 'Atténuer',
 framework: 'NIST_CSF',
 treatment: {
 strategy: 'Atténuer',
 description: 'Déploiement d\'un SIEM/SOC externalisé ou interne, définition de cas d\'usage de détection.',
 status: 'Planifié',
 estimatedCost: 35000,
 dueDate: new Date(new Date().setMonth(new Date().getMonth() + 6)).toISOString()
 }
 },

 // --- HDS (Hébergeur de Données de Santé) ---
 {
 name: 'Accès illégitime aux données de santé',
 description: 'Consultation de dossiers patients par personnel non habilité.',
 field: 'Confidentialité Santé',
 scenario: 'Un agent administratif accède aux dossiers médicaux complets de VIPs par curiosité.',
 threat: 'Violation de confidentialité',
 vulnerability: 'Droits d\'accès trop larges et absence de traçabilité des consultations.',
 probability: 3, impact: 5, strategy: 'Atténuer',
 framework: 'HDS',
 treatment: {
 strategy: 'Atténuer',
 description: 'Restriction des accès au strict besoin d\'en connaître, journalisation auditée des accès dossiers.',
 status: 'En cours',
 estimatedCost: 5000,
 dueDate: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString()
 }
 }
];
