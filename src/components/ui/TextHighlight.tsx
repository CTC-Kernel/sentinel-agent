import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';

interface TextHighlightProps {
    text: string;
    query: string;
    className?: string;
    highlightClassName?: string;
    isHtml?: boolean;
}

// DOMPurify configuration for safe HTML rendering
const DOMPURIFY_CONFIG: DOMPurify.Config = {
    ALLOWED_TAGS: ['mark', 'span', 'b', 'i', 'em', 'strong', 'br', 'p'],
    ALLOWED_ATTR: ['class'],
    KEEP_CONTENT: true,
};

export const TextHighlight: React.FC<TextHighlightProps> = ({
    text,
    query,
    className = '',
    highlightClassName = 'bg-brand-500/20 text-brand-600 dark:text-brand-400 font-bold rounded-sm px-0.5',
    isHtml = false
}) => {
    // Memoize sanitized content to prevent unnecessary DOMPurify calls
    const sanitizedContent = useMemo(() => {
        if (!isHtml) return null;

        // First sanitize the input HTML
        const sanitizedText = DOMPurify.sanitize(text, DOMPURIFY_CONFIG);

        if (!query || !query.trim()) {
            return sanitizedText;
        }

        // Escape special characters for regex
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Apply highlighting to sanitized content
        const highlighted = sanitizedText.replace(
            new RegExp(`(${escapedQuery})`, 'gi'),
            `<mark class="${highlightClassName.replace(/"/g, '&quot;')}">$1</mark>`
        );

        // Re-sanitize after adding marks (defense in depth)
        return DOMPurify.sanitize(highlighted, DOMPURIFY_CONFIG);
    }, [text, query, isHtml, highlightClassName]);

    if (!query || !query.trim()) {
        if (isHtml) {
            return <span className={className} dangerouslySetInnerHTML={{ __html: sanitizedContent || '' }} />;
        }
        return <span className={className}>{text}</span>;
    }

    // Escape special characters for regex
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (isHtml) {
        return <span className={className} dangerouslySetInnerHTML={{ __html: sanitizedContent || '' }} />;
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
