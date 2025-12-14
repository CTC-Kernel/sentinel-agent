import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useStore } from '../store';
import { Check, ChevronRight, Shield, Zap, Building2, HelpCircle, Info, ChevronDown, type LucideIcon } from 'lucide-react';
import { SubscriptionService } from '../services/subscriptionService';
import { ErrorLogger } from '../services/errorLogger';
import { PLANS } from '../config/plans';
import { PlanType } from '../types';
import { Tooltip } from '../components/ui/Tooltip';
import { ContactModal } from '../components/ui/ContactModal';

const Pricing = () => {
  const { user, addToast } = useStore();
  const [isAnnual, setIsAnnual] = useState(true);
  const [loading, setLoading] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isContactOpen, setIsContactOpen] = useState(false);

  const handleSubscribe = async (planId: PlanType) => {
    if (!user?.organizationId) {
      addToast("Vous devez être rattaché à une organisation pour souscrire.", "error");
      return;
    }
    try {
      setLoading(planId);
      await SubscriptionService.startSubscription(user.organizationId, planId, isAnnual ? 'year' : 'month');
    } catch (error) {
      ErrorLogger.error(error, 'Pricing.handleSubscribe');
      addToast("Une erreur est survenue lors de la redirection vers le paiement.", "error");
    } finally {
      setLoading(null);
    }
  };

  const faqs = [
    { q: "Puis-je changer de plan ?", a: "Oui, à tout moment depuis vos paramètres. Le prorata est calculé automatiquement." },
    { q: "Comment sont sécurisées mes données ?", a: "Chiffrement AES-256, hébergement en Europe, infrastructure certifiée ISO 27001." },
    { q: "Qu'est-ce que la Marque Blanche ?", a: "Vos rapports PDF sans le logo Sentinel GRC. Disponible sur les plans Pro et Enterprise." },
    { q: "Y a-t-il un engagement ?", a: "Aucun engagement sur les plans mensuels. L'engagement est d'un an sur les plans annuels avec une remise de 20%." },
  ];

  const features = [
    // Limites Générales
    { name: 'Utilisateurs inclus', discovery: '3', professional: '10', enterprise: 'Illimité', tooltip: "Nombre de comptes utilisateurs pouvant accéder à la plateforme." },
    { name: 'Actifs gérés', discovery: '50', professional: '250', enterprise: 'Illimité', tooltip: "Nombre total d'actifs (serveurs, applications, personnes, etc.) dans l'inventaire." },
    { name: 'Projets simultanés', discovery: '1', professional: '10', enterprise: 'Illimité', tooltip: "Nombre de projets de conformité ou d'audit actifs en parallèle." },
    { name: 'Stockage sécurisé', discovery: '1 Go', professional: '10 Go', enterprise: '100 Go', tooltip: "Espace de stockage pour vos politiques, procédures et preuves d'audit." },

    // Gestion des Risques & Conformité
    { name: 'Méthode ISO 27005', discovery: true, professional: true, enterprise: true, tooltip: "Analyse de risques complète : Menaces, Vulnérabilités, Scénarios, Impact/Probabilité." },
    { name: 'Bibliothèque de Menaces', discovery: true, professional: true, enterprise: true, tooltip: "Catalogue pré-rempli de menaces et vulnérabilités standards." },
    { name: 'Calcul du Risque', discovery: true, professional: true, enterprise: true, tooltip: "Calcul automatique du risque brut et résiduel." },
    { name: 'Plan de Traitement (RTP)', discovery: true, professional: true, enterprise: true, tooltip: "Suivi des plans d'action pour réduire les risques." },
    { name: 'Conformité ISO 27001:2022', discovery: true, professional: true, enterprise: true, tooltip: "Suivi complet de l'Annexe A et génération du SoA." },

    // Fonctionnalités Avancées
    { name: 'Assistant IA (Sentinel)', discovery: true, professional: true, enterprise: true, tooltip: "Aide à la rédaction de politiques et suggestion de mesures de sécurité." },
    { name: 'Gestion Documentaire', discovery: true, professional: true, enterprise: true, tooltip: "Cycle de vie des documents, versionning et approbation." },
    { name: 'Rapports PDF Standards', discovery: true, professional: true, enterprise: true, tooltip: "Export des rapports d'audit et du SoA au format PDF." },
    { name: 'Rapports Marque Blanche', discovery: false, professional: true, enterprise: true, tooltip: "Suppression du logo Sentinel GRC et personnalisation avec votre logo." },
    { name: 'Modèles Personnalisables', discovery: false, professional: true, enterprise: true, tooltip: "Création de vos propres modèles de documents et de risques." },

    // Enterprise & Support
    { name: 'Support Email', discovery: 'Standard', professional: 'Prioritaire', enterprise: 'Dédié 24/7' },
    { name: 'API REST', discovery: false, professional: false, enterprise: true, tooltip: "Accès complet à l'API pour l'automatisation et l'intégration." },
    { name: 'SSO (SAML / OIDC)', discovery: false, professional: false, enterprise: true, tooltip: "Connexion unique avec votre fournisseur d'identité d'entreprise." },
    { name: 'Logs d\'Audit Avancés', discovery: false, professional: false, enterprise: true, tooltip: "Traçabilité complète de toutes les actions utilisateurs pour la conformité." },
    { name: 'Onboarding Assisté', discovery: false, professional: false, enterprise: true, tooltip: "Accompagnement personnalisé pour la configuration initiale." },
  ];

  const plans: { id: PlanType; name: string; icon: LucideIcon; popular?: boolean }[] = [
    { id: 'discovery', name: 'Discovery', icon: Shield },
    { id: 'professional', name: 'Professional', icon: Zap, popular: true },
    { id: 'enterprise', name: 'Enterprise', icon: Building2 },
  ];

  return (
    <div className="space-y-10 animate-fade-in pb-12 px-4 sm:px-6 lg:px-8 w-full min-w-0">
      {/* Header with Premium Typography */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 min-w-0">
        <div className="min-w-0">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-display tracking-tight leading-tight">
            Abonnement
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 mt-2 font-medium max-w-xl leading-relaxed">
            Des outils puissants pour votre conformité, adaptés à chaque étape de votre croissance.
          </p>
        </div>

        {/* Apple-style Segmented Control */}
        <div className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl flex items-center relative shadow-inner border border-slate-200/50 dark:border-white/5 shrink-0 max-w-full overflow-x-auto">
          <div
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-slate-700 rounded-lg shadow-sm transition-all duration-300 ease-out ${isAnnual ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'}`}
          />
          <button
            onClick={() => setIsAnnual(false)}
            className={`relative z-10 px-6 py-2 text-sm font-bold transition-colors duration-300 ${!isAnnual ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setIsAnnual(true)}
            className={`relative z-10 px-6 py-2 text-sm font-bold transition-colors duration-300 flex items-center gap-2 ${isAnnual ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Annuel
            <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full shadow-sm shadow-emerald-500/20 tracking-wide">
              -20%
            </span>
          </button>
        </div>
      </div>

      {/* Plans Grid - Refined Glassmorphism */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {plans.map(({ id, name, icon: Icon, popular }) => {
          const plan = PLANS[id];
          const price = plan.priceMonthly;

          return (
            <div
              key={id}
              className={`relative flex flex-col rounded-[2rem] overflow-hidden transition-all duration-500 group ${popular
                ? 'bg-white/90 dark:bg-slate-800/90 shadow-2xl shadow-blue-900/10 ring-1 ring-blue-500/20 dark:ring-blue-400/20 scale-[1.02] z-10'
                : 'bg-white/60 dark:bg-slate-900/60 shadow-xl shadow-slate-200/50 dark:shadow-black/20 ring-1 ring-slate-200/60 dark:ring-white/5 hover:bg-white/80 dark:hover:bg-slate-800/80 hover:shadow-2xl hover:-translate-y-1'
                } backdrop-blur-xl`}
            >
              {popular && (
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 opacity-80" />
              )}

              <div className="p-8 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-8">
                  <div className={`p-3.5 rounded-2xl ${popular ? 'bg-blue-50 dark:bg-slate-900 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'}`}>
                    <Icon className="w-6 h-6" strokeWidth={2} />
                  </div>
                  {popular && (
                    <span className="bg-blue-50 dark:bg-slate-900 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-3 py-1 rounded-full border border-blue-100 dark:border-blue-500/20 uppercase tracking-widest">
                      Populaire
                    </span>
                  )}
                </div>

                <div className="mb-2">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{name}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mt-1">{plan.description}</p>
                </div>

                <div className="my-8">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold text-slate-900 dark:text-white font-display tracking-tighter">
                      {price === 0 ? 'Gratuit' : `${price}€`}
                    </span>
                    {price > 0 && <span className="text-slate-600 font-medium text-lg">HT/mois</span>}
                  </div>
                  {isAnnual && price > 0 && (
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                      Facturé {plan.priceYearly}€ HT par an
                    </p>
                  )}
                </div>

                <div className="space-y-4 mb-8 flex-1">
                  {plan.featuresList.map((feature, i) => (
                    <div
                      key={i}
                      className="text-sm text-slate-700 dark:text-slate-300 font-medium"
                    >
                      <span className="leading-relaxed">{feature}</span>
                    </div>
                  ))}
                </div>

                {Capacitor.isNativePlatform() ? (
                  <div className="w-full py-4 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-center">
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      La gestion des abonnements est disponible uniquement sur la version web de Sentinel GRC.
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => handleSubscribe(id)}
                    disabled={loading !== null}
                    className={`w-full py-4 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${popular
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5'
                      : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 hover:shadow-lg hover:-translate-y-0.5'
                      } ${loading === id ? 'opacity-75 cursor-wait' : ''}`}
                  >
                    {loading === id ? (
                      <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        {price === 0 ? 'Commencer gratuitement' : 'Choisir ce plan'}
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparison Table - Minimalist */}
      <div className="glass-panel p-0 rounded-[2.5rem] overflow-hidden border border-white/60 dark:border-white/5 shadow-sm min-w-0">
        <div className="px-10 pt-10 pb-6 bg-slate-50/50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Comparatif détaillé</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">Analysez les fonctionnalités en détail.</p>
        </div>

        <div className="overflow-x-auto max-w-full">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="text-left py-6 px-10 font-bold text-xs text-slate-500 uppercase tracking-widest w-1/3">Fonctionnalités</th>
                <th className="py-6 px-6 text-center font-bold text-xs text-slate-900 dark:text-white uppercase tracking-widest w-1/5">Discovery</th>
                <th className="py-6 px-6 text-center font-bold text-xs text-blue-600 dark:text-blue-400 uppercase tracking-widest w-1/5 bg-blue-50/30 dark:bg-blue-500/5 border-x border-blue-100/50 dark:border-blue-500/10">Professional</th>
                <th className="py-6 px-6 text-center font-bold text-xs text-slate-900 dark:text-white uppercase tracking-widest w-1/5">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {features.map((feature, i) => (
                <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                  <td className="py-5 px-10 text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    {feature.name}
                    {feature.tooltip && (
                      <Tooltip content={feature.tooltip}>
                        <Info className="w-4 h-4 text-slate-500 hover:text-blue-500 transition-colors cursor-help" />
                      </Tooltip>
                    )}
                  </td>
                  <td className="py-5 px-6 text-center">
                    {typeof feature.discovery === 'boolean' ? (
                      feature.discovery ? (
                        <div className="flex justify-center"><Check className="w-5 h-5 text-slate-900 dark:text-white" strokeWidth={2.5} /></div>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 font-medium">—</span>
                      )
                    ) : (
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{feature.discovery}</span>
                    )}
                  </td>
                  <td className="py-5 px-6 text-center bg-blue-50/10 dark:bg-blue-500/5 border-x border-blue-100/50 dark:border-blue-500/10">
                    {typeof feature.professional === 'boolean' ? (
                      feature.professional ? (
                        <div className="flex justify-center"><Check className="w-5 h-5 text-blue-600 dark:text-blue-400" strokeWidth={2.5} /></div>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 font-medium">—</span>
                      )
                    ) : (
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{feature.professional}</span>
                    )}
                  </td>
                  <td className="py-5 px-6 text-center">
                    {typeof feature.enterprise === 'boolean' ? (
                      feature.enterprise ? (
                        <div className="flex justify-center"><Check className="w-5 h-5 text-slate-900 dark:text-white" strokeWidth={2.5} /></div>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 font-medium">—</span>
                      )
                    ) : (
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{feature.enterprise}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ - Clean Accordion */}
      <div className="glass-panel p-0 rounded-[2.5rem] overflow-hidden border border-white/60 dark:border-white/5 shadow-sm">
        <div className="px-10 pt-10 pb-6 bg-slate-50/50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Questions fréquentes</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">Réponses aux interrogations courantes.</p>
          </div>
          <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <HelpCircle className="w-6 h-6 text-slate-500" />
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {faqs.map((faq, i) => (
            <div key={i} className="group">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-8 text-left hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors"
              >
                <span className="font-bold text-slate-800 dark:text-slate-200 text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{faq.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${openFaq === i ? 'rotate-180 text-blue-500' : 'group-hover:text-blue-500'}`}
                />
              </button>
              <div
                className={`grid transition-all duration-300 ease-in-out ${openFaq === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
              >
                <div className="overflow-hidden">
                  <div className="px-8 pb-8 pt-0">
                    <p className="text-base text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center pt-8 pb-4">
        <p className="text-sm text-slate-500 font-medium">
          Besoin d'un devis personnalisé ?
          <button
            onClick={() => setIsContactOpen(true)}
            className="ml-1 text-slate-900 dark:text-white hover:underline font-bold focus:outline-none"
          >
            Contactez notre équipe commerciale
          </button>
        </p>
      </div>

      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
        subject="Demande de devis / Information"
      />
    </div>
  );
};

export default Pricing;
