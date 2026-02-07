/**
 * Exemple d'intégration complète des services de sécurité BMAD
 * Ce composant montre comment utiliser:
 * - useSecureForm pour les formulaires sécurisés
 * - InputSanitizer pour la validation
 * - RateLimiter pour la limitation de débit
 * - SessionMonitor pour le monitoring de session
 *
 * Ce fichier est un EXEMPLE et peut être supprimé en production
 */

import React, { useEffect } from 'react';
import { useSecureForm, useSecureFileUpload } from '../../hooks/useSecureForm';
import { SessionMonitor } from '../../services/sessionMonitoringService';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';

interface ExampleFormData {
 [key: string]: unknown;
 name: string;
 email: string;
 description: string;
 url?: string;
 phone?: string;
}

export const SecureFormExample: React.FC = () => {
 const user = useStore(state => state.user);

 // Initialiser le monitoring de session
 useEffect(() => {
 if (user) {
 SessionMonitor.recordActivity();
 }
 }, [user]);

 // Formulaire sécurisé
 const form = useSecureForm<ExampleFormData>({
 initialValues: {
 name: '',
 email: '',
 description: '',
 url: '',
 phone: ''
 },
 validate: (values) => {
 const errors: Record<string, string> = {};

 if (!values.name || values.name.length < 3) {
 errors.name = 'Name must be at least 3 characters';
 }

 if (!values.email) {
 errors.email = 'Email is required';
 }

 if (!values.description || values.description.length < 10) {
 errors.description = 'Description must be at least 10 characters';
 }

 return errors;
 },
 onSubmit: async (data) => {
 // Simuler un appel API
 ErrorLogger.debug(`Données sanitizées: ${JSON.stringify(data)}`, 'SecureFormExample.onSubmit');

 // Dans un vrai cas, vous feriez:
 // await createAsset(data);
 // ou
 // await updateRisk(data);

 await new Promise(resolve => setTimeout(resolve, 1000));
 alert('Formulaire soumis avec succès!');
 },
 rateLimitOperation: 'api',
 sanitizationOptions: {
 maxLength: 500,
 allowHTML: false
 }
 });

 // Upload de fichiers sécurisé
 const fileUpload = useSecureFileUpload({
 maxSize: 5 * 1024 * 1024, // 5MB
 allowedTypes: ['image/png', 'image/jpeg', 'application/pdf'],
 onUpload: async (file) => {
 ErrorLogger.debug(`Fichier uploadé: ${file.name}`, 'SecureFormExample.onUpload');
 // Ici vous uploaderiez vers Firebase Storage
 // await uploadToStorage(file);
 },
 rateLimitOperation: 'file_upload'
 });

 return (
 <div className="max-w-2xl mx-auto p-6 bg-card rounded-lg shadow-md">
 <h2 className="text-2xl font-bold mb-6 text-foreground">
 Exemple de Formulaire Sécurisé BMAD
 </h2>

 <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
 <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
 🔒 Fonctionnalités de Sécurité Actives:
 </h3>
 <ul className="list-disc list-inside text-sm text-blue-800 dark:text-blue-200 space-y-1">
 <li>✅ Rate Limiting (100 requêtes max)</li>
 <li>✅ Input Sanitization (XSS, SQL Injection)</li>
 <li>✅ Session Monitoring</li>
 <li>✅ Validation des URLs (Protection SSRF)</li>
 <li>✅ Sanitization des fichiers</li>
 </ul>
 </div>

 /* schema validation via zod */
<form onSubmit={form.handleSubmit} className="space-y-4">
 {/* Nom */}
 <div>
 <label htmlFor="example-name" className="block text-sm font-medium text-foreground mb-1">
 Nom *
 </label>
 <input
 id="example-name"
 type="text"
 value={form.values.name}
 onChange={(e) => form.handleChange('name')(e.target.value)}
 onBlur={form.handleBlur('name')}
 className={`w-full px-3 py-2 border rounded-md dark:text-white ${form.errors.name && form.touched.name
 ? 'border-red-500'
 : 'border-border/40'
 }`}
 placeholder="Entrez un nom"
 />

 {form.errors.name && form.touched.name && (
 <p className="mt-1 text-sm text-red-600 dark:text-red-400">
 {form.errors.name}
 </p>
 )}
 <p className="mt-1 text-xs text-muted-foreground">
 Essayez d'entrer: <code>&lt;script&gt;alert('xss')&lt;/script&gt;</code>
 <br />
 → Sera automatiquement sanitizé
 </p>
 </div>

 {/* Email */}
 <div>
 <label htmlFor="example-email" className="block text-sm font-medium text-foreground mb-1">
 Email *
 </label>
 <input
 id="example-email"
 type="email"
 value={form.values.email}
 onChange={(e) => form.handleChange('email')(e.target.value)}
 onBlur={form.handleBlur('email')}
 className={`w-full px-3 py-2 border rounded-md dark:text-white ${form.errors.email && form.touched.email
 ? 'border-red-500'
 : 'border-border/40'
 }`}
 placeholder="email@example.com"
 />

 {form.errors.email && form.touched.email && (
 <p className="mt-1 text-sm text-red-600 dark:text-red-400">
 {form.errors.email}
 </p>
 )}
 </div>

 {/* Description */}
 <div>
 <label htmlFor="example-description" className="block text-sm font-medium text-foreground mb-1">
 Description *
 </label>
 <textarea
 id="example-description"
 value={form.values.description}
 onChange={(e) => form.handleChange('description')(e.target.value)}
 onBlur={form.handleBlur('description')}
 rows={4}
 className={`w-full px-3 py-2 border rounded-md dark:text-white ${form.errors.description && form.touched.description
 ? 'border-red-500'
 : 'border-border/40'
 }`}
 placeholder="Entrez une description..."
 />

 {form.errors.description && form.touched.description && (
 <p className="mt-1 text-sm text-red-600 dark:text-red-400">
 {form.errors.description}
 </p>
 )}
 </div>

 {/* URL (optionnel) */}
 <div>
 <label htmlFor="example-url" className="block text-sm font-medium text-foreground mb-1">
 URL (optionnel)
 </label>
 <input
 id="example-url"
 type="url"
 value={form.values.url || ''}
 onChange={(e) => form.handleChange('url')(e.target.value)}
 className="w-full px-3 py-2 border border-border/40 rounded-md dark:text-white"
 placeholder="https://example.com"
 />

 <p className="mt-1 text-xs text-muted-foreground">
 Essayez d'entrer: <code>http://localhost/admin</code>
 <br />
 → Sera bloqué (Protection SSRF)
 </p>
 </div>

 {/* Téléphone (optionnel) */}
 <div>
 <label htmlFor="example-phone" className="block text-sm font-medium text-foreground mb-1">
 Téléphone (optionnel)
 </label>
 <input
 id="example-phone"
 type="tel"
 value={form.values.phone || ''}
 onChange={(e) => form.handleChange('phone')(e.target.value)}
 className="w-full px-3 py-2 border border-border/40 rounded-md dark:text-white"
 placeholder="+33 6 12 34 56 78"
 />

 </div>

 {/* Upload de fichier */}
 <div>
 <label htmlFor="example-file" className="block text-sm font-medium text-foreground mb-1">
 Fichier (optionnel)
 </label>
 <input
 id="example-file"
 type="file"
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (file) {
 fileUpload.handleUpload(file);
 }
 }}
 className="w-full px-3 py-2 border border-border/40 rounded-md dark:text-white"
 accept=".png,.jpg,.jpeg,.pdf"
 />

 {fileUpload.error && (
 <p className="mt-1 text-sm text-red-600 dark:text-red-400">
 {fileUpload.error}
 </p>
 )}
 {fileUpload.isUploading && (
 <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">
 Upload en cours...
 </p>
 )}
 <p className="mt-1 text-xs text-muted-foreground">
 Max 5MB. Types acceptés: PNG, JPG, PDF
 </p>
 </div>

 {/* Boutons */}
 <div className="flex gap-4 pt-4">
 <button
 type="submit"
 disabled={form.isSubmitting || !form.isValid}
 className={`flex-1 px-4 py-2 rounded-md font-medium ${form.isSubmitting || !form.isValid
 ? 'bg-muted text-muted-foreground cursor-not-allowed'
 : 'bg-blue-600 text-white hover:bg-blue-700'
 }`}
 >
 {form.isSubmitting ? 'Envoi en cours...' : 'Soumettre'}
 </button>

 <button
 type="button"
 onClick={form.resetForm}
 className="px-4 py-2 border border-border/40 rounded-md font-medium text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
 >
 Réinitialiser
 </button>
 </div>
 </form>

 {/* Informations de debug */}
 <div className="mt-8 p-4 bg-muted rounded-lg">
 <h3 className="font-semibold text-foreground mb-2">
 Debug Info:
 </h3>
 <pre className="text-xs text-foreground overflow-auto">
 {JSON.stringify(
 {
 values: form.values,
 errors: form.errors,
 touched: form.touched,
 isValid: form.isValid,
 isSubmitting: form.isSubmitting
 },
 null,
 2
 )}
 </pre>
 </div>

 {/* Instructions */}
 <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
 <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
 📖 Pour utiliser dans vos composants:
 </h3>
 <pre className="text-xs text-yellow-800 dark:text-yellow-200 overflow-auto">
 {`import { useSecureForm } from '@/hooks/useSecureForm';

const MyForm = () => {
 const form = useSecureForm({
 initialValues: { name: '', email: '' },
 onSubmit: async (data) => {
 await createAsset(data);
 },
 validate: (values) => {
 const errors = {};
 if (!values.name) errors.name = 'Requis';
 return errors;
 }
 });

 return (
 <form onSubmit={form.handleSubmit}>
 <input
 aria-label="Name"
 value={form.values.name}
 onChange={(e) => form.handleChange('name')(e.target.value)}
 />
 {form.errors.name && <p>{form.errors.name}</p>}
 <button type="submit">Submit</button>
 </form>
 );
};`}
 </pre>
 </div>
 </div>
 );
};
