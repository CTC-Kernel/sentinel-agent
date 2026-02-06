/**
 * Centralized Chart Types for Sentinel GRC
 * Defines shared interfaces for Recharts custom renderers to ensure type safety.
 */

import type { PieSectorDataItem } from 'recharts/types/polar/Pie';

/**
 * Enhanced Pie Sector Data for Active Shapes
 * Ensures presence of payload properties used in dashboards
 */
export interface SentinelPieActiveShapeProps extends PieSectorDataItem {
    payload: {
        name: string;
        value: number;
        [key: string]: unknown;
    };
    percent?: number;
}

/**
 * Standard Gauge Data Item
 */
export interface GaugeDataItem {
    name: string;
    value: number;
    fill: string;
}
