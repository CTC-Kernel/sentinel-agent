import '../types';

export interface AuditChecklistItem {
 id: string;
 controlCode: string;
 controlName: string;
 question: string;
 guidance: string;
 status: 'not_started' | 'compliant' | 'partial' | 'non_compliant' | 'not_applicable';
 evidence?: string[];
 notes?: string;
 assessedBy?: string;
 assessedDate?: string;
}

export interface AuditChecklist {
 id: string;
 auditId: string;
 organizationId: string;
 domain: 'A.5' | 'A.6' | 'A.7' | 'A.8';
 items: AuditChecklistItem[];
 completionRate: number;
 createdAt: string;
 updatedAt: string;
}

/**
 * ISO 27001:2022 Audit Checklists
 * Organized by Annex A domains
 */
export const ISO27001_CHECKLISTS = {
 'A.5': {
 title: 'Contrôles Organisationnels',
 items: [
 {
 controlCode: 'A.5.1',
 controlName: 'Politiques de sécurité de l\'information',
 question: 'Des politiques de sécurité de l\'information sont-elles définies, approuvées et communiquées ?',
 guidance: 'Vérifier l\'existence de politiques formelles, leur date d\'approbation par la direction, et leur diffusion aux parties prenantes.'
 },
 {
 controlCode: 'A.5.2',
 controlName: 'Rôles et responsabilités',
 question: 'Les rôles et responsabilités en matière de sécurité sont-ils clairement définis et attribués ?',
 guidance: 'Examiner les fiches de poste, organigrammes, et matrices RACI pour la sécurité de l\'information.'
 },
 {
 controlCode: 'A.5.3',
 controlName: 'Ségrégation des tâches',
 question: 'Les tâches et responsabilités conflictuelles sont-elles séparées pour réduire les risques ?',
 guidance: 'Vérifier qu\'aucune personne ne cumule des fonctions incompatibles (ex: développement + mise en production).'
 },
 {
 controlCode: 'A.5.7',
 controlName: 'Renseignement sur les menaces',
 question: 'Des informations sur les menaces de sécurité sont-elles collectées et analysées ?',
 guidance: 'Vérifier les sources de veille (CERT, bulletins de sécurité), la fréquence de consultation, et les actions prises.'
 },
 {
 controlCode: 'A.5.8',
 controlName: 'Sécurité de l\'information dans la gestion de projet',
 question: 'La sécurité est-elle intégrée dans la gestion de projet ?',
 guidance: 'Examiner les méthodologies de projet pour vérifier l\'intégration des exigences de sécurité dès la conception.'
 },
 {
 controlCode: 'A.5.10',
 controlName: 'Utilisation acceptable de l\'information',
 question: 'Des règles d\'utilisation acceptable des actifs informationnels sont-elles établies ?',
 guidance: 'Vérifier l\'existence d\'une charte informatique, sa communication aux utilisateurs, et son acceptation formelle.'
 },
 {
 controlCode: 'A.5.14',
 controlName: 'Transfert d\'information',
 question: 'Des règles de transfert d\'information sont-elles en place et respectées ?',
 guidance: 'Vérifier les procédures de transfert sécurisé (chiffrement, canaux approuvés) et les journaux de transfert.'
 },
 {
 controlCode: 'A.5.23',
 controlName: 'Sécurité Cloud',
 question: 'La sécurité des services cloud est-elle gérée conformément aux exigences de l\'organisation ?',
 guidance: 'Examiner les contrats cloud, les évaluations de sécurité des fournisseurs, et les configurations de sécurité.'
 }
 ]
 },
 'A.6': {
 title: 'Contrôles Liés aux Personnes',
 items: [
 {
 controlCode: 'A.6.1',
 controlName: 'Sélection',
 question: 'Des vérifications de sécurité sont-elles effectuées lors du recrutement ?',
 guidance: 'Vérifier les processus de vérification des antécédents, références, et diplômes pour les postes sensibles.'
 },
 {
 controlCode: 'A.6.2',
 controlName: 'Termes et conditions d\'emploi',
 question: 'Les obligations de sécurité sont-elles incluses dans les contrats de travail ?',
 guidance: 'Examiner les contrats pour vérifier les clauses de confidentialité, NDA, et responsabilités en matière de sécurité.'
 },
 {
 controlCode: 'A.6.3',
 controlName: 'Sensibilisation, éducation et formation',
 question: 'Les employés reçoivent-ils une formation régulière à la sécurité de l\'information ?',
 guidance: 'Vérifier le programme de formation, les taux de participation, les tests de connaissances, et la fréquence.'
 },
 {
 controlCode: 'A.6.4',
 controlName: 'Processus disciplinaire',
 question: 'Un processus disciplinaire est-il en place pour les violations de sécurité ?',
 guidance: 'Examiner les procédures disciplinaires, les cas traités, et la cohérence des sanctions appliquées.'
 },
 {
 controlCode: 'A.6.5',
 controlName: 'Responsabilités après la cessation',
 question: 'Les responsabilités de sécurité sont-elles maintenues après la fin de l\'emploi ?',
 guidance: 'Vérifier les procédures de départ (restitution des actifs, révocation des accès, rappel des obligations).'
 },
 {
 controlCode: 'A.6.8',
 controlName: 'Signalement des événements',
 question: 'Les employés savent-ils comment signaler les événements de sécurité ?',
 guidance: 'Vérifier l\'existence de canaux de signalement, leur communication, et les statistiques de signalements.'
 }
 ]
 },
 'A.7': {
 title: 'Contrôles Physiques',
 items: [
 {
 controlCode: 'A.7.1',
 controlName: 'Périmètres physiques',
 question: 'Des périmètres de sécurité physique sont-ils définis et protégés ?',
 guidance: 'Inspecter les barrières, clôtures, portes sécurisées, et systèmes de contrôle d\'accès physique.'
 },
 {
 controlCode: 'A.7.2',
 controlName: 'Accès physique',
 question: 'L\'accès physique aux zones sensibles est-il contrôlé et surveillé ?',
 guidance: 'Vérifier les badges, registres d\'accès, caméras de surveillance, et procédures de gestion des visiteurs.'
 },
 {
 controlCode: 'A.7.3',
 controlName: 'Sécurisation des bureaux',
 question: 'Les bureaux et salles sont-ils sécurisés contre les accès non autorisés ?',
 guidance: 'Examiner les systèmes de verrouillage, alarmes, et procédures de fermeture des locaux.'
 },
 {
 controlCode: 'A.7.4',
 controlName: 'Surveillance physique',
 question: 'Une surveillance physique est-elle en place pour détecter les intrusions ?',
 guidance: 'Vérifier les systèmes de vidéosurveillance, alarmes, détecteurs de mouvement, et leur maintenance.'
 },
 {
 controlCode: 'A.7.7',
 controlName: 'Bureau propre (Clear desk)',
 question: 'Une politique de bureau propre est-elle appliquée ?',
 guidance: 'Observer les bureaux, vérifier le rangement des documents sensibles, et le verrouillage des écrans.'
 },
 {
 controlCode: 'A.7.10',
 controlName: 'Supports de stockage',
 question: 'Les supports de stockage sont-ils gérés de manière sécurisée ?',
 guidance: 'Vérifier les procédures de gestion des disques durs, USB, bandes, et leur destruction sécurisée.'
 }
 ]
 },
 'A.8': {
 title: 'Contrôles Technologiques',
 items: [
 {
 controlCode: 'A.8.1',
 controlName: 'Équipements d\'utilisateur final',
 question: 'Les équipements des utilisateurs sont-ils protégés ?',
 guidance: 'Vérifier le chiffrement des disques, antivirus, pare-feu, et mises à jour de sécurité.'
 },
 {
 controlCode: 'A.8.2',
 controlName: 'Droits d\'accès privilégiés',
 question: 'Les droits d\'accès privilégiés sont-ils contrôlés et surveillés ?',
 guidance: 'Examiner la gestion des comptes admin, l\'authentification forte, et les journaux d\'activité.'
 },
 {
 controlCode: 'A.8.3',
 controlName: 'Restriction d\'accès à l\'information',
 question: 'L\'accès à l\'information est-il restreint selon le principe du moindre privilège ?',
 guidance: 'Vérifier les matrices de droits, les revues d\'accès, et la ségrégation des environnements.'
 },
 {
 controlCode: 'A.8.5',
 controlName: 'Authentification sécurisée',
 question: 'Des mécanismes d\'authentification sécurisée sont-ils en place ?',
 guidance: 'Vérifier l\'utilisation de MFA, la complexité des mots de passe, et les politiques de renouvellement.'
 },
 {
 controlCode: 'A.8.8',
 controlName: 'Gestion des vulnérabilités techniques',
 question: 'Les vulnérabilités techniques sont-elles identifiées et corrigées ?',
 guidance: 'Examiner les scans de vulnérabilités, les processus de patch management, et les délais de correction.'
 },
 {
 controlCode: 'A.8.9',
 controlName: 'Gestion de la configuration',
 question: 'Les configurations de sécurité sont-elles documentées et maintenues ?',
 guidance: 'Vérifier les baselines de sécurité, la gestion des changements, et les audits de configuration.'
 },
 {
 controlCode: 'A.8.10',
 controlName: 'Suppression d\'information',
 question: 'L\'information est-elle supprimée de manière sécurisée ?',
 guidance: 'Vérifier les procédures d\'effacement sécurisé, de destruction physique, et les certificats de destruction.'
 },
 {
 controlCode: 'A.8.13',
 controlName: 'Sauvegardes',
 question: 'Des sauvegardes régulières sont-elles effectuées et testées ?',
 guidance: 'Examiner la politique de sauvegarde, la fréquence, le stockage hors site, et les tests de restauration.'
 },
 {
 controlCode: 'A.8.15',
 controlName: 'Journalisation',
 question: 'Les événements de sécurité sont-ils journalisés et conservés ?',
 guidance: 'Vérifier les logs système, applicatifs, d\'accès, leur centralisation, et la durée de rétention.'
 },
 {
 controlCode: 'A.8.16',
 controlName: 'Surveillance',
 question: 'Les systèmes sont-ils surveillés pour détecter les anomalies ?',
 guidance: 'Examiner les outils de monitoring, SIEM, alertes configurées, et les procédures de réponse.'
 },
 {
 controlCode: 'A.8.23',
 controlName: 'Filtrage web',
 question: 'Le filtrage web est-il en place pour bloquer les contenus malveillants ?',
 guidance: 'Vérifier les solutions de filtrage, les catégories bloquées, et les journaux de blocage.'
 },
 {
 controlCode: 'A.8.24',
 controlName: 'Cryptographie',
 question: 'La cryptographie est-elle utilisée pour protéger l\'information ?',
 guidance: 'Examiner les algorithmes utilisés, la gestion des clés, et les protocoles de chiffrement (TLS, etc.).'
 }
 ]
 }
};

