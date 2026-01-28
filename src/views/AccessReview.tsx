/**
 * Access Review View
 *
 * Main view for access review campaigns and dormant account management.
 * Part of NIS2 Article 21.2(i) compliance.
 *
 * Features:
 * - Campaign management (create, launch, track)
 * - Manager review workflow
 * - Dormant account detection
 * - Audit reports
 *
 * @module views/AccessReview
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCheck,
  Plus,
  Play,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  LayoutDashboard,
  List,
  UserX,
  Calendar,
  RefreshCw,
  ChevronRight,
} from '../components/ui/Icons';
import { Button } from '../components/ui/button';
import { useStore } from '../store';
import { hasPermission } from '../utils/permissions';
import { AccessReviewService } from '../services/AccessReviewService';
import { ErrorLogger } from '../services/errorLogger';
import { PageHeader } from '../components/ui/PageHeader';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { SEO } from '../components/SEO';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { FloatingLabelInput } from '../components/ui/FloatingLabelInput';
import { FloatingLabelSelect } from '../components/ui/FloatingLabelSelect';
import { FloatingLabelTextarea } from '../components/ui/FloatingLabelTextarea';
import { staggerContainerVariants, slideUpVariants } from '../components/ui/animationVariants';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';
import type {
  AccessReviewCampaign,
  DormantAccount,
  AccessReviewStats,
  CampaignStatus,
  DormantStatus,
} from '../types/accessReview';

type TabId = 'dashboard' | 'campaigns' | 'dormant';

const campaignStatusConfig: Record<CampaignStatus, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: 'bg-slate-200 text-slate-600' },
  active: { label: 'En cours', color: 'bg-primary/10 text-primary' },
  completed: { label: 'Terminée', color: 'bg-success-bg text-success-text' },
  cancelled: { label: 'Annulée', color: 'bg-danger-bg text-danger-text' },
};

const dormantStatusConfig: Record<DormantStatus, { label: string; color: string }> = {
  detected: { label: 'Détecté', color: 'bg-warning-bg text-warning-text' },
  contacted: { label: 'Contacté', color: 'bg-primary/10 text-primary' },
  disabled: { label: 'Désactivé', color: 'bg-slate-200 text-slate-600' },
  deleted: { label: 'Supprimé', color: 'bg-danger-bg text-danger-text' },
  excluded: { label: 'Exclu', color: 'bg-muted text-muted-foreground' },
};

export const AccessReview: React.FC = () => {
  const { user, addToast } = useStore();

  // State
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [campaigns, setCampaigns] = useState<AccessReviewCampaign[]>([]);
  const [dormantAccounts, setDormantAccounts] = useState<DormantAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [campaignName, setCampaignName] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [scope, setScope] = useState<'all' | 'department' | 'role'>('all');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState(90);

  // Permissions
  const canEdit = user && hasPermission(user, 'User', 'manage');

  // Tabs
  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'campaigns', label: 'Campagnes', icon: List },
    { id: 'dormant', label: 'Comptes dormants', icon: UserX },
  ];

  // Subscribe to data
  useEffect(() => {
    if (!user?.organizationId) return;

    setLoading(true);

    const unsubCampaigns = AccessReviewService.subscribeToCampaigns(
      user.organizationId,
      (data) => {
        setCampaigns(data);
        setLoading(false);
      }
    );

    const unsubDormant = AccessReviewService.subscribeToDormantAccounts(
      user.organizationId,
      (data) => {
        setDormantAccounts(data);
      }
    );

    return () => {
      unsubCampaigns();
      unsubDormant();
    };
  }, [user?.organizationId]);

  // Calculate stats
  const stats: AccessReviewStats = useMemo(() => {
    return AccessReviewService.calculateStats(campaigns, [], dormantAccounts);
  }, [campaigns, dormantAccounts]);

  // Reset form
  const resetForm = useCallback(() => {
    setCampaignName('');
    setCampaignDescription('');
    setStartDate('');
    setEndDate('');
    setScope('all');
    setIsRecurring(false);
    setRecurrenceDays(90);
  }, []);

  // Create campaign
  const handleCreateCampaign = useCallback(async () => {
    if (!user || !campaignName || !startDate || !endDate) return;

    setIsSubmitting(true);
    try {
      await AccessReviewService.createCampaign(
        {
          name: campaignName,
          description: campaignDescription,
          startDate: Timestamp.fromDate(new Date(startDate)),
          endDate: Timestamp.fromDate(new Date(endDate)),
          scope,
          isRecurring,
          recurrenceDays: isRecurring ? recurrenceDays : undefined,
        },
        user
      );

      addToast('Campagne créée avec succès', 'success');
      setShowCampaignForm(false);
      resetForm();
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'accessReview.errors.createFailed');
    } finally {
      setIsSubmitting(false);
    }
  }, [user, campaignName, campaignDescription, startDate, endDate, scope, isRecurring, recurrenceDays, addToast, resetForm]);

  // Launch campaign
  const handleLaunchCampaign = useCallback(async (campaign: AccessReviewCampaign) => {
    if (!user) return;

    try {
      // In a real implementation, we would fetch users based on campaign scope
      // For now, we just update the status
      await AccessReviewService.updateCampaignStatus(campaign.id, 'active', user);
      addToast('Campagne lancée avec succès', 'success');
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'accessReview.errors.launchFailed');
    }
  }, [user, addToast]);

  // Update dormant status
  const handleDormantAction = useCallback(async (account: DormantAccount, newStatus: DormantStatus) => {
    if (!user) return;

    try {
      await AccessReviewService.updateDormantStatus(
        account.id,
        newStatus,
        `Status changed to ${newStatus}`,
        user
      );
      addToast('Statut mis à jour', 'success');
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'accessReview.errors.updateFailed');
    }
  }, [user, addToast]);

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
      className="w-full px-2 sm:px-4 lg:px-8 py-6 max-w-[1800px] mx-auto flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24"
    >
      <MasterpieceBackground />
      <SEO title="Revue des Accès" description="Gestion des revues d'accès périodiques" />

      {/* Header */}
      <motion.div variants={slideUpVariants}>
        <PageHeader
          title="Revue des Accès"
          subtitle="Campagnes de révision périodique et détection des comptes dormants"
          icon={<UserCheck className="w-12 h-12 text-primary" />}
          trustType="confidentiality"
          actions={
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <span>NIS2</span>
                <span className="text-primary/60">|</span>
                <span>Art. 21.2(i)</span>
              </div>
              {canEdit && (
                <Button onClick={() => setShowCampaignForm(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Nouvelle Campagne
                </Button>
              )}
            </div>
          }
        />
      </motion.div>

      {/* Tabs */}
      <motion.div variants={slideUpVariants}>
        <ScrollableTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as TabId)}
        />
      </motion.div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass-premium rounded-2xl p-6 border border-white/60 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Play className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-foreground">{stats.activeCampaigns}</div>
                    <div className="text-sm text-muted-foreground">Campagnes actives</div>
                  </div>
                </div>
              </div>

              <div className="glass-premium rounded-2xl p-6 border border-white/60 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-warning-bg">
                    <Clock className="w-6 h-6 text-warning-text" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-warning-text">{stats.pendingReviews}</div>
                    <div className="text-sm text-muted-foreground">Revues en attente</div>
                  </div>
                </div>
              </div>

              <div className="glass-premium rounded-2xl p-6 border border-white/60 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-danger-bg">
                    <UserX className="w-6 h-6 text-danger-text" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-danger-text">{stats.dormantAccounts}</div>
                    <div className="text-sm text-muted-foreground">Comptes dormants</div>
                  </div>
                </div>
              </div>

              <div className="glass-premium rounded-2xl p-6 border border-white/60 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${stats.daysSinceLastCampaign > 90 ? 'bg-danger-bg' : 'bg-success-bg'}`}>
                    <Calendar className={`w-6 h-6 ${stats.daysSinceLastCampaign > 90 ? 'text-danger-text' : 'text-success-text'}`} />
                  </div>
                  <div>
                    <div className={`text-3xl font-bold ${stats.daysSinceLastCampaign > 90 ? 'text-danger-text' : 'text-foreground'}`}>
                      {stats.daysSinceLastCampaign}j
                    </div>
                    <div className="text-sm text-muted-foreground">Depuis dernière revue</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Alerts */}
            {stats.daysSinceLastCampaign > 90 && (
              <div className="glass-premium rounded-2xl p-6 border border-danger-text/20 bg-danger-bg/30">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-danger-text" />
                  <div>
                    <div className="font-semibold text-danger-text">
                      Revue des accès en retard
                    </div>
                    <div className="text-sm text-muted-foreground">
                      La dernière campagne de revue date de plus de 90 jours. NIS2 recommande une revue trimestrielle.
                    </div>
                  </div>
                  {canEdit && (
                    <Button
                      onClick={() => setShowCampaignForm(true)}
                      className="ml-auto"
                    >
                      Lancer une campagne
                    </Button>
                  )}
                </div>
              </div>
            )}

            {stats.overdueReviews > 0 && (
              <div className="glass-premium rounded-2xl p-6 border border-warning-text/20 bg-warning-bg/30">
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-warning-text" />
                  <div>
                    <div className="font-semibold text-warning-text">
                      {stats.overdueReviews} revue(s) en retard
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Des revues d'accès ont dépassé leur date limite.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Campaigns */}
            <div className="glass-premium rounded-2xl p-6 border border-white/60 dark:border-white/5">
              <h3 className="text-lg font-semibold text-foreground mb-4">Campagnes récentes</h3>
              {campaigns.length === 0 ? (
                <p className="text-muted-foreground">Aucune campagne créée</p>
              ) : (
                <div className="space-y-3">
                  {campaigns.slice(0, 5).map((campaign) => {
                    const statusInfo = campaignStatusConfig[campaign.status];
                    const progress = campaign.totalReviews > 0
                      ? Math.round((campaign.completedReviews / campaign.totalReviews) * 100)
                      : 0;

                    return (
                      <div
                        key={campaign.id}
                        className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div>
                          <div className="font-medium text-foreground">{campaign.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {format(campaign.startDate.toDate(), 'dd MMM', { locale: fr })} - {format(campaign.endDate.toDate(), 'dd MMM yyyy', { locale: fr })}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {campaign.status === 'active' && (
                            <div className="text-sm text-muted-foreground">
                              {progress}% complété
                            </div>
                          )}
                          <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'campaigns' && (
          <motion.div
            key="campaigns"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {loading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-muted/20 rounded-2xl" />
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <EmptyState
                icon={UserCheck}
                title="Aucune campagne"
                description="Créez votre première campagne de revue des accès"
                actionLabel={canEdit ? 'Nouvelle campagne' : undefined}
                onAction={canEdit ? () => setShowCampaignForm(true) : undefined}
              />
            ) : (
              <div className="space-y-4">
                {campaigns.map((campaign) => {
                  const statusInfo = campaignStatusConfig[campaign.status];
                  const progress = campaign.totalReviews > 0
                    ? Math.round((campaign.completedReviews / campaign.totalReviews) * 100)
                    : 0;

                  return (
                    <div
                      key={campaign.id}
                      className="glass-premium rounded-2xl p-6 border border-white/60 dark:border-white/5"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="font-semibold text-foreground text-lg">{campaign.name}</div>
                          {campaign.description && (
                            <div className="text-sm text-muted-foreground mt-1">{campaign.description}</div>
                          )}
                          <div className="text-sm text-muted-foreground mt-2">
                            {format(campaign.startDate.toDate(), 'dd MMM', { locale: fr })} - {format(campaign.endDate.toDate(), 'dd MMM yyyy', { locale: fr })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                          {campaign.status === 'draft' && canEdit && (
                            <Button
                              size="sm"
                              onClick={() => handleLaunchCampaign(campaign)}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Lancer
                            </Button>
                          )}
                        </div>
                      </div>

                      {campaign.status === 'active' && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Progression</span>
                            <span className="font-medium">{campaign.completedReviews}/{campaign.totalReviews} ({progress}%)</span>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                            <span className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-success-text" />
                              {campaign.approvedCount} approuvés
                            </span>
                            <span className="flex items-center gap-1">
                              <XCircle className="w-3 h-3 text-danger-text" />
                              {campaign.revokedCount} révoqués
                            </span>
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-warning-text" />
                              {campaign.escalatedCount} escaladés
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'dormant' && (
          <motion.div
            key="dormant"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {loading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-muted/20 rounded-2xl" />
                ))}
              </div>
            ) : dormantAccounts.length === 0 ? (
              <EmptyState
                icon={UserX}
                title="Aucun compte dormant"
                description="Tous les comptes sont actifs"
              />
            ) : (
              <div className="space-y-4">
                {dormantAccounts.map((account) => {
                  const statusInfo = dormantStatusConfig[account.status];

                  return (
                    <div
                      key={account.id}
                      className="glass-premium rounded-2xl p-6 border border-white/60 dark:border-white/5"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-xl bg-danger-bg">
                            <UserX className="w-6 h-6 text-danger-text" />
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{account.userName}</div>
                            <div className="text-sm text-muted-foreground">{account.userEmail}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {account.neverLoggedIn ? (
                                'Jamais connecté'
                              ) : (
                                <>Dernière connexion: {account.lastLoginAt ? format(account.lastLoginAt.toDate(), 'dd MMM yyyy', { locale: fr }) : 'Inconnue'}</>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-lg font-bold text-danger-text">
                              {account.daysSinceLastLogin}j
                            </div>
                            <div className="text-xs text-muted-foreground">d'inactivité</div>
                          </div>
                          <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                          {canEdit && account.status === 'detected' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDormantAction(account, 'contacted')}
                              >
                                Contacter
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDormantAction(account, 'disabled')}
                              >
                                Désactiver
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Campaign Form Modal */}
      <Modal
        isOpen={showCampaignForm}
        onClose={() => {
          setShowCampaignForm(false);
          resetForm();
        }}
        title="Nouvelle campagne de revue"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-6">
          <FloatingLabelInput
            label="Nom de la campagne"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
          />

          <FloatingLabelTextarea
            label="Description (optionnel)"
            value={campaignDescription}
            onChange={(e) => setCampaignDescription(e.target.value)}
            rows={3}
          />

          <div className="grid grid-cols-2 gap-4">
            <FloatingLabelInput
              type="date"
              label="Date de début"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <FloatingLabelInput
              type="date"
              label="Date de fin"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <FloatingLabelSelect
            label="Périmètre"
            value={scope}
            onChange={(e) => setScope(e.target.value as 'all' | 'department' | 'role')}
            options={[
              { value: 'all', label: 'Tous les utilisateurs' },
              { value: 'department', label: 'Par département' },
              { value: 'role', label: 'Par rôle' },
            ]}
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="recurring"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="recurring" className="text-sm text-foreground">
              Récurrence automatique
            </label>
          </div>

          {isRecurring && (
            <FloatingLabelInput
              type="number"
              label="Intervalle (jours)"
              value={recurrenceDays.toString()}
              onChange={(e) => setRecurrenceDays(parseInt(e.target.value) || 90)}
              min={30}
              max={365}
            />
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowCampaignForm(false);
                resetForm();
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateCampaign}
              disabled={isSubmitting || !campaignName || !startDate || !endDate}
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Créer la campagne
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
};

export default AccessReview;
