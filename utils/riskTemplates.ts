import { Risk } from '../types';

/**
 * Template de risque prédéfini
 */
export interface RiskTemplate {
    id: string;
    name: string;
    description: string;
    category: 'OWASP' | 'ISO27001' | 'RGPD' | 'Cloud' | 'SupplyChain' | 'Custom';
    icon: string;
    risks: Omit<Risk, 'id' | 'organizationId' | 'createdAt'>[];
}

/**
 * Templates de risques prédéfinis
 */
export const RISK_TEMPLATES: RiskTemplate[] = [
    {
        id: 'owasp-top-10-2021',
        name: 'OWASP Top 10 2021',
        description: 'Les 10 risques de sécurité applicative les plus critiques',
        category: 'OWASP',
        icon: '🔐',
        risks: [
            {
                assetId: '',
                threat: 'A01:2021 – Broken Access Control',
                vulnerability: 'Contrôles d\'accès insuffisants ou mal configurés. Impact: Accès non autorisé aux données sensibles, modification ou suppression de données',
                probability: 4,
                impact: 5,
                score: 20,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 12
            },
            {
                assetId: '',
                threat: 'A02:2021 – Cryptographic Failures',
                vulnerability: 'Chiffrement faible ou absent des données sensibles. Impact: Exposition de données confidentielles (mots de passe, données personnelles, secrets)',
                probability: 3,
                impact: 5,
                score: 15,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 9
            },
            {
                assetId: '',
                threat: 'A03:2021 – Injection',
                vulnerability: 'Validation insuffisante des entrées utilisateur. Impact: Exécution de code malveillant, accès base de données, compromission système',
                probability: 3,
                impact: 5,
                score: 15,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 8
            },
            {
                assetId: '',
                threat: 'A04:2021 – Insecure Design',
                vulnerability: 'Absence de sécurité dès la conception. Impact: Vulnérabilités structurelles difficiles à corriger',
                probability: 3,
                impact: 4,
                score: 12,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 8
            },
            {
                assetId: '',
                threat: 'A05:2021 – Security Misconfiguration',
                vulnerability: 'Configurations par défaut, erreurs de configuration. Impact: Exposition de données, accès non autorisé, compromission système',
                probability: 4,
                impact: 4,
                score: 16,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 10
            },
            {
                assetId: '',
                threat: 'A06:2021 – Vulnerable and Outdated Components',
                vulnerability: 'Utilisation de composants avec vulnérabilités connues. Impact: Exploitation de failles connues, compromission application',
                probability: 4,
                impact: 4,
                score: 16,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 10
            },
            {
                assetId: '',
                threat: 'A07:2021 – Identification and Authentication Failures',
                vulnerability: 'Mécanismes d\'authentification faibles. Impact: Usurpation d\'identité, accès non autorisé aux comptes',
                probability: 3,
                impact: 4,
                score: 12,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 8
            },
            {
                assetId: '',
                threat: 'A08:2021 – Software and Data Integrity Failures',
                vulnerability: 'Absence de vérification d\'intégrité. Impact: Injection de code malveillant, compromission de la chaîne d\'approvisionnement',
                probability: 2,
                impact: 5,
                score: 10,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 6
            },
            {
                assetId: '',
                threat: 'A09:2021 – Security Logging and Monitoring Failures',
                vulnerability: 'Journalisation et surveillance insuffisantes. Impact: Détection tardive des incidents, impossibilité d\'investigation',
                probability: 4,
                impact: 3,
                score: 12,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 8
            },
            {
                assetId: '',
                threat: 'A10:2021 – Server-Side Request Forgery (SSRF)',
                vulnerability: 'Validation insuffisante des URLs fournies par l\'utilisateur. Impact: Accès aux ressources internes, scan du réseau interne',
                probability: 2,
                impact: 4,
                score: 8,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 5
            }
        ]
    },
    {
        id: 'iso27001-common',
        name: 'Risques ISO 27001 Courants',
        description: 'Risques typiques identifiés dans les analyses ISO 27001',
        category: 'ISO27001',
        icon: '🏆',
        risks: [
            {
                assetId: '',
                threat: 'Perte ou vol de matériel',
                vulnerability: 'Absence de chiffrement des postes de travail. Impact: Exposition de données confidentielles, non-conformité RGPD',
                probability: 3,
                impact: 4,
                score: 12,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 6
            },
            {
                assetId: '',
                threat: 'Départ d\'un employé clé',
                vulnerability: 'Absence de documentation, connaissance non partagée. Impact: Perte de compétences critiques, interruption de service',
                probability: 3,
                impact: 3,
                score: 9,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 6
            },
            {
                assetId: '',
                threat: 'Attaque par ransomware',
                vulnerability: 'Absence de sauvegardes hors ligne, sensibilisation insuffisante. Impact: Chiffrement des données, demande de rançon, interruption activité',
                probability: 3,
                impact: 5,
                score: 15,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 9
            },
            {
                assetId: '',
                threat: 'Défaillance du fournisseur cloud',
                vulnerability: 'Dépendance à un seul fournisseur, absence de plan de continuité. Impact: Indisponibilité prolongée des services, perte de données',
                probability: 2,
                impact: 5,
                score: 10,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 6
            },
            {
                assetId: '',
                threat: 'Accès non autorisé par ancien employé',
                vulnerability: 'Processus de révocation des accès incomplet. Impact: Accès illégitime aux systèmes, sabotage, vol de données',
                probability: 2,
                impact: 4,
                score: 8,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 4
            }
        ]
    },
    {
        id: 'rgpd-risks',
        name: 'Risques RGPD',
        description: 'Risques liés à la protection des données personnelles',
        category: 'RGPD',
        icon: '🔒',
        risks: [
            {
                assetId: '',
                threat: 'Fuite de données personnelles',
                vulnerability: 'Sécurité insuffisante des bases de données. Impact: Violation RGPD, amendes jusqu\'à 4% CA, atteinte réputation',
                probability: 3,
                impact: 5,
                score: 15,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 9
            },
            {
                assetId: '',
                threat: 'Transfert illégal de données hors UE',
                vulnerability: 'Absence de clauses contractuelles types. Impact: Non-conformité RGPD, sanctions CNIL',
                probability: 2,
                impact: 4,
                score: 8,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 4
            },
            {
                assetId: '',
                threat: 'Conservation excessive des données',
                vulnerability: 'Absence de politique de rétention. Impact: Non-respect du principe de limitation de conservation',
                probability: 4,
                impact: 3,
                score: 12,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 6
            },
            {
                assetId: '',
                threat: 'Absence de consentement valide',
                vulnerability: 'Formulaires non conformes, consentement pré-coché. Impact: Traitement illégal, sanctions CNIL',
                probability: 3,
                impact: 3,
                score: 9,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 5
            },
            {
                assetId: '',
                threat: 'Violation du droit d\'accès',
                vulnerability: 'Processus de réponse aux demandes inexistant. Impact: Plaintes CNIL, sanctions',
                probability: 2,
                impact: 3,
                score: 6,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 3
            }
        ]
    },
    {
        id: 'cloud-risks',
        name: 'Risques Cloud',
        description: 'Risques spécifiques aux environnements cloud (AWS, Azure, GCP)',
        category: 'Cloud',
        icon: '☁️',
        risks: [
            {
                assetId: '',
                threat: 'Bucket S3 public',
                vulnerability: 'Mauvaise configuration des permissions. Impact: Exposition publique de données sensibles',
                probability: 3,
                impact: 5,
                score: 15,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 6
            },
            {
                assetId: '',
                threat: 'Compromission de clés API',
                vulnerability: 'Clés hardcodées dans le code, rotation insuffisante. Impact: Accès non autorisé aux ressources cloud, facturation excessive',
                probability: 3,
                impact: 4,
                score: 12,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 6
            },
            {
                assetId: '',
                threat: 'Absence de MFA sur comptes admin',
                vulnerability: 'Authentification simple par mot de passe. Impact: Prise de contrôle du compte, accès total aux ressources',
                probability: 2,
                impact: 5,
                score: 10,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 4
            },
            {
                assetId: '',
                threat: 'Shadow IT cloud',
                vulnerability: 'Absence de gouvernance cloud. Impact: Ressources non sécurisées, coûts incontrôlés, non-conformité',
                probability: 4,
                impact: 3,
                score: 12,
                status: 'Ouvert',
                owner: '',
                strategy: 'Atténuer',
                residualScore: 8
            }
        ]
    }
];

/**
 * Crée des risques à partir d'un template
 */
export function createRisksFromTemplate(
    template: RiskTemplate,
    organizationId: string,
    defaultOwner: string
) {
    return template.risks.map(risk => ({
        ...risk,
        owner: defaultOwner,
        organizationId,
        createdAt: new Date().toISOString()
    }));
}
