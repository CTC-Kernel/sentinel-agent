/**
 * Story 25.6 - Retention Dashboard UI Component
 *
 * Dashboard for managing document retention policies:
 * - List all retention policies with edit/delete
 * - Create new policy form
 * - Show documents expiring soon
 * - Charts showing document age distribution
 * - Manual trigger for retention preview
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  FileText,
  Archive,
  XCircle,
  Bell,
  Loader2,
  BarChart3,
  Settings,
  CheckCircle,
  Clock,
  Shield,
  LucideIcon,
} from '../ui/Icons';

import { Switch } from '@/components/ui/Switch';
import { Separator } from '@/components/ui/separator';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useStore } from '@/store';
import { useLocale } from '@/hooks/useLocale';
import { useDocumentsData } from '../../hooks/documents/useDocumentsData';
import {
  getPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getDocumentsNearExpiry,
  getExpiredDocuments,
  getDocumentAgeDistribution,
  getRetentionStats,
} from '@/services/retentionService';
import type {
  RetentionPolicy,
  RetentionAction,
  DocumentRetentionStatus,
  ClassificationLevel,
  RetentionScope,
} from '@/types/vault';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ErrorLogger } from '@/services/errorLogger';

interface RetentionDashboardProps {
  className?: string;
}

const ACTION_CONFIG: Record<RetentionAction, { label: string; icon: LucideIcon; color: string }> = {
  archive: { label: 'Archiver', icon: Archive, color: 'text-blue-500' },
  delete: { label: 'Supprimer', icon: XCircle, color: 'text-red-500' },
  notify: { label: 'Notifier', icon: Bell, color: 'text-warning-500' },
};

const DOCUMENT_TYPES = ['Policy', 'Procedure', 'Evidence', 'Audit', 'Contract', 'HR', 'Legal', 'Financial'];
const CLASSIFICATION_LEVELS: ClassificationLevel[] = ['public', 'internal', 'confidential', 'secret'];

export function RetentionDashboard({ className }: RetentionDashboardProps) {
  const { t } = useLocale();

  const { user, organization } = useStore();
  const organizationId = organization?.id;
  const { documents } = useDocumentsData(organizationId);

  // State
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [nearExpiry, setNearExpiry] = useState<DocumentRetentionStatus[]>([]);
  const [expired, setExpired] = useState<DocumentRetentionStatus[]>([]);
  const [ageDistribution, setAgeDistribution] = useState({
    under30Days: 0,
    under90Days: 0,
    under1Year: 0,
    under3Years: 0,
    over3Years: 0,
    total: 0,
  });
  const [stats, setStats] = useState({
    totalPolicies: 0,
    activePolicies: 0,
    documentsWithPolicy: 0,
    documentsExpiringSoon: 0,
    documentsExpired: 0,
    documentsUnderLegalHold: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [expiryFilter, setExpiryFilter] = useState<7 | 30 | 90>(30);

  // Dialog state
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<RetentionPolicy | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [policyToDelete, setPolicyToDelete] = useState<RetentionPolicy | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    retentionDays: 365,
    action: 'notify' as RetentionAction,
    notifyDaysBefore: 30,
    documentTypes: [] as string[],
    classifications: [] as ClassificationLevel[],
    excludeLegalHold: true,
    isActive: true,
    priority: 0,
  });
  const [formLoading, setFormLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const [policiesData, statsData, distributionData] = await Promise.all([
        getPolicies(organizationId),
        getRetentionStats(organizationId),
        getDocumentAgeDistribution(organizationId),
      ]);
      setPolicies(policiesData);
      setStats(statsData);
      setAgeDistribution(distributionData);
    } catch (error) {
      ErrorLogger.error(error, 'RetentionDashboard.loadData');
      toast.error(t('retention.error.loadFailed', 'Erreur lors du chargement'));
    } finally {
      setLoading(false);
    }
  }, [organizationId, t]);

  const loadExpiryData = useCallback(async () => {
    if (!organizationId) return;
    try {
      const [nearExpiryData, expiredData] = await Promise.all([
        getDocumentsNearExpiry(organizationId, expiryFilter),
        getExpiredDocuments(organizationId),
      ]);
      setNearExpiry(nearExpiryData);
      setExpired(expiredData);
    } catch (error) {
      ErrorLogger.error(error, 'RetentionDashboard.loadExpiryData');
    }
  }, [organizationId, expiryFilter]);

  // Load data
  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadExpiryData();
  }, [loadExpiryData]);

  // Get document title by ID
  const getDocumentTitle = (docId: string): string => {
    const doc = documents.find((d) => d.id === docId);
    return doc?.title || docId;
  };

  // Handle save policy
  const handleSavePolicy = async () => {
    if (!organizationId || !user) return;
    if (!formData.name.trim()) {
      toast.error(t('retention.error.nameRequired', 'Le nom est obligatoire'));
      return;
    }

    setFormLoading(true);
    try {
      const scope: Partial<RetentionScope> = {};
      if (formData.documentTypes.length > 0) {
        scope.documentTypes = formData.documentTypes;
      }
      if (formData.classifications.length > 0) {
        scope.classifications = formData.classifications;
      }

      if (editingPolicy) {
        await updatePolicy(editingPolicy.id, user.uid, {
          name: formData.name,
          description: formData.description || undefined,
          retentionDays: formData.retentionDays,
          action: formData.action,
          notifyDaysBefore: formData.notifyDaysBefore,
          scope: Object.keys(scope).length > 0 ? scope : undefined,
          exceptions: {
            excludeLegalHold: formData.excludeLegalHold,
          },
          isActive: formData.isActive,
          priority: formData.priority,
        });
        toast.success(t('retention.success.updated', 'Politique mise a jour'));
      } else {
        await createPolicy(
          organizationId,
          formData.name,
          formData.retentionDays,
          formData.action,
          user.uid,
          {
            description: formData.description || undefined,
            scope: Object.keys(scope).length > 0 ? scope : undefined,
            notifyDaysBefore: formData.notifyDaysBefore,
            priority: formData.priority,
            exceptions: {
              excludeLegalHold: formData.excludeLegalHold,
            },
          }
        );
        toast.success(t('retention.success.created', 'Politique creee'));
      }

      setPolicyDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      ErrorLogger.error(error, 'RetentionDashboard.savePolicy');
      toast.error(t('retention.error.saveFailed', 'Erreur lors de la sauvegarde'));
    } finally {
      setFormLoading(false);
    }
  };

  // Handle delete policy
  const handleDeletePolicy = async () => {
    if (!policyToDelete) return;

    try {
      await deletePolicy(policyToDelete.id);
      toast.success(t('retention.success.deleted', 'Politique supprimee'));
      setDeleteDialogOpen(false);
      setPolicyToDelete(null);
      loadData();
    } catch (error) {
      ErrorLogger.error(error, 'RetentionDashboard.deletePolicy');
      toast.error(t('retention.error.deleteFailed', 'Erreur lors de la suppression'));
    }
  };

  // Open edit dialog
  const openEditDialog = (policy: RetentionPolicy) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name,
      description: policy.description || '',
      retentionDays: policy.retentionDays,
      action: policy.action,
      notifyDaysBefore: policy.notifyDaysBefore,
      documentTypes: policy.scope?.documentTypes || [],
      classifications: policy.scope?.classifications || [],
      excludeLegalHold: policy.exceptions?.excludeLegalHold ?? true,
      isActive: policy.isActive ?? true,
      priority: policy.priority || 0,
    });
    setPolicyDialogOpen(true);
  };

  // Reset form
  const resetForm = () => {
    setEditingPolicy(null);
    setFormData({
      name: '',
      description: '',
      retentionDays: 365,
      action: 'notify',
      notifyDaysBefore: 30,
      documentTypes: [],
      classifications: [],
      excludeLegalHold: true,
      isActive: true,
      priority: 0,
    });
  };

  // Toggle document type selection
  const toggleDocumentType = (type: string) => {
    setFormData((prev) => ({
      ...prev,
      documentTypes: prev.documentTypes.includes(type)
        ? prev.documentTypes.filter((t) => t !== type)
        : [...prev.documentTypes, type],
    }));
  };

  // Toggle classification selection
  const toggleClassification = (level: ClassificationLevel) => {
    setFormData((prev) => ({
      ...prev,
      classifications: prev.classifications.includes(level)
        ? prev.classifications.filter((c) => c !== level)
        : [...prev.classifications, level],
    }));
  };

  const formatDays = (days: number): string => {
    if (days >= 365) {
      const years = Math.floor(days / 365);
      return `${years} an${years > 1 ? 's' : ''}`;
    }
    if (days >= 30) {
      const months = Math.floor(days / 30);
      return `${months} mois`;
    }
    return `${days} jour${days > 1 ? 's' : ''}`;
  };

  // const formatDate = (timestamp: { toDate: () => Date } | undefined) => {
  //   if (!timestamp) return '-';
  //   return format(timestamp.toDate(), 'dd MMM yyyy', { locale: fr });
  // };

  // Calculate percentages for age distribution chart
  const ageChartData = useMemo(() => {
    const total = ageDistribution.total || 1;
    return [
      { label: '< 30 jours', value: ageDistribution.under30Days, percent: (ageDistribution.under30Days / total) * 100, color: 'bg-green-500' },
      { label: '30-90 jours', value: ageDistribution.under90Days, percent: (ageDistribution.under90Days / total) * 100, color: 'bg-blue-500' },
      { label: '3-12 mois', value: ageDistribution.under1Year, percent: (ageDistribution.under1Year / total) * 100, color: 'bg-warning-500' },
      { label: '1-3 ans', value: ageDistribution.under3Years, percent: (ageDistribution.under3Years / total) * 100, color: 'bg-orange-500' },
      { label: '> 3 ans', value: ageDistribution.over3Years, percent: (ageDistribution.over3Years / total) * 100, color: 'bg-red-500' },
    ];
  }, [ageDistribution]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {t('retention.title', 'Politiques de Retention')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('retention.description', 'Gerez le cycle de vie de vos documents')}
          </p>
        </div>
        <Button onClick={() => { resetForm(); setPolicyDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          {t('retention.create', 'Nouvelle Politique')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Politiques Actives</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activePolicies}</div>
            <p className="text-xs text-muted-foreground">
              sur {stats.totalPolicies} au total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expirent Bientot</CardTitle>
            <Clock className="h-4 w-4 text-warning-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning-600">{stats.documentsExpiringSoon}</div>
            <p className="text-xs text-muted-foreground">
              dans les 30 prochains jours
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expires</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.documentsExpired}</div>
            <p className="text-xs text-muted-foreground">
              action requise
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sous Legal Hold</CardTitle>
            <Shield className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.documentsUnderLegalHold}</div>
            <p className="text-xs text-muted-foreground">
              proteges contre la suppression
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="policies">Politiques</TabsTrigger>
          <TabsTrigger value="expiring">Documents Expirant</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Age Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Distribution par Age
                </CardTitle>
                <CardDescription>
                  {ageDistribution.total} documents au total
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {ageChartData.map((item) => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{item.label}</span>
                        <span className="text-muted-foreground">
                          {item.value} ({item.percent.toFixed(1)}%)
                        </span>
                      </div>
                      <Progress value={item.percent} className={cn('h-2', item.color)} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Expiry */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Prochaines Expirations
                </CardTitle>
                <CardDescription>
                  Documents expirant dans les {expiryFilter} jours
                </CardDescription>
              </CardHeader>
              <CardContent>
                {nearExpiry.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mb-2 text-green-500" />
                    <p>Aucun document n'expire bientot</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {nearExpiry.slice(0, 5).map((item) => (
                        <div
                          key={item.documentId}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm truncate">
                              {getDocumentTitle(item.documentId)}
                            </span>
                            {item.isUnderLegalHold && (
                              <Shield className="h-3 w-3 text-blue-500 shrink-0" />
                            )}
                          </div>
                          <Badge
                            status={item.daysUntilExpiry <= 7 ? 'error' : 'neutral'}
                            variant={item.daysUntilExpiry <= 7 ? 'soft' : 'outline'}
                            className="shrink-0 ml-2"
                          >
                            {item.daysUntilExpiry}j
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Policies Tab */}
        <TabsContent value="policies" className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : policies.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Settings className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  Aucune politique de retention. Creez-en une pour commencer.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Retention</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Portee</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy) => {
                    const ActionIcon = ACTION_CONFIG[policy.action].icon;
                    return (
                      <TableRow key={policy.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{policy.name}</p>
                            {policy.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {policy.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatDays(policy.retentionDays)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ActionIcon className={cn('h-4 w-4', ACTION_CONFIG[policy.action].color)} />
                            <span>{ACTION_CONFIG[policy.action].label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {policy.scope?.documentTypes?.map((type) => (
                              <Badge key={type} variant="outline" className="text-xs">
                                {type}
                              </Badge>
                            ))}
                            {(!policy.scope?.documentTypes || policy.scope.documentTypes.length === 0) && (
                              <span className="text-xs text-muted-foreground">Tous</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={policy.isActive !== false ? 'soft' : 'soft'}
                            status={policy.isActive !== false ? 'success' : 'neutral'}
                          >
                            {policy.isActive !== false ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(policy)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setPolicyToDelete(policy);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Expiring Documents Tab */}
        <TabsContent value="expiring" className="space-y-4">
          <div className="flex items-center gap-4">
            <Select
              value={String(expiryFilter)}
              onValueChange={(v) => setExpiryFilter(Number(v) as 7 | 30 | 90)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 jours</SelectItem>
                <SelectItem value="30">30 jours</SelectItem>
                <SelectItem value="90">90 jours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Expired Documents */}
          {expired.length > 0 && (
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Documents Expires ({expired.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-red-200 dark:border-red-900">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Politique</TableHead>
                        <TableHead>Expire depuis</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expired.map((item) => {
                        const ActionIcon = ACTION_CONFIG[item.action].icon;
                        return (
                          <TableRow key={item.documentId}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                {getDocumentTitle(item.documentId)}
                              </div>
                            </TableCell>
                            <TableCell>{item.policyName}</TableCell>
                            <TableCell>
                              <Badge status="error" variant="soft">
                                {Math.abs(item.daysUntilExpiry)} jours
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <ActionIcon className={cn('h-4 w-4', ACTION_CONFIG[item.action].color)} />
                                {ACTION_CONFIG[item.action].label}
                              </div>
                            </TableCell>
                            <TableCell>
                              {item.isUnderLegalHold ? (
                                <Badge variant="outline" className="text-blue-600">
                                  <Shield className="h-3 w-3 mr-1" />
                                  Legal Hold
                                </Badge>
                              ) : (
                                <Badge status="error" variant="soft">Action requise</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Near Expiry Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Expirent dans {expiryFilter} jours ({nearExpiry.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nearExpiry.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mb-2 text-green-500" />
                  <p>Aucun document n'expire dans cette periode</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Politique</TableHead>
                        <TableHead>Expire dans</TableHead>
                        <TableHead>Action prevue</TableHead>
                        <TableHead>Legal Hold</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nearExpiry.map((item) => {
                        const ActionIcon = ACTION_CONFIG[item.action].icon;
                        return (
                          <TableRow key={item.documentId}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                {getDocumentTitle(item.documentId)}
                              </div>
                            </TableCell>
                            <TableCell>{item.policyName}</TableCell>
                            <TableCell>
                              <Badge
                                variant="soft"
                                status={item.daysUntilExpiry <= 7 ? 'error' : 'neutral'}
                              >
                                {item.daysUntilExpiry} jours
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <ActionIcon className={cn('h-4 w-4', ACTION_CONFIG[item.action].color)} />
                                {ACTION_CONFIG[item.action].label}
                              </div>
                            </TableCell>
                            <TableCell>
                              {item.isUnderLegalHold ? (
                                <Badge variant="outline" className="text-blue-600">
                                  <Shield className="h-3 w-3 mr-1" />
                                  Protege
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Policy Dialog */}
      <Dialog open={policyDialogOpen} onOpenChange={setPolicyDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingPolicy
                ? t('retention.edit', 'Modifier la Politique')
                : t('retention.create', 'Nouvelle Politique')}
            </DialogTitle>
            <DialogDescription>
              Definissez les regles de retention pour vos documents.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Retention Documents RH"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Description de la politique..."
                  rows={2}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="retentionDays">Periode de retention (jours)</Label>
                  <Input
                    id="retentionDays"
                    type="number"
                    min={1}
                    value={formData.retentionDays}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        retentionDays: parseInt(e.target.value) || 1,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    = {formatDays(formData.retentionDays)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="action">Action a l'expiration</Label>
                  <Select
                    value={formData.action}
                    onValueChange={(v) =>
                      setFormData((prev) => ({ ...prev, action: v as RetentionAction }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACTION_CONFIG).map(([key, config]) => {
                        const Icon = config.icon;
                        return (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <Icon className={cn('h-4 w-4', config.color)} />
                              {config.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notifyDaysBefore">Notification (jours avant)</Label>
                <Input
                  id="notifyDaysBefore"
                  type="number"
                  min={0}
                  value={formData.notifyDaysBefore}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      notifyDaysBefore: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Types de documents concernes</Label>
                <div className="flex flex-wrap gap-2">
                  {DOCUMENT_TYPES.map((type) => (
                    <Badge
                      key={type}
                      variant={formData.documentTypes.includes(type) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleDocumentType(type)}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Laissez vide pour appliquer a tous les types
                </p>
              </div>

              <div className="space-y-2">
                <Label>Classifications concernees</Label>
                <div className="flex flex-wrap gap-2">
                  {CLASSIFICATION_LEVELS.map((level) => (
                    <Badge
                      key={level}
                      variant={formData.classifications.includes(level) ? 'default' : 'outline'}
                      className="cursor-pointer capitalize"
                      onClick={() => toggleClassification(level)}
                    >
                      {level}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Laissez vide pour appliquer a toutes les classifications
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Exclure les documents sous Legal Hold</Label>
                  <p className="text-xs text-muted-foreground">
                    Les documents proteges ne seront pas affectes
                  </p>
                </div>
                <Switch
                  checked={formData.excludeLegalHold}
                  onChange={(checked) =>
                    setFormData((prev) => ({ ...prev, excludeLegalHold: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Politique active</Label>
                  <p className="text-xs text-muted-foreground">
                    Desactivez pour suspendre temporairement
                  </p>
                </div>
                <Switch
                  checked={formData.isActive}
                  onChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isActive: checked }))
                  }
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPolicyDialogOpen(false);
                resetForm();
              }}
            >
              Annuler
            </Button>
            <Button onClick={handleSavePolicy} disabled={formLoading}>
              {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingPolicy ? 'Mettre a jour' : 'Creer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Supprimer la politique
            </DialogTitle>
            <DialogDescription>
              Etes-vous sur de vouloir supprimer cette politique de retention ?
              Cette action est irreversible.
            </DialogDescription>
          </DialogHeader>

          {policyToDelete && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{policyToDelete.name}</p>
              <p className="text-sm text-muted-foreground">
                Retention: {formatDays(policyToDelete.retentionDays)} - Action: {ACTION_CONFIG[policyToDelete.action].label}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setPolicyToDelete(null);
              }}
            >
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeletePolicy}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RetentionDashboard;
