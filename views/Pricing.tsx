import { useState } from 'react';
import { useStore } from '../store';
import { Check, X, Shield, Zap, Building, ArrowRight, Star } from 'lucide-react';
import { SubscriptionService } from '../services/subscriptionService';
import { PLANS } from '../config/plans';
import { PlanType } from '../types';

const Pricing = () => {
  const { user } = useStore();
  const [isAnnual, setIsAnnual] = useState(true);
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (planId: PlanType) => {
    if (!user?.organizationId) {
        alert("Vous devez être rattaché à une organisation pour souscrire.");
        return;
    }
    
    try {
      setLoading(planId);
      await SubscriptionService.startSubscription(user.organizationId, planId, isAnnual ? 'year' : 'month');
    } catch (error) {
      console.error('Subscription error:', error);
      alert('Une erreur est survenue lors de la redirection vers le paiement.');
    } finally {
      setLoading(null);
    }
  };

  const PlanCard = ({ planId, icon: Icon }: { planId: PlanType, icon: any }) => {
    const plan = PLANS[planId];
    const price = isAnnual ? plan.priceYearly / 12 : plan.priceMonthly;
    
    return (
      <div className={`relative flex flex-col p-8 bg-white dark:bg-slate-800 rounded-2xl border-2 ${plan.highlight ? 'border-blue-500 shadow-2xl scale-105 z-10' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 transition-all'}`}>
        {plan.highlight && (
          <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg flex items-center gap-1">
            <Star className="w-3 h-3 fill-current" /> Recommandé
          </div>
        )}
        
        <div className="mb-6">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${plan.highlight ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
            <Icon className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 min-h-[40px]">{plan.description}</p>
        </div>

        <div className="mb-6">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
              {price === 0 ? 'Gratuit' : `${Math.round(price)}€`}
            </span>
            <span className="text-slate-500 dark:text-slate-400">/mois</span>
          </div>
          {isAnnual && price > 0 && (
            <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
              Facturé {plan.priceYearly}€ par an (2 mois offerts)
            </p>
          )}
        </div>

        <div className="flex-grow mb-8">
          <ul className="space-y-3">
            {plan.featuresList.map((feature: string, idx: number) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={() => handleSubscribe(planId)}
          disabled={loading !== null}
          className={`w-full py-3 px-6 rounded-lg font-semibold transition-all flex items-center justify-center gap-2
            ${plan.highlight 
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-blue-500/30' 
              : 'bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white'
            }
            ${loading ? 'opacity-70 cursor-not-allowed' : ''}
          `}
        >
          {loading === planId ? 'Redirection...' : (
            <>
              {plan.priceMonthly === 0 ? 'Commencer gratuitement' : 'Choisir ce plan'}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white sm:text-5xl sm:tracking-tight lg:text-6xl">
            Une sécurité de niveau <span className="text-blue-600">Entreprise</span>,<br />
            accessible à tous.
          </h1>
          <p className="mt-5 max-w-xl mx-auto text-xl text-slate-500 dark:text-slate-400">
            Choisissez le plan adapté à votre maturité ISO 27001. Changez à tout moment.
          </p>
        
          {/* Billing Toggle */}
          <div className="mt-8 flex justify-center items-center gap-4">
            <span className={`text-sm font-medium ${!isAnnual ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
              Mensuel
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isAnnual ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isAnnual ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <span className={`text-sm font-medium ${isAnnual ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
              Annuel <span className="text-green-500 font-bold ml-1">-20%</span>
            </span>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 max-w-7xl mx-auto mb-20">
          <PlanCard planId="discovery" icon={Shield} />
          <PlanCard planId="professional" icon={Zap} />
          <PlanCard planId="enterprise" icon={Building} />
        </div>

        {/* Comparison Table */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-8 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Comparaison détaillée</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="p-6 bg-slate-50 dark:bg-slate-800/50 text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">Fonctionnalité</th>
                  <th className="p-6 bg-slate-50 dark:bg-slate-800/50 text-center text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 w-1/4">Discovery</th>
                  <th className="p-6 bg-slate-50 dark:bg-slate-800/50 text-center text-sm font-bold text-blue-600 dark:text-blue-400 border-b border-slate-200 dark:border-slate-700 w-1/4">Professional</th>
                  <th className="p-6 bg-slate-50 dark:bg-slate-800/50 text-center text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 w-1/4">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                
                {/* LIMITS */}
                <tr>
                  <td className="p-6 text-sm font-medium text-slate-900 dark:text-white">Utilisateurs</td>
                  <td className="p-6 text-center text-slate-600 dark:text-slate-300">3</td>
                  <td className="p-6 text-center font-bold text-slate-900 dark:text-white">10</td>
                  <td className="p-6 text-center text-slate-600 dark:text-slate-300">Illimité</td>
                </tr>
                <tr>
                  <td className="p-6 text-sm font-medium text-slate-900 dark:text-white">Actifs gérés</td>
                  <td className="p-6 text-center text-slate-600 dark:text-slate-300">50</td>
                  <td className="p-6 text-center font-bold text-slate-900 dark:text-white">250</td>
                  <td className="p-6 text-center text-slate-600 dark:text-slate-300">Illimité</td>
                </tr>
                <tr>
                  <td className="p-6 text-sm font-medium text-slate-900 dark:text-white">Stockage Documentaire</td>
                  <td className="p-6 text-center text-slate-600 dark:text-slate-300">1 Go</td>
                  <td className="p-6 text-center font-bold text-slate-900 dark:text-white">10 Go</td>
                  <td className="p-6 text-center text-slate-600 dark:text-slate-300">100 Go</td>
                </tr>

                {/* FEATURES */}
                <tr>
                  <td className="p-6 text-sm font-medium text-slate-900 dark:text-white">Analyses de risques ISO 27005</td>
                  <td className="p-6 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-6 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-6 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-6 text-sm font-medium text-slate-900 dark:text-white">Rapports Marque Blanche</td>
                  <td className="p-6 text-center"><X className="w-5 h-5 text-slate-300 mx-auto" /></td>
                  <td className="p-6 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-6 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-6 text-sm font-medium text-slate-900 dark:text-white">API Access</td>
                  <td className="p-6 text-center"><X className="w-5 h-5 text-slate-300 mx-auto" /></td>
                  <td className="p-6 text-center"><X className="w-5 h-5 text-slate-300 mx-auto" /></td>
                  <td className="p-6 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-6 text-sm font-medium text-slate-900 dark:text-white">SSO (SAML / OIDC)</td>
                  <td className="p-6 text-center"><X className="w-5 h-5 text-slate-300 mx-auto" /></td>
                  <td className="p-6 text-center"><X className="w-5 h-5 text-slate-300 mx-auto" /></td>
                  <td className="p-6 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-12">Questions Fréquentes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">Puis-je changer de plan à tout moment ?</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Oui, vous pouvez upgrader ou downgrader votre abonnement instantanément depuis vos paramètres. Le prorata sera calculé automatiquement.</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">Mes données sont-elles sécurisées ?</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Absolument. Nous utilisons le chiffrement AES-256 au repos et TLS en transit. Nos serveurs sont hébergés en Europe et certifiés ISO 27001.</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">Qu'est-ce que le mode "Marque Blanche" ?</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Le mode Marque Blanche (Plan Pro & Enterprise) supprime le logo "Sentinel GRC" des rapports PDF exportés, vous permettant de les présenter à vos clients ou auditeurs comme vos propres documents.</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">Acceptez-vous les virements ?</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Pour le plan Enterprise annuel uniquement. Pour les autres plans, le paiement se fait par carte bancaire via notre partenaire sécurisé Stripe.</p>
            </div>
          </div>
        </div>

        {/* Trust & Contact */}
        <div className="mt-20 text-center border-t border-slate-200 dark:border-slate-700 pt-12">
          <div className="flex justify-center items-center gap-6 mb-8 opacity-70 grayscale hover:grayscale-0 transition-all">
             {/* Placeholders for logos like Stripe, ISO, GDPR if you had assets */}
             <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Paiement sécurisé par Stripe</span>
             <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Conforme RGPD</span>
             <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hébergé en UE</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            Besoin d'aide ? <a href="mailto:support@sentinel-grc.com" className="text-blue-600 hover:underline">Contactez le support</a>.
          </p>
        </div>

      </div>
    </div>
  );
};

export default Pricing;
