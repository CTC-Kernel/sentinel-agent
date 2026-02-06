import React, { useState } from 'react';
import { useZodForm } from '../../hooks/useZodForm'; // Hook for localized validation
import { z } from 'zod';
import { HardwareInfo } from '../../utils/hardwareDetection';
import { Laptop, Save, AlertTriangle, User, Server, Database } from '../ui/Icons';
import { Project, UserProfile } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';
import { IntakeService } from '../../services/intakeService';
import { useFormPersistence } from '../../hooks/utils/useFormPersistence';

interface IntakeFormProps {
 hardwareInfo: HardwareInfo;
 orgId: string;
 onSuccess: () => void;
}

export const IntakeForm: React.FC<IntakeFormProps> = ({ hardwareInfo, orgId, onSuccess }) => {
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [projects, setProjects] = useState<Project[]>([]);
 const [users, setUsers] = useState<UserProfile[]>([]);

 const intakeSchema = z.object({
 name: z.string().trim().min(1, "Equipment name is required"),
 serialNumber: z.string().trim().min(1, "Serial number is required"),
 userId: z.string().optional(),
 projectId: z.string().optional(),
 notes: z.string().trim().optional(),
 hardwareType: z.string().min(1)
 });

 type IntakeFormData = z.infer<typeof intakeSchema>;

 const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useZodForm({
 schema: intakeSchema,
 mode: 'onChange',
 defaultValues: {
 name: '',
 serialNumber: '',
 userId: '',
 projectId: '',
 notes: '',
 hardwareType: hardwareInfo.isMobile ? 'Mobile' : 'Laptop'
 }
 });

 // Persistence Hook
 const { clearDraft } = useFormPersistence<IntakeFormData>('sentinel_intake_draft_new', {
 watch,
 reset
 });

 const hardwareType = watch('hardwareType');

 const assetTypeIcons: Record<string, React.ReactNode> = {
 'Laptop': <Laptop className="h-8 w-8 text-blue-600" />,
 'Server': <Server className="h-8 w-8 text-blue-600" />,
 'Workstation': <Laptop className="h-8 w-8 text-blue-600" />,
 'Mobile': <Laptop className="h-8 w-8 text-blue-600" />,
 'Tablet': <Laptop className="h-8 w-8 text-blue-600" />,
 'Network': <Server className="h-8 w-8 text-blue-600" />,
 'Storage': <Server className="h-8 w-8 text-blue-600" />,
 'Other': <AlertTriangle className="h-8 w-8 text-blue-600" />
 };

 React.useEffect(() => {
 const fetchOptions = async () => {
 if (!orgId) return;
 try {
 const options = await IntakeService.fetchOptions(orgId);
 setProjects(options.projects);
 setUsers(options.users);
 } catch (e) {
 // Handled in service, but we might want to show UI error
 ErrorLogger.error(e, 'IntakeForm.fetchOptions');
 }
 };
 fetchOptions();

 // Smart Categorization
 if (hardwareInfo.os.includes('iOS') || hardwareInfo.os.includes('Android')) {
 setValue('hardwareType', 'Mobile');
 } else if (hardwareInfo.gpu.includes('NVIDIA') || Number(hardwareInfo.cpuCores) > 8) {
 setValue('hardwareType', 'Workstation');
 } else {
 setValue('hardwareType', 'Laptop');
 }
 }, [orgId, hardwareInfo, setValue]);

 const onSubmit = async (data: IntakeFormData) => {
 setLoading(true);
 setError(null);

 if (!orgId) {
 setError("Organization not identified. Invalid link.");
 setLoading(false);
 return;
 }

 try {
 await IntakeService.submitAsset({
 ...data,
 orgId: orgId,
 hardware: hardwareInfo,
 userId: data.userId || '',
 projectId: data.projectId || '',
 notes: data.notes || ''
 });
 clearDraft();
 onSuccess();
 } catch {
 setError("An error occurred while saving. Please try again.");
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="w-full max-w-2xl mx-auto">
 <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

 {/* Hardware Detected Section */}
 <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-border/40">
  <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
  {assetTypeIcons[hardwareType]}
  Matériel Détecté
  </h3>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
  <div className="p-3 bg-muted/50 dark:bg-white/5 rounded-3xl border border-border/40 dark:border-white/5">
  <div className="flex items-center gap-2 text-muted-foreground mb-1">
  <User className="h-4 w-4" />
  <span className="text-xs font-bold uppercase">Processeur / GPU</span>
  </div>
  <div className="font-medium text-foreground truncate" title={hardwareInfo.gpu}>
  {hardwareInfo.gpu}
  </div>
  <div className="text-xs text-muted-foreground mt-1">
  {hardwareInfo.cpuCores} Cœurs logiques
  </div>
  </div>

  <div className="p-3 bg-muted/50 dark:bg-white/5 rounded-3xl border border-border/40 dark:border-white/5">
  <div className="flex items-center gap-2 text-muted-foreground mb-1">
  <Database className="h-4 w-4" />
  <span className="text-xs font-bold uppercase">Mémoire & OS</span>
  </div>
  <div className="font-medium text-foreground">
  {hardwareInfo.os} ({hardwareInfo.ram})
  </div>
  <div className="text-xs text-muted-foreground mt-1">
  Navigateur: {hardwareInfo.browser}
  </div>
  </div>

  <div className="p-3 bg-muted/50 dark:bg-white/5 rounded-3xl border border-border/40 dark:border-white/5 col-span-1 md:col-span-2">
  <div className="flex items-center gap-2 text-muted-foreground mb-1">
  <Laptop className="h-4 w-4" />
  <span className="text-xs font-bold uppercase">Affichage</span>
  </div>
  <div className="font-medium text-foreground">
  {hardwareInfo.screenResolution}
  </div>
  </div>
  </div>
 </div>

 {/* User Input Section */}
 <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-border/40">
  <h3 className="text-lg font-bold text-foreground mb-4">
  Informations Complémentaires
  </h3>

  <div className="space-y-4">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div>
  <FloatingLabelInput
   label="Nom de l'équipement"
   {...register('name')}
   placeholder="ex: MacBook Pro de Thibault"
   error={errors.name?.message}
  />
  </div>
  <div>
  <FloatingLabelInput
   label="Numéro de Série"
   {...register('serialNumber')}
   placeholder="ex: C02..."
   error={errors.serialNumber?.message}
  />
  </div>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div>
  <CustomSelect
   label="Utilisateur Principal"
   value={watch('userId') || ''}
   onChange={(val) => setValue('userId', val as string)}
   options={users.map(u => ({ value: u.uid, label: u.displayName }))}
   placeholder="-- Sélectionner un utilisateur --"
  />
  </div>
  <div>
  <CustomSelect
   label="Projet Associé"
   value={watch('projectId') || ''}
   onChange={(val) => setValue('projectId', val as string)}
   options={projects.map(p => ({ value: p.id, label: p.name }))}
   placeholder="-- Aucun projet --"
  />
  </div>
  </div>

  <div>
  <CustomSelect
  label="Type d'équipement"
  value={watch('hardwareType')}
  onChange={(val) => setValue('hardwareType', val as string)}
  options={[
   { value: 'Laptop', label: 'Ordinateur Portable' },
   { value: 'Desktop', label: 'Ordinateur Fixe' },
   { value: 'Mobile', label: 'Smartphone' },
   { value: 'Tablet', label: 'Tablette' },
   { value: 'Workstation', label: 'Station de Travail' },
   { value: 'Server', label: 'Serveur' },
   { value: 'Other', label: 'Autre' }
  ]}
  />
  </div>

  <div>
  <FloatingLabelTextarea
  label="Notes"
  {...register('notes')}
  placeholder="État physique, accessoires fournis..."
  rows={3}
  />
  </div>
  </div>
 </div>

 {
  error && (
  <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-3xl flex items-center gap-2 text-sm font-medium border border-red-100 dark:border-red-900/30">
  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
  {error}
  </div>
  )
 }

 <Button
  type="submit"
  isLoading={loading}
  disabled={loading}
  className="w-full py-4 bg-foreground text-background rounded-3xl font-bold text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all border border-border/40"
 >
  <Save className="h-5 w-5 mr-2" />
  Enregistrer l'équipement
 </Button>
 </form >
 </div >
 );
};

