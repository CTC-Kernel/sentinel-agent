import React, { useRef, useState } from 'react';
import { useStore } from '../../store';
import { Camera, ShieldAlert } from '../ui/Icons';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema, ProfileFormData } from '../../schemas/settingsSchema';
import { CustomSelect } from '../ui/CustomSelect';
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
        <div className="glass-panel rounded-[2.5rem] p-4 sm:p-8 relative overflow-hidden shadow-sm animate-fade-in-up">
            <div className="flex flex-col items-center mb-8">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-border shadow-2xl bg-accent flex items-center justify-center transition-transform group-hover:scale-105">
                        {uploadingPhoto ? (
                            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : user?.photoURL ? (
                            <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-4xl font-bold text-muted-foreground">{user?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                        )}
                    </div>
                    <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="text-white h-8 w-8" />
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                </div>
                <h2 className="text-2xl font-bold text-foreground mt-4">{user?.displayName}</h2>
                <span className="px-3 py-1 rounded-full bg-accent text-muted-foreground text-xs font-bold uppercase tracking-wide mt-2 border border-border">
                    {user?.role}
                </span>
                <div className="flex items-center gap-2 mt-2">
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <button
                        onClick={handleCheckBreach}
                        disabled={breachCheckLoading}
                        className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                        title="Vérifier si cet email a été compromis (Have I Been Pwned)"
                    >
                        {breachCheckLoading ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <ShieldAlert className="w-3 h-3" />}
                    </button>
                </div>
            </div>

            <form onSubmit={profileForm.handleSubmit(handleUpdateProfile)} className="space-y-5 max-w-sm mx-auto">
                <div>
                    <label htmlFor="settings-displayName" className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 ml-1">{t('settings.displayName')}</label>
                    <input id="settings-displayName" autoComplete="name" type="text" className="w-full px-4 py-3.5 bg-background/60 border border-border rounded-2xl focus:ring-2 focus:ring-brand-500 text-foreground transition-all outline-none font-medium"
                        {...profileForm.register('displayName')} />
                    {profileForm.formState.errors.displayName && <p className="text-red-500 text-xs mt-1">{profileForm.formState.errors.displayName.message}</p>}
                </div>
                <div>
                    <label htmlFor="settings-department" className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 ml-1">{t('settings.department')}</label>
                    <input id="settings-department" autoComplete="organization" type="text" className="w-full px-4 py-3.5 bg-background/60 border border-border rounded-2xl focus:ring-2 focus:ring-brand-500 text-foreground transition-all outline-none font-medium"
                        {...profileForm.register('department')} />
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 ml-1">{t('settings.role')}</label>
                    <div className="relative">
                        <Controller
                            control={profileForm.control}
                            name="role"
                            render={({ field }) => (
                                <CustomSelect
                                    label=""
                                    value={field.value}
                                    onChange={field.onChange}
                                    options={[
                                        { value: 'admin', label: 'Administrateur' },
                                        { value: 'rssi', label: 'RSSI / CISO' },
                                        { value: 'direction', label: 'Direction / DPO' },
                                        { value: 'project_manager', label: 'Chef de Projet' },
                                        { value: 'auditor', label: 'Auditeur' },
                                        { value: 'user', label: 'Utilisateur' }
                                    ]}
                                    className={!hasPermission(user, 'User', 'manage') ? 'opacity-50 pointer-events-none' : ''}
                                />
                            )}
                        />
                    </div>
                    {!hasPermission(user, 'User', 'manage') && (
                        <p className="text-[10px] text-muted-foreground mt-1.5 ml-1">{t('settings.contactAdmin')}</p>
                    )}
                </div>

                <Button type="submit" isLoading={savingProfile} className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-brand-500/20 mt-4">
                    {t('settings.saveProfile')}
                </Button>
            </form>
        </div>
    );
};
