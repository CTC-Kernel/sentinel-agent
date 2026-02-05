
export const DORA_QUESTIONNAIRE_SECTIONS = [
 {
 id: 'governance',
 title: 'Gouvernance & Stratégie',
 weight: 20,
 questions: [
 {
 id: 'gov_1',
 text: 'Avez-vous désigné un responsable de la sécurité des systèmes d\'information (RSSI) ?',
 type: 'yes_no',
 weight: 5,
 required: true
 },
 {
 id: 'gov_2',
 text: 'Disposez-vous d\'une politique de sécurité de l\'information (PSSI) revue annuellement ?',
 type: 'yes_no',
 weight: 5,
 required: true
 }
 ]
 },
 {
 id: 'access_control',
 title: 'Contrôle d\'accès & Identité',
 weight: 25,
 questions: [
 {
 id: 'acc_1',
 text: 'Utilisez-vous l\'authentification multi-facteurs (MFA) pour tous les accès distants ?',
 type: 'yes_no',
 weight: 10,
 required: true
 },
 {
 id: 'acc_2',
 text: 'Effectuez-vous des revues de comptes utilisateurs au moins semestriellement ?',
 type: 'yes_no',
 weight: 5,
 required: true
 }
 ]
 },
 {
 id: 'incidents',
 title: 'Gestion des Incidents',
 weight: 25,
 questions: [
 {
 id: 'inc_1',
 text: 'Disposez-vous d\'un processus formel de notification des incidents majeurs sous 24h ?',
 type: 'yes_no',
 weight: 10,
 required: true
 },
 {
 id: 'inc_2',
 text: 'Avez-vous testé votre procédure de réponse aux incidents au cours des 12 derniers mois ?',
 type: 'yes_no',
 weight: 5,
 required: true
 }
 ]
 },
 {
 id: 'continuity',
 title: 'Continuité d\'Activité (BCP/DRP)',
 weight: 15,
 questions: [
 {
 id: 'bcp_1',
 text: 'Disposez-vous d\'un Plan de Continuité d\'Activité (PCA/BCP) testé ?',
 type: 'yes_no',
 weight: 8,
 required: true
 },
 {
 id: 'bcp_2',
 text: 'Vos sauvegardes sont-elles immuables (protection contre Ransomware) ?',
 type: 'yes_no',
 weight: 7,
 required: true
 }
 ]
 },
 {
 id: 'audit',
 title: 'Droit d\'Audit & Conformité',
 weight: 15,
 questions: [
 {
 id: 'aud_1',
 text: 'Acceptez-vous les clauses de droit d\'audit incluses dans nos contrats ?',
 type: 'yes_no',
 weight: 10,
 required: true,
 helperText: 'Point critique pour la conformité DORA.'
 },
 {
 id: 'aud_2',
 text: 'Êtes-vous certifié ISO 27001 ou SOC 2 Type II ?',
 type: 'yes_no',
 weight: 5,
 required: false
 }
 ]
 }
];
