import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorLogger } from '../services/errorLogger';
import { useNavigate } from 'react-router-dom';
import { Check, X, HelpCircle, Globe, ChevronDown, LayoutDashboard, FolderKanban, FileText, Calendar, Siren, Bug, Box, ShieldAlert, Activity, HeartPulse, Fingerprint, Server, Building, Briefcase, Users, Gauge, Save, Brain, Database, Headset, Info, Sparkles, Crown, Star, Building2, ArrowRight, type LucideIcon } from '../components/ui/Icons';
import { Button } from '../components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { SEO } from '../components/SEO';
import { Tooltip } from '../components/ui/Tooltip';
import { ContactModal } from '../components/ui/ContactModal';
import { LegalModal } from '../components/ui/LegalModal';
import { PLANS } from '../config/plans';
import { cn } from '../lib/utils';
import { PremiumCard } from '../components/ui/PremiumCard';
import { TechCorner } from '../components/ui/TechCorner';
import { useStore } from '../store';
import { SubscriptionService } from '../services/subscriptionService';
import { PlanType } from '../types';
import { toast } from '../lib/toast';

// Plan icons mapping
const PLAN_ICONS: Record<string, LucideIcon> = {
  discovery: Star,
  professional: Crown,
  enterprise: Building2
};

// Plan gradient mapping
const PLAN_GRADIENTS: Record<string, { from: string; to: string; glow: string }> = {
  discovery: { from: 'from-slate-400', to: 'to-slate-500', glow: 'shadow-slate-400/20' },
  professional: { from: 'from-brand-500', to: 'to-violet-600', glow: 'shadow-brand-500/30' },
  enterprise: { from: 'from-purple-500', to: 'to-fuchsia-600', glow: 'shadow-purple-500/30' }
};



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
        ErrorLogger.error(error, 'Pricing.handleSubscribe');
        toast.error(t('pricing.subscriptionError'));
        setIsLoading(null);
      }
    } else {
      // Navigate to registration with plan selection if not logged in
      navigate(`/register?plan=${planId}&period=${isAnnual ? 'annual' : 'monthly'}`);
    }
  };

  const renderFeatureValue = (value: string | boolean) => {
    if (value === true) return <Check className="w-5 h-5 text-success-500 mx-auto" />;
    if (value === false) return <X className="w-5 h-5 text-slate-300 dark:text-slate-300 mx-auto" />;
    return <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{value}</span>;
  };

  const faqs = [
    { q: t('pricing.faq1_q'), a: t('pricing.faq1_a') },
    { q: t('pricing.faq2_q'), a: t('pricing.faq2_a') },
    { q: t('pricing.faq3_q'), a: t('pricing.faq3_a') },
  ];

  return (
    <div className="min-h-screen relative font-inter text-slate-900 dark:text-white pb-20">
      <MasterpieceBackground />
      <SEO title="Tarifs | Sentinel GRC" description="Des solutions flexibles pour sécuriser votre entreprise, de la startup au grand groupe." />

      <div className="relative z-10 container mx-auto px-4 pt-32 lg:pt-40">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 border border-brand-200 mb-6"
          >
            <Sparkles className="w-4 h-4 text-brand-500" />
            <span className="text-sm font-bold text-brand-600 dark:text-brand-400">Tarification transparente</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-200 dark:to-white"
          >
            {t('common.pricingTitle')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg md:text-xl text-slate-600 dark:text-slate-300 font-medium"
          >
            {t('common.pricingSubtitle')}
          </motion.p>

          {/* Billing Toggle */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-10 inline-flex items-center p-1.5 rounded-2xl glass-premium border border-white/60 dark:border-white/10 shadow-lg"
          >
            <button
              onClick={() => setIsAnnual(false)}
              className={cn(
                "px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300",
                !isAnnual
                  ? 'bg-white dark:bg-slate-800 shadow-md text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {t('pricing.monthly', { defaultValue: 'Mensuel' })}
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={cn(
                "px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2",
                isAnnual
                  ? 'bg-white dark:bg-slate-800 shadow-md text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {t('pricing.annual', { defaultValue: 'Annuel' })}
              <span className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-success-500 to-emerald-500 text-white text-[11px] uppercase tracking-wider font-black shadow-sm">
                -20%
              </span>
            </button>
          </motion.div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 mb-24 max-w-7xl mx-auto">
          {Object.entries(PLANS).map(([key, plan], index) => {
            const isPopular = plan.highlight;
            const price = isAnnual ? Math.round(plan.priceYearly / 12) : plan.priceMonthly;
            const PlanIcon = PLAN_ICONS[plan.id] || Star;
            const gradient = PLAN_GRADIENTS[plan.id] || PLAN_GRADIENTS.discovery;

            return (
              <motion.div
                key={plan.id || 'unknown'}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 + 0.3 }}
              >
                <PremiumCard
                  glass={!isPopular}
                  gradient={isPopular}
                  glow={isPopular}
                  hover={true}
                  className={cn(
                    "h-full flex flex-col pt-10 px-8 pb-8",
                    isPopular ? 'scale-105 z-10 border-brand-300' : 'border-white/60 dark:border-white/10'
                  )}
                >
                  {isPopular && (
                    <div className="absolute top-0 right-0">
                      <div className="bg-brand-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl shadow-lg">
                        RECOMMANDÉ
                      </div>
                    </div>
                  )}

                  {/* Icon & Title */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className={cn(
                      "p-3 rounded-2xl shadow-inner",
                      `bg-gradient-to-br ${gradient.from} ${gradient.to}`
                    )}>
                      <PlanIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className={cn(
                        "text-xl font-bold",
                        isPopular ? 'text-slate-900 dark:text-white' : 'text-slate-900 dark:text-white'
                      )}>
                        {plan.name}
                      </h3>
                      <p className={cn("text-xs font-medium uppercase tracking-wider opacity-70")}>
                        {isAnnual ? 'Facturation annuelle' : 'Facturation mensuelle'}
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                        {price === 0 ? 'Gratuit' : `${price}€`}
                      </span>
                      {price > 0 && <span className="text-sm font-bold text-slate-500">/mois</span>}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 mb-8 min-h-[40px]">
                    {key === 'DISCOVERY' ? 'Idéal pour découvrir la plateforme et gérer vos premiers risques.' :
                      key === 'professional' ? 'Pour les équipes structurées visant la conformité ISO 27001.' :
                        'Pour les grandes organisations aux besoins complexes.'}
                  </p>

                  {/* Features */}
                  <div className="space-y-4 mb-8 flex-grow">
                    {(plan.featuresList || []).slice(0, 6).map((feature, i) => (
                      <div key={i || 'unknown'} className="flex items-start gap-3">
                        <div className="mt-0.5 p-1 rounded-full bg-success-bg dark:bg-success-500/20">
                          <Check className="w-3 h-3 text-success-600 dark:text-success-400" />
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <Button
                    onClick={() => handleSelectPlan(plan.id)}
                    isLoading={isLoading === plan.id}
                    disabled={!!isLoading}
                    className={cn(
                      "w-full rounded-xl font-bold py-6 transition-all duration-300 group",
                      isPopular
                        ? 'bg-gradient-to-r from-brand-600 to-violet-600 text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 hover:scale-[1.02]'
                        : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100'
                    )}
                  >
                    {isLoading === plan.id ? t('common.loading', { defaultValue: 'Chargement...' }) : (
                      <span className="flex items-center gap-2">
                        Commencer maintenant
                        <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-70 group-hover:translate-x-0 transition-all" />
                      </span>
                    )}
                  </Button>
                </PremiumCard>
              </motion.div>
            );
          })}
        </div>


        {/* Detailed Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="max-w-7xl mx-auto mb-20"
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4">{t('pricing.detailed_comparison')}</h2>
            <p className="text-muted-foreground font-medium">{t('pricing.features_intro')}</p>
          </div>

          <div className="glass-premium rounded-4xl border border-white/60 dark:border-white/10 overflow-hidden shadow-xl relative">
            <TechCorner position="top-left" className="dark:text-white/40" />
            <TechCorner position="bottom-right" className="dark:text-white/40" />

            {/* Table Header - Sticky */}
            <div className="grid grid-cols-4 p-6 border-b border-slate-200/50 dark:border-white/5 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-20">
              <div className="col-span-1 p-2 font-black text-muted-foreground uppercase text-xs tracking-wider">{t('pricing.features_header')}</div>
              <div className="col-span-1 p-2 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <Star className="w-4 h-4 text-slate-500" />
                  <span className="font-bold text-slate-700 dark:text-slate-300">Discovery</span>
                </div>
              </div>
              <div className="col-span-1 p-2 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-500/10 to-violet-500/10 border border-brand-200">
                  <Crown className="w-4 h-4 text-brand-500" />
                  <span className="font-bold text-brand-600 dark:text-brand-400">Professional</span>
                </div>
              </div>
              <div className="col-span-1 p-2 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                  <Building2 className="w-4 h-4 text-purple-500" />
                  <span className="font-bold text-purple-700 dark:text-purple-300">Enterprise</span>
                </div>
              </div>
            </div>

            {/* Feature Categories */}
            <div className="divide-y divide-slate-200/50 dark:divide-white/5">
              {featureCategories.map((category) => (
                <div key={category.id || 'unknown'}>
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between p-6 bg-slate-50/80 dark:bg-slate-900/40 font-bold text-left hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <span className="text-lg font-black text-slate-900 dark:text-white">{category.title}</span>
                    <ChevronDown className={cn(
                      "w-5 h-5 text-slate-400 dark:text-slate-400 transition-transform duration-300",
                      expandedCategories.includes(category.id) && 'rotate-180 text-brand-500 dark:text-brand-400'
                    )} />
                  </button>

                  <AnimatePresence>
                    {expandedCategories.includes(category.id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="divide-y divide-slate-100/50 dark:divide-white/5">
                          {category.features.map((feature, idx) => (
                            <div
                              key={idx || 'unknown'}
                              className="grid grid-cols-4 p-4 items-center hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors"
                            >
                              <div className="col-span-1 flex items-center gap-3 pl-4">
                                {feature.icon && (
                                  <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80">
                                    <feature.icon className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                )}
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                  {feature.name}
                                  {feature.tooltip && (
                                    <Tooltip content={feature.tooltip}>
                                      <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400 ml-2 inline cursor-help" />
                                    </Tooltip>
                                  )}
                                </span>
                              </div>
                              <div className="col-span-1 text-center py-2">{renderFeatureValue(feature.discovery)}</div>
                              <div className="col-span-1 text-center bg-brand-50 dark:bg-brand-900 py-2 rounded-xl mx-2">{renderFeatureValue(feature.professional)}</div>
                              <div className="col-span-1 text-center py-2">{renderFeatureValue(feature.enterprise)}</div>
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
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="max-w-4xl mx-auto mb-24 relative"
        >
          <div className="glass-premium rounded-4xl border border-white/60 dark:border-white/10 overflow-hidden">
            <TechCorner position="top-right" className="dark:text-white/40" />

            <div className="px-8 lg:px-10 pt-8 pb-6 bg-slate-50/50 dark:bg-white/5 border-b border-slate-100/50 dark:border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{t('pricing.faq')}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 font-medium">{t('pricing.faqDesc')}</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-brand-500/10 to-violet-500/10 rounded-2xl border border-brand-200">
                <HelpCircle className="w-6 h-6 text-brand-500" />
              </div>
            </div>

            <div className="divide-y divide-slate-100/50 dark:divide-white/5">
              {faqs.map((faq, i) => (
                <div key={i || 'unknown'} className="group">
                  <button
                    onClick={() => setExpandedCategories(prev => prev.includes(`faq-${i}`) ? prev.filter(c => c !== `faq-${i}`) : [...prev, `faq-${i}`])}
                    className="w-full flex items-center justify-between p-6 lg:p-8 text-left hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="font-bold text-slate-800 dark:text-slate-200 dark:text-slate-100 text-base pr-4">{faq.q}</span>
                    <ChevronDown
                      className={cn(
                        "w-5 h-5 text-slate-400 dark:text-slate-400 flex-shrink-0 transition-transform duration-300",
                        expandedCategories.includes(`faq-${i}`) && 'rotate-180 text-brand-500 dark:text-brand-400'
                      )}
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
                        <div className="px-6 lg:px-8 pb-6 lg:pb-8 pt-0">
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
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="max-w-4xl mx-auto mb-16 relative"
        >
          <div className="glass-premium rounded-4xl border border-white/60 dark:border-white/10 p-8 lg:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-violet-500/5 pointer-events-none" />
            <TechCorner position="bottom-left" className="dark:text-white/40" />
            <TechCorner position="top-right" className="dark:text-white/40" />

            <div className="relative z-10">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-4">
                {t('pricing.custom_solution_title')}
              </h3>
              <p className="text-slate-600 dark:text-slate-300 font-medium mb-8 max-w-lg mx-auto">
                {t('pricing.custom_solution_desc')}
              </p>
              <Button
                onClick={() => setIsContactOpen(true)}
                className="px-8 py-3 h-auto bg-gradient-to-r from-brand-500 to-violet-600 text-white font-bold rounded-xl shadow-lg shadow-brand-500/20 hover:shadow-xl hover:shadow-brand-500/30 transition-all duration-300"
              >
                <span className="flex items-center gap-2">
                  <Headset className="w-5 h-5" />
                  {t('pricing.contact_us')}
                </span>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Footer Section */}
        <div className="text-center pb-8 border-t border-slate-200/50 dark:border-white/5 pt-8">
          <div className="flex flex-wrap gap-4 justify-center items-center text-xs font-bold text-slate-500">
            <button onClick={() => { setLegalTab('cgv'); setShowLegalModal(true); }} className="hover:text-slate-900 dark:hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5">
              CGV
            </button>
            <button onClick={() => { setLegalTab('privacy'); setShowLegalModal(true); }} className="hover:text-slate-900 dark:hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5">
              Confidentialité
            </button>
            <button onClick={() => { setLegalTab('mentions'); setShowLegalModal(true); }} className="hover:text-slate-900 dark:hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5">
              Mentions Légales
            </button>
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
