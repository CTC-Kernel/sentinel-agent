import React from 'react';

interface TextHighlightProps {
    text: string;
    query: string;
    className?: string;
    highlightClassName?: string;
    isHtml?: boolean;
}

export const TextHighlight: React.FC<TextHighlightProps> = ({
    text,
    query,
    className = '',
    highlightClassName = 'bg-brand-500/20 text-brand-600 dark:text-brand-400 font-bold rounded-sm px-0.5',
    isHtml = false
}) => {
    if (!query || !query.trim()) {
        if (isHtml) return <span className={className} dangerouslySetInnerHTML={{ __html: text }} />;
        return <span className={className}>{text}</span>;
    }

    // Escape special characters for regex
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (isHtml) {
        // Simple regex replace for HTML (might be fragile if query matches inside tags, but usually okay for simple content)
        const highlighted = text.replace(
            new RegExp(`(${escapedQuery})`, 'gi'),
            `<mark class="${highlightClassName.replace(/"/g, '&quot;')}">$1</mark>`
        );
        return <span className={className} dangerouslySetInnerHTML={{ __html: highlighted }} />;
    }

    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));

    return (
        <span className={className}>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase() ? (
                    <span key={i} className={highlightClassName}>
                        {part}
                    </span>
                ) : (
                    part
                )
            )}
        </span>
    );
};
