/**
 * Story 26.5 - Signature Workflow UI Component
 *
 * Comprehensive signature workflow management:
 * - Initiate signature request form (select signers, order, deadline)
 * - Signature status tracker (pending, signed, rejected, expired)
 * - Sign document modal (for internal signature)
 * - Signature history timeline
 * - Download signed document with certificate
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import {
  PenTool,
  Send,
  Plus,
  Trash2,
  GripVertical,
  Download,
  Shield,
  Loader2,
  RefreshCw,
  XCircle,
  CheckCircle2,
  History,
  Check,
  X,
  AlertTriangle,
} from '../ui/Icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Button } from '@/components/ui/button';
import { Input } from '../ui/input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
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
} from '../ui/select';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/Switch';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Tooltip } from '../ui/Tooltip';
import { ConfirmModal } from '../ui/ConfirmModal';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import {
  SignatureService,
} from '@/services/signatureService';
import type {
  SignatureRequest,
  SignerInfo,
  SignatureStatus,
  SignatureType,
  CreateSignatureRequestInput,
  ApplySignatureInput,
  SignerStatus
} from '@/types/signature';
import { toast } from 'sonner';
import { ErrorLogger } from '@/services/errorLogger';

interface SignatureWorkflowProps {
  documentId: string;
  documentName?: string;
  className?: string;
  onRequestCreated?: (request: SignatureRequest) => void;
  onSignatureComplete?: () => void;
}

/**
 * Sortable signer item for drag-and-drop reordering
 */
