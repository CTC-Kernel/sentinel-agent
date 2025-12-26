import React from 'react';
import DOMPurify from 'dompurify';

interface SafeHTMLProps {
    content: string;
    className?: string;
}

export const SafeHTML: React.FC<SafeHTMLProps> = ({ content, className = '' }) => {
    const sanitizedContent = DOMPurify.sanitize(content);

    return (
        <div
            className={`prose dark:prose-invert max-w-none ${className}`}
            dangerouslySetInnerHTML={{ __html: sanitizedContent }} // audit-ignore: DOMPurify used
        />
    );
};
