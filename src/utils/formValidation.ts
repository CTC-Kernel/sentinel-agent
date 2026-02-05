import { Asset, Risk, Project, Audit, Document, Incident, Supplier } from '../types';
import i18n from '../i18n';

export interface ValidationError {
 field: string;
 message: string;
}

type AssetValidationInput = {
 name?: string;
 category?: string;
 criticality?: string;
 value?: number;
 owner?: string;
 location?: string;
 type?: Asset['type'];
 confidentiality?: Asset['confidentiality'];
 integrity?: Asset['integrity'];
 availability?: Asset['availability'];
};

/**
 * Validate Asset data
 */
export const validateAsset = (asset: AssetValidationInput): ValidationError[] => {
 const errors: ValidationError[] = [];

 if (!asset.name?.trim()) {
 errors.push({ field: 'name', message: i18n.t('validation.nameRequired', { defaultValue: 'Le nom est requis' }) });
 } else if ((asset.name?.length || 0) < 3) {
 errors.push({ field: 'name', message: i18n.t('validation.nameMinLength', { defaultValue: 'Le nom doit contenir au moins 3 caractères', count: 3 }) });
 }

 if (!asset.category?.trim()) {
 errors.push({ field: 'category', message: i18n.t('validation.categoryRequired', { defaultValue: 'La catégorie est requise' }) });
 }

 if (!asset.criticality?.trim()) {
 errors.push({ field: 'criticality', message: i18n.t('validation.criticalityRequired', { defaultValue: 'La criticité est requise' }) });
 }

 if (asset.value !== undefined && asset.value <= 0) {
 errors.push({ field: 'value', message: i18n.t('validation.valuePositive', { defaultValue: 'La valeur doit être supérieure à 0' }) });
 }

 if ('type' in asset && !asset.type) {
 errors.push({ field: 'type', message: i18n.t('validation.typeRequired', { defaultValue: 'Le type est requis' }) });
 }

 if ('confidentiality' in asset && !asset.confidentiality) {
 errors.push({ field: 'confidentiality', message: i18n.t('validation.confidentialityRequired', { defaultValue: 'La confidentialité est requise' }) });
 }

 if ('integrity' in asset && !asset.integrity) {
 errors.push({ field: 'integrity', message: i18n.t('validation.integrityRequired', { defaultValue: "L'intégrité est requise" }) });
 }

 if ('availability' in asset && !asset.availability) {
 errors.push({ field: 'availability', message: i18n.t('validation.availabilityRequired', { defaultValue: 'La disponibilité est requise' }) });
 }

 return errors;
};

/**
 * Validate Risk data
 */
export const validateRisk = (risk: Partial<Risk>): ValidationError[] => {
 const errors: ValidationError[] = [];

 if (!risk.threat?.trim()) {
 errors.push({ field: 'threat', message: i18n.t('validation.threatRequired', { defaultValue: 'La menace est requise' }) });
 }

 if (!risk.category?.trim()) {
 errors.push({ field: 'category', message: i18n.t('validation.categoryRequired', { defaultValue: 'La catégorie est requise' }) });
 }

 if (risk.probability !== undefined && (risk.probability < 1 || risk.probability > 5)) {
 errors.push({ field: 'probability', message: i18n.t('validation.probabilityRange', { defaultValue: 'La probabilité doit être entre 1 et 5' }) });
 }

 if (risk.impact !== undefined && (risk.impact < 1 || risk.impact > 5)) {
 errors.push({ field: 'impact', message: i18n.t('validation.impactRange', { defaultValue: "L'impact doit être entre 1 et 5" }) });
 }
 return errors;
};

/**
 * Validate Project data
 */
export const validateProject = (project: Partial<Project>): ValidationError[] => {
 const errors: ValidationError[] = [];

 if (!project.name?.trim()) {
 errors.push({ field: 'name', message: i18n.t('validation.nameRequired', { defaultValue: 'Le nom est requis' }) });
 }

 if (!project.status) {
 errors.push({ field: 'status', message: i18n.t('validation.statusRequired', { defaultValue: 'Le statut est requis' }) });
 }

 if (project.startDate && project.dueDate) {
 const start = new Date(project.startDate);
 const end = new Date(project.dueDate);
 if (end < start) {
 errors.push({ field: 'dueDate', message: i18n.t('validation.endDateAfterStart', { defaultValue: 'La date de fin doit être après la date de début' }) });
 }
 }

 return errors;
};

/**
 * Validate Audit data
 */
export const validateAudit = (audit: Partial<Audit>): ValidationError[] => {
 const errors: ValidationError[] = [];

 if (!audit.name?.trim()) {
 errors.push({ field: 'name', message: i18n.t('validation.nameRequired', { defaultValue: 'Le nom est requis' }) });
 }

 if (!audit.type) {
 errors.push({ field: 'type', message: i18n.t('validation.typeRequired', { defaultValue: 'Le type est requis' }) });
 }

 if (!audit.dateScheduled) {
 errors.push({ field: 'dateScheduled', message: i18n.t('validation.dateRequired', { defaultValue: 'La date est requise' }) });
 }

 if (!audit.auditor?.trim()) {
 errors.push({ field: 'auditor', message: i18n.t('validation.auditorRequired', { defaultValue: "L'auditeur est requis" }) });
 }

 return errors;
};

