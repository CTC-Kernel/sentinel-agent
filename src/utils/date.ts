export const formatDate = (date: string | Date | undefined | null): string => {
    if (!date) return '-';
    try {
        const d = new Date(date);
        return new Intl.DateTimeFormat('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).format(d);
    } catch {
        return String(date);
    }
};

export const formatDateTime = (date: string | Date | undefined | null): string => {
    if (!date) return '-';
    try {
        const d = new Date(date);
        return new Intl.DateTimeFormat('fr-FR', {
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