/**
 * Generate a complete audit checklist for a domain
 */
export function generateAuditChecklist(
 auditId: string,
 organizationId: string,
 domain: 'A.5' | 'A.6' | 'A.7' | 'A.8'
): Omit<AuditChecklist, 'id'> {
 const domainData = ISO27001_CHECKLISTS[domain];

 const items: AuditChecklistItem[] = domainData.items.map((item, index) => ({
 id: `${domain}-${index}`,
 controlCode: item.controlCode,
 controlName: item.controlName,
 question: item.question,
 guidance: item.guidance,
 status: 'not_started',
 evidence: [],
 notes: '',
 }));

 return {
 auditId,
 organizationId,
 domain,
 items,
 completionRate: 0,
 createdAt: new Date(Date.now()).toISOString(),
 updatedAt: new Date(Date.now()).toISOString(),
 };
}

/**
 * Calculate completion rate for a checklist
 */
export function calculateCompletionRate(items: AuditChecklistItem[]): number {
 const completed = items.filter(
 (item) => item.status !== 'not_started'
 ).length;
 return Math.round((completed / items.length) * 100);
}

/**
 * Get compliance score for a checklist
 */
export function getComplianceScore(items: AuditChecklistItem[]): {
 compliant: number;
 partial: number;
 nonCompliant: number;
 notApplicable: number;
 notAssessed: number;
} {
 return {
 compliant: items.filter((i) => i.status === 'compliant').length,
 partial: items.filter((i) => i.status === 'partial').length,
 nonCompliant: items.filter((i) => i.status === 'non_compliant').length,
 notApplicable: items.filter((i) => i.status === 'not_applicable').length,
 notAssessed: items.filter((i) => i.status === 'not_started').length,
 };
}