function SortableSigner({
  signer,
  index,
  onRemove,
  onUpdate,
}: {
  signer: Omit<SignerInfo, 'id' | 'status'>;
  index: number;
  onRemove: () => void;
  onUpdate: (updates: Partial<Omit<SignerInfo, 'id' | 'status'>>) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `signer-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border rounded-lg',
        isDragging && 'opacity-60 shadow-lg'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400 text-sm font-medium">
        {index + 1}
      </div>

      <div className="flex-1 grid grid-cols-2 gap-2">
        <Input
          placeholder="Nom"
          value={signer.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ name: e.target.value })}
          className="h-9"
        />
        <Input
          type="email"
          placeholder="Email"
          value={signer.email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ email: e.target.value })}
          className="h-9"
        />
      </div>

      <Input
        placeholder="Rôle (optionnel)"
        value={signer.role || ''}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ role: e.target.value })}
        className="h-9 w-32"
      />

      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="h-9 w-9 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * Signer status badge component
 */
function SignerStatusBadge({ status }: { status: SignerStatus }) {
  const config = SignatureService.getSignerStatusConfig(status);
  return (
    <Badge status={config.badgeStatus} variant="soft" size="sm">
      {config.label}
    </Badge>
  );
}

/**
 * Request status badge component
 */
function RequestStatusBadge({ status }: { status: SignatureStatus }) {
  const config = SignatureService.getStatusConfig(status);
  return (
    <Badge status={config.badgeStatus} variant="soft">
      {config.label}
    </Badge>
  );
}

export function SignatureWorkflow({
  documentId,
  documentName,
  className,
  onRequestCreated,
  onSignatureComplete,
}: SignatureWorkflowProps) {
  const { user, organization } = useStore();
  const organizationId = organization?.id;

  // Main state
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'requests' | 'create'>('requests');

  // Create request form state
  const [formTitle, setFormTitle] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formSequential, setFormSequential] = useState(false);
  const [formSigners, setFormSigners] = useState<Omit<SignerInfo, 'id' | 'status'>[]>([
    { name: '', email: '', order: 1 },
  ]);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Sign modal state
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<SignatureRequest | null>(null);
  const [activeSigner, setActiveSigner] = useState<SignerInfo | null>(null);
  const [signatureType, setSignatureType] = useState<SignatureType>('advanced');
  const [typedName, setTypedName] = useState('');
  const [signing, setSigning] = useState(false);
  const signaturePadRef = useRef<SignatureCanvas | null>(null);

  // Rejection modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Cancel request confirmation
  const [cancelRequestTarget, setCancelRequestTarget] = useState<SignatureRequest | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load signature requests
  const loadRequests = useCallback(async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      const data = await SignatureService.getSignatureRequestsForDocument(
        documentId,
        organizationId
      );
      setRequests(data);
    } catch (error) {
      ErrorLogger.error(error, 'SignatureWorkflow.loadRequests');
      toast.error('Impossible de charger les demandes de signature');
    } finally {
      setLoading(false);
    }
  }, [documentId, organizationId]);

  useEffect(() => {
    if (documentId && organizationId) {
      loadRequests();
    }
  }, [documentId, organizationId, loadRequests]);

  // Handle drag end for signer reordering
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = parseInt(String(active.id).replace('signer-', ''));
      const newIndex = parseInt(String(over.id).replace('signer-', ''));

      setFormSigners((signers) => {
        const newSigners = arrayMove(signers, oldIndex, newIndex);
        // Update order numbers
        return newSigners.map((s, i) => ({ ...s, order: i + 1 }));
      });
    }
  }, []);

  // Add a new signer to form
  const addSigner = useCallback(() => {
    setFormSigners((prev) => [
      ...prev,
      { name: '', email: '', order: prev.length + 1 },
    ]);
  }, []);

  // Remove a signer from form
  const removeSigner = useCallback((index: number) => {
    setFormSigners((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((s, i) => ({ ...s, order: i + 1 }));
    });
  }, []);

  // Update a signer in form
  const updateSigner = useCallback(
    (index: number, updates: Partial<Omit<SignerInfo, 'id' | 'status'>>) => {
      setFormSigners((prev) =>
        prev.map((s, i) => (i === index ? { ...s, ...updates } : s))
      );
    },
    []
  );


  // Reset create form
  const resetForm = useCallback(() => {
    setFormTitle('');
    setFormMessage('');
    setFormDeadline('');
    setFormSequential(false);
    setFormSigners([{ name: '', email: '', order: 1 }]);
  }, []);

  // Create signature request
  const handleCreateRequest = useCallback(async () => {
    if (!organizationId || !user) return;

    // Validation
    if (!formTitle.trim()) {
      toast.error('Veuillez saisir un titre');
      return;
    }

    const validSigners = formSigners.filter((s) => s.name.trim() && s.email.trim());
    if (validSigners.length === 0) {
      toast.error('Veuillez ajouter au moins un signataire');
      return;
    }

    // Validate emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmail = validSigners.find((s) => !emailRegex.test(s.email));
    if (invalidEmail) {
      toast.error(`Email invalide: ${invalidEmail.email}`);
      return;
    }

    setFormSubmitting(true);
    try {
      const input: CreateSignatureRequestInput = {
        documentId,
        documentName: documentName || 'Document',
        title: formTitle.trim(),
        message: formMessage.trim() || undefined,
        signers: validSigners,
        deadline: formDeadline ? new Date(formDeadline) : undefined,
        sequentialSigning: formSequential,
        sendImmediately: true,
      };

      const request = await SignatureService.createSignatureRequest(
        organizationId,
        user.uid,
        input
      );

      toast.success('Demande de signature créée');
      setRequests((prev) => [request, ...prev]);
      resetForm();
      setActiveTab('requests');

      onRequestCreated?.(request);
    } catch (error) {
      ErrorLogger.error(error, 'SignatureWorkflow.createRequest');
      toast.error('Échec de la création de la demande');
    } finally {
      setFormSubmitting(false);
    }
  }, [
    organizationId,
    user,
    documentId,
    documentName,
    formTitle,
    formMessage,
    formDeadline,
    formSequential,
    formSigners,
    onRequestCreated,
    resetForm,
  ]);



  // Open sign modal
  const openSignModal = useCallback((request: SignatureRequest, signer: SignerInfo) => {
    setActiveRequest(request);
    setActiveSigner(signer);
    setSignatureType('advanced');
    setTypedName(user?.displayName || '');
    setSignModalOpen(true);
  }, [user]);

  // Apply signature
  const handleSign = useCallback(async () => {
    if (!activeRequest || !activeSigner || !user) return;

    // Validation
    if (signatureType === 'simple' && !typedName.trim()) {
      toast.error('Veuillez saisir votre nom');
      return;
    }

    if (signatureType === 'advanced' && signaturePadRef.current?.isEmpty()) {
      toast.error('Veuillez dessiner votre signature');
      return;
    }

    setSigning(true);
    try {
      const input: ApplySignatureInput = {
        requestId: activeRequest.id,
        signerId: activeSigner.id,
        signatureType,
        typedName: signatureType === 'simple' ? typedName.trim() : undefined,
        signatureImage: signatureType === 'advanced'
          ? signaturePadRef.current?.toDataURL('image/png')
          : undefined,
      };

      await SignatureService.applySignature(
        input,
        user.uid,
        user.email || '',
        user.displayName || user.email || ''
      );

      toast.success('Signature appliquée avec succès');
      setSignModalOpen(false);
      loadRequests();
      onSignatureComplete?.();
    } catch (error: unknown) {
      ErrorLogger.error(error, 'SignatureWorkflow.applySignature');
      const message = error instanceof Error ? error.message : 'Échec de la signature';
      toast.error(message);
    } finally {
      setSigning(false);
    }
  }, [activeRequest, activeSigner, user, signatureType, typedName, loadRequests, onSignatureComplete]);

  // Open reject modal
  const openRejectModal = useCallback((request: SignatureRequest, signer: SignerInfo) => {
    setActiveRequest(request);
    setActiveSigner(signer);
    setRejectionReason('');
    setRejectModalOpen(true);
  }, []);

  // Reject signature
  const handleReject = useCallback(async () => {
    if (!activeRequest || !activeSigner || !user) return;

    if (!rejectionReason.trim()) {
      toast.error('Veuillez indiquer une raison');
      return;
    }

    setRejecting(true);
    try {
      await SignatureService.rejectSignature(
        activeRequest.id,
        activeSigner.id,
        rejectionReason.trim(),
        user.uid,
        user.email || '',
        user.displayName || user.email || ''
      );

      toast.success('Signature rejetée');
      setRejectModalOpen(false);
      loadRequests();
    } catch (error: unknown) {
      ErrorLogger.error(error, 'SignatureWorkflow.rejectSignature');
      const message = error instanceof Error ? error.message : 'Échec du rejet';
      toast.error(message);
    } finally {
      setRejecting(false);
    }
  }, [activeRequest, activeSigner, user, rejectionReason, loadRequests]);

  // Cancel a request
  const handleCancelRequest = useCallback(async (request: SignatureRequest) => {
    if (!user) return;

    try {
      await SignatureService.cancelSignatureRequest(
        request.id,
        'Annulée par l\'utilisateur',
        user.uid
      );
      toast.success('Demande annulée');
      loadRequests();
    } catch (error) {
      ErrorLogger.error(error, 'SignatureWorkflow.cancelRequest');
      toast.error(error instanceof Error ? error.message : 'Échec de l\'annulation');
    } finally {
      setCancelRequestTarget(null);
    }
  }, [user, loadRequests]);

  // Check if current user can sign
  const canSign = useCallback(
    (request: SignatureRequest, signer: SignerInfo): boolean => {
      if (!user?.email) return false;
      if (signer.email.toLowerCase() !== user.email.toLowerCase()) return false;
      if (signer.status !== 'pending' && signer.status !== 'notified') return false;

      // Check sequential signing
      if (request.sequentialSigning) {
        const signerIndex = request.signers.findIndex((s: SignerInfo) => s.id === signer.id);
        for (let i = 0; i < signerIndex; i++) {
          if (request.signers[i].status !== 'signed') {
            return false;
          }
        }
      }

      return true;
    },
    [user]
  );

  // Get progress percentage
  const getProgress = (request: SignatureRequest): number => {
    const signed = request.signers.filter((s: SignerInfo) => s.status === 'signed').length;
    return Math.round((signed / request.signers.length) * 100);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'requests' | 'create')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="requests" className="gap-2">
            <History className="h-4 w-4" />
            Demandes ({requests.length})
          </TabsTrigger>
          <TabsTrigger value="create" className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle demande
          </TabsTrigger>
        </TabsList>

        {/* Existing Requests Tab */}
        <TabsContent value="requests" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <PenTool className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Aucune demande de signature pour ce document
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setActiveTab('create')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Créer une demande
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <Card key={request.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          {request.title}
                          <RequestStatusBadge status={request.status} />
                        </CardTitle>
                        <CardDescription>
                          Créé le{' '}
                          {request.createdAt?.toDate
                            ? format(request.createdAt.toDate(), 'dd MMMM yyyy à HH:mm', { locale: fr })
                            : '-'}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {(request.status === 'pending' || request.status === 'in_progress') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCancelRequestTarget(request)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={loadRequests}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Progression</span>
                        <span className="font-medium">{getProgress(request)}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full transition-all duration-500',
                            request.status === 'completed'
                              ? 'bg-green-500'
                              : request.status === 'rejected'
                                ? 'bg-red-500'
                                : 'bg-brand-500'
                          )}
                          style={{ width: `${getProgress(request)}%` }}
                        />
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* Signers list */}
                    <div className="space-y-2">
                      {request.signers.map((signer, index) => (
                        <div
                          key={signer.id}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-lg border',
                            signer.status === 'signed'
                              ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 dark:border-green-800'
                              : signer.status === 'rejected'
                                ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 dark:border-red-800'
                                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'
                          )}
                        >
                          {/* Order number */}
                          <div
                            className={cn(
                              'flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium',
                              signer.status === 'signed'
                                ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
                                : signer.status === 'rejected'
                                  ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            )}
                          >
                            {signer.status === 'signed' ? (
                              <Check className="h-4 w-4" />
                            ) : signer.status === 'rejected' ? (
                              <X className="h-4 w-4" />
                            ) : (
                              index + 1
                            )}
                          </div>

                          {/* Signer info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{signer.name}</span>
                              {signer.role && (
                                <span className="text-xs text-muted-foreground">({signer.role})</span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{signer.email}</p>
                          </div>

                          {/* Status and actions */}
                          <div className="flex items-center gap-2">
                            <SignerStatusBadge status={signer.status} />

                            {canSign(request, signer) && (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  onClick={() => openSignModal(request, signer)}
                                  className="gap-1"
                                >
                                  <PenTool className="h-3 w-3" />
                                  Signer
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openRejectModal(request, signer)}
                                  className="text-red-500 hover:text-red-600"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Signed at info */}
                    {request.status === 'completed' && request.completedAt && (
                      <div className="mt-4 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Signé le{' '}
                        {format(request.completedAt.toDate(), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                      </div>
                    )}
                  </CardContent>

                  {/* Footer with download option for completed requests */}
                  {request.status === 'completed' && (
                    <CardFooter className="border-t pt-4">
                      <Button variant="outline" size="sm" className="gap-2">
                        <Download className="h-4 w-4" />
                        Télécharger le certificat
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Create Request Tab */}
        <TabsContent value="create" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nouvelle demande de signature</CardTitle>
              <CardDescription>
                Configurez les signataires et les options pour cette demande
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Titre de la demande *</Label>
                <Input
                  id="title"
                  placeholder="Ex: Contrat de prestation - Signature"
                  value={formTitle}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormTitle(e.target.value)}
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label htmlFor="message">Message aux signataires</Label>
                <Textarea
                  id="message"
                  placeholder="Message optionnel pour les signataires..."
                  value={formMessage}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormMessage(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Options */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deadline">Date limite</Label>
                  <Input
                    id="deadline"
                    type="datetime-local"
                    value={formDeadline}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormDeadline(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3 pt-7">
                  <div className="flex items-center gap-3 pt-7">
                    <Switch
                      checked={formSequential}
                      onChange={(v: boolean) => setFormSequential(v)}
                    />
                    <Label htmlFor="sequential" className="cursor-pointer">
                      Signature séquentielle
                    </Label>
                    <Tooltip content="Les signataires devront signer dans l'ordre défini">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground outline-none" />
                    </Tooltip>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Signers */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Signataires *</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addSigner}
                    className="gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </Button>
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={formSigners.map((_, i) => `signer-${i}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {formSigners.map((signer, index) => (
                        <SortableSigner
                          key={`signer-${index}`}
                          signer={signer}
                          index={index}
                          onRemove={() => removeSigner(index)}
                          onUpdate={(updates) => updateSigner(index, updates)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {formSigners.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Ajoutez au moins un signataire
                  </p>
                )}
              </div>
            </CardContent>

            <CardFooter className="border-t pt-4 flex justify-between">
              <Button variant="ghost" onClick={resetForm}>
                Réinitialiser
              </Button>
              <Button
                onClick={handleCreateRequest}
                disabled={formSubmitting}
                className="gap-2"
              >
                {formSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Créer et envoyer
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sign Modal */}
      <Dialog open={signModalOpen} onOpenChange={setSignModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Signature électronique</DialogTitle>
            <DialogDescription>
              Signez le document "{activeRequest?.documentName}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Signature type selector */}
            <div className="space-y-2">
              <Label>Type de signature</Label>
              <Select
                value={signatureType}
                onValueChange={(v) => setSignatureType(v as SignatureType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Signature simple (clic)</SelectItem>
                  <SelectItem value="advanced">Signature manuscrite</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Simple signature: typed name */}
            {signatureType === 'simple' && (
              <div className="space-y-2">
                <Label htmlFor="typedName">Tapez votre nom complet</Label>
                <Input
                  id="typedName"
                  placeholder="Prénom Nom"
                  value={typedName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTypedName(e.target.value)}
                  className="text-lg"
                />
                <p className="text-sm text-muted-foreground">
                  En tapant votre nom, vous acceptez de signer électroniquement ce document.
                </p>
              </div>
            )}

            {/* Advanced signature: drawing pad */}
            {signatureType === 'advanced' && (
              <div className="space-y-2">
                <Label>Dessinez votre signature</Label>
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white">
                  <SignatureCanvas
                    ref={signaturePadRef}
                    canvasProps={{
                      width: 450,
                      height: 150,
                      className: 'signature-canvas w-full cursor-crosshair',
                    }}
                    backgroundColor="white"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => signaturePadRef.current?.clear()}
                  >
                    Effacer
                  </Button>
                </div>
              </div>
            )}

            {/* Legal notice */}
            <div className="bg-warning-50 dark:bg-warning-950/30 border border-warning-200 dark:border-warning-800 rounded-lg p-3">
              <p className="text-sm text-warning-800 dark:text-warning-200">
                <Shield className="h-4 w-4 inline mr-1" />
                En signant, vous attestez avoir lu et approuvé le contenu de ce document.
                Votre signature sera horodatée et liée cryptographiquement au document.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSignModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSign} disabled={signing} className="gap-2">
              {signing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signature...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Signer le document
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeter la signature</DialogTitle>
            <DialogDescription>
              Indiquez la raison de votre refus de signer ce document.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Raison du rejet *</Label>
              <Textarea
                id="rejectionReason"
                placeholder="Expliquez pourquoi vous refusez de signer..."
                value={rejectionReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejecting}
              className="gap-2"
            >
              {rejecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rejet...
                </>
              ) : (
                <>
                  <X className="h-4 w-4" />
                  Confirmer le rejet
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Request Confirmation */}
      <ConfirmModal
        isOpen={cancelRequestTarget !== null}
        onClose={() => setCancelRequestTarget(null)}
        onConfirm={() => cancelRequestTarget && handleCancelRequest(cancelRequestTarget)}
        title="Annuler la demande de signature"
        message="Êtes-vous sûr de vouloir annuler cette demande de signature ?"
        type="warning"
        confirmText="Annuler la demande"
        cancelText="Retour"
      />
    </div>
  );
}

export default SignatureWorkflow;
