/**
 * Control Test Factory
 * Creates mock Control objects for testing
 */

import { Control } from '../../types';

let controlCounter = 0;

export interface ControlFactoryOptions {
    id?: string;
    organizationId?: string;
    code?: string;
    name?: string;
    status?: Control['status'];
    framework?: string;
    category?: string;
    priority?: Control['priority'];
}

export function createControl(options: ControlFactoryOptions = {}): Control {
    controlCounter++;
    const id = options.id || `ctrl-${controlCounter}`;

    return {
        id,
        organizationId: options.organizationId || 'org-test',
        code: options.code || `A.${controlCounter}.1`,
        name: options.name || `Test Control ${controlCounter}`,
        description: `Description for control ${controlCounter}`,
        status: options.status || 'Non implémenté',
        framework: options.framework || 'ISO27001',
        category: options.category || 'Organizational',
        priority: options.priority || 'Moyenne',
        owner: 'Control Owner',
        ownerId: 'user-1',
        evidenceIds: [],
        linkedRiskIds: [],
        implementationDate: undefined,
        reviewDate: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

export function createControlList(count: number, options: ControlFactoryOptions = {}): Control[] {
    return Array.from({ length: count }, () => createControl(options));
}

export function createImplementedControl(options: ControlFactoryOptions = {}): Control {
    return createControl({
        ...options,
        status: 'Implémenté',
    });
}

export function resetControlCounter(): void {
    controlCounter = 0;
}
