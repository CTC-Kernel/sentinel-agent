/**
 * Document Templates Data
 * Story 6.4: Regulatory Document Templates
 * ISO 27001 required document templates with pre-filled structure
 */

export interface DocumentTemplate {
    id: string;
    title: string;
    type: 'Politique' | 'Procédure' | 'Preuve' | 'Rapport' | 'Autre';
    category: 'ISO 27001' | 'RGPD' | 'NIS2' | 'Général';
    description: string;
    controlReference?: string;
    icon: string; // Lucide icon name
    content: string; // Rich HTML with placeholders
}

// Placeholder markers for user customization
const PLACEHOLDER = {
    ORG_NAME: '[NOM_ORGANISATION]',
    DATE: '[DATE]',
    VERSION: '[VERSION]',
    AUTHOR: '[AUTEUR]',
    APPROVER: '[APPROBATEUR]',
    SCOPE: '[PÉRIMÈTRE]',
    CUSTOM: '[À_PERSONNALISER]'
};

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
    // ============================================
    // POLICIES - ISO 27001
    // ============================================
    {
        id: 'pol-info-security',
        title: 'Politique de Sécurité de l\'Information',
        type: 'Politique',
        category: 'ISO 27001',
        description: 'Document fondateur définissant les principes et engagements de sécurité de l\'organisation',
        controlReference: 'A.5.1',
        icon: 'Shield',
        content: `
<h1>Politique de Sécurité de l'Information</h1>

<p><strong>Organisation:</strong> ${PLACEHOLDER.ORG_NAME}</p>
<p><strong>Version:</strong> ${PLACEHOLDER.VERSION}</p>
<p><strong>Date d'approbation:</strong> ${PLACEHOLDER.DATE}</p>
<p><strong>Approuvé par:</strong> ${PLACEHOLDER.APPROVER}</p>

<hr/>

<h2>1. Objet</h2>
<p>Cette politique définit les principes fondamentaux de la sécurité de l'information au sein de ${PLACEHOLDER.ORG_NAME}. Elle établit le cadre de gouvernance pour protéger les actifs informationnels contre les menaces internes et externes.</p>

<h2>2. Périmètre</h2>
<p>Cette politique s'applique à:</p>
<ul>
    <li>Tous les collaborateurs, prestataires et partenaires</li>
    <li>Tous les systèmes d'information de ${PLACEHOLDER.ORG_NAME}</li>
    <li>Toutes les informations traitées, stockées ou transmises</li>
</ul>

<h2>3. Engagements de la Direction</h2>
<p>La direction de ${PLACEHOLDER.ORG_NAME} s'engage à:</p>
<ul>
    <li>Fournir les ressources nécessaires à la mise en oeuvre du SMSI</li>
    <li>Communiquer l'importance de la sécurité de l'information</li>
    <li>Réviser régulièrement cette politique et le SMSI</li>
    <li>Assurer l'amélioration continue du système de management</li>
</ul>

<h2>4. Principes Fondamentaux</h2>
<h3>4.1 Confidentialité</h3>
<p>${PLACEHOLDER.CUSTOM}: Définir les niveaux de classification et les règles d'accès.</p>

<h3>4.2 Intégrité</h3>
<p>${PLACEHOLDER.CUSTOM}: Définir les contrôles garantissant l'exactitude des données.</p>

<h3>4.3 Disponibilité</h3>
<p>${PLACEHOLDER.CUSTOM}: Définir les exigences de disponibilité des systèmes critiques.</p>

<h2>5. Rôles et Responsabilités</h2>
<p>${PLACEHOLDER.CUSTOM}: Détailler les rôles (RSSI, DPO, propriétaires d'actifs, etc.)</p>

<h2>6. Revue et Mise à Jour</h2>
<p>Cette politique est révisée annuellement ou lors de changements significatifs.</p>
`
    },
    {
        id: 'pol-access-control',
        title: 'Politique de Contrôle des Accès',
        type: 'Politique',
        category: 'ISO 27001',
        description: 'Règles de gestion des accès aux systèmes et données',
        controlReference: 'A.5.15-A.5.18',
        icon: 'Lock',
        content: `
<h1>Politique de Contrôle des Accès</h1>

<p><strong>Organisation:</strong> ${PLACEHOLDER.ORG_NAME}</p>
<p><strong>Version:</strong> ${PLACEHOLDER.VERSION}</p>
<p><strong>Date:</strong> ${PLACEHOLDER.DATE}</p>

<hr/>

<h2>1. Objet</h2>
<p>Cette politique définit les règles de contrôle des accès aux systèmes d'information, aux données et aux locaux de ${PLACEHOLDER.ORG_NAME}.</p>

<h2>2. Principes Généraux</h2>
<ul>
    <li><strong>Besoin d'en connaître:</strong> L'accès n'est accordé que si nécessaire à l'exercice des fonctions</li>
    <li><strong>Moindre privilège:</strong> Les droits accordés sont les minimums nécessaires</li>
    <li><strong>Séparation des tâches:</strong> Les fonctions incompatibles sont séparées</li>
</ul>

<h2>3. Gestion des Identités</h2>
<h3>3.1 Création de Comptes</h3>
<p>${PLACEHOLDER.CUSTOM}: Processus de demande et validation des accès.</p>

<h3>3.2 Révision des Accès</h3>
<p>Les droits d'accès sont révisés:</p>
<ul>
    <li>Tous les ${PLACEHOLDER.CUSTOM} mois</li>
    <li>Lors de changement de fonction</li>
    <li>Au départ d'un collaborateur</li>
</ul>

<h2>4. Authentification</h2>
<ul>
    <li>Mots de passe: minimum ${PLACEHOLDER.CUSTOM} caractères, complexité requise</li>
    <li>MFA obligatoire pour: ${PLACEHOLDER.CUSTOM}</li>
    <li>Verrouillage après ${PLACEHOLDER.CUSTOM} tentatives échouées</li>
</ul>

<h2>5. Accès Privilégiés</h2>
<p>${PLACEHOLDER.CUSTOM}: Règles spécifiques pour les comptes administrateurs.</p>

<h2>6. Accès Distant</h2>
<p>${PLACEHOLDER.CUSTOM}: Conditions d'accès VPN et télétravail.</p>
`
    },
    {
        id: 'pol-acceptable-use',
        title: 'Politique d\'Utilisation Acceptable',
        type: 'Politique',
        category: 'ISO 27001',
        description: 'Règles d\'utilisation des ressources informatiques',
        controlReference: 'A.5.10',
        icon: 'FileCheck',
        content: `
<h1>Politique d'Utilisation Acceptable des Ressources IT</h1>

<p><strong>Organisation:</strong> ${PLACEHOLDER.ORG_NAME}</p>
<p><strong>Version:</strong> ${PLACEHOLDER.VERSION}</p>
<p><strong>Date:</strong> ${PLACEHOLDER.DATE}</p>

<hr/>

<h2>1. Objet</h2>
<p>Cette politique définit les règles d'utilisation acceptable des ressources informatiques mises à disposition par ${PLACEHOLDER.ORG_NAME}.</p>

<h2>2. Ressources Concernées</h2>
<ul>
    <li>Ordinateurs, téléphones mobiles, tablettes</li>
    <li>Messagerie électronique et outils collaboratifs</li>
    <li>Accès Internet et réseaux</li>
    <li>Données et applications de l'entreprise</li>
</ul>

<h2>3. Utilisation Autorisée</h2>
<p>Les ressources IT sont destinées principalement à un usage professionnel. Un usage personnel limité est toléré sous réserve qu'il:</p>
<ul>
    <li>Ne perturbe pas l'activité professionnelle</li>
    <li>Ne consomme pas de ressources excessives</li>
    <li>Respecte la législation et cette politique</li>
</ul>

<h2>4. Utilisations Interdites</h2>
<ul>
    <li>Téléchargement de logiciels non autorisés</li>
    <li>Accès à des contenus illicites ou offensants</li>
    <li>Partage d'informations confidentielles sans autorisation</li>
    <li>Utilisation de la messagerie à des fins personnelles massives</li>
    <li>${PLACEHOLDER.CUSTOM}: Autres interdictions spécifiques</li>
</ul>

<h2>5. Protection des Données</h2>
<p>${PLACEHOLDER.CUSTOM}: Règles de classification et manipulation des données.</p>

<h2>6. Sanctions</h2>
<p>Le non-respect de cette politique peut entraîner des sanctions disciplinaires conformément au règlement intérieur.</p>
`
    },
    // ============================================
    // PROCEDURES - ISO 27001
    // ============================================
    {
        id: 'proc-incident-response',
        title: 'Procédure de Gestion des Incidents de Sécurité',
        type: 'Procédure',
        category: 'ISO 27001',
        description: 'Processus de détection, réponse et récupération suite à un incident',
        controlReference: 'A.5.24-A.5.27',
        icon: 'AlertTriangle',
        content: `
<h1>Procédure de Gestion des Incidents de Sécurité</h1>

<p><strong>Organisation:</strong> ${PLACEHOLDER.ORG_NAME}</p>
<p><strong>Version:</strong> ${PLACEHOLDER.VERSION}</p>
<p><strong>Date:</strong> ${PLACEHOLDER.DATE}</p>

<hr/>

<h2>1. Objet</h2>
<p>Cette procédure décrit le processus de gestion des incidents de sécurité de l'information au sein de ${PLACEHOLDER.ORG_NAME}.</p>

<h2>2. Définitions</h2>
<ul>
    <li><strong>Événement de sécurité:</strong> Occurrence indiquant une possible violation de sécurité</li>
    <li><strong>Incident de sécurité:</strong> Événement confirmé ayant un impact sur la sécurité</li>
</ul>

<h2>3. Classification des Incidents</h2>
<table>
    <tr><th>Niveau</th><th>Impact</th><th>Délai de réponse</th></tr>
    <tr><td>Critique</td><td>Interruption majeure / Fuite données sensibles</td><td>< 1 heure</td></tr>
    <tr><td>Majeur</td><td>Impact significatif sur les opérations</td><td>< 4 heures</td></tr>
    <tr><td>Mineur</td><td>Impact limité, contenu</td><td>< 24 heures</td></tr>
</table>

<h2>4. Processus de Gestion</h2>

<h3>4.1 Détection et Signalement</h3>
<p>Tout collaborateur doit signaler immédiatement tout événement suspect à: ${PLACEHOLDER.CUSTOM}</p>
<p>Canal de signalement: ${PLACEHOLDER.CUSTOM}</p>

<h3>4.2 Évaluation et Classification</h3>
<p>L'équipe de sécurité évalue l'événement et détermine:</p>
<ul>
    <li>S'il s'agit d'un incident confirmé</li>
    <li>Le niveau de criticité</li>
    <li>Les systèmes/données impactés</li>
</ul>

<h3>4.3 Confinement</h3>
<p>${PLACEHOLDER.CUSTOM}: Actions de confinement selon le type d'incident.</p>

<h3>4.4 Éradication et Récupération</h3>
<p>${PLACEHOLDER.CUSTOM}: Étapes de remédiation et restauration.</p>

<h3>4.5 Analyse Post-Incident</h3>
<p>Après chaque incident majeur, une analyse est réalisée incluant:</p>
<ul>
    <li>Chronologie des événements</li>
    <li>Cause racine</li>
    <li>Actions correctives</li>
    <li>Leçons apprises</li>
</ul>

<h2>5. Contacts d'Urgence</h2>
<p>${PLACEHOLDER.CUSTOM}: Liste des contacts (RSSI, IT, Direction, Autorités)</p>
`
    },
    {
        id: 'proc-backup',
        title: 'Procédure de Sauvegarde et Restauration',
        type: 'Procédure',
        category: 'ISO 27001',
        description: 'Processus de backup des données et systèmes critiques',
        controlReference: 'A.8.13',
        icon: 'Database',
        content: `
<h1>Procédure de Sauvegarde et Restauration</h1>

<p><strong>Organisation:</strong> ${PLACEHOLDER.ORG_NAME}</p>
<p><strong>Version:</strong> ${PLACEHOLDER.VERSION}</p>
<p><strong>Date:</strong> ${PLACEHOLDER.DATE}</p>

<hr/>

<h2>1. Objet</h2>
<p>Cette procédure définit les règles de sauvegarde et de restauration des données et systèmes de ${PLACEHOLDER.ORG_NAME}.</p>

<h2>2. Périmètre des Sauvegardes</h2>
<table>
    <tr><th>Système/Données</th><th>Fréquence</th><th>Rétention</th><th>Type</th></tr>
    <tr><td>Bases de données production</td><td>Quotidienne</td><td>30 jours</td><td>Incrémentale</td></tr>
    <tr><td>Fichiers utilisateurs</td><td>Quotidienne</td><td>90 jours</td><td>Incrémentale</td></tr>
    <tr><td>Configurations serveurs</td><td>Hebdomadaire</td><td>1 an</td><td>Complète</td></tr>
    <tr><td>${PLACEHOLDER.CUSTOM}</td><td>${PLACEHOLDER.CUSTOM}</td><td>${PLACEHOLDER.CUSTOM}</td><td>${PLACEHOLDER.CUSTOM}</td></tr>
</table>

<h2>3. Règle 3-2-1</h2>
<ul>
    <li><strong>3</strong> copies des données</li>
    <li><strong>2</strong> supports différents</li>
    <li><strong>1</strong> copie hors site</li>
</ul>

<h2>4. Stockage des Sauvegardes</h2>
<p>${PLACEHOLDER.CUSTOM}: Localisation et sécurisation des sauvegardes (chiffrement, accès, etc.)</p>

<h2>5. Tests de Restauration</h2>
<p>Des tests de restauration sont effectués:</p>
<ul>
    <li>Mensuellement pour les systèmes critiques</li>
    <li>Trimestriellement pour les autres systèmes</li>
    <li>Annuellement en simulation complète (PRA)</li>
</ul>

<h2>6. Procédure de Restauration</h2>
<h3>6.1 Demande de Restauration</h3>
<p>${PLACEHOLDER.CUSTOM}: Processus de demande et validation.</p>

<h3>6.2 Exécution</h3>
<p>${PLACEHOLDER.CUSTOM}: Étapes techniques de restauration.</p>

<h2>7. Responsabilités</h2>
<p>${PLACEHOLDER.CUSTOM}: Rôles IT, propriétaires de données, etc.</p>
`
    },
    {
        id: 'proc-change-management',
        title: 'Procédure de Gestion des Changements',
        type: 'Procédure',
        category: 'ISO 27001',
        description: 'Processus de contrôle des modifications des systèmes',
        controlReference: 'A.8.32',
        icon: 'GitBranch',
        content: `
<h1>Procédure de Gestion des Changements</h1>

<p><strong>Organisation:</strong> ${PLACEHOLDER.ORG_NAME}</p>
<p><strong>Version:</strong> ${PLACEHOLDER.VERSION}</p>
<p><strong>Date:</strong> ${PLACEHOLDER.DATE}</p>

<hr/>

<h2>1. Objet</h2>
<p>Cette procédure définit le processus de gestion des changements affectant les systèmes d'information de ${PLACEHOLDER.ORG_NAME}.</p>

<h2>2. Types de Changements</h2>
<table>
    <tr><th>Type</th><th>Description</th><th>Approbation</th></tr>
    <tr><td>Standard</td><td>Changement pré-approuvé, faible risque</td><td>Automatique</td></tr>
    <tr><td>Normal</td><td>Changement planifié, risque modéré</td><td>CAB</td></tr>
    <tr><td>Urgent</td><td>Changement critique non planifié</td><td>ECAB</td></tr>
</table>

<h2>3. Processus de Changement</h2>

<h3>3.1 Demande (RFC)</h3>
<p>Toute demande de changement inclut:</p>
<ul>
    <li>Description du changement</li>
    <li>Justification et bénéfices</li>
    <li>Analyse d'impact et de risque</li>
    <li>Plan de mise en oeuvre</li>
    <li>Plan de retour arrière</li>
</ul>

<h3>3.2 Évaluation</h3>
<p>${PLACEHOLDER.CUSTOM}: Critères d'évaluation et responsables.</p>

<h3>3.3 Approbation</h3>
<p>Le CAB (Change Advisory Board) se réunit: ${PLACEHOLDER.CUSTOM}</p>

<h3>3.4 Implémentation</h3>
<p>${PLACEHOLDER.CUSTOM}: Règles de déploiement (fenêtres, environnements, etc.)</p>

<h3>3.5 Revue Post-Implémentation</h3>
<p>Validation que le changement a atteint ses objectifs sans impact négatif.</p>

<h2>4. Documentation</h2>
<p>Tous les changements sont documentés dans: ${PLACEHOLDER.CUSTOM}</p>
`
    },
    // ============================================
    // RGPD
    // ============================================
    {
        id: 'pol-data-protection',
        title: 'Politique de Protection des Données Personnelles',
        type: 'Politique',
        category: 'RGPD',
        description: 'Politique de conformité RGPD',
        controlReference: 'A.5.34',
        icon: 'UserCheck',
        content: `
<h1>Politique de Protection des Données Personnelles</h1>

<p><strong>Organisation:</strong> ${PLACEHOLDER.ORG_NAME}</p>
<p><strong>Version:</strong> ${PLACEHOLDER.VERSION}</p>
<p><strong>Date:</strong> ${PLACEHOLDER.DATE}</p>
<p><strong>DPO:</strong> ${PLACEHOLDER.CUSTOM}</p>

<hr/>

<h2>1. Engagement</h2>
<p>${PLACEHOLDER.ORG_NAME} s'engage à protéger les données personnelles conformément au RGPD et à la loi Informatique et Libertés.</p>

<h2>2. Principes Fondamentaux</h2>
<ul>
    <li><strong>Licéité:</strong> Traitement sur base légale valide</li>
    <li><strong>Finalité:</strong> Collecte pour des finalités déterminées et légitimes</li>
    <li><strong>Minimisation:</strong> Données limitées au nécessaire</li>
    <li><strong>Exactitude:</strong> Données exactes et mises à jour</li>
    <li><strong>Limitation de conservation:</strong> Durées définies</li>
    <li><strong>Sécurité:</strong> Protection contre accès non autorisés</li>
</ul>

<h2>3. Droits des Personnes</h2>
<p>Nous garantissons l'exercice des droits:</p>
<ul>
    <li>Droit d'accès</li>
    <li>Droit de rectification</li>
    <li>Droit à l'effacement</li>
    <li>Droit à la portabilité</li>
    <li>Droit d'opposition</li>
</ul>
<p>Contact DPO: ${PLACEHOLDER.CUSTOM}</p>

<h2>4. Registre des Traitements</h2>
<p>${PLACEHOLDER.CUSTOM}: Référence au registre des traitements.</p>

<h2>5. Sous-traitants</h2>
<p>${PLACEHOLDER.CUSTOM}: Politique de sélection et contractualisation.</p>

<h2>6. Violation de Données</h2>
<p>Notification à la CNIL sous 72h si risque pour les personnes.</p>
`
    }
];

// Group templates by category
export const getTemplatesByCategory = (): Record<string, DocumentTemplate[]> => {
    return DOCUMENT_TEMPLATES.reduce((acc, template) => {
        if (!acc[template.category]) {
            acc[template.category] = [];
        }
        acc[template.category].push(template);
        return acc;
    }, {} as Record<string, DocumentTemplate[]>);
};

// Get template by ID
export const getTemplateById = (id: string): DocumentTemplate | undefined => {
    return DOCUMENT_TEMPLATES.find(t => t.id === id);
};
