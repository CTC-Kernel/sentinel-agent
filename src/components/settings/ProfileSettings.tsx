import React, { useRef, useState } from 'react';
import { useStore } from '../../store';
import { Camera, ShieldAlert, Trash2, AlertTriangle } from '../ui/Icons';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema, ProfileFormData } from '../../schemas/settingsSchema';
import { CustomSelect } from '../ui/CustomSelect';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { Switch } from '../ui/Switch';
import { Button } from '../ui/button';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateDoc, doc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, storage, auth } from '../../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { AccountService } from '../../services/accountService';
import { ConfirmModal } from '../ui/ConfirmModal';
import { ErrorLogger } from '../../services/errorLogger';
import { sanitizeData } from '../../utils/dataSanitizer';
import { hasPermission } from '../../utils/permissions';
import { UserProfile } from '../../types';

export const ProfileSettings: React.FC = () => {
    const { user, setUser, addToast, t, language, setLanguage } = useStore();
    const [savingProfile, setSavingProfile] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [breachCheckLoading, setBreachCheckLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const profileForm = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            displayName: user?.displayName || '',
            department: user?.department || '',
            role: (user?.role as UserProfile['role']) || 'user',
            shodanApiKey: '',
            hibpApiKey: '',
            safeBrowsingApiKey: '',
            notificationPreferences: user?.notificationPreferences || {
                risks: { email: true, push: true, inApp: true },
                audits: { email: true, push: true, inApp: true },
                tasks: { email: true, push: true, inApp: true },
                system: { email: true, push: true, inApp: true }
            }
        }
    });

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!user || !e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setUploadingPhoto(true);

        try {
            const storageRef = ref(storage, `avatars/${user.uid}/${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', user.email));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const docId = querySnapshot.docs[0].id;
                await updateDoc(doc(db, 'users', docId), { photoURL: downloadURL });
                setUser({ ...user, photoURL: downloadURL });
                addToast(t('settings.photoUpdated'), "success");
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'ProfileSettings.handlePhotoUpload', 'FILE_UPLOAD_FAILED');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleCheckBreach = async () => {
        if (!user?.email) return;
        if (!user.hasHibpKey) {
            addToast(t('settings.hibpKeyRequired'), "info");
            return;
        }

        setBreachCheckLoading(true);
        try {
            const functions = getFunctions();
            const checkBreachWithHIBP = httpsCallable(functions, 'checkBreachWithHIBP');
            const { data } = await checkBreachWithHIBP({ email: user.email });
            const breaches = (data as { breaches?: unknown[] } | undefined)?.breaches || [];
            if (breaches.length === 0) {
                addToast(t('settings.noBreachesFound'), "success");
            } else {
                addToast(t('settings.breachesFound').replace('{count}', breaches.length.toString()), "error");
            }
        } catch (err) {
            addToast(t('settings.hibpError'), "error");
            ErrorLogger.handleErrorWithToast(err, 'ProfileSettings.handleCheckBreach', 'HIBP_FAILED');
        } finally {
            setBreachCheckLoading(false);
        }
    };

    const handleUpdateProfile: SubmitHandler<ProfileFormData> = async (data) => {
        if (!user) return;
        setSavingProfile(true);
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', user.email));
            const querySnapshot = await getDocs(q);

            const updatedRole = hasPermission(user, 'User', 'manage') ? data.role : user.role;

            if (!querySnapshot.empty) {
                const docId = querySnapshot.docs[0].id;
                await updateDoc(doc(db, 'users', docId), sanitizeData({
                    displayName: data.displayName,
                    department: data.department || '',
                    role: updatedRole,
                    notificationPreferences: data.notificationPreferences
                }));
            }

            const functions = getFunctions();
            const saveUserApiKeys = httpsCallable(functions, 'saveUserApiKeys');
            const payload: Record<string, string> = {};
            if (data.shodanApiKey !== undefined) payload.shodanApiKey = data.shodanApiKey || '';
            if (data.hibpApiKey !== undefined) payload.hibpApiKey = data.hibpApiKey || '';
            if (data.safeBrowsingApiKey !== undefined) payload.safeBrowsingApiKey = data.safeBrowsingApiKey || '';

            await saveUserApiKeys(payload);

            const userData: UserProfile = {
                ...user,
                displayName: data.displayName,
                department: data.department || '',
                role: updatedRole,
                hasShodanKey: data.shodanApiKey ? true : user.hasShodanKey,
                hasHibpKey: data.hibpApiKey ? true : user.hasHibpKey,
                hasSafeBrowsingKey: data.safeBrowsingApiKey ? true : user.hasSafeBrowsingKey,
                notificationPreferences: data.notificationPreferences
            };

            setUser(userData);
            addToast(t('settings.profileUpdated'), "success");
        } catch (err) {
            ErrorLogger.handleErrorWithToast(err, 'ProfileSettings.handleUpdateProfile', 'UPDATE_FAILED');
        } finally {
            setSavingProfile(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!user || !auth.currentUser) return;
        setIsDeleting(true);
        try {
            await AccountService.deleteAccount(user, auth.currentUser);
            addToast(t('settings.accountDeleted'), "success");
            // Redirect is handled by AuthState listener or force reload
            window.location.href = '/login';
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'ProfileSettings.handleDeleteAccount', 'DELETE_ACCOUNT_FAILED');
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="glass-panel p-8 rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
                    {/* Avatar Section */}
                    <div className="flex-shrink-0 w-full md:w-auto flex flex-col items-center space-y-4">
                        <div className="relative group mx-auto">
                            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl ring-4 ring-slate-100 dark:ring-white/5">
                                {user?.photoURL ? (
                                    <img src={user.photoURL} alt={user?.displayName || 'User'} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-brand-100 to-brand-50 dark:from-brand-900/50 dark:to-brand-800/30 flex items-center justify-center text-4xl font-bold text-brand-600 dark:text-brand-400">
                                        {(user?.displayName || 'U').charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div
                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            fileInputRef.current?.click();
                                        }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    aria-label="Modifier la photo de profil"
                                >
                                    <Camera className="w-8 h-8 text-white" />
                                </div>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handlePhotoUpload}
                                aria-label="Sélectionner une photo de profil"
                            />
                            {uploadingPhoto && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                </div>
                            )}
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('settings.profilePhoto')}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">{t('settings.photoRequirements')}</p>
                        </div>
                    </div>

                    {/* Form Section */}
                    <form onSubmit={profileForm.handleSubmit(handleUpdateProfile)} className="flex-1 w-full space-y-8">
                        {/* Personal Info */}
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('settings.personalInfo')}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.personalInfoDesc')}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FloatingLabelInput
                                    label={t('settings.displayName')}
                                    {...profileForm.register('displayName')}
                                    error={profileForm.formState.errors.displayName?.message}
                                />
                                <FloatingLabelInput
                                    label={t('settings.email')}
                                    value={user?.email || ''}
                                    disabled
                                    readOnly
                                    className="opacity-70 bg-white/50 dark:bg-white/5 backdrop-blur-sm"
                                />
                                <div className="md:col-span-2">
                                    <Controller
                                        name="role"
                                        control={profileForm.control}
                                        render={({ field }) => (
                                            <CustomSelect
                                                label={t('settings.role')}
                                                options={[
                                                    { value: 'admin', label: t('settings.roles.admin') },
                                                    { value: 'rssi', label: t('settings.roles.rssi') },
                                                    { value: 'auditor', label: t('settings.roles.auditor') },
                                                    { value: 'project_manager', label: t('settings.roles.project_manager') },
                                                    { value: 'direction', label: t('settings.roles.direction') },
                                                    { value: 'user', label: t('settings.roles.user') },
                                                ]}
                                                value={field.value}
                                                onChange={field.onChange}
                                                disabled={!hasPermission(user, 'User', 'manage')}
                                            />
                                        )}
                                    />
                                </div>
                                <FloatingLabelInput
                                    label={t('settings.department')}
                                    {...profileForm.register('department')}
                                    error={profileForm.formState.errors.department?.message}
                                    className="md:col-span-2"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                <CustomSelect
                                    label={t('common.language')}
                                    options={[
                                        { value: 'fr', label: 'Français' },
                                        { value: 'en', label: 'English' },
                                    ]}
                                    value={language}
                                    onChange={(value) => setLanguage(value as 'fr' | 'en')}
                                />
                            </div>
                        </div>

                        <div className="border-t border-slate-200 dark:border-white/10 my-6"></div>

                        {/* Notification Preferences */}
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('settings.notifications')}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.notificationsDesc')}</p>
                            </div>

                            <div className="space-y-4">
                                {([
                                    { key: 'risks', label: t('common.risks') },
                                    { key: 'audits', label: t('common.audits') },
                                    { key: 'tasks', label: t('common.tasks') },
                                    { key: 'system', label: t('common.system') }
                                ] as const).map((category) => (
                                    <div key={category.key} className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                                        <h4 className="font-medium text-slate-900 dark:text-white mb-3 capitalize">{category.label}</h4>
                                        <div className="flex gap-6 flex-wrap">
                                            <Controller
                                                name={`notificationPreferences.${category.key}.email`}
                                                control={profileForm.control}
                                                render={({ field }) => (
                                                    <div className="flex items-center gap-2">
                                                        <Switch checked={field.value ?? false} onChange={field.onChange} />
                                                        <span className="text-sm text-slate-600 dark:text-slate-300">{t('settings.notificationsChannels.email')}</span>
                                                    </div>
                                                )}
                                            />
                                            <Controller
                                                name={`notificationPreferences.${category.key}.push`}
                                                control={profileForm.control}
                                                render={({ field }) => (
                                                    <div className="flex items-center gap-2">
                                                        <Switch checked={field.value ?? false} onChange={field.onChange} />
                                                        <span className="text-sm text-slate-600 dark:text-slate-300">{t('settings.notificationsChannels.push')}</span>
                                                    </div>
                                                )}
                                            />
                                            <Controller
                                                name={`notificationPreferences.${category.key}.inApp`}
                                                control={profileForm.control}
                                                render={({ field }) => (
                                                    <div className="flex items-center gap-2">
                                                        <Switch checked={field.value ?? false} onChange={field.onChange} />
                                                        <span className="text-sm text-slate-600 dark:text-slate-300">{t('settings.notificationsChannels.inApp')}</span>
                                                    </div>
                                                )}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-slate-200 dark:border-white/10 my-6"></div>

                        {/* API Keys */}
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                                    {t('settings.apiKeys')}
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                                        {t('settings.private')}
                                    </span>
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.apiKeysDesc')}</p>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <FloatingLabelInput
                                    label={t('settings.apiKeysLabels.shodan')}
                                    type="password"
                                    {...profileForm.register('shodanApiKey')}
                                    placeholder="..."
                                />
                                <div className="flex gap-2 items-end">
                                    <FloatingLabelInput
                                        label={t('settings.apiKeysLabels.hibp')}
                                        type="password"
                                        {...profileForm.register('hibpApiKey')}
                                        placeholder="..."
                                        className="col-span-2"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleCheckBreach}
                                        disabled={breachCheckLoading || !user?.hasHibpKey}
                                        className="h-[52px] px-6"
                                    >
                                        {breachCheckLoading ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                        ) : (
                                            <ShieldAlert className="h-4 w-4 text-amber-500" />
                                        )}
                                    </Button>
                                </div>
                                <FloatingLabelInput
                                    label={t('settings.apiKeysLabels.safeBrowsing')}
                                    type="password"
                                    {...profileForm.register('safeBrowsingApiKey')}
                                    placeholder="..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={savingProfile} className="min-w-[140px] h-12 text-base shadow-lg shadow-brand-500/20">
                                {savingProfile ? (
                                    <div className="flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        {t('common.saving')}
                                    </div>
                                ) : (
                                    t('common.save')
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="glass-panel p-8 rounded-[2.5rem] border border-red-200/50 dark:border-red-900/30 shadow-xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-red-50/50 to-transparent dark:from-red-900/10 pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center justify-between">
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                            <AlertTriangle className="w-6 h-6" />
                            {t('settings.dangerZone')}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg">
                            {t('settings.deleteAccountDescription')}
                        </p>
                    </div>
                    <Button
                        variant="destructive"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-900/30 shadow-none hover:shadow-lg hover:shadow-red-500/10 transition-all duration-300"
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t('settings.deleteAccount')}
                    </Button>
                </div>
            </div>

            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDeleteAccount}
                title={t('settings.deleteAccountTitle')}
                message={t('settings.deleteAccountMessage')}
                type="danger"
                confirmText={t('common.delete')}
                loading={isDeleting}
            />
        </div>
    );
};

// Headless UI handles FocusTrap and keyboard navigation
