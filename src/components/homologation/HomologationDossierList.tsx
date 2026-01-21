/**
 * HomologationDossierList
 *
 * Display list of homologation dossiers with status and actions.
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, differenceInDays } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import {
  Star,
  FileText,
  Shield,
  ShieldAlert,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileCheck,
  Calendar
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '../ui/DropdownMenu';
import { Progress } from '../ui/Progress';
import type { HomologationDossier, HomologationLevel, HomologationStatus } from '../../types/homologation';
import { LEVEL_INFO, DOCUMENT_TYPE_INFO } from '../../types/homologation';

interface HomologationDossierListProps {
  dossiers: HomologationDossier[];
  onView: (dossier: HomologationDossier) => void;
  onEdit: (dossier: HomologationDossier) => void;
  onDelete: (dossier: HomologationDossier) => void;
  loading?: boolean;
}

const LEVEL_ICONS: Record<HomologationLevel, React.ElementType> = {
  etoile: Star,
  simple: FileText,
  standard: Shield,
  renforce: ShieldAlert
};

const STATUS_CONFIG: Record<
  HomologationStatus,
  { icon: React.ElementType; color: string; bgColor: string }
> = {
  draft: { icon: FileText, color: 'text-gray-600', bgColor: 'bg-gray-100' },
  in_progress: { icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  pending_decision: { icon: FileCheck, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  homologated: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
  expired: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100' },
  revoked: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' }
};

export const HomologationDossierList: React.FC<HomologationDossierListProps> = ({
  dossiers,
  onView,
  onEdit,
  onDelete,
  loading
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? enUS : fr;
  const isEnglish = i18n.language === 'en';

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<HomologationStatus | 'all'>('all');

  // Filter dossiers
  const filteredDossiers = useMemo(() => {
    return dossiers.filter((dossier) => {
      const matchesSearch =
        !searchTerm ||
        dossier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dossier.systemScope.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || dossier.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [dossiers, searchTerm, statusFilter]);

  // Calculate document progress
  const getDocumentProgress = (dossier: HomologationDossier) => {
    const total = dossier.documents.length;
    const completed = dossier.documents.filter(
      (d) => d.status === 'completed' || d.status === 'validated'
    ).length;
    return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  // Get expiration info
  const getExpirationInfo = (dossier: HomologationDossier) => {
    if (!dossier.validityEndDate) return null;

    const endDate = new Date(dossier.validityEndDate);
    const daysRemaining = differenceInDays(endDate, new Date());

    if (daysRemaining < 0) {
      return { status: 'expired', days: Math.abs(daysRemaining), color: 'text-red-600' };
    }
    if (daysRemaining <= 30) {
      return { status: 'critical', days: daysRemaining, color: 'text-red-600' };
    }
    if (daysRemaining <= 60) {
      return { status: 'warning', days: daysRemaining, color: 'text-amber-600' };
    }
    if (daysRemaining <= 90) {
      return { status: 'notice', days: daysRemaining, color: 'text-yellow-600' };
    }
    return { status: 'ok', days: daysRemaining, color: 'text-green-600' };
  };

  const renderDossierCard = (dossier: HomologationDossier) => {
    const levelInfo = LEVEL_INFO[dossier.level];
    const LevelIcon = LEVEL_ICONS[dossier.level];
    const statusConfig = STATUS_CONFIG[dossier.status];
    const StatusIcon = statusConfig.icon;
    const docProgress = getDocumentProgress(dossier);
    const expirationInfo = getExpirationInfo(dossier);

    return (
      <Card
        key={dossier.id}
        className="p-4 hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => onView(dossier)}
      >
        <div className="flex items-start justify-between">
          {/* Left: Level icon and info */}
          <div className="flex items-start gap-3">
            <div
              className="p-2 rounded-lg flex-shrink-0"
              style={{ backgroundColor: `${levelInfo.color}20`, color: levelInfo.color }}
            >
              <LevelIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">{dossier.name}</h3>
              <p className="text-sm text-muted-foreground">{dossier.systemScope}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" style={{ borderColor: levelInfo.color, color: levelInfo.color }}>
                  {levelInfo.label}
                </Badge>
                <Badge className={cn(statusConfig.bgColor, statusConfig.color, 'border-0')}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {t(`homologation.status.${dossier.status}`, dossier.status)}
                </Badge>
                {dossier.levelOverridden && (
                  <Badge variant="secondary" className="text-xs">
                    {t('homologation.overridden', 'Modifié')}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onView(dossier);
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                {t('common.view', 'Voir')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(dossier);
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                {t('common.edit', 'Modifier')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(dossier);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('common.delete', 'Supprimer')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Document progress */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">
              {t('homologation.documents', 'Documents')}
            </span>
            <span className="text-xs font-medium">
              {docProgress.completed}/{docProgress.total}
            </span>
          </div>
          <Progress value={docProgress.percentage} className="h-1.5" />
        </div>

        {/* Expiration info for homologated dossiers */}
        {dossier.status === 'homologated' && expirationInfo && (
          <div className="mt-3 flex items-center gap-2">
            <Calendar className={cn('h-4 w-4', expirationInfo.color)} />
            <span className={cn('text-sm', expirationInfo.color)}>
              {expirationInfo.status === 'expired'
                ? t('homologation.expiredDaysAgo', 'Expiré depuis {{days}} jours', {
                    days: expirationInfo.days
                  })
                : t('homologation.expiresInDays', 'Expire dans {{days}} jours', {
                    days: expirationInfo.days
                  })}
            </span>
          </div>
        )}

        {/* Created date */}
        <div className="mt-2 text-xs text-muted-foreground">
          {t('common.createdAt', 'Créé le')}{' '}
          {format(new Date(dossier.createdAt), 'PPP', { locale })}
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-muted rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input
          placeholder={t('homologation.searchDossiers', 'Rechercher un dossier...')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex gap-2 flex-wrap">
          {(['all', 'draft', 'in_progress', 'pending_decision', 'homologated', 'expired'] as const).map(
            (status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {status === 'all'
                  ? t('common.all', 'Tous')
                  : t(`homologation.status.${status}`, status)}
              </Button>
            )
          )}
        </div>
      </div>

      {/* Dossier grid */}
      {filteredDossiers.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDossiers.map(renderDossierCard)}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium mb-2">
            {t('homologation.noDossiers', 'Aucun dossier d\'homologation')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {searchTerm || statusFilter !== 'all'
              ? t('homologation.noMatchingDossiers', 'Aucun dossier ne correspond aux critères')
              : t('homologation.createFirstDossier', 'Créez votre premier dossier pour commencer')}
          </p>
        </Card>
      )}
    </div>
  );
};

export default HomologationDossierList;
