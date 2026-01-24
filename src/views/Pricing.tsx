import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, X, HelpCircle, Globe, ChevronDown, LayoutDashboard, FolderKanban, FileText, Calendar, Siren, Bug, Box, ShieldAlert, Activity, HeartPulse, Fingerprint, Server, Building, Briefcase, Users, Gauge, Save, Brain, Database, Headset, Info, type LucideIcon } from '../components/ui/Icons';
import { Button } from '../components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { SEO } from '../components/SEO';
import { Tooltip } from '../components/ui/Tooltip';
import { ContactModal } from '../components/ui/ContactModal';
import { LegalModal } from '../components/ui/LegalModal';
import { PLANS } from '../config/plans';

import { useStore } from '../store';
import { SubscriptionService } from '../services/subscriptionService';
import { PlanType } from '../types';
import { toast } from '../lib/toast';

const Pricing = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useStore();
  const [isAnnual, setIsAnnual] = useState(true);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms' | 'mentions' | 'cgv'>('terms');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['pilotage', 'operations']);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  interface DetailedFeature {
    name: string;
    icon?: LucideIcon;
    discovery: string | boolean;
    professional: string | boolean;
    enterprise: string | boolean;
    tooltip?: string;
  }

  interface ProcessedFeatureCategory {
    id: string;
    title: string;
    features: DetailedFeature[];
  }

  const featureCategories: ProcessedFeatureCategory[] = [
    {
      id: 'pilotage',
      title: t('common.pilotage'),
      features: [
        { name: t('common.feat_dashboard'), icon: LayoutDashboard, discovery: t('common.val_simple'), professional: t('common.val_advanced'), enterprise: t('common.val_custom'), tooltip: 'Tableaux de bord dynamiques et personnalisables pour la direction.' },
        { name: t('common.feat_projects'), icon: FolderKanban, discovery: '1', professional: '10', enterprise: t('common.val_unlimited') },
        { name: t('common.feat_reports'), icon: FileText, discovery: false, professional: true, enterprise: t('common.val_included') },
        { name: t('common.feat_calendar'), icon: Calendar, discovery: true, professional: true, enterprise: true },
      ]
    },
    {
      id: 'operations',
      title: t('common.operations'),
      features: [
        { name: t('common.feat_incidents'), icon: Siren, discovery: t('common.val_simple'), professional: t('common.val_advanced'), enterprise: t('common.val_ai_assisted') || "AI Assisted" },
        { name: t('common.feat_vulns'), icon: Bug, discovery: false, professional: t('common.val_manual'), enterprise: t('common.val_automated') || "Automated" },
        { name: t('common.feat_threats'), icon: Globe, discovery: true, professional: true, enterprise: true },
        { name: t('common.feat_voxel'), icon: Box, discovery: false, professional: true, enterprise: true, tooltip: 'Moteur de visualisation 3D des infrastructures.' },
      ]
    },
    {
      id: 'governance',
      title: t('common.governance'),
      features: [
        { name: t('common.feat_risks'), icon: ShieldAlert, discovery: t('common.val_simple'), professional: 'ISO 27005', enterprise: 'ISO/EBIOS' },
        { name: t('common.feat_compliance'), icon: Activity, discovery: false, professional: 'ISO 27001', enterprise: 'Multi-normes' },
        { name: t('common.feat_audits'), icon: FileText, discovery: false, professional: true, enterprise: t('common.val_portal') || "Portail" },
        { name: t('common.feat_portal'), discovery: false, professional: false, enterprise: true, tooltip: 'Portail dédié pour vos auditeurs externes.' },
        { name: t('common.feat_continuity'), icon: HeartPulse, discovery: false, professional: false, enterprise: true },
        { name: t('common.feat_privacy'), icon: Fingerprint, discovery: false, professional: true, enterprise: true },
      ]
    },
    {
      id: 'repository',
      title: t('common.repository'),
      features: [
        { name: t('common.feat_assets'), icon: Server, discovery: '50', professional: '250', enterprise: t('common.val_unlimited') },
        { name: t('common.feat_suppliers'), icon: Building, discovery: '10', professional: '50', enterprise: t('common.val_unlimited') },
        { name: t('common.feat_documents'), icon: Briefcase, discovery: '1 GB', professional: '10 GB', enterprise: '100 GB' },
      ]
    },
    {
      id: 'adminSec',
      title: t('common.adminSec'),
      features: [
        { name: t('common.feat_team'), icon: Users, discovery: '3', professional: '10', enterprise: t('common.val_unlimited') },
        { name: t('common.feat_health'), icon: Gauge, discovery: true, professional: true, enterprise: true },
        { name: t('common.feat_backup'), icon: Save, discovery: 'Hebdo', professional: 'Quotidien', enterprise: 'Temps réel' },
        { name: t('common.feat_ai'), icon: Brain, discovery: false, professional: true, enterprise: t('common.val_advanced') },
        { name: t('common.feat_api'), icon: Database, discovery: false, professional: false, enterprise: true },
        { name: t('common.feat_support'), icon: Headset, discovery: t('common.val_comm'), professional: t('common.val_prio'), enterprise: t('common.val_dedicated') },
      ]
    }
  ];

  const handleSelectPlan = async (planId: string) => {
    if (user && user.organizationId) {
      try {
        setIsLoading(planId);
        await SubscriptionService.startSubscription(
          user.organizationId,
          planId as PlanType,
          isAnnual ? 'year' : 'month'
        );
      } catch (error) {
        console.error('Failed to start subscription:', error);
        toast.error("Erreur lors de l'initialisation du paiement. Veuillez réessayer.");
        setIsLoading(null);
      }
    } else {
      // Navigate to registration with plan selection if not logged in
      navigate(`/register?plan=${planId}&period=${isAnnual ? 'annual' : 'monthly'}`);
    }
  };

  const renderFeatureValue = (value: string | boolean) => {
    if (value === true) return <Check className="w-5 h-5 text-success-text mx-auto" />;
    if (value === false) return <X className="w-5 h-5 text-slate-500 mx-auto opacity-50" />;
    return <span className="font-medium text-slate-700 dark:text-slate-300 text-sm">{value}</span>;
  };

  const faqs = [
    { q: t('pricing.faq1_q', "Puis-je changer de plan plus tard ?"), a: t('pricing.faq1_a', "Absolument. Vous pouvez upgrader ou downgrader votre plan à tout moment depuis votre espace d'administration. Le changement sera effectif immédiatement.") },
    { q: t('pricing.faq2_q', "Quels sont les modes de paiement ?"), a: t('pricing.faq2_a', "Nous acceptons toutes les cartes bancaires majeures (Visa, Mastercard, Amex) ainsi que les prélèvements SEPA pour les plans annuels.") },
    { q: t('pricing.faq3_q', "Les données sont-elles sécurisées ?"), a: t('pricing.faq3_a', "Oui, la sécurité est notre priorité. Toutes vos données sont chiffrées en transit et au repos. Nous sommes hébergés sur des infrastructures certifiées ISO 27001 et SecNumCloud.") },
  ];

  return (
    <div className="min-h-screen relative font-inter bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white pb-20">
      <MasterpieceBackground />
      <SEO title="Tarifs | Sentinel GRC" description="Des solutions flexibles pour sécuriser votre entreprise, de la startup au grand groupe." />

      <div className="relative z-10 container mx-auto px-4 pt-32 lg:pt-40">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400"
          >
            {t('common.pricingTitle')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg md:text-xl text-slate-600 dark:text-muted-foreground font-medium"
          >
            {t('common.pricingSubtitle')}
          </motion.p>

          {/* Billing Toggle */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-10 inline-flex items-center p-1 rounded-full bg-slate-200/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700"
          >
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 ${!isAnnual ? 'bg-white dark:bg-slate-700 shadow-md text-brand-600 dark:text-brand-400' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 ${isAnnual ? 'bg-white dark:bg-slate-700 shadow-md text-brand-600 dark:text-brand-400' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Annuel
              <span className="px-2 py-0.5 rounded-full bg-success-bg text-success-text text-[10px] uppercase tracking-wider font-extrabold">-20%</span>
            </button>
          </motion.div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24 max-w-7xl mx-auto">
          {Object.entries(PLANS).map(([key, plan], index) => {
            const isPopular = plan.highlight;
            const price = isAnnual ? Math.round(plan.priceYearly / 12) : plan.priceMonthly;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 + 0.3 }}
                className={`relative group p-8 rounded-4xl border transition-all duration-500 ${isPopular
                  ? 'bg-gradient-to-br from-slate-900 to-slate-800 text-white border-transparent shadow-2xl scale-105 z-10'
                  : 'bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-brand-600 to-violet-600 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg">
                    Recommandé
                  </div>
                )}

                <div className="mb-8">
                  <h3 className={`text-xl font-bold mb-2 ${isPopular ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-black ${isPopular ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                      {price === 0 ? '0€' : `${price}€`}
                    </span>
                    <span className={`text-sm font-medium ${isPopular ? 'text-slate-300' : 'text-slate-500'}`}>/mois</span>
                  </div>
                  <p className={`mt-4 text-sm leading-relaxed ${isPopular ? 'text-slate-300' : 'text-slate-500'}`}>
                    {key === 'DISCOVERY' ? 'Pour découvrir la plateforme et gérer vos premiers risques.' :
                      key === 'professional' ? 'Pour les équipes structurées qui visent la conformité ISO.' :
                        'Pour les grandes organisations avec des besoins complexes de gouvernance.'}
                  </p>
                </div>

                <Button
                  onClick={() => handleSelectPlan(plan.id)}
                  isLoading={isLoading === plan.id}
                  disabled={!!isLoading}
                  className={`w-full h-12 rounded-xl font-bold text-sm tracking-wide transition-all duration-300 ${isPopular
                    ? 'bg-white text-slate-900 hover:bg-slate-100 hover:scale-[1.02]'
                    : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 hover:scale-[1.02]'
                    }`}
                >
                  {isLoading === plan.id ? 'Chargement...' : 'Commencer'}
                </Button>

                <div className="mt-8 space-y-4">
                  {(plan.featuresList || []).slice(0, 5).map((feature, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`mt-1 p-0.5 rounded-full ${isPopular ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                        <Check className={`w-3 h-3 ${isPopular ? 'text-white' : 'text-slate-900 dark:text-white'}`} />
                      </div>
                      <span className={`text-sm font-medium ${isPopular ? 'text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Detailed Comparison Table */}
        <div className="max-w-7xl mx-auto mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Comparaison Détaillée</h2>
            <p className="text-slate-500">Tout ce inclus dans chaque plan.</p>
          </div>

          <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-5xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-xl">
            {/* Table Header - Sticky */}
            <div className="grid grid-cols-4 p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-20">
              <div className="col-span-1 p-2 font-bold text-slate-500 uppercase text-xs tracking-wider">Fonctionnalités</div>
              <div className="col-span-1 p-2 text-center font-bold text-slate-900 dark:text-white">Discovery</div>
              <div className="col-span-1 p-2 text-center font-bold text-brand-600 dark:text-brand-400">Professional</div>
              <div className="col-span-1 p-2 text-center font-bold text-slate-900 dark:text-white">Enterprise</div>
            </div>

            {/* Feature Categories */}
            <div className="divide-y divide-slate-200 dark:divide-white/5">
              {featureCategories.map((category) => (
                <div key={category.id} className="transition-colors hover:bg-slate-50/30 dark:hover:bg-white/5">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between p-6 bg-slate-50/50 dark:bg-slate-900/30 font-bold text-left hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <span className="text-lg text-slate-800 dark:text-slate-200">{category.title}</span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${expandedCategories.includes(category.id) ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {expandedCategories.includes(category.id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                          {category.features.map((feature, idx) => (
                            <div key={idx} className="grid grid-cols-4 p-4 items-center hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                              <div className="col-span-1 flex items-center gap-3 pl-4">
                                {feature.icon && <feature.icon className="w-4 h-4 text-muted-foreground" />}
                                <span className="text-sm font-medium text-slate-700 dark:text-muted-foreground">
                                  {feature.name}
                                  {feature.tooltip && (
                                    <Tooltip content={feature.tooltip}>
                                      <Info className="w-3.5 h-3.5 text-slate-400 ml-2 inline cursor-help" />
                                    </Tooltip>
                                  )}
                                </span>
                              </div>
                              <div className="col-span-1 text-center">{renderFeatureValue(feature.discovery)}</div>
                              <div className="col-span-1 text-center bg-brand-50/30 dark:bg-brand-900/10 py-2 rounded-lg">{renderFeatureValue(feature.professional)}</div>
                              <div className="col-span-1 text-center">{renderFeatureValue(feature.enterprise)}</div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="glass-premium p-0 rounded-5xl overflow-hidden mb-24 max-w-4xl mx-auto">
          <div className="px-10 pt-10 pb-6 bg-slate-50/50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{t('pricing.faq', 'FAQ')}</h3>
              <p className="text-sm text-slate-600 dark:text-muted-foreground mt-1 font-medium">{t('pricing.faqDesc', 'Questions fréquentes')}</p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
              <HelpCircle className="w-6 h-6 text-slate-500" />
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {faqs.map((faq, i) => (
              <div key={i} className="group">
                <button
                  onClick={() => setExpandedCategories(prev => prev.includes(`faq-${i}`) ? prev.filter(c => c !== `faq-${i}`) : [...prev, `faq-${i}`])}
                  className="w-full flex items-center justify-between p-8 text-left hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors"
                >
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-base">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${expandedCategories.includes(`faq-${i}`) ? 'rotate-180 text-brand-500' : ''}`}
                  />
                </button>
                <AnimatePresence>
                  {expandedCategories.includes(`faq-${i}`) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-8 pb-8 pt-0">
                        <p className="text-base text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                          {faq.a}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Section */}
        <div className="text-center pb-8 border-t border-slate-200 dark:border-slate-800 pt-8 mt-12">
          <p className="text-sm text-slate-500 font-medium mb-4">
            {t('pricing.contact.text', 'Besoin de plus d\'informations ?')}
            <Button
              variant="link"
              onClick={() => setIsContactOpen(true)}
              className="ml-1 text-slate-900 dark:text-white hover:underline font-bold h-auto p-0"
            >
              {t('pricing.contact.link', 'Contactez-nous')}
            </Button>
          </p>

          <div className="flex flex-wrap gap-4 justify-center items-center text-xs font-medium text-slate-500">
            <Button variant="ghost" size="sm" onClick={() => { setLegalTab('cgv'); setShowLegalModal(true); }} className="hover:text-slate-900 dark:hover:text-white transition-colors h-auto py-1">CGV</Button>
            <Button variant="ghost" size="sm" onClick={() => { setLegalTab('privacy'); setShowLegalModal(true); }} className="hover:text-slate-900 dark:hover:text-white transition-colors h-auto py-1">Confidentialité</Button>
            <Button variant="ghost" size="sm" onClick={() => { setLegalTab('mentions'); setShowLegalModal(true); }} className="hover:text-slate-900 dark:hover:text-white transition-colors h-auto py-1">Mentions Légales</Button>
          </div>
        </div>
      </div>

      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
        subject="Demande de devis / Information"
      />

      <LegalModal
        isOpen={showLegalModal}
        onClose={() => setShowLegalModal(false)}
        initialTab={legalTab}
      />
    </div>
  );
};

export default Pricing;
