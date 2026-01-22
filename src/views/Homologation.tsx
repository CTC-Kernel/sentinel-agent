/**
 * Homologation View
 *
 * Main view for ANSSI homologation management.
 * Epic 38 - Story 38-1: Homologation Level Selector
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Star, FileText, Shield, ShieldAlert, AlertTriangle, CheckCircle, type LucideIcon } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { toast } from '../lib/toast';
import { useHomologation } from '../hooks/useHomologation';
import { useAuth } from '../hooks/useAuth';
import {
  LevelDeterminationWizard,
  HomologationDossierList,
  HomologationValidityWidget,
  RenewalDialog
} from '../components/homologation';
import type { HomologationDossier, CreateHomologationDossierInput, HomologationLevel } from '../types/homologation';
import { LEVEL_INFO } from '../types/homologation';

const LEVEL_ICONS: Record<HomologationLevel, LucideIcon> = {
  etoile: Star,
  simple: FileText,
  standard: Shield,
  renforce: ShieldAlert
};

const Homologation: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    dossiers,
    loading,
    error,
    stats,
    createDossier,
    deleteDossier
  } = useHomologation();

  // Dialog states
  const [showWizard, setShowWizard] = useState(false);
  const [dossierToDelete, setDossierToDelete] = useState<HomologationDossier | null>(null);
  const [dossierToRenew, setDossierToRenew] = useState<HomologationDossier | null>(null);

  // Handle wizard completion
  const handleWizardComplete = useCallback(
    async (input: Omit<CreateHomologationDossierInput, 'organizationId' | 'userId'>) => {
      if (!user?.uid) return;

      const completeInput: CreateHomologationDossierInput = {
        ...input,
        organizationId: user.organizationId || '',
        userId: user.uid
      };

      const dossierId = await createDossier(completeInput);
      setShowWizard(false);

      toast.success(
        t('homologation.dossierCreated', 'Dossier créé'),
        t('homologation.dossierCreatedDesc', 'Le dossier d\'homologation a été créé avec succès.')
      );

      // Navigate to the new dossier
      navigate(`/homologation/${dossierId}`);
    },
    [user?.uid, user?.organizationId, createDossier, t, navigate]
  );

  // Handle view dossier
  const handleViewDossier = useCallback(
    (dossier: HomologationDossier) => {
      navigate(`/homologation/${dossier.id}`);
    },
    [navigate]
  );

  // Handle edit dossier
  const handleEditDossier = useCallback(
    (dossier: HomologationDossier) => {
      navigate(`/homologation/${dossier.id}/edit`);
    },
    [navigate]
  );

  // Handle delete dossier
  const handleDeleteDossier = useCallback(async () => {
    if (!dossierToDelete) return;

    try {
      await deleteDossier(dossierToDelete.id);
      toast.success(
        t('homologation.dossierDeleted', 'Dossier supprimé'),
        t('homologation.dossierDeletedDesc', 'Le dossier a été supprimé.')
      );
    } catch {
      toast.error(
        t('common.error', 'Erreur'),
        t('homologation.deleteError', 'Impossible de supprimer le dossier.')
      );
    } finally {
      setDossierToDelete(null);
    }
  }, [dossierToDelete, deleteDossier, t]);

  // Render stats card
  const renderStatsCard = (
    label: string,
    value: number,
    Icon: LucideIcon,
    color: string,
    bgColor: string
  ) => (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">{t('common.error', 'Erreur')}</h2>
          <p className="text-muted-foreground">{error.message}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('homologation.title', 'Homologation ANSSI')}</h1>
          <p className="text-muted-foreground">
            {t('homologation.subtitle', 'Gérez vos dossiers d\'homologation RGS')}
          </p>
        </div>
        <Button onClick={() => setShowWizard(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('homologation.newDossier', 'Nouveau dossier')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {renderStatsCard(
          t('homologation.totalDossiers', 'Total dossiers'),
          stats.total,
          FileText,
          'text-blue-600',
          'bg-blue-100'
        )}
        {renderStatsCard(
          t('homologation.homologated', 'Homologués'),
          stats.byStatus.homologated,
          CheckCircle,
          'text-green-600',
          'bg-green-100'
        )}
        {renderStatsCard(
          t('homologation.inProgress', 'En cours'),
          stats.byStatus.in_progress + stats.byStatus.draft,
          Shield,
          'text-amber-600',
          'bg-amber-100'
        )}
        {renderStatsCard(
          t('homologation.expiringSoon', 'Expirent bientôt'),
          stats.expiringSoon,
          AlertTriangle,
          'text-yellow-600',
          'bg-yellow-100'
        )}
        {renderStatsCard(
          t('homologation.expired', 'Expirés'),
          stats.expired,
          AlertTriangle,
          'text-red-600',
          'bg-red-100'
        )}
      </div>

      {/* Level distribution and Validity widget */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Level distribution */}
        <Card className="p-4 lg:col-span-2">
          <h3 className="font-medium mb-4">{t('homologation.levelDistribution', 'Répartition par niveau')}</h3>
          <div className="grid gap-4 md:grid-cols-4">
            {(['etoile', 'simple', 'standard', 'renforce'] as HomologationLevel[]).map((level) => {
              const info = LEVEL_INFO[level];
              const Icon = LEVEL_ICONS[level];
              const count = stats.byLevel[level];
              const percentage = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;

              return (
                <div key={level} className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${info.color}20`, color: info.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{info.label}</span>
                      <span className="text-sm text-muted-foreground">{count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${percentage}%`, backgroundColor: info.color }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Validity widget */}
        <HomologationValidityWidget
          maxItems={4}
          onRenewalClick={setDossierToRenew}
        />
      </div>

      {/* Dossier list */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">{t('common.all', 'Tous')}</TabsTrigger>
          <TabsTrigger value="active">{t('homologation.active', 'Actifs')}</TabsTrigger>
          <TabsTrigger value="pending">{t('homologation.pending', 'En attente')}</TabsTrigger>
          <TabsTrigger value="expired">{t('homologation.expired', 'Expirés')}</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <HomologationDossierList
            dossiers={dossiers}
            loading={loading}
            onView={handleViewDossier}
            onEdit={handleEditDossier}
            onDelete={setDossierToDelete}
          />
        </TabsContent>

        <TabsContent value="active" className="mt-4">
          <HomologationDossierList
            dossiers={dossiers.filter((d) => d.status === 'homologated')}
            loading={loading}
            onView={handleViewDossier}
            onEdit={handleEditDossier}
            onDelete={setDossierToDelete}
          />
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          <HomologationDossierList
            dossiers={dossiers.filter(
              (d) => d.status === 'draft' || d.status === 'in_progress' || d.status === 'pending_decision'
            )}
            loading={loading}
            onView={handleViewDossier}
            onEdit={handleEditDossier}
            onDelete={setDossierToDelete}
          />
        </TabsContent>

        <TabsContent value="expired" className="mt-4">
          <HomologationDossierList
            dossiers={dossiers.filter((d) => d.status === 'expired' || d.status === 'revoked')}
            loading={loading}
            onView={handleViewDossier}
            onEdit={handleEditDossier}
            onDelete={setDossierToDelete}
          />
        </TabsContent>
      </Tabs>

      {/* Create Wizard Dialog */}
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('homologation.newDossierWizard', 'Nouveau dossier d\'homologation')}
            </DialogTitle>
          </DialogHeader>
          <LevelDeterminationWizard
            onComplete={handleWizardComplete}
            onCancel={() => setShowWizard(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmModal
        isOpen={!!dossierToDelete}
        onClose={() => setDossierToDelete(null)}
        onConfirm={handleDeleteDossier}
        title={t('homologation.confirmDelete', 'Confirmer la suppression')}
        message={t(
          'homologation.confirmDeleteDesc',
          'Êtes-vous sûr de vouloir supprimer le dossier "{{name}}" ? Cette action est irréversible.',
          { name: dossierToDelete?.name }
        )}
        type="danger"
        confirmText={t('common.delete', 'Supprimer')}
        cancelText={t('common.cancel', 'Annuler')}
      />

      {/* Renewal Dialog */}
      <RenewalDialog
        dossier={dossierToRenew}
        open={!!dossierToRenew}
        onOpenChange={(open) => !open && setDossierToRenew(null)}
      />
    </div>
  );
};

export default Homologation;
