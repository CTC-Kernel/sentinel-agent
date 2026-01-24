/**
 * RelativeTime Component
 * Displays timestamps in human-readable relative format
 * Auto-updates and shows exact time on hover
 */

import React, { useState, useEffect, useMemo } from 'react';
import { formatDistanceToNow, format, isValid, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Tooltip } from './Tooltip';
import { cn } from '../../lib/utils';

interface RelativeTimeProps {
    /** Date to display - can be Date, timestamp, or ISO string */
    date: Date | number | string | null | undefined;
    /** Show "il y a" prefix */
    addSuffix?: boolean;
    /** Locale for formatting */
    locale?: Locale;
    /** Update interval in ms (default: 60000 = 1 minute) */
    updateInterval?: number;
    /** Show tooltip with exact time */
    showTooltip?: boolean;
    /** Tooltip format */
    tooltipFormat?: string;
    /** Additional class names */
    className?: string;
    /** Fallback text when date is invalid */
    fallback?: string;
    /** Capitalize first letter */
    capitalize?: boolean;
    /** Short format (e.g., "5m" instead of "il y a 5 minutes") */
    short?: boolean;
}

/**
 * Parse various date formats into a Date object
 */
const parseDate = (date: Date | number | string | null | undefined): Date | null => {
    if (!date) return null;

    if (date instanceof Date) {
        return isValid(date) ? date : null;
    }

    if (typeof date === 'number') {
        const d = new Date(date);
        return isValid(d) ? d : null;
    }

    if (typeof date === 'string') {
        // Try ISO parse first
        const parsed = parseISO(date);
        if (isValid(parsed)) return parsed;

        // Try direct Date constructor
        const d = new Date(date);
        return isValid(d) ? d : null;
    }

    return null;
};

/**
 * Format time in short format (e.g., "5m", "2h", "3j")
 */
const formatShort = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);

    if (diffSec < 60) return 'maintenant';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHour < 24) return `${diffHour}h`;
    if (diffDay < 7) return `${diffDay}j`;
    if (diffWeek < 4) return `${diffWeek}sem`;
    if (diffMonth < 12) return `${diffMonth}mois`;
    return `${diffYear}an${diffYear > 1 ? 's' : ''}`;
};

export const RelativeTime: React.FC<RelativeTimeProps> = ({
    date,
    addSuffix = true,
    locale = fr,
    updateInterval = 60000,
    showTooltip = true,
    tooltipFormat = "EEEE d MMMM yyyy 'à' HH:mm",
    className,
    fallback = '—',
    capitalize = false,
    short = false
}) => {
    const [, forceUpdate] = useState({});

    const parsedDate = useMemo(() => parseDate(date), [date]);

    // Auto-update every interval
    useEffect(() => {
        if (!parsedDate || updateInterval <= 0) return;

        const timer = setInterval(() => {
            forceUpdate({});
        }, updateInterval);

        return () => clearInterval(timer);
    }, [parsedDate, updateInterval]);

    if (!parsedDate) {
        return <span className={cn('text-muted-foreground', className)}>{fallback}</span>;
    }

    let relativeText: string;

    if (short) {
        relativeText = formatShort(parsedDate);
    } else {
        relativeText = formatDistanceToNow(parsedDate, {
            addSuffix,
            locale
        });
    }

    if (capitalize && relativeText.length > 0) {
        relativeText = relativeText.charAt(0).toUpperCase() + relativeText.slice(1);
    }

    const exactTime = format(parsedDate, tooltipFormat, { locale });

    const content = (
        <time
            dateTime={parsedDate.toISOString()}
            className={cn('tabular-nums', className)}
            title={!showTooltip ? exactTime : undefined}
        >
            {relativeText}
        </time>
    );

    if (showTooltip) {
        return (
            <Tooltip content={exactTime} position="top">
                {content}
            </Tooltip>
        );
    }

    return content;
};

/**
 * TimeAgo - Simplified alias for RelativeTime
 */
export const TimeAgo: React.FC<Omit<RelativeTimeProps, 'addSuffix'>> = (props) => (
    <RelativeTime {...props} addSuffix />
);

/**
 * SmartDate - Shows relative time for recent dates, exact for older ones
 */
interface SmartDateProps extends RelativeTimeProps {
    /** Threshold in days after which to show exact date */
    thresholdDays?: number;
    /** Format for dates older than threshold */
    oldFormat?: string;
}

export const SmartDate: React.FC<SmartDateProps> = ({
    date,
    thresholdDays = 7,
    oldFormat = 'd MMM yyyy',
    locale = fr,
    className,
    fallback = '—',
    showTooltip = true,
    tooltipFormat = "EEEE d MMMM yyyy 'à' HH:mm",
    ...props
}) => {
    const parsedDate = useMemo(() => parseDate(date), [date]);

    if (!parsedDate) {
        return <span className={cn('text-muted-foreground', className)}>{fallback}</span>;
    }

    const now = new Date();
    const diffDays = Math.floor((now.getTime() - parsedDate.getTime()) / (1000 * 60 * 60 * 24));

    // Show relative time for recent dates
    if (diffDays < thresholdDays) {
        return (
            <RelativeTime
                date={parsedDate}
                locale={locale}
                className={className}
                fallback={fallback}
                showTooltip={showTooltip}
                tooltipFormat={tooltipFormat}
                {...props}
            />
        );
    }

    // Show formatted date for older dates
    const formattedDate = format(parsedDate, oldFormat, { locale });
    const exactTime = format(parsedDate, tooltipFormat, { locale });

    const content = (
        <time
            dateTime={parsedDate.toISOString()}
            className={cn('tabular-nums', className)}
        >
            {formattedDate}
        </time>
    );

    if (showTooltip) {
        return (
            <Tooltip content={exactTime} position="top">
                {content}
            </Tooltip>
        );
    }

    return content;
};

/**
 * DateRange - Display a date range in a readable format
 */
interface DateRangeProps {
    start: Date | number | string | null | undefined;
    end: Date | number | string | null | undefined;
    separator?: string;
    format?: string;
    locale?: Locale;
    className?: string;
    fallback?: string;
}

export const DateRange: React.FC<DateRangeProps> = ({
    start,
    end,
    separator = ' → ',
    format: dateFormat = 'd MMM yyyy',
    locale = fr,
    className,
    fallback = '—'
}) => {
    const startDate = parseDate(start);
    const endDate = parseDate(end);

    if (!startDate && !endDate) {
        return <span className={cn('text-muted-foreground', className)}>{fallback}</span>;
    }

    const formatDate = (d: Date | null) =>
        d ? format(d, dateFormat, { locale }) : '...';

    return (
        <span className={cn('tabular-nums', className)}>
            {formatDate(startDate)}
            {separator}
            {formatDate(endDate)}
        </span>
    );
};

export default RelativeTime;
