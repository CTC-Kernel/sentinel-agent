import React, { useMemo } from 'react';
import DOMPurify, { Config } from 'dompurify';

interface TextHighlightProps {
 text: string;
 query: string;
 className?: string;
 highlightClassName?: string;
 isHtml?: boolean;
}

// DOMPurify configuration for safe HTML rendering
const DOMPURIFY_CONFIG: Config = {
 ALLOWED_TAGS: ['mark', 'span', 'b', 'i', 'em', 'strong', 'br', 'p'],
 ALLOWED_ATTR: ['class'],
 KEEP_CONTENT: true,
};

export const TextHighlight: React.FC<TextHighlightProps> = ({
 text,
 query,
 className = '',
 highlightClassName = 'bg-primary/15 text-primary font-bold rounded-sm px-0.5',
 isHtml = false
}) => {
 // Memoize sanitized content to prevent unnecessary DOMPurify calls
 const sanitizedContent = useMemo(() => {
 if (!isHtml) return null;

 // First sanitize the input HTML - RETURN_TRUSTED_TYPE: false ensures string return
 const sanitizedText = DOMPurify.sanitize(text, { ...DOMPURIFY_CONFIG, RETURN_TRUSTED_TYPE: false }) as string;

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
 return DOMPurify.sanitize(highlighted, { ...DOMPURIFY_CONFIG, RETURN_TRUSTED_TYPE: false }) as string;
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
  <span key={i || 'unknown'} className={highlightClassName}>
  {part}
  </span>
 ) : (
  part
 )
 )}
 </span>
 );
};
