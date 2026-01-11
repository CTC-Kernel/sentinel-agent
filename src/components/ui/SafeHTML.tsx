import React, { useMemo } from 'react';
import DOMPurify, { Config } from 'dompurify';

/**
 * DOMPurify configuration for safe HTML rendering
 * Restricts allowed tags and attributes to prevent XSS attacks
 */
const DOMPURIFY_CONFIG: Config = {
    ALLOWED_TAGS: [
        'p', 'br', 'b', 'i', 'em', 'strong', 'u', 's', 'strike',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'a', 'blockquote', 'pre', 'code',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'div', 'span', 'hr'
    ],
    ALLOWED_ATTR: ['href', 'title', 'class', 'id', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    ADD_ATTR: ['target'], // Allow target attribute for links
    // Force all links to open in new tab with security attributes
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false
};

// Configure DOMPurify hooks for additional security
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    // Force all links to have rel="noopener noreferrer" for security
    if (node.tagName === 'A') {
        node.setAttribute('rel', 'noopener noreferrer');
        // Only allow http/https links
        const href = node.getAttribute('href');
        if (href && !href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('/')) {
            node.removeAttribute('href');
        }
    }
});

interface SafeHTMLProps {
    content: string;
    className?: string;
    /** Use minimal config (only basic formatting) */
    minimal?: boolean;
}

/**
 * Minimal config for user-generated content (comments, descriptions)
 */
const MINIMAL_CONFIG: Config = {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'u', 'a'],
    ALLOWED_ATTR: ['href', 'title'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
};

export const SafeHTML: React.FC<SafeHTMLProps> = ({ content, className = '', minimal = false }) => {
    const sanitizedContent = useMemo(() => {
        if (!content) return '';
        return DOMPurify.sanitize(content, minimal ? MINIMAL_CONFIG : DOMPURIFY_CONFIG);
    }, [content, minimal]);

    return (
        <div
            className={`prose dark:prose-invert max-w-none ${className}`}
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
    );
};
