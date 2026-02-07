import { QuestionnaireTemplate } from '../types/business';

export const DPIA_TEMPLATE: QuestionnaireTemplate = {
 id: 'dpia-cnil-v1',
 organizationId: 'system',
 title: "Analyse d'Impact (DPIA) - Modèle CNIL simplifié",
 description: "Évaluation des risques sur la vie privée basée sur la méthode de la CNIL. Obligatoire pour les traitements à risque élevé.",
 isSystem: true,
 sections: [
 {
 id: 'context',
 title: "1. Contexte du Traitement",
 weight: 20,
 questions: [
 {
  id: 'nature',
  text: "Quelle est la nature du traitement (collecte, enregistrement, transmission...) ?",
  type: 'text',
  required: true,
  weight: 1
 },
 {
  id: 'scope',
  text: "Quel est le périmètre géographique et volume des données ?",
  type: 'text',
  required: true,
  weight: 1
 }
 ]
 },
 {
 id: 'necessity',
 title: "2. Nécessité et Proportionnalité",
 weight: 30,
 questions: [
 {
  id: 'purpose_check',
  text: "La finalité est-elle déterminée, explicite et légitime ?",
  type: 'yes_no',
  required: true,
  weight: 5
 },
 {
  id: 'minimization',
  text: "Les données collectées sont-elles adéquates, pertinentes et limitées ?",
  type: 'yes_no',
  required: true,
  weight: 5
 }
 ]
 },
 {
 id: 'risks',
 title: "3. Étude des Risques (Droits et Libertés)",
 weight: 50,
 questions: [
 {
  id: 'access_control',
  text: "Des mesures de contrôle d'accès robustes sont-elles en place ?",
  type: 'multiple_choice',
  options: [
  "Oui, MFA et politique stricte",
  "Oui, authentification standard",
  "Non, accès large"
  ],
  required: true,
  weight: 10
 },
 {
  id: 'encryption',
  text: "Les données sont-elles chiffrées (au repos et en transit) ?",
  type: 'yes_no',
  required: true,
  weight: 10
 },
 {
  id: 'impact_severity',
  text: "Quel serait l'impact pour les personnes en cas de violation ?",
  type: 'multiple_choice',
  options: [
  "Négligeable",
  "Limité",
  "Important (Préjudice moral/fin)",
  "Maximal (Survie, liberté, santé)"
  ],
  required: true,
  weight: 20
 }
 ]
 }
 ],
 createdAt: new Date(Date.now()).toISOString(),
 updatedAt: new Date(Date.now()).toISOString(),
 createdBy: 'system'
};
