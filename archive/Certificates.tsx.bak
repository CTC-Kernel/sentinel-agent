/**
 * Certificates View
 *
 * Main view for SSL/TLS certificate inventory management.
 * Part of NIS2 Article 21.2(h) compliance.
 *
 * Features:
 * - Dashboard with KPIs
 * - Certificate list with filters
 * - Create/Edit forms
 * - CSV import
 * - Expiration alerts
 *
 * @module views/Certificates
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  KeyRound,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  LayoutDashboard,
  List,
  Shield,
  RefreshCw,
} from '../components/ui/Icons';
import { Button } from '../components/ui/button';
import { useStore } from '../store';
import { hasPermission } from '../utils/permissions';
import { CertificateService } from '../services/CertificateService';
import { ErrorLogger } from '../services/errorLogger';
import { PageHeader } from '../components/ui/PageHeader';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { SEO } from '../components/SEO';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Modal } from '../components/ui/Modal';
import { FloatingLabelInput } from '../components/ui/FloatingLabelInput';
import { FloatingLabelSelect } from '../components/ui/FloatingLabelSelect';
import { FloatingLabelTextarea } from '../components/ui/FloatingLabelTextarea';
import { staggerContainerVariants, slideUpVariants } from '../components/ui/animationVariants';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useZodForm } from '../hooks/useZodForm';
import { certificateSchema, certificateTypeOptions, keyAlgorithmOptions, issuerTypeOptions } from '../schemas/certificateSchema';
import type { Certificate, CertificateStats, CertificateStatus, CertificateFormData } from '../types/certificates';

type TabId = 'dashboard' | 'list';

import type { LucideIcon } from 'lucide-react';

const statusConfig: Record<CertificateStatus, { label: string; color: string; icon: LucideIcon }> = {
  valid: { label: 'Valide', color: 'bg-success-bg text-success-text', icon: CheckCircle },
  expiring_soon: { label: 'Expire bientôt', color: 'bg-warning-bg text-warning-text', icon: Clock },
  expired: { label: 'Expiré', color: 'bg-danger-bg text-danger-text', icon: XCircle },
  revoked: { label: 'Révoqué', color: 'bg-slate-200 text-slate-600', icon: XCircle },
};

export const Certificates: React.FC = () => {
  const { t, user, addToast } = useStore();

  // State
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CertificateStatus | ''>('');
  const [showForm, setShowForm] = useState(false);
  const [editingCertificate, setEditingCertificate] = useState<Certificate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Certificate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Permissions
  const canEdit = user && hasPermission(user, 'Asset', 'manage');

  // Form
  const { register, handleSubmit, reset, formState: { errors } } = useZodForm({
    schema: certificateSchema,
    defaultValues: {
      type: 'ssl_tls',
      issuerType: 'public_ca',
      keyAlgorithm: 'RSA',
      keySize: 2048,
      autoRenew: false,
      domains: [],
    },
  });

  // Tabs
  const tabs = [
    { id: 'dashboard', label: t('certificates.dashboard') || 'Tableau de bord', icon: LayoutDashboard },
    { id: 'list', label: t('certificates.list') || 'Liste', icon: List },
  ];

  // Subscribe to certificates
  useEffect(() => {
    if (!user?.organizationId) return;

    setLoading(true);
    const unsubscribe = CertificateService.subscribeToCertificates(
      user.organizationId,
      (certs) => {
        setCertificates(certs);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.organizationId]);

  // Calculate stats
  const stats: CertificateStats = useMemo(() => {
    return CertificateService.calculateStats(certificates);
  }, [certificates]);

  // Filter certificates
  const filteredCertificates = useMemo(() => {
    let filtered = [...certificates];

    if (statusFilter) {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.commonName.toLowerCase().includes(query) ||
          c.domains.some((d) => d.toLowerCase().includes(query)) ||
          c.issuer.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [certificates, statusFilter, searchQuery]);

  // Open form for editing
  const handleEdit = useCallback((cert: Certificate) => {
    setEditingCertificate(cert);
    reset({
      name: cert.name,
      description: cert.description,
      type: cert.type,
      commonName: cert.commonName,
      domains: cert.domains,
      serialNumber: cert.serialNumber,
      issuer: cert.issuer,
      issuerType: cert.issuerType,
      validFrom: cert.validFrom.toDate(),
      validTo: cert.validTo.toDate(),
      keyAlgorithm: cert.keyAlgorithm,
      keySize: cert.keySize,
      signatureAlgorithm: cert.signatureAlgorithm,
      thumbprintSha1: cert.thumbprintSha1,
      thumbprintSha256: cert.thumbprintSha256,
      assetId: cert.assetId,
      assetName: cert.assetName,
      owner: cert.owner,
      ownerEmail: cert.ownerEmail,
      autoRenew: cert.autoRenew,
      notes: cert.notes,
      tags: cert.tags,
    });
    setShowForm(true);
  }, [reset]);

  // Open form for creation
  const handleCreate = useCallback(() => {
    setEditingCertificate(null);
    reset({
      type: 'ssl_tls',
      issuerType: 'public_ca',
      keyAlgorithm: 'RSA',
      keySize: 2048,
      autoRenew: false,
      domains: [],
    });
    setShowForm(true);
  }, [reset]);

  // Submit form
  const onSubmit = handleSubmit(async (data) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      if (editingCertificate) {
        await CertificateService.updateCertificate(editingCertificate.id, data as unknown as Partial<CertificateFormData>, user);
        addToast(t('certificates.success.updated') || 'Certificat mis à jour', 'success');
      } else {
        await CertificateService.createCertificate(data as unknown as CertificateFormData, user);
        addToast(t('certificates.success.created') || 'Certificat créé', 'success');
      }
      setShowForm(false);
      setEditingCertificate(null);
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'certificates.errors.save');
    } finally {
      setIsSubmitting(false);
    }
  });

  // Delete certificate
  const handleDelete = useCallback(async () => {
    if (!deleteConfirm) return;

    try {
      await CertificateService.deleteCertificate(deleteConfirm.id);
      addToast(t('certificates.success.deleted') || 'Certificat supprimé', 'success');
      setDeleteConfirm(null);
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'certificates.errors.delete');
    }
  }, [deleteConfirm, addToast, t]);

  // Days until expiration
  const getDaysUntilExpiration = (cert: Certificate) => {
    return differenceInDays(cert.validTo.toDate(), new Date());
  };

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
      className="w-full px-2 sm:px-4 lg:px-8 py-6 max-w-[1800px] mx-auto flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24"
    >
      <MasterpieceBackground />
      <SEO title={t('certificates.title') || 'Certificats'} description={t('certificates.subtitle') || 'Gestion des certificats SSL/TLS'} />

      {/* Header */}
      <motion.div variants={slideUpVariants}>
        <PageHeader
          title={t('certificates.title') || 'Certificats SSL/TLS'}
          subtitle={t('certificates.subtitle') || 'Inventaire et suivi des certificats cryptographiques'}
          icon={<KeyRound className="w-12 h-12 text-primary" />}
          trustType="integrity"
          actions={
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <span>NIS2</span>
                <span className="text-primary/60">|</span>
                <span>Art. 21.2(h)</span>
              </div>
              {canEdit && (
                <Button onClick={handleCreate} className="gap-2">
                  <Plus className="w-4 h-4" />
                  {t('certificates.newCertificate') || 'Nouveau'}
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
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-foreground">{stats.total}</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                </div>
              </div>

              <div className="glass-premium rounded-2xl p-6 border border-white/60 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-success-bg">
                    <CheckCircle className="w-6 h-6 text-success-text" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-success-text">{stats.valid}</div>
                    <div className="text-sm text-muted-foreground">Valides</div>
                  </div>
                </div>
              </div>

              <div className="glass-premium rounded-2xl p-6 border border-white/60 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-warning-bg">
                    <Clock className="w-6 h-6 text-warning-text" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-warning-text">{stats.expiringSoon}</div>
                    <div className="text-sm text-muted-foreground">Expirent bientôt</div>
                  </div>
                </div>
              </div>

              <div className="glass-premium rounded-2xl p-6 border border-white/60 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-danger-bg">
                    <XCircle className="w-6 h-6 text-danger-text" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-danger-text">{stats.expired}</div>
                    <div className="text-sm text-muted-foreground">Expirés</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Expiring Soon List */}
            {stats.expiringNext30Days.length > 0 && (
              <div className="glass-premium rounded-2xl p-6 border border-white/60 dark:border-white/5">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning-text" />
                  Certificats expirant dans les 30 prochains jours
                </h3>
                <div className="space-y-3">
                  {stats.expiringNext30Days.map((cert) => (
                    <div
                      key={cert.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-warning-bg/30 border border-warning-text/20"
                    >
                      <div>
                        <div className="font-medium text-foreground">{cert.name}</div>
                        <div className="text-sm text-muted-foreground">{cert.commonName}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-warning-text">
                          {getDaysUntilExpiration(cert)} jours
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(cert.validTo.toDate(), 'dd MMM yyyy', { locale: fr })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weak Crypto Alert */}
            {stats.weakCrypto > 0 && (
              <div className="glass-premium rounded-2xl p-6 border border-danger-text/20 bg-danger-bg/30">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-danger-text" />
                  <div>
                    <div className="font-semibold text-danger-text">
                      {stats.weakCrypto} certificat(s) avec cryptographie faible
                    </div>
                    <div className="text-sm text-muted-foreground">
                      RSA {'<'} 2048 bits ou algorithme SHA1 détecté
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as CertificateStatus | '')}
                className="px-4 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Tous les statuts</option>
                <option value="valid">Valide</option>
                <option value="expiring_soon">Expire bientôt</option>
                <option value="expired">Expiré</option>
                <option value="revoked">Révoqué</option>
              </select>
            </div>

            {/* Certificate List */}
            {loading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-muted/20 rounded-2xl" />
                ))}
              </div>
            ) : filteredCertificates.length === 0 ? (
              <EmptyState
                icon={KeyRound}
                title={t('certificates.empty.title') || 'Aucun certificat'}
                description={t('certificates.empty.description') || 'Ajoutez votre premier certificat SSL/TLS'}
                actionLabel={canEdit ? 'Ajouter un certificat' : undefined}
                onAction={canEdit ? handleCreate : undefined}
              />
            ) : (
              <div className="space-y-4">
                {filteredCertificates.map((cert) => {
                  const statusInfo = statusConfig[cert.status];
                  const StatusIcon = statusInfo.icon;
                  const daysLeft = getDaysUntilExpiration(cert);

                  return (
                    <div
                      key={cert.id}
                      className="glass-premium rounded-2xl p-6 border border-white/60 dark:border-white/5 hover:border-primary/20 transition-colors cursor-pointer"
                      onClick={() => handleEdit(cert)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-xl bg-primary/10">
                            <KeyRound className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{cert.name}</div>
                            <div className="text-sm text-muted-foreground">{cert.commonName}</div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {cert.domains.slice(0, 3).map((domain) => (
                                <span
                                  key={domain}
                                  className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground"
                                >
                                  {domain}
                                </span>
                              ))}
                              {cert.domains.length > 3 && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
                                  +{cert.domains.length - 3}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={statusInfo.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                          <div className="text-sm text-muted-foreground mt-2">
                            {daysLeft > 0 ? (
                              <>Expire dans {daysLeft} jours</>
                            ) : daysLeft === 0 ? (
                              <>Expire aujourd'hui</>
                            ) : (
                              <>Expiré depuis {Math.abs(daysLeft)} jours</>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(cert.validTo.toDate(), 'dd MMM yyyy', { locale: fr })}
                          </div>
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

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingCertificate(null);
        }}
        title={editingCertificate ? 'Modifier le certificat' : 'Nouveau certificat'}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FloatingLabelInput
              label="Nom"
              {...register('name')}
              error={errors.name?.message}
            />
            <FloatingLabelSelect
              label="Type"
              {...register('type')}
              error={errors.type?.message}
              options={certificateTypeOptions.map((type) => ({
                value: type,
                label: type.replace('_', ' ').toUpperCase(),
              }))}
            />
          </div>

          <FloatingLabelInput
            label="Common Name (CN)"
            {...register('commonName')}
            error={errors.commonName?.message}
          />

          <FloatingLabelInput
            label="Domaines (séparés par des virgules)"
            {...register('domains', {
              setValueAs: (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()) : v),
            })}
            error={errors.domains?.message}
            placeholder="example.com, *.example.com"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FloatingLabelInput
              label="Numéro de série"
              {...register('serialNumber')}
              error={errors.serialNumber?.message}
            />
            <FloatingLabelInput
              label="Émetteur"
              {...register('issuer')}
              error={errors.issuer?.message}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FloatingLabelInput
              type="date"
              label="Date de début"
              {...register('validFrom', { valueAsDate: true })}
              error={errors.validFrom?.message}
            />
            <FloatingLabelInput
              type="date"
              label="Date d'expiration"
              {...register('validTo', { valueAsDate: true })}
              error={errors.validTo?.message}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FloatingLabelSelect
              label="Algorithme"
              {...register('keyAlgorithm')}
              error={errors.keyAlgorithm?.message}
              options={keyAlgorithmOptions.map((algo) => ({
                value: algo,
                label: algo,
              }))}
            />
            <FloatingLabelInput
              type="number"
              label="Taille de clé (bits)"
              {...register('keySize', { valueAsNumber: true })}
              error={errors.keySize?.message}
            />
            <FloatingLabelSelect
              label="Type d'émetteur"
              {...register('issuerType')}
              error={errors.issuerType?.message}
              options={issuerTypeOptions.map((type) => ({
                value: type,
                label: type.replace('_', ' ').toUpperCase(),
              }))}
            />
          </div>

          <FloatingLabelTextarea
            label="Notes"
            {...register('notes')}
            error={errors.notes?.message}
            rows={3}
          />

          <div className="flex justify-between pt-4">
            {editingCertificate && canEdit && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setDeleteConfirm(editingCertificate)}
              >
                Supprimer
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingCertificate(null);
                }}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {editingCertificate ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Supprimer le certificat ?"
        message={`Êtes-vous sûr de vouloir supprimer "${deleteConfirm?.name}" ? Cette action est irréversible.`}
      />
    </motion.div>
  );
};

export default Certificates;
