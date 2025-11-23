import { Asset, Risk, Project, Audit, Document, Incident, Supplier } from '../types';

export interface ValidationError {
    field: string;
    message: string;
}

/**
 * Validate Asset data
 */
export const validateAsset = (asset: Partial<Asset>): ValidationError[] => {
    const errors: ValidationError[] = [];
    const a = asset as any; // Type assertion for partial validation

    if (!asset.name?.trim()) {
        errors.push({ field: 'name', message: 'Le nom est requis' });
    } else if (asset.name.length < 3) {
        errors.push({ field: 'name', message: 'Le nom doit contenir au moins 3 caractères' });
    }

    if (!a.category) {
        errors.push({ field: 'category', message: 'La catégorie est requise' });
    }

    if (!a.criticality) {
        errors.push({ field: 'criticality', message: 'La criticité est requise' });
    }

    if (a.value !== undefined && a.value < 0) {
        errors.push({ field: 'value', message: 'La valeur ne peut pas être négative' });
    }

    return errors;
};

/**
 * Validate Risk data
 */
export const validateRisk = (risk: Partial<Risk>): ValidationError[] => {
    const errors: ValidationError[] = [];
    const r = risk as any;

    if (!r.threat?.trim()) {
        errors.push({ field: 'threat', message: 'La menace est requise' });
    }

    if (!r.category) {
        errors.push({ field: 'category', message: 'La catégorie est requise' });
    }

    if (r.probability !== undefined && (r.probability < 1 || r.probability > 5)) {
        errors.push({ field: 'probability', message: 'La probabilité doit être entre 1 et 5' });
    }

    if (r.impact !== undefined && (r.impact < 1 || r.impact > 5)) {
        errors.push({ field: 'impact', message: "L'impact doit être entre 1 et 5" });
    }
    return errors;
};

/**
 * Validate Project data
 */
export const validateProject = (project: Partial<Project>): ValidationError[] => {
    const errors: ValidationError[] = [];
    const p = project as any;

    if (!p.name?.trim()) {
        errors.push({ field: 'name', message: 'Le nom est requis' });
    }

    if (!p.status) {
        errors.push({ field: 'status', message: 'Le statut est requis' });
    }

    if (!p.priority) {
        errors.push({ field: 'priority', message: 'La priorité est requise' });
    }

    if (p.startDate && p.endDate) {
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        if (end < start) {
            errors.push({ field: 'endDate', message: 'La date de fin doit être après la date de début' });
        }
    }

    if (p.budget !== undefined && p.budget < 0) {
        errors.push({ field: 'budget', message: 'Le budget ne peut pas être négatif' });
    }
    return errors;
};

/**
 * Validate Audit data
 */
export const validateAudit = (audit: Partial<Audit>): ValidationError[] => {
    const errors: ValidationError[] = [];
    const a = audit as any;

    if (!a.name?.trim()) {
        errors.push({ field: 'name', message: 'Le nom est requis' });
    }

    if (!a.type) {
        errors.push({ field: 'type', message: 'Le type est requis' });
    }

    if (!a.scope?.trim()) {
        errors.push({ field: 'scope', message: 'Le périmètre est requis' });
    }

    if (!a.scheduledDate) {
        errors.push({ field: 'scheduledDate', message: 'La date est requise' });
    }

    if (!a.auditor?.trim()) {
        errors.push({ field: 'auditor', message: "L'auditeur est requis" });
    }

    return errors;
};

/**
 * Validate Document data
 */
export const validateDocument = (document: Partial<Document>): ValidationError[] => {
    const errors: ValidationError[] = [];
    const d = document as any;

    if (!d.title?.trim()) {
        errors.push({ field: 'title', message: 'Le titre est requis' });
    }

    if (!d.type) {
        errors.push({ field: 'type', message: 'Le type est requis' });
    }

    if (!d.category) {
        errors.push({ field: 'category', message: 'La catégorie est requise' });
    }

    if (d.reviewDate) {
        const reviewDate = new Date(d.reviewDate);
        const today = new Date();
        if (reviewDate < today) {
            errors.push({ field: 'reviewDate', message: 'La date de révision doit être dans le futur' });
        }
    }

    return errors;
};

/**
 * Validate Incident data
 */
export const validateIncident = (incident: Partial<Incident>): ValidationError[] => {
    const errors: ValidationError[] = [];
    const i = incident as any;

    if (!i.title?.trim()) {
        errors.push({ field: 'title', message: 'Le titre est requis' });
    }

    if (!i.description?.trim()) {
        errors.push({ field: 'description', message: 'La description est requise' });
    }

    if (!i.severity) {
        errors.push({ field: 'severity', message: 'La sévérité est requise' });
    }

    if (!i.category) {
        errors.push({ field: 'category', message: 'La catégorie est requise' });
    }

    if (!i.detectedDate) {
        errors.push({ field: 'detectedDate', message: 'La date de détection est requise' });
    }

    return errors;
};

/**
 * Validate Supplier data
 */
export const validateSupplier = (supplier: Partial<Supplier>): ValidationError[] => {
    const errors: ValidationError[] = [];
    const s = supplier as any;

    if (!s.name?.trim()) {
        errors.push({ field: 'name', message: 'Le nom est requis' });
    }

    if (!s.category) {
        errors.push({ field: 'category', message: 'La catégorie est requise' });
    }

    if (!s.criticality) {
        errors.push({ field: 'criticality', message: 'La criticité est requise' });
    }

    if (s.email && !isValidEmail(s.email)) {
        errors.push({ field: 'email', message: 'Email invalide' });
    }

    if (s.phone && !isValidPhone(s.phone)) {
        errors.push({ field: 'phone', message: 'Numéro de téléphone invalide' });
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
export const validateRequired = (value: any, fieldName: string): ValidationError | null => {
    if (value === undefined || value === null || value === '') {
        return { field: fieldName, message: `${fieldName} est requis` };
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
        return { field: fieldName, message: `${fieldName} doit contenir au moins ${min} caractères` };
    }
    if (max !== undefined && value.length > max) {
        return { field: fieldName, message: `${fieldName} ne peut pas dépasser ${max} caractères` };
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
        return { field: fieldName, message: `${fieldName} doit être au moins ${min}` };
    }
    if (max !== undefined && value > max) {
        return { field: fieldName, message: `${fieldName} ne peut pas dépasser ${max}` };
    }
    return null;
};
