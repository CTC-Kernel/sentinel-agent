import React, { useRef, useState } from 'react';
import { useStore } from '../../store';
import { Camera, ShieldAlert } from '../ui/Icons';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema, ProfileFormData } from '../../schemas/settingsSchema';
import { CustomSelect } from '../ui/CustomSelect';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { Button } from '../ui/button';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateDoc, doc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, storage } from '../../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ErrorLogger } from '../../services/errorLogger';
import { sanitizeData } from '../../utils/dataSanitizer';
import { hasPermission } from '../../utils/permissions';
import { UserProfile } from '../../types';

export const ProfileSettings: React.FC = () => {
    const { user, setUser, addToast, t } = useStore();
    const [savingProfile, setSavingProfile] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [breachCheckLoading, setBreachCheckLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const profileForm = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            displayName: user?.displayName || '',
            department: user?.department || '',
            role: (user?.role as UserProfile['role']) || 'user',
            geminiApiKey: '',
            shodanApiKey: '',
            hibpApiKey: '',
            safeBrowsingApiKey: ''
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
                    role: updatedRole
                }));
            }

            const functions = getFunctions();
            const saveUserApiKeys = httpsCallable(functions, 'saveUserApiKeys');
            const payload: Record<string, string> = {};
            if (data.geminiApiKey !== undefined) payload.geminiApiKey = data.geminiApiKey || '';
            if (data.shodanApiKey !== undefined) payload.shodanApiKey = data.shodanApiKey || '';
            if (data.hibpApiKey !== undefined) payload.hibpApiKey = data.hibpApiKey || '';
            if (data.safeBrowsingApiKey !== undefined) payload.safeBrowsingApiKey = data.safeBrowsingApiKey || '';

            await saveUserApiKeys(payload);

            const userData: UserProfile = {
                ...user,
                displayName: data.displayName,
                department: data.department || '',
                role: updatedRole,
                hasGeminiKey: data.geminiApiKey ? true : user.hasGeminiKey,
                hasShodanKey: data.shodanApiKey ? true : user.hasShodanKey,
                hasHibpKey: data.hibpApiKey ? true : user.hasHibpKey,
                hasSafeBrowsingKey: data.safeBrowsingApiKey ? true : user.hasSafeBrowsingKey
            };

            setUser(userData);
            addToast(t('settings.profileUpdated'), "success");
        } catch (err) {
            ErrorLogger.handleErrorWithToast(err, 'ProfileSettings.handleUpdateProfile', 'UPDATE_FAILED');
        } finally {
            setSavingProfile(false);
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
                                    <div className="w-full h-full bg-linear-to-br from-brand-100 to-brand-50 dark:from-brand-900/50 dark:to-brand-800/30 flex items-center justify-center text-4xl font-bold text-brand-600 dark:text-brand-400">
                                        {(user?.displayName || 'U').charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                    <Camera className="w-8 h-8 text-white" />
                                </div>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handlePhotoUpload}
                            />
                            {uploadingPhoto && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                </div>
                            )}
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('settings.profilePhoto')}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">JPG, PNG, GIF max 5MB</p>
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
                                    className="opacity-70 bg-slate-50/50 dark:bg-white/5"
                                />
                                <div className="md:col-span-2">
                                    <Controller
                                        name="role"
                                        control={profileForm.control}
                                        render={({ field }) => (
                                            <CustomSelect
                                                label={t('settings.role')}
                                                options={[
                                                    { value: 'admin', label: 'Administrateur' },
                                                    { value: 'rssi', label: 'RSSI' },
                                                    { value: 'auditor', label: 'Auditeur' },
                                                    { value: 'project_manager', label: 'Chef de Projet' },
                                                    { value: 'direction', label: 'Direction' },
                                                    { value: 'user', label: 'Utilisateur' },
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
                        </div>

                        <div className="border-t border-slate-200 dark:border-white/10 my-6"></div>

                        {/* API Keys */}
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                                    Api Keys
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                                        Private
                                    </span>
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.apiKeysDesc')}</p>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <FloatingLabelInput
                                    label="Gemini API Key (Google AI)"
                                    type="password"
                                    {...profileForm.register('geminiApiKey')}
                                    placeholder="sk-..."
                                />
                                <FloatingLabelInput
                                    label="Shodan API Key (Threat Intel)"
                                    type="password"
                                    {...profileForm.register('shodanApiKey')}
                                    placeholder="..."
                                />
                                <div className="flex gap-2 items-end">
                                    <FloatingLabelInput
                                        label="HIBP API Key (Have I Been Pwned)"
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
                                    label="Google Safe Browsing API Key"
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
        </div>
    );
};
