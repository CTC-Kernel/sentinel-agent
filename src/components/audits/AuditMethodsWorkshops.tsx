/**
 * Audit Methods & Workshops Component
 * Provides structured methodologies for Internal, External, and Certification audits
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PremiumCard } from '../ui/PremiumCard';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';
import {
  Building2,
  Users,
  Award,
  ChevronRight,
  CheckCircle,
  Circle,
  Clock,
  FileText,
  Target,
  Lightbulb,
  ClipboardList,
  FileCheck,
  BookOpen,
  Play,
  RotateCcw,
} from '../ui/Icons';
import { Button } from '../ui/button';
import type { AuditMethodTemplate, AuditWorkshopPhase } from '../../types/audits';

interface AuditMethodsWorkshopsProps {
  onStartWorkshop?: (templateId: string, auditId?: string) => void;
  selectedAuditId?: string;
}

// Default audit method templates
const AUDIT_METHOD_TEMPLATES: AuditMethodTemplate[] = [
  {
    id: 'internal-iso27001',
    name: 'Audit Interne ISO 27001',
    type: 'Interne',
    framework: 'ISO 27001:2022',
    description: 'Méthodologie complète pour conduire un audit interne du SMSI selon les exigences ISO 27001.',
    estimatedDuration: '2-4 semaines',
    bestPractices: [
      'Planifier l\'audit au moins 2 semaines à l\'avance',
      'Impliquer les responsables de processus dès la phase de préparation',
      'Utiliser des checklists basées sur les contrôles de l\'Annexe A',
      'Documenter toutes les preuves collectées',
      'Prévoir une réunion de clôture avec les audités',
    ],
    deliverables: [
      'Plan d\'audit détaillé',
      'Rapport d\'audit avec constats',
      'Liste des non-conformités',
      'Recommandations d\'amélioration',
      'Suivi des actions correctives',
    ],
    phases: [
      {
        id: 'prep-internal',
        name: 'Phase 1: Préparation',
        description: 'Définition du périmètre, objectifs et planification de l\'audit',
        order: 1,
        tasks: [
          { id: 't1', title: 'Définir le périmètre de l\'audit', description: 'Identifier les processus, départements et contrôles à auditer', isCompleted: false, isRequired: true },
          { id: 't2', title: 'Constituer l\'équipe d\'audit', description: 'Sélectionner les auditeurs qualifiés et indépendants', isCompleted: false, isRequired: true },
          { id: 't3', title: 'Élaborer le plan d\'audit', description: 'Calendrier, ressources et critères d\'audit', isCompleted: false, isRequired: true },
          { id: 't4', title: 'Préparer les checklists', description: 'Créer ou adapter les questionnaires d\'audit', isCompleted: false, isRequired: true },
          { id: 't5', title: 'Communiquer le plan', description: 'Informer les audités du calendrier et des attentes', isCompleted: false, isRequired: false },
        ],
        deliverables: ['Plan d\'audit', 'Checklists d\'audit', 'Notification aux audités'],
      },
      {
        id: 'exec-internal',
        name: 'Phase 2: Réalisation',
        description: 'Conduite de l\'audit sur le terrain',
        order: 2,
        tasks: [
          { id: 't6', title: 'Réunion d\'ouverture', description: 'Présenter les objectifs et le déroulement aux audités', isCompleted: false, isRequired: true },
          { id: 't7', title: 'Collecter les preuves', description: 'Interviews, observations, revue documentaire', isCompleted: false, isRequired: true },
          { id: 't8', title: 'Évaluer la conformité', description: 'Comparer les pratiques aux exigences ISO 27001', isCompleted: false, isRequired: true },
          { id: 't9', title: 'Identifier les écarts', description: 'Documenter les non-conformités et observations', isCompleted: false, isRequired: true },
          { id: 't10', title: 'Réunion de clôture', description: 'Présenter les constats préliminaires', isCompleted: false, isRequired: true },
        ],
        deliverables: ['Notes d\'entretien', 'Preuves collectées', 'Constats préliminaires'],
      },
      {
        id: 'report-internal',
        name: 'Phase 3: Rapport',
        description: 'Rédaction et diffusion du rapport d\'audit',
        order: 3,
        tasks: [
          { id: 't11', title: 'Rédiger le rapport', description: 'Documenter tous les constats avec preuves', isCompleted: false, isRequired: true },
          { id: 't12', title: 'Classifier les constats', description: 'Non-conformités majeures, mineures, observations', isCompleted: false, isRequired: true },
          { id: 't13', title: 'Valider avec l\'équipe', description: 'Revue interne du rapport avant diffusion', isCompleted: false, isRequired: false },
          { id: 't14', title: 'Diffuser le rapport', description: 'Envoyer aux parties prenantes concernées', isCompleted: false, isRequired: true },
        ],
        deliverables: ['Rapport d\'audit final', 'Synthèse exécutive'],
      },
      {
        id: 'followup-internal',
        name: 'Phase 4: Suivi',
        description: 'Suivi des actions correctives et amélioration continue',
        order: 4,
        tasks: [
          { id: 't15', title: 'Définir les actions correctives', description: 'Plan d\'action pour chaque non-conformité', isCompleted: false, isRequired: true },
          { id: 't16', title: 'Assigner les responsables', description: 'Désigner les propriétaires des actions', isCompleted: false, isRequired: true },
          { id: 't17', title: 'Suivre l\'avancement', description: 'Vérifier la mise en œuvre des corrections', isCompleted: false, isRequired: true },
          { id: 't18', title: 'Clôturer les constats', description: 'Valider l\'efficacité des actions', isCompleted: false, isRequired: true },
        ],
        deliverables: ['Plan d\'actions correctives', 'Rapport de suivi'],
      },
    ],
  },
  {
    id: 'external-audit',
    name: 'Audit Externe / Tiers',
    type: 'Externe',
    framework: 'Multi-référentiel',
    description: 'Guide pour préparer et accompagner un audit conduit par un organisme externe ou un client.',
    estimatedDuration: '1-2 semaines (préparation) + audit',
    bestPractices: [
      'Anticiper les demandes documentaires de l\'auditeur externe',
      'Préparer les équipes aux interviews',
      'Centraliser les preuves dans un espace dédié',
      'Désigner un point de contact unique pour l\'auditeur',
      'Effectuer un audit blanc avant l\'audit réel',
    ],
    deliverables: [
      'Dossier de preuves organisé',
      'Matrice de correspondance exigences/preuves',
      'Planning d\'accompagnement',
      'Compte-rendu des échanges',
      'Plan de remédiation post-audit',
    ],
    phases: [
      {
        id: 'prep-external',
        name: 'Phase 1: Préparation',
        description: 'Anticipation et organisation avant l\'arrivée de l\'auditeur',
        order: 1,
        tasks: [
          { id: 'e1', title: 'Analyser le référentiel', description: 'Comprendre les exigences spécifiques de l\'audit', isCompleted: false, isRequired: true },
          { id: 'e2', title: 'Réaliser un audit blanc', description: 'Identifier les gaps avant l\'audit officiel', isCompleted: false, isRequired: false, helpText: 'Fortement recommandé pour les premiers audits' },
          { id: 'e3', title: 'Préparer la documentation', description: 'Rassembler et organiser toutes les preuves', isCompleted: false, isRequired: true },
          { id: 'e4', title: 'Former les équipes', description: 'Briefer les collaborateurs sur le déroulement', isCompleted: false, isRequired: true },
          { id: 'e5', title: 'Logistique', description: 'Réserver les salles, accès, équipements', isCompleted: false, isRequired: false },
        ],
        deliverables: ['Dossier de preuves', 'Brief équipes', 'Planning logistique'],
      },
      {
        id: 'accomp-external',
        name: 'Phase 2: Accompagnement',
        description: 'Support pendant le déroulement de l\'audit',
        order: 2,
        tasks: [
          { id: 'e6', title: 'Accueillir l\'auditeur', description: 'Présentation de l\'organisation et du périmètre', isCompleted: false, isRequired: true },
          { id: 'e7', title: 'Coordonner les interviews', description: 'Planifier et faciliter les entretiens', isCompleted: false, isRequired: true },
          { id: 'e8', title: 'Fournir les preuves', description: 'Répondre aux demandes documentaires', isCompleted: false, isRequired: true },
          { id: 'e9', title: 'Prendre des notes', description: 'Documenter les observations de l\'auditeur', isCompleted: false, isRequired: true },
          { id: 'e10', title: 'Clarifier les points', description: 'Répondre aux questions et lever les ambiguïtés', isCompleted: false, isRequired: true },
        ],
        deliverables: ['Notes de suivi', 'Liste des preuves fournies'],
      },
      {
        id: 'post-external',
        name: 'Phase 3: Post-Audit',
        description: 'Analyse des résultats et plan d\'amélioration',
        order: 3,
        tasks: [
          { id: 'e11', title: 'Analyser le rapport', description: 'Comprendre les constats et recommandations', isCompleted: false, isRequired: true },
          { id: 'e12', title: 'Prioriser les actions', description: 'Établir un plan de remédiation', isCompleted: false, isRequired: true },
          { id: 'e13', title: 'Communiquer en interne', description: 'Partager les résultats avec la direction', isCompleted: false, isRequired: true },
          { id: 'e14', title: 'Mettre en œuvre', description: 'Exécuter les actions correctives', isCompleted: false, isRequired: true },
        ],
        deliverables: ['Plan de remédiation', 'Rapport de synthèse interne'],
      },
    ],
  },
  {
    id: 'certification-iso27001',
    name: 'Audit de Certification ISO 27001',
    type: 'Certification',
    framework: 'ISO 27001:2022',
    description: 'Préparation complète pour obtenir ou renouveler la certification ISO 27001.',
    estimatedDuration: '3-6 mois (préparation) + audit',
    bestPractices: [
      'Commencer la préparation au moins 6 mois avant l\'audit',
      'S\'assurer que le SMSI est opérationnel depuis 3 mois minimum',
      'Avoir réalisé au moins un cycle complet d\'audit interne',
      'Avoir conduit une revue de direction documentée',
      'Préparer une déclaration d\'applicabilité (SoA) à jour',
    ],
    deliverables: [
      'SMSI documenté et opérationnel',
      'Déclaration d\'applicabilité (SoA)',
      'Analyse des risques complète',
      'Rapports d\'audits internes',
      'Procès-verbaux de revue de direction',
      'Certificat ISO 27001',
    ],
    phases: [
      {
        id: 'gap-cert',
        name: 'Phase 1: Analyse d\'écarts',
        description: 'Évaluation initiale de la maturité du SMSI',
        order: 1,
        tasks: [
          { id: 'c1', title: 'Évaluer la documentation', description: 'Vérifier l\'existence et la qualité des documents requis', isCompleted: false, isRequired: true },
          { id: 'c2', title: 'Analyser les contrôles', description: 'Évaluer la mise en œuvre des 93 contrôles de l\'Annexe A', isCompleted: false, isRequired: true },
          { id: 'c3', title: 'Identifier les gaps', description: 'Lister les écarts par rapport aux exigences', isCompleted: false, isRequired: true },
          { id: 'c4', title: 'Établir la roadmap', description: 'Planifier les actions de mise en conformité', isCompleted: false, isRequired: true },
        ],
        deliverables: ['Rapport d\'analyse d\'écarts', 'Roadmap de certification'],
      },
      {
        id: 'impl-cert',
        name: 'Phase 2: Mise en conformité',
        description: 'Implémentation des exigences manquantes',
        order: 2,
        tasks: [
          { id: 'c5', title: 'Finaliser la documentation', description: 'Politiques, procédures, enregistrements', isCompleted: false, isRequired: true },
          { id: 'c6', title: 'Déployer les contrôles', description: 'Mettre en œuvre les mesures de sécurité', isCompleted: false, isRequired: true },
          { id: 'c7', title: 'Former les équipes', description: 'Sensibilisation et formation SMSI', isCompleted: false, isRequired: true },
          { id: 'c8', title: 'Collecter les preuves', description: 'Documenter le fonctionnement du SMSI', isCompleted: false, isRequired: true },
        ],
        deliverables: ['Documentation SMSI', 'Preuves de fonctionnement'],
      },
      {
        id: 'audit-internal-cert',
        name: 'Phase 3: Audit interne',
        description: 'Vérification de la conformité avant l\'audit de certification',
        order: 3,
        tasks: [
          { id: 'c9', title: 'Planifier l\'audit interne', description: 'Couvrir l\'ensemble du périmètre', isCompleted: false, isRequired: true },
          { id: 'c10', title: 'Réaliser l\'audit', description: 'Évaluer la conformité et l\'efficacité', isCompleted: false, isRequired: true },
          { id: 'c11', title: 'Traiter les non-conformités', description: 'Actions correctives avant certification', isCompleted: false, isRequired: true },
          { id: 'c12', title: 'Revue de direction', description: 'Valider la maturité du SMSI', isCompleted: false, isRequired: true },
        ],
        deliverables: ['Rapport d\'audit interne', 'PV de revue de direction'],
      },
      {
        id: 'stage1-cert',
        name: 'Phase 4: Audit Stage 1',
        description: 'Audit documentaire par l\'organisme de certification',
        order: 4,
        tasks: [
          { id: 'c13', title: 'Préparer le dossier', description: 'SoA, politiques, procédures clés', isCompleted: false, isRequired: true },
          { id: 'c14', title: 'Accompagner l\'auditeur', description: 'Présentation du SMSI et documentation', isCompleted: false, isRequired: true },
          { id: 'c15', title: 'Analyser les retours', description: 'Traiter les observations du Stage 1', isCompleted: false, isRequired: true },
        ],
        deliverables: ['Rapport Stage 1', 'Plan d\'action Stage 1'],
      },
      {
        id: 'stage2-cert',
        name: 'Phase 5: Audit Stage 2',
        description: 'Audit de certification sur site',
        order: 5,
        tasks: [
          { id: 'c16', title: 'Finaliser les corrections', description: 'Clôturer les actions du Stage 1', isCompleted: false, isRequired: true },
          { id: 'c17', title: 'Accompagner l\'audit', description: 'Interviews, visites, preuves', isCompleted: false, isRequired: true },
          { id: 'c18', title: 'Réunion de clôture', description: 'Recevoir les constats finaux', isCompleted: false, isRequired: true },
          { id: 'c19', title: 'Traiter les NC', description: 'Actions correctives post-audit', isCompleted: false, isRequired: true },
        ],
        deliverables: ['Rapport d\'audit final', 'Certificat ISO 27001'],
      },
    ],
  },
];

const typeIcons: Record<string, React.ReactNode> = {
  'Interne': <Building2 className="w-6 h-6" />,
  'Externe': <Users className="w-6 h-6" />,
  'Certification': <Award className="w-6 h-6" />,
};

// Using muted, professional colors aligned with design tokens
const typeColors: Record<string, string> = {
  'Interne': 'bg-brand-500',
  'Externe': 'bg-violet-500',
  'Certification': 'bg-warning',
};

const typeBgColors: Record<string, string> = {
  'Interne': 'bg-brand-50 dark:bg-brand-900 border-brand-200 dark:border-brand-800',
  'Externe': 'bg-violet-50/50 dark:bg-violet-900/10 border-violet-200 dark:border-violet-800',
  'Certification': 'bg-warning-bg dark:bg-warning/10 border-warning-border dark:border-warning/30',
};

export const AuditMethodsWorkshops: React.FC<AuditMethodsWorkshopsProps> = ({
  onStartWorkshop,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<AuditMethodTemplate | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [activeWorkshop, setActiveWorkshop] = useState<{
    templateId: string;
    phases: AuditWorkshopPhase[];
    progress: number;
  } | null>(null);

  // Calculate progress for active workshop
  const workshopProgress = useMemo(() => {
    if (!activeWorkshop) return 0;
    const allTasks = activeWorkshop.phases.flatMap(p => p.tasks);
    const completedTasks = allTasks.filter(t => t.isCompleted).length;
    return Math.round((completedTasks / allTasks.length) * 100);
  }, [activeWorkshop]);

  const handleStartWorkshop = (template: AuditMethodTemplate) => {
    const phases: AuditWorkshopPhase[] = template.phases.map(p => ({
      ...p,
      status: 'not_started' as const,
      tasks: p.tasks.map(t => ({ ...t, isCompleted: false })),
    }));

    setActiveWorkshop({
      templateId: template.id,
      phases,
      progress: 0,
    });

    if (onStartWorkshop) {
      onStartWorkshop(template.id);
    }
  };

  const handleToggleTask = (phaseId: string, taskId: string) => {
    if (!activeWorkshop) return;

    setActiveWorkshop(prev => {
      if (!prev) return prev;

      const updatedPhases = prev.phases.map(phase => {
        if (phase.id !== phaseId) return phase;

        const updatedTasks = phase.tasks.map(task =>
          task.id === taskId ? { ...task, isCompleted: !task.isCompleted } : task
        );

        const allCompleted = updatedTasks.filter(t => t.isRequired).every(t => t.isCompleted);
        const anyStarted = updatedTasks.some(t => t.isCompleted);

        return {
          ...phase,
          tasks: updatedTasks,
          status: allCompleted ? 'completed' : anyStarted ? 'in_progress' : 'not_started',
          completedAt: allCompleted ? new Date().toISOString() : undefined,
        } as AuditWorkshopPhase;
      });

      return { ...prev, phases: updatedPhases };
    });
  };

  const handleResetWorkshop = () => {
    setActiveWorkshop(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Méthodes & Ateliers d'Audit
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">
            Méthodologies structurées pour conduire vos audits de sécurité
          </p>
        </div>
        {activeWorkshop && (
          <Button variant="outline" size="sm" onClick={handleResetWorkshop} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Réinitialiser l'atelier
          </Button>
        )}
      </div>

      {/* Method Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {AUDIT_METHOD_TEMPLATES.map((template) => {
          const isActive = activeWorkshop?.templateId === template.id;
          const isSelected = selectedTemplate?.id === template.id;

          return (
            <motion.div
              key={template.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <PremiumCard glass
                className={cn(
                  "p-5 cursor-pointer transition-all border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  isSelected ? "ring-2 ring-indigo-500 border-indigo-300 dark:border-indigo-700" : "border-transparent",
                  isActive && "bg-green-500 dark:bg-green-50 dark:bg-green-900 border-green-300 dark:border-green-700 dark:border-green-700",
                  typeBgColors[template.type]
                )}
                onClick={() => setSelectedTemplate(template)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedTemplate(template);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={cn("p-3 rounded-3xl text-white", typeColors[template.type])}>
                    {typeIcons[template.type]}
                  </div>
                  {isActive && (
                    <Badge status="success" size="sm">En cours</Badge>
                  )}
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                  {template.name}
                </h3>

                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" size="sm">{template.type}</Badge>
                  {template.framework && (
                    <Badge variant="outline" size="sm">{template.framework}</Badge>
                  )}
                </div>

                <p className="text-sm text-slate-600 dark:text-muted-foreground mb-4 line-clamp-2">
                  {template.description}
                </p>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {template.estimatedDuration}
                  </span>
                  <span className="flex items-center gap-1">
                    <ClipboardList className="w-3.5 h-3.5" />
                    {template.phases.length} phases
                  </span>
                </div>

                {isActive && (
                  <div className="mt-4 pt-4 border-t border-border/40 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-600 dark:text-muted-foreground">Progression</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{workshopProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${workshopProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </PremiumCard>
            </motion.div>
          );
        })}
      </div>

      {/* Selected Template Detail */}
      <AnimatePresence mode="wait">
        {selectedTemplate && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Template Overview */}
            <PremiumCard glass className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={cn("p-4 rounded-2xl text-white", typeColors[selectedTemplate.type])}>
                    {typeIcons[selectedTemplate.type]}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                      {selectedTemplate.name}
                    </h3>
                    <p className="text-slate-500 mt-1">{selectedTemplate.description}</p>
                  </div>
                </div>
                {!activeWorkshop || activeWorkshop.templateId !== selectedTemplate.id ? (
                  <Button
                    onClick={() => handleStartWorkshop(selectedTemplate)}
                    className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600"
                  >
                    <Play className="w-4 h-4" />
                    Démarrer l'atelier
                  </Button>
                ) : (
                  <Badge status="success" className="text-sm px-4 py-2">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Atelier en cours
                  </Badge>
                )}
              </div>

              {/* Best Practices & Deliverables */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-4 rounded-3xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-indigo-700 dark:text-indigo-400 mb-3">
                    <Lightbulb className="w-4 h-4" />
                    Bonnes pratiques
                  </h4>
                  <ul className="space-y-2">
                    {selectedTemplate.bestPractices.map((practice, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-muted-foreground">
                        <CheckCircle className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                        {practice}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-3xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-3">
                    <FileText className="w-4 h-4" />
                    Livrables attendus
                  </h4>
                  <ul className="space-y-2">
                    {selectedTemplate.deliverables.map((deliverable, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-muted-foreground">
                        <FileCheck className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        {deliverable}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </PremiumCard>

            {/* Phases Accordion */}
            <div className="space-y-3">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-500" />
                Phases de l'audit
              </h4>

              {(activeWorkshop?.templateId === selectedTemplate.id
                ? activeWorkshop.phases
                : selectedTemplate.phases.map(p => ({ ...p, status: 'not_started' as const }))
              ).map((phase, index) => {
                const isExpanded = expandedPhase === phase.id;
                const completedTasks = phase.tasks.filter(t => t.isCompleted).length;
                const totalTasks = phase.tasks.length;
                const phaseProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                return (
                  <PremiumCard glass key={phase.id} className="overflow-hidden">
                    <button
                      onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-3xl flex items-center justify-center text-white font-bold",
                          phase.status === 'completed' ? 'bg-green-500' :
                            phase.status === 'in_progress' ? 'bg-blue-500' :
                              'bg-slate-400'
                        )}>
                          {phase.status === 'completed' ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : (
                            index + 1
                          )}
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-900 dark:text-white">{phase.name}</h5>
                          <p className="text-sm text-slate-500">{phase.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {activeWorkshop?.templateId === selectedTemplate.id && (
                          <div className="text-right">
                            <span className="text-sm font-medium text-slate-600 dark:text-muted-foreground">
                              {completedTasks}/{totalTasks} tâches
                            </span>
                            <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-1">
                              <div
                                className="h-full bg-indigo-500 rounded-full transition-all"
                                style={{ width: `${phaseProgress}%` }}
                              />
                            </div>
                          </div>
                        )}
                        <ChevronRight className={cn(
                          "w-5 h-5 text-slate-400 transition-transform",
                          isExpanded && "rotate-90"
                        )} />
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-border/40 dark:border-slate-700"
                        >
                          <div className="p-4 space-y-3">
                            {phase.tasks.map((task) => {
                              const isWorkshopActive = activeWorkshop?.templateId === selectedTemplate.id;

                              return (
                                <div
                                  key={task.id}
                                  className={cn(
                                    "flex items-start gap-3 p-3 rounded-3xl border transition-colors relative",
                                    task.isCompleted
                                      ? "bg-green-50 dark:bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-800 dark:border-green-800"
                                      : "bg-white dark:bg-slate-800/50 border-border/40 dark:border-slate-700",
                                    isWorkshopActive && "hover:border-indigo-300 dark:hover:border-indigo-700"
                                  )}
                                >
                                  {isWorkshopActive && (
                                    <button
                                      onClick={() => handleToggleTask(phase.id, task.id)}
                                      className="absolute inset-0 w-full h-full bg-transparent border-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-3xl"
                                      aria-label={`Toggle task: ${task.title}`}
                                    />
                                  )}
                                  <div className="mt-0.5">
                                    {task.isCompleted ? (
                                      <CheckCircle className="w-5 h-5 text-green-500" />
                                    ) : (
                                      <Circle className="w-5 h-5 text-slate-300 dark:text-slate-300" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className={cn(
                                        "font-medium",
                                        task.isCompleted
                                          ? "text-green-700 dark:text-green-400 line-through"
                                          : "text-slate-900 dark:text-white"
                                      )}>
                                        {task.title}
                                      </span>
                                      {task.isRequired && (
                                        <Badge status="warning" size="sm">Requis</Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-slate-500 dark:text-slate-300 mt-0.5">{task.description}</p>
                                    {task.helpText && (
                                      <p className="text-xs text-indigo-500 mt-1 flex items-center gap-1">
                                        <BookOpen className="w-3 h-3" />
                                        {task.helpText}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {phase.deliverables && phase.deliverables.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-border/40 dark:border-slate-700">
                                <h6 className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-2">
                                  Livrables de cette phase
                                </h6>
                                <div className="flex flex-wrap gap-2">
                                  {phase.deliverables.map((d, i) => (
                                    <Badge key={i} variant="outline" size="sm" className="gap-1">
                                      <FileText className="w-3 h-3" />
                                      {d}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </PremiumCard>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!selectedTemplate && (
        <PremiumCard glass className="p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-indigo-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Sélectionnez une méthode d'audit
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              Choisissez un type d'audit ci-dessus pour voir la méthodologie détaillée et démarrer un atelier interactif.
            </p>
          </div>
        </PremiumCard>
      )}
    </div>
  );
};

export default AuditMethodsWorkshops;