/**
 * Validate Document data
 */
export const validateDocument = (document: Partial<Document>): ValidationError[] => {
 const errors: ValidationError[] = [];

 if (!document.title?.trim()) {
 errors.push({ field: 'title', message: i18n.t('validation.titleRequired', { defaultValue: 'Le titre est requis' }) });
 }

 if (!document.type) {
 errors.push({ field: 'type', message: i18n.t('validation.typeRequired', { defaultValue: 'Le type est requis' }) });
 }

 if (document.nextReviewDate) {
 const reviewDate = new Date(document.nextReviewDate);
 const today = new Date();
 if (reviewDate < today) {
 errors.push({ field: 'nextReviewDate', message: i18n.t('validation.dateFuture', { defaultValue: 'La date de révision doit être dans le futur' }) });
 }
 }

 return errors;
};

/**
 * Validate Incident data
 */
export const validateIncident = (incident: Partial<Incident>): ValidationError[] => {
 const errors: ValidationError[] = [];

 if (!incident.title?.trim()) {
 errors.push({ field: 'title', message: i18n.t('validation.titleRequired', { defaultValue: 'Le titre est requis' }) });
 }

 if (!incident.description?.trim()) {
 errors.push({ field: 'description', message: i18n.t('validation.descriptionRequired', { defaultValue: 'La description est requise' }) });
 }

 if (!incident.severity) {
 errors.push({ field: 'severity', message: i18n.t('validation.severityRequired', { defaultValue: 'La sévérité est requise' }) });
 }

 if (!incident.category) {
 errors.push({ field: 'category', message: i18n.t('validation.categoryRequired', { defaultValue: 'La catégorie est requise' }) });
 }

 if (!incident.dateReported) {
 errors.push({ field: 'dateReported', message: i18n.t('validation.detectionDateRequired', { defaultValue: 'La date de détection est requise' }) });
 }

 return errors;
};

/**
 * Validate Supplier data
 */
export const validateSupplier = (supplier: Partial<Supplier>): ValidationError[] => {
 const errors: ValidationError[] = [];

 if (!supplier.name?.trim()) {
 errors.push({ field: 'name', message: i18n.t('validation.nameRequired', { defaultValue: 'Le nom est requis' }) });
 }

 if (!supplier.category) {
 errors.push({ field: 'category', message: i18n.t('validation.categoryRequired', { defaultValue: 'La catégorie est requise' }) });
 }

 if (!supplier.criticality) {
 errors.push({ field: 'criticality', message: i18n.t('validation.criticalityRequired', { defaultValue: 'La criticité est requise' }) });
 }

 if (supplier.contactEmail && !isValidEmail(supplier.contactEmail)) {
 errors.push({ field: 'contactEmail', message: i18n.t('validation.invalidEmail', { defaultValue: 'Email invalide' }) });
 }

 return errors;
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
 const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
 return emailRegex.test(email);
};

/**
 * Validate phone format (French format)
 */
export const isValidPhone = (phone: string): boolean => {
 const phoneRegex = /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;
 return phoneRegex.test(phone);
};

/**
 * Validate URL format
 */
export const isValidURL = (url: string): boolean => {
 try {
 new URL(url);
 return true;
 } catch {
 return false;
 }
};

/**
 * Validate date is not in the past
 */
export const isValidFutureDate = (date: string): boolean => {
 const inputDate = new Date(date);
 const today = new Date();
 today.setHours(0, 0, 0, 0);
 return inputDate >= today;
};

/**
 * Generic required field validator
 */
export const validateRequired = (value: unknown, fieldName: string): ValidationError | null => {
 if (value === undefined || value === null || value === '') {
 return { field: fieldName, message: i18n.t('validation.fieldRequired', { defaultValue: `${fieldName} est requis`, field: fieldName }) };
 }
 return null;
};

/**
 * Generic string length validator
 */
export const validateLength = (
 value: string,
 fieldName: string,
 min?: number,
 max?: number
): ValidationError | null => {
 if (min !== undefined && value.length < min) {
 return { field: fieldName, message: i18n.t('validation.minLength', { defaultValue: `${fieldName} doit contenir au moins ${min} caractères`, field: fieldName, count: min }) };
 }
 if (max !== undefined && value.length > max) {
 return { field: fieldName, message: i18n.t('validation.maxLength', { defaultValue: `${fieldName} ne doit pas dépasser ${max} caractères`, field: fieldName, count: max }) };
 }
 return null;
};

/**
 * Generic number range validator
 */
export const validateRange = (
 value: number,
 fieldName: string,
 min?: number,
 max?: number
): ValidationError | null => {
 if (min !== undefined && value < min) {
 return { field: fieldName, message: i18n.t('validation.minValue', { defaultValue: `${fieldName} doit être au moins ${min}`, field: fieldName, min }) };
 }
 if (max !== undefined && value > max) {
 return { field: fieldName, message: i18n.t('validation.maxValue', { defaultValue: `${fieldName} ne doit pas dépasser ${max}`, field: fieldName, max }) };
 }
 return null;
};
