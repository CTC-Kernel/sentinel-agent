import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, ShieldCheck, CalendarCheck, CalendarClock, Euro, Clock, Plus, List, LayoutGrid, Search, X, CheckCircle, AlertTriangle, ExternalLink, Users } from '../components/ui/Icons';
import { PageHeader } from '../components/ui/PageHeader';
import { SmartSummary, SmartInsight } from '../components/ui/SmartSummary';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/button';
import { Drawer } from '../components/ui/Drawer';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { staggerContainerVariants, slideUpVariants } from '../components/ui/animationVariants';
import { cn } from '@/lib/utils';
import { useStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import { usePersistedState } from '../hooks/usePersistedState';
import { useCertifications } from '../hooks/useCertifications';
import { CertificationService } from '../services/certificationService';
import { CERTIFICATION_STANDARDS } from '../types/certification';
import type { Certification } from '../types/certification';

// ============================================================================
// Helper functions
// ============================================================================

function daysUntil(dateStr: string | undefined): number {
  if (!dateStr) return Infinity;
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const STATUS_CONFIG: Record<Certification['status'], { label: string; color: string; bg: string }> = {
  planning: { label: 'Planification', color: 'text-muted-foreground', bg: 'bg-muted/50 border-muted-foreground/20' },
  'in-progress': { label: 'En cours', color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
  certified: { label: 'Certifie', color: 'text-success', bg: 'bg-success/10 border-success/20' },
  'expiring-soon': { label: 'Expire bientot', color: 'text-warning', bg: 'bg-warning/10 border-warning/20' },
  expired: { label: 'Expire', color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20' },
  suspended: { label: 'Suspendu', color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20' },
  withdrawn: { label: 'Retire', color: 'text-muted-foreground', bg: 'bg-muted/50 border-muted-foreground/20' },
};

const CATEGORY_ICONS: Record<string, string> = {
  security: '🛡️',
  privacy: '🔒',
  quality: '✅',
  cloud: '☁️',
  healthcare: '🏥',
  financial: '💳',
};

type CertTab = 'overview' | 'list' | 'timeline';

// ============================================================================
// StatusBadge Component
// ============================================================================

const StatusBadge: React.FC<{ status: Certification['status'] }> = ({ status }) => {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border',
      config.bg, config.color
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', config.color === 'text-success' ? 'bg-success' : config.color === 'text-warning' ? 'bg-warning' : config.color === 'text-destructive' ? 'bg-destructive' : config.color === 'text-primary' ? 'bg-primary' : 'bg-muted-foreground')} />
      {config.label}
    </span>
  );
};

// ============================================================================
// CertificationCard Component
// ============================================================================

const CertificationCard: React.FC<{
  cert: Certification;
  onClick: (cert: Certification) => void;
}> = ({ cert, onClick }) => {
  const standard = CERTIFICATION_STANDARDS.find(s => s.name === cert.standard || s.shortName === cert.standard);
  const categoryIcon = standard ? CATEGORY_ICONS[standard.category] || '📋' : '📋';
  const daysLeft = daysUntil(cert.expiryDate);
  const completedMilestones = cert.milestones.filter(m => m.status === 'completed').length;
  const totalMilestones = cert.milestones.length;
  const milestoneProgress = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

  return (
    <motion.div
      variants={slideUpVariants}
      whileHover={{ y: -4, scale: 1.01 }}
      onClick={() => onClick(cert)}
      className="glass-premium border border-border/40 rounded-2xl p-5 cursor-pointer group transition-all duration-300 hover:shadow-lg hover:border-primary/20 relative overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />

      <div className="relative z-10 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-card/80 border border-border/40 flex items-center justify-center text-xl shadow-sm">
              {categoryIcon}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                {cert.name}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                {cert.standard}
              </p>
            </div>
          </div>
          <StatusBadge status={cert.status} />
        </div>

        {/* Body info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {cert.expiryDate ? (
                daysLeft > 0 ? (
                  <span className={daysLeft <= 90 ? 'text-warning font-medium' : ''}>
                    {daysLeft}j restants
                  </span>
                ) : (
                  <span className="text-destructive font-medium">Expire</span>
                )
              ) : (
                'Non defini'
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarClock className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {cert.nextAuditDate ? formatDate(cert.nextAuditDate) : 'Aucun audit'}
            </span>
          </div>
        </div>

        {/* Certification body */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{cert.certificationBody || 'Non renseigne'}</span>
        </div>

        {/* Milestone progress */}
        {totalMilestones > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Jalons</span>
              <span className="font-medium text-foreground">{completedMilestones}/{totalMilestones}</span>
            </div>
            <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${milestoneProgress}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="h-full bg-primary rounded-full"
              />
            </div>
          </div>
        )}

        {/* Tags */}
        {cert.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {cert.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                {tag}
              </span>
            ))}
            {cert.tags.length > 3 && (
              <span className="px-2 py-0.5 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                +{cert.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ============================================================================
// CertificationListRow Component
// ============================================================================

const CertificationListRow: React.FC<{
  cert: Certification;
  onClick: (cert: Certification) => void;
}> = ({ cert, onClick }) => {
  const standard = CERTIFICATION_STANDARDS.find(s => s.name === cert.standard || s.shortName === cert.standard);
  const categoryIcon = standard ? CATEGORY_ICONS[standard.category] || '📋' : '📋';
  const daysLeft = daysUntil(cert.expiryDate);

  return (
    <motion.tr
      variants={slideUpVariants}
      onClick={() => onClick(cert)}
      className="border-b border-border/30 hover:bg-muted/30 cursor-pointer transition-colors group"
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <span className="text-lg">{categoryIcon}</span>
          <div>
            <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{cert.name}</p>
            <p className="text-xs text-muted-foreground">{cert.standard}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <p className="text-sm text-muted-foreground">{cert.certificationBody}</p>
      </td>
      <td className="py-3 px-4">
        <StatusBadge status={cert.status} />
      </td>
      <td className="py-3 px-4">
        <p className="text-sm text-muted-foreground">{formatDate(cert.expiryDate)}</p>
        {cert.expiryDate && daysLeft > 0 && daysLeft <= 90 && (
          <p className="text-xs text-warning font-medium">{daysLeft}j restants</p>
        )}
      </td>
      <td className="py-3 px-4">
        <p className="text-sm text-muted-foreground">{formatDate(cert.nextAuditDate)}</p>
      </td>
      <td className="py-3 px-4">
        <p className="text-sm text-muted-foreground">
          {cert.cost ? formatCurrency(cert.cost.annualMaintenanceCost + cert.cost.auditCost, cert.cost.currency) : '-'}
        </p>
      </td>
    </motion.tr>
  );
};

// ============================================================================
// CertificationTimeline Component
// ============================================================================

const CertificationTimeline: React.FC<{ cert: Certification }> = ({ cert }) => {
  const events = CertificationService.getCertificationTimeline(cert);

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Aucun evenement dans la timeline
      </div>
    );
  }

  const variantColors: Record<string, string> = {
    success: 'bg-success border-success',
    warning: 'bg-warning border-warning',
    destructive: 'bg-destructive border-destructive',
    primary: 'bg-primary border-primary',
    secondary: 'bg-secondary border-secondary',
  };

  return (
    <div className="relative pl-8 space-y-6">
      {/* Timeline line */}
      <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border/60" />

      {events.map((event, idx) => (
        <div key={idx} className="relative flex items-start gap-4">
          {/* Dot */}
          <div className={cn(
            'absolute left-[-20px] top-1 w-3 h-3 rounded-full border-2 bg-background z-10',
            event.status === 'past' ? 'border-muted-foreground/40' : variantColors[event.variant] || 'border-primary'
          )}>
            {event.status === 'current' && (
              <div className={cn('absolute inset-0 rounded-full animate-ping opacity-40', variantColors[event.variant])} />
            )}
          </div>

          {/* Content */}
          <div className={cn(
            'flex-1 rounded-xl border p-3 transition-colors',
            event.status === 'past' ? 'bg-muted/20 border-border/30 opacity-60' : 'bg-card/50 border-border/40'
          )}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">{event.label}</span>
              <span className="text-xs text-muted-foreground">{formatDate(event.date)}</span>
            </div>
            <span className={cn(
              'inline-block mt-1.5 px-2 py-0.5 rounded-lg text-xs font-medium',
              event.variant === 'success' ? 'bg-success/10 text-success' :
              event.variant === 'warning' ? 'bg-warning/10 text-warning' :
              event.variant === 'destructive' ? 'bg-destructive/10 text-destructive' :
              'bg-primary/10 text-primary'
            )}>
              {event.type === 'certification' ? 'Certification' : event.type === 'audit' ? 'Audit' : event.type === 'milestone' ? 'Jalon' : event.type === 'expiry' ? 'Expiration' : 'Renouvellement'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// CertificationDetail Panel Component
// ============================================================================

const CertificationDetail: React.FC<{
  cert: Certification;
  onClose: () => void;
  onEdit: (cert: Certification) => void;
  onDelete: (id: string) => void;
}> = ({ cert, onClose, onEdit, onDelete }) => {
  const [activeSection, setActiveSection] = useState<'info' | 'audits' | 'milestones' | 'timeline' | 'contacts'>('info');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const daysLeft = daysUntil(cert.expiryDate);

  return (
    <Drawer isOpen={true} onClose={onClose} title={cert.name} width="max-w-3xl">
      <div className="space-y-6">
        {/* Status and key info */}
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={cert.status} />
          {cert.certificateNumber && (
            <span className="text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-xl">
              N° {cert.certificateNumber}
            </span>
          )}
          {cert.expiryDate && daysLeft > 0 && (
            <span className={cn(
              'text-xs font-medium px-2.5 py-1 rounded-xl',
              daysLeft <= 90 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
            )}>
              <Clock className="w-3 h-3 inline mr-1" />
              {daysLeft}j avant expiration
            </span>
          )}
        </div>

        {/* Quick info grid */}
        <div className="grid grid-cols-2 gap-4">
          <InfoItem label="Standard" value={cert.standard} />
          <InfoItem label="Organisme" value={cert.certificationBody} />
          <InfoItem label="Perimetre" value={cert.scope} />
          <InfoItem label="Version" value={cert.version || '-'} />
          <InfoItem label="Certification initiale" value={formatDate(cert.initialCertDate)} />
          <InfoItem label="Certification courante" value={formatDate(cert.currentCertDate)} />
          <InfoItem label="Expiration" value={formatDate(cert.expiryDate)} />
          <InfoItem label="Prochain audit" value={formatDate(cert.nextAuditDate)} />
          <InfoItem label="Renouvellement" value={formatDate(cert.renewalDate)} />
          {cert.cost && (
            <InfoItem label="Cout annuel" value={formatCurrency(cert.cost.annualMaintenanceCost + cert.cost.auditCost, cert.cost.currency)} />
          )}
        </div>

        {/* Section tabs */}
        <div className="flex gap-2 border-b border-border/40 pb-2 overflow-x-auto">
          {[
            { id: 'info' as const, label: 'Notes' },
            { id: 'audits' as const, label: `Audits (${cert.auditHistory.length})` },
            { id: 'milestones' as const, label: `Jalons (${cert.milestones.length})` },
            { id: 'timeline' as const, label: 'Timeline' },
            { id: 'contacts' as const, label: `Contacts (${cert.contacts.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap',
                activeSection === tab.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Section content */}
        {activeSection === 'info' && (
          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
            {cert.notes || 'Aucune note'}
          </div>
        )}

        {activeSection === 'audits' && (
          <div className="space-y-3">
            {cert.auditHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun audit enregistre</p>
            ) : (
              cert.auditHistory.map((audit) => (
                <div key={audit.id} className="border border-border/40 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold capitalize">{audit.type.replace('-', ' ')}</span>
                    <span className={cn(
                      'px-2 py-0.5 rounded-lg text-xs font-medium',
                      audit.result === 'pass' ? 'bg-success/10 text-success' :
                      audit.result === 'fail' ? 'bg-destructive/10 text-destructive' :
                      'bg-warning/10 text-warning'
                    )}>
                      {audit.result === 'pass' ? 'Reussi' : audit.result === 'fail' ? 'Echoue' : audit.result === 'conditional' ? 'Conditionnel' : 'En attente'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Date: {formatDate(audit.date)}</span>
                    <span>Auditeur: {audit.auditor}</span>
                    <span>NC majeures: {audit.majorNonConformities}</span>
                    <span>NC mineures: {audit.minorNonConformities}</span>
                    <span>Observations: {audit.observations}</span>
                    <span>Total constatations: {audit.findings}</span>
                  </div>
                  {audit.notes && (
                    <p className="text-xs text-muted-foreground mt-2">{audit.notes}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeSection === 'milestones' && (
          <div className="space-y-3">
            {cert.milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun jalon defini</p>
            ) : (
              cert.milestones.map((m) => (
                <div key={m.id} className={cn(
                  'border rounded-xl p-4 flex items-start gap-3 transition-colors',
                  m.status === 'completed' ? 'border-success/20 bg-success/5' :
                  m.status === 'overdue' ? 'border-destructive/20 bg-destructive/5' :
                  'border-border/40'
                )}>
                  <div className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                    m.status === 'completed' ? 'bg-success/20 text-success' :
                    m.status === 'overdue' ? 'bg-destructive/20 text-destructive' :
                    m.status === 'in-progress' ? 'bg-primary/20 text-primary' :
                    'bg-muted/40 text-muted-foreground'
                  )}>
                    {m.status === 'completed' ? (
                      <CheckCircle className="w-3.5 h-3.5" />
                    ) : m.status === 'overdue' ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{m.title}</p>
                    {m.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>Echeance: {formatDate(m.dueDate)}</span>
                      {m.assigneeName && <span>Assigne: {m.assigneeName}</span>}
                      {m.completedAt && <span>Termine: {formatDate(m.completedAt)}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeSection === 'timeline' && (
          <CertificationTimeline cert={cert} />
        )}

        {activeSection === 'contacts' && (
          <div className="space-y-3">
            {cert.contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun contact renseigne</p>
            ) : (
              cert.contacts.map((contact, idx) => (
                <div key={idx} className="border border-border/40 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">{contact.organization} - {contact.role.replace('-', ' ')}</p>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      {contact.email && <span>{contact.email}</span>}
                      {contact.phone && <span>{contact.phone}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-border/40">
          <Button variant="default" size="sm" onClick={() => onEdit(cert)}>
            Modifier
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
            Supprimer
          </Button>
          {cert.certificateUrl && (
            <a href={cert.certificateUrl} target="_blank" rel="noopener noreferrer" className="ml-auto">
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-1.5" />
                Voir certificat
              </Button>
            </a>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          onDelete(cert.id);
          setShowDeleteConfirm(false);
          onClose();
        }}
        title="Supprimer la certification"
        message={`Etes-vous sur de vouloir supprimer la certification "${cert.name}" ? Cette action est irreversible.`}
        type="danger"
      />
    </Drawer>
  );
};

// ============================================================================
// InfoItem Helper Component
// ============================================================================

const InfoItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">{label}</p>
    <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
  </div>
);

// ============================================================================
// CertificationForm Component
// ============================================================================

const CertificationForm: React.FC<{
  initialData?: Certification;
  onSubmit: (data: Omit<Certification, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}> = ({ initialData, onSubmit, onCancel, submitting }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [standard, setStandard] = useState(initialData?.standard || '');
  const [certificationBody, setCertificationBody] = useState(initialData?.certificationBody || '');
  const [scope, setScope] = useState(initialData?.scope || '');
  const [status, setStatus] = useState<Certification['status']>(initialData?.status || 'planning');
  const [initialCertDate, setInitialCertDate] = useState(initialData?.initialCertDate?.split('T')[0] || '');
  const [currentCertDate, setCurrentCertDate] = useState(initialData?.currentCertDate?.split('T')[0] || '');
  const [expiryDate, setExpiryDate] = useState(initialData?.expiryDate?.split('T')[0] || '');
  const [nextAuditDate, setNextAuditDate] = useState(initialData?.nextAuditDate?.split('T')[0] || '');
  const [renewalDate, setRenewalDate] = useState(initialData?.renewalDate?.split('T')[0] || '');
  const [certificateNumber, setCertificateNumber] = useState(initialData?.certificateNumber || '');
  const [certificateUrl, setCertificateUrl] = useState(initialData?.certificateUrl || '');
  const [version, setVersion] = useState(initialData?.version || '');
  const [level, setLevel] = useState(initialData?.level || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [tagsStr, setTagsStr] = useState(initialData?.tags?.join(', ') || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !standard || !certificationBody || !scope) return;

    const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);

    await onSubmit({
      name,
      standard,
      certificationBody,
      scope,
      status,
      initialCertDate: initialCertDate ? new Date(initialCertDate).toISOString() : undefined,
      currentCertDate: currentCertDate ? new Date(currentCertDate).toISOString() : undefined,
      expiryDate: expiryDate ? new Date(expiryDate).toISOString() : undefined,
      nextAuditDate: nextAuditDate ? new Date(nextAuditDate).toISOString() : undefined,
      renewalDate: renewalDate ? new Date(renewalDate).toISOString() : undefined,
      certificateNumber: certificateNumber || undefined,
      certificateUrl: certificateUrl || undefined,
      version: version || undefined,
      level: level || undefined,
      notes: notes || undefined,
      tags,
      auditHistory: initialData?.auditHistory || [],
      milestones: initialData?.milestones || [],
      contacts: initialData?.contacts || [],
      cost: initialData?.cost,
    });
  };

  const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors';
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div>
        <label className={labelClass}>Nom de la certification *</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="Ex: ISO 27001 - Mon entreprise" required />
      </div>

      {/* Standard */}
      <div>
        <label className={labelClass}>Standard *</label>
        <select value={standard} onChange={e => setStandard(e.target.value)} className={inputClass} required>
          <option value="">Selectionner un standard</option>
          {CERTIFICATION_STANDARDS.map(s => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
          <option value="Autre">Autre</option>
        </select>
      </div>

      {/* Certification body */}
      <div>
        <label className={labelClass}>Organisme de certification *</label>
        <input type="text" value={certificationBody} onChange={e => setCertificationBody(e.target.value)} className={inputClass} placeholder="Ex: Bureau Veritas, AFNOR, BSI" required />
      </div>

      {/* Scope */}
      <div>
        <label className={labelClass}>Perimetre *</label>
        <textarea value={scope} onChange={e => setScope(e.target.value)} className={cn(inputClass, 'min-h-[80px] resize-y')} placeholder="Decrire le perimetre de la certification..." required />
      </div>

      {/* Status */}
      <div>
        <label className={labelClass}>Statut</label>
        <select value={status} onChange={e => setStatus(e.target.value as Certification['status'])} className={inputClass}>
          <option value="planning">Planification</option>
          <option value="in-progress">En cours</option>
          <option value="certified">Certifie</option>
          <option value="expiring-soon">Expire bientot</option>
          <option value="expired">Expire</option>
          <option value="suspended">Suspendu</option>
          <option value="withdrawn">Retire</option>
        </select>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Certification initiale</label>
          <input type="date" value={initialCertDate} onChange={e => setInitialCertDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Certification courante</label>
          <input type="date" value={currentCertDate} onChange={e => setCurrentCertDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Date d'expiration</label>
          <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Prochain audit</label>
          <input type="date" value={nextAuditDate} onChange={e => setNextAuditDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Renouvellement</label>
          <input type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} className={inputClass} />
        </div>
      </div>

      {/* Optional info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Numero de certificat</label>
          <input type="text" value={certificateNumber} onChange={e => setCertificateNumber(e.target.value)} className={inputClass} placeholder="Ex: CERT-2024-001" />
        </div>
        <div>
          <label className={labelClass}>URL du certificat</label>
          <input type="url" value={certificateUrl} onChange={e => setCertificateUrl(e.target.value)} className={inputClass} placeholder="https://..." />
        </div>
        <div>
          <label className={labelClass}>Version</label>
          <input type="text" value={version} onChange={e => setVersion(e.target.value)} className={inputClass} placeholder="Ex: 2022" />
        </div>
        <div>
          <label className={labelClass}>Niveau</label>
          <input type="text" value={level} onChange={e => setLevel(e.target.value)} className={inputClass} placeholder="Ex: Niveau 1" />
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className={labelClass}>Tags (separes par des virgules)</label>
        <input type="text" value={tagsStr} onChange={e => setTagsStr(e.target.value)} className={inputClass} placeholder="Ex: securite, cloud, production" />
      </div>

      {/* Notes */}
      <div>
        <label className={labelClass}>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} className={cn(inputClass, 'min-h-[100px] resize-y')} placeholder="Notes supplementaires..." />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-border/40">
        <Button type="submit" disabled={submitting || !name || !standard || !certificationBody || !scope} isLoading={submitting}>
          {initialData ? 'Mettre a jour' : 'Creer la certification'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
};

// ============================================================================
// Main Certifications View
// ============================================================================

export const Certifications: React.FC = () => {
  const _auth = useAuth();
  const _store = useStore();

  const {
    certifications,
    filteredCertifications,
    loading,
    stats,
    filters,
    setFilters,
    createCertification,
    updateCertification,
    deleteCertification,
    submitting,
  } = useCertifications();

  // UI State
  const [activeTab, setActiveTab] = usePersistedState<CertTab>('certifications-active-tab', 'overview');
  const [viewMode, setViewMode] = usePersistedState<'grid' | 'list'>('certifications-view-mode', 'grid');
  const [selectedCert, setSelectedCert] = useState<Certification | null>(null);
  const [creationMode, setCreationMode] = useState(false);
  const [editingCert, setEditingCert] = useState<Certification | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Update search filter
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setFilters(prev => ({ ...prev, searchQuery: value || undefined }));
  }, [setFilters]);

  // Stats insights
  const insights = useMemo<SmartInsight[]>(() => {
    if (loading) return [];
    return [
      {
        label: 'Certifications actives',
        value: stats.active,
        subValue: `${stats.total} au total`,
        icon: <ShieldCheck className="w-5 h-5" />,
        variant: 'success' as const,
      },
      {
        label: 'Expirant bientot',
        value: stats.expiringSoon,
        subValue: 'Dans les 90 prochains jours',
        icon: <AlertTriangle className="w-5 h-5" />,
        variant: stats.expiringSoon > 0 ? 'warning' as const : 'success' as const,
      },
      {
        label: 'Audits a venir',
        value: stats.upcomingAudits,
        subValue: 'Dans les 90 prochains jours',
        icon: <CalendarClock className="w-5 h-5" />,
        variant: 'primary' as const,
      },
      {
        label: 'Cout annuel',
        value: stats.totalAnnualCost > 0 ? formatCurrency(stats.totalAnnualCost) : '-',
        subValue: 'Maintenance + audits',
        icon: <Euro className="w-5 h-5" />,
        variant: 'secondary' as const,
      },
    ];
  }, [loading, stats]);

  const tabs = useMemo(() => [
    { id: 'overview', label: 'Vue d\'ensemble', icon: LayoutGrid },
    { id: 'list', label: 'Registre', icon: List },
    { id: 'timeline', label: 'Timeline', icon: CalendarCheck },
  ], []);

  // Form handlers
  const handleFormSubmit = useCallback(async (data: Omit<Certification, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    if (editingCert) {
      await updateCertification(editingCert.id, data);
    } else {
      await createCertification(data);
    }
    setCreationMode(false);
    setEditingCert(null);
  }, [editingCert, updateCertification, createCertification]);

  const handleEdit = useCallback((cert: Certification) => {
    setEditingCert(cert);
    setCreationMode(true);
    setSelectedCert(null);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await deleteCertification(id);
    setSelectedCert(null);
  }, [deleteCertification]);

  // Filter handlers
  const handleStatusFilter = useCallback((status: Certification['status'] | null) => {
    setFilters(prev => ({ ...prev, status }));
  }, [setFilters]);

  // Loading state
  if (loading) {
    return (
      <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24">
        <PageHeader title="Certifications" subtitle="Suivi du cycle de vie des certifications" icon={<Award className="text-primary" />} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 rounded-2xl bg-muted/20 animate-pulse border border-border/40" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-muted/20 animate-pulse border border-border/40" />
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24">
      <PageHeader
        title="Certifications"
        subtitle="Suivi du cycle de vie des certifications organisationnelles"
        icon={<Award className="text-primary" />}
        actions={
          <Button onClick={() => { setEditingCert(null); setCreationMode(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Nouvelle certification
          </Button>
        }
      />

      {/* Smart Summary Stats */}
      <SmartSummary insights={insights} loading={loading} />

      {/* Tabs */}
      <ScrollableTabs tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as CertTab)} />

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Rechercher une certification..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
          />
          {searchQuery && (
            <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status filters */}
        <div className="flex flex-wrap gap-2">
          {(['certified', 'expiring-soon', 'in-progress', 'expired'] as const).map(status => (
            <button
              key={status}
              onClick={() => handleStatusFilter(filters.status === status ? null : status)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors',
                filters.status === status
                  ? STATUS_CONFIG[status].bg + ' ' + STATUS_CONFIG[status].color + ' border-current'
                  : 'border-border/40 text-muted-foreground hover:bg-muted/30'
              )}
            >
              {STATUS_CONFIG[status].label}
            </button>
          ))}
        </div>

        {/* View mode toggle (for overview tab) */}
        {activeTab === 'overview' && (
          <div className="flex items-center gap-1 rounded-xl border border-border/40 p-1 ml-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                viewMode === 'grid' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label="Vue grille"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                viewMode === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label="Vue liste"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Tab Content */}
      {(activeTab === 'overview' || activeTab === 'list') && (
        <>
          {filteredCertifications.length === 0 ? (
            <EmptyState
              icon={Award}
              title="Aucune certification"
              description={searchQuery || filters.status ? "Aucune certification ne correspond a vos criteres de recherche." : "Commencez par ajouter votre premiere certification pour suivre son cycle de vie."}
              actionLabel={searchQuery || filters.status ? "Reinitialiser les filtres" : "Ajouter une certification"}
              onAction={searchQuery || filters.status ? () => { handleSearchChange(''); handleStatusFilter(null); } : () => setCreationMode(true)}
              semantic="info"
            />
          ) : (activeTab === 'overview' && viewMode === 'grid') || activeTab === 'overview' && viewMode === 'grid' ? (
            <motion.div
              variants={staggerContainerVariants}
              initial="initial"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filteredCertifications.map(cert => (
                <CertificationCard key={cert.id} cert={cert} onClick={setSelectedCert} />
              ))}
            </motion.div>
          ) : (
            <div className="border border-border/40 rounded-2xl overflow-hidden bg-card/50">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/20">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Certification</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Organisme</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Statut</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expiration</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prochain audit</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cout annuel</th>
                    </tr>
                  </thead>
                  <motion.tbody variants={staggerContainerVariants} initial="initial" animate="visible">
                    {filteredCertifications.map(cert => (
                      <CertificationListRow key={cert.id} cert={cert} onClick={setSelectedCert} />
                    ))}
                  </motion.tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'timeline' && (
        <div className="space-y-8">
          {certifications.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="Aucune timeline disponible"
              description="Ajoutez des certifications pour visualiser leur cycle de vie sur une timeline."
              actionLabel="Ajouter une certification"
              onAction={() => setCreationMode(true)}
              semantic="info"
            />
          ) : (
            certifications.map(cert => (
              <motion.div
                key={cert.id}
                variants={slideUpVariants}
                className="border border-border/40 rounded-2xl p-6 bg-card/50"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Award className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">{cert.name}</h3>
                    <p className="text-xs text-muted-foreground">{cert.standard} - {cert.certificationBody}</p>
                  </div>
                  <div className="ml-auto">
                    <StatusBadge status={cert.status} />
                  </div>
                </div>
                <CertificationTimeline cert={cert} />
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedCert && (
          <CertificationDetail
            cert={selectedCert}
            onClose={() => setSelectedCert(null)}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>

      {/* Creation/Edit Drawer */}
      <AnimatePresence>
        {creationMode && (
          <Drawer
            isOpen={creationMode}
            onClose={() => { setCreationMode(false); setEditingCert(null); }}
            title={editingCert ? 'Modifier la certification' : 'Nouvelle certification'}
            width="max-w-2xl"
          >
            <CertificationForm
              initialData={editingCert || undefined}
              onSubmit={handleFormSubmit}
              onCancel={() => { setCreationMode(false); setEditingCert(null); }}
              submitting={submitting}
            />
          </Drawer>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
