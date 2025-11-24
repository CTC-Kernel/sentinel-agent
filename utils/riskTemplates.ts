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
                threat: 'A01:2021 – Broken Access Control',
                vulnerability: 'Contrôles d\'accès insuffisants ou mal configurés',
                impact: 'Accès non autorisé aux données sensibles, modification ou suppression de données',
                likelihood: 4,
                impactLevel: 5,
                score: 20,
                status: 'Identifié',
                owner: '',
                category: 'Application',
                treatment: 'Mitiger',
                residualRisk: 12
            },
            {
                threat: 'A02:2021 – Cryptographic Failures',
                vulnerability: 'Chiffrement faible ou absent des données sensibles',
                impact: 'Exposition de données confidentielles (mots de passe, données personnelles, secrets)',
                likelihood: 3,
                impactLevel: 5,
                score: 15,
                status: 'Identifié',
                owner: '',
                category: 'Application',
                treatment: 'Mitiger',
                residualRisk: 9
            },
            {
                threat: 'A03:2021 – Injection',
                vulnerability: 'Validation insuffisante des entrées utilisateur',
                impact: 'Exécution de code malveillant, accès base de données, compromission système',
                likelihood: 3,
                impactLevel: 5,
                score: 15,
                status: 'Identifié',
                owner: '',
                category: 'Application',
                treatment: 'Mitiger',
                residualRisk: 8
            },
            {
                threat: 'A04:2021 – Insecure Design',
                vulnerability: 'Absence de sécurité dès la conception',
                impact: 'Vulnérabilités structurelles difficiles à corriger',
                likelihood: 3,
                impactLevel: 4,
                score: 12,
                status: 'Identifié',
                owner: '',
                category: 'Application',
                treatment: 'Mitiger',
                residualRisk: 8
            },
            {
                threat: 'A05:2021 – Security Misconfiguration',
                vulnerability: 'Configurations par défaut, erreurs de configuration',
                impact: 'Exposition de données, accès non autorisé, compromission système',
                likelihood: 4,
                impactLevel: 4,
                score: 16,
                status: 'Identifié',
                owner: '',
                category: 'Infrastructure',
                treatment: 'Mitiger',
                residualRisk: 10
            },
            {
                threat: 'A06:2021 – Vulnerable and Outdated Components',
                vulnerability: 'Utilisation de composants avec vulnérabilités connues',
                impact: 'Exploitation de failles connues, compromission application',
                likelihood: 4,
                impactLevel: 4,
                score: 16,
                status: 'Identifié',
                owner: '',
                category: 'Application',
                treatment: 'Mitiger',
                residualRisk: 10
            },
            {
                threat: 'A07:2021 – Identification and Authentication Failures',
                vulnerability: 'Mécanismes d\'authentification faibles',
                impact: 'Usurpation d\'identité, accès non autorisé aux comptes',
                likelihood: 3,
                impactLevel: 4,
                score: 12,
                status: 'Identifié',
                owner: '',
                category: 'Application',
                treatment: 'Mitiger',
                residualRisk: 8
            },
            {
                threat: 'A08:2021 – Software and Data Integrity Failures',
                vulnerability: 'Absence de vérification d\'intégrité',
                impact: 'Injection de code malveillant, compromission de la chaîne d\'approvisionnement',
                likelihood: 2,
                impactLevel: 5,
                score: 10,
                status: 'Identifié',
                owner: '',
                category: 'Application',
                treatment: 'Mitiger',
                residualRisk: 6
            },
            {
                threat: 'A09:2021 – Security Logging and Monitoring Failures',
                vulnerability: 'Journalisation et surveillance insuffisantes',
                impact: 'Détection tardive des incidents, impossibilité d\'investigation',
                likelihood: 4,
                impactLevel: 3,
                score: 12,
                status: 'Identifié',
                owner: '',
                category: 'Infrastructure',
                treatment: 'Mitiger',
                residualRisk: 8
            },
            {
                threat: 'A10:2021 – Server-Side Request Forgery (SSRF)',
                vulnerability: 'Validation insuffisante des URLs fournies par l\'utilisateur',
                impact: 'Accès aux ressources internes, scan du réseau interne',
                likelihood: 2,
                impactLevel: 4,
                score: 8,
                status: 'Identifié',
                owner: '',
                category: 'Application',
                treatment: 'Mitiger',
                residualRisk: 5
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
                threat: 'Perte ou vol de matériel',
                vulnerability: 'Absence de chiffrement des postes de travail',
                impact: 'Exposition de données confidentielles, non-conformité RGPD',
                likelihood: 3,
                impactLevel: 4,
                score: 12,
                status: 'Identifié',
                owner: '',
                category: 'Physique',
                treatment: 'Mitiger',
                residualRisk: 6
            },
            {
                threat: 'Départ d\'un employé clé',
                vulnerability: 'Absence de documentation, connaissance non partagée',
                impact: 'Perte de compétences critiques, interruption de service',
                likelihood: 3,
                impactLevel: 3,
                score: 9,
                status: 'Identifié',
                owner: '',
                category: 'Humain',
                treatment: 'Mitiger',
                residualRisk: 6
            },
            {
                threat: 'Attaque par ransomware',
                vulnerability: 'Absence de sauvegardes hors ligne, sensibilisation insuffisante',
                impact: 'Chiffrement des données, demande de rançon, interruption activité',
                likelihood: 3,
                impactLevel: 5,
                score: 15,
                status: 'Identifié',
                owner: '',
                category: 'Malware',
                treatment: 'Mitiger',
                residualRisk: 9
            },
            {
                threat: 'Défaillance du fournisseur cloud',
                vulnerability: 'Dépendance à un seul fournisseur, absence de plan de continuité',
                impact: 'Indisponibilité prolongée des services, perte de données',
                likelihood: 2,
                impactLevel: 5,
                score: 10,
                status: 'Identifié',
                owner: '',
                category: 'Infrastructure',
                treatment: 'Mitiger',
                residualRisk: 6
            },
            {
                threat: 'Accès non autorisé par ancien employé',
                vulnerability: 'Processus de révocation des accès incomplet',
                impact: 'Accès illégitime aux systèmes, sabotage, vol de données',
                likelihood: 2,
                impactLevel: 4,
                score: 8,
                status: 'Identifié',
                owner: '',
                category: 'Humain',
                treatment: 'Mitiger',
                residualRisk: 4
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
                threat: 'Fuite de données personnelles',
                vulnerability: 'Sécurité insuffisante des bases de données',
                impact: 'Violation RGPD, amendes jusqu\'à 4% CA, atteinte réputation',
                likelihood: 3,
                impactLevel: 5,
                score: 15,
                status: 'Identifié',
                owner: '',
                category: 'Données',
                treatment: 'Mitiger',
                residualRisk: 9
            },
            {
                threat: 'Transfert illégal de données hors UE',
                vulnerability: 'Absence de clauses contractuelles types',
                impact: 'Non-conformité RGPD, sanctions CNIL',
                likelihood: 2,
                impactLevel: 4,
                score: 8,
                status: 'Identifié',
                owner: '',
                category: 'Données',
                treatment: 'Mitiger',
                residualRisk: 4
            },
            {
                threat: 'Conservation excessive des données',
                vulnerability: 'Absence de politique de rétention',
                impact: 'Non-respect du principe de limitation de conservation',
                likelihood: 4,
                impactLevel: 3,
                score: 12,
                status: 'Identifié',
                owner: '',
                category: 'Données',
                treatment: 'Mitiger',
                residualRisk: 6
            },
            {
                threat: 'Absence de consentement valide',
                vulnerability: 'Formulaires non conformes, consentement pré-coché',
                impact: 'Traitement illégal, sanctions CNIL',
                likelihood: 3,
                impactLevel: 3,
                score: 9,
                status: 'Identifié',
                owner: '',
                category: 'Données',
                treatment: 'Mitiger',
                residualRisk: 5
            },
            {
                threat: 'Violation du droit d\'accès',
                vulnerability: 'Processus de réponse aux demandes inexistant',
                impact: 'Plaintes CNIL, sanctions',
                likelihood: 2,
                impactLevel: 3,
                score: 6,
                status: 'Identifié',
                owner: '',
                category: 'Données',
                treatment: 'Mitiger',
                residualRisk: 3
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
                threat: 'Bucket S3 public',
                vulnerability: 'Mauvaise configuration des permissions',
                impact: 'Exposition publique de données sensibles',
                likelihood: 3,
                impactLevel: 5,
                score: 15,
                status: 'Identifié',
                owner: '',
                category: 'Infrastructure',
                treatment: 'Mitiger',
                residualRisk: 6
            },
            {
                threat: 'Compromission de clés API',
                vulnerability: 'Clés hardcodées dans le code, rotation insuffisante',
                impact: 'Accès non autorisé aux ressources cloud, facturation excessive',
                likelihood: 3,
                impactLevel: 4,
                score: 12,
                status: 'Identifié',
                owner: '',
                category: 'Infrastructure',
                treatment: 'Mitiger',
                residualRisk: 6
            },
            {
                threat: 'Absence de MFA sur comptes admin',
                vulnerability: 'Authentification simple par mot de passe',
                impact: 'Prise de contrôle du compte, accès total aux ressources',
                likelihood: 2,
                impactLevel: 5,
                score: 10,
                status: 'Identifié',
                owner: '',
                category: 'Infrastructure',
                treatment: 'Mitiger',
                residualRisk: 4
            },
            {
                threat: 'Shadow IT cloud',
                vulnerability: 'Absence de gouvernance cloud',
                impact: 'Ressources non sécurisées, coûts incontrôlés, non-conformité',
                likelihood: 4,
                impactLevel: 3,
                score: 12,
                status: 'Identifié',
                owner: '',
                category: 'Gouvernance',
                treatment: 'Mitiger',
                residualRisk: 8
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
