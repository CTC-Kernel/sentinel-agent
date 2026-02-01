import { getLocaleConfig, type SupportedLocale } from '../config/localeConfig';
import i18n from '../i18n';

export const formatDate = (date: string | Date | undefined | null, locale: string = getLocaleConfig(i18n.language as SupportedLocale).intlLocale): string => {
    if (!date) return '-';
    try {
        const d = new Date(date);
        return new Intl.DateTimeFormat(locale, {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).format(d);
    } catch {
        return String(date);
    }
};

export const formatDateTime = (date: string | Date | undefined | null, locale: string = getLocaleConfig(i18n.language as SupportedLocale).intlLocale): string => {
    if (!date) return '-';
    try {
        const d = new Date(date);
        return new Intl.DateTimeFormat(locale, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(d);
    } catch {
        return String(date);
    }
};
