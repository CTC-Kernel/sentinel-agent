/**
 * ProjectTemplates Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect } from 'vitest';
import { PROJECT_TEMPLATES, createProjectFromTemplate } from '../projectTemplates';

describe('PROJECT_TEMPLATES', () => {
    it('should have multiple templates defined', () => {
        expect(PROJECT_TEMPLATES.length).toBeGreaterThan(0);
    });

    it('should have ISO 27001 implementation template', () => {
        const iso27001 = PROJECT_TEMPLATES.find(t => t.id === 'iso27001-implementation');
        expect(iso27001).toBeDefined();
        expect(iso27001?.category).toBe('ISO27001');
        expect(iso27001?.defaultTasks.length).toBeGreaterThan(0);
        expect(iso27001?.defaultMilestones.length).toBeGreaterThan(0);
    });

    it('should have security audit template', () => {
        const audit = PROJECT_TEMPLATES.find(t => t.id === 'security-audit');
        expect(audit).toBeDefined();
        expect(audit?.category).toBe('Audit');
    });

    it('should have incident response template', () => {
        const incident = PROJECT_TEMPLATES.find(t => t.id === 'incident-response');
        expect(incident).toBeDefined();
        expect(incident?.category).toBe('Incident');
    });

    it('should have NIS2 compliance template', () => {
        const nis2 = PROJECT_TEMPLATES.find(t => t.id === 'nis2-compliance');
        expect(nis2).toBeDefined();
    });

    it('should have DORA compliance template', () => {
        const dora = PROJECT_TEMPLATES.find(t => t.id === 'dora-compliance');
        expect(dora).toBeDefined();
    });

    it('should have GDPR compliance template', () => {
        const gdpr = PROJECT_TEMPLATES.find(t => t.id === 'gdpr-compliance');
        expect(gdpr).toBeDefined();
    });

    it('should have all required fields in each template', () => {
        PROJECT_TEMPLATES.forEach(template => {
            expect(template.id).toBeTruthy();
            expect(template.name).toBeTruthy();
            expect(template.description).toBeTruthy();
            expect(template.category).toBeTruthy();
            expect(template.icon).toBeTruthy();
            expect(typeof template.estimatedDuration).toBe('number');
            expect(Array.isArray(template.defaultTasks)).toBe(true);
            expect(Array.isArray(template.defaultMilestones)).toBe(true);
        });
    });

    it('should have valid task structure in all templates', () => {
        PROJECT_TEMPLATES.forEach(template => {
            template.defaultTasks.forEach(task => {
                expect(task.title).toBeTruthy();
                expect(task.status).toBeTruthy();
                expect(task.priority).toBeTruthy();
            });
        });
    });

    it('should have valid milestone structure in all templates', () => {
        PROJECT_TEMPLATES.forEach(template => {
            template.defaultMilestones.forEach(milestone => {
                expect(milestone.title).toBeTruthy();
                expect(milestone.status).toBe('pending');
            });
        });
    });
});

describe('createProjectFromTemplate', () => {
    const template = PROJECT_TEMPLATES[0]; // ISO 27001 template
    const projectName = 'Test Project';
    const startDate = new Date('2024-06-01');
    const manager = { id: 'manager-123', label: 'John Doe' };
    const organizationId = 'org-123';

    it('should create project with correct name and description', () => {
        const { project } = createProjectFromTemplate(template, projectName, startDate, manager, organizationId);

        expect(project.name).toBe(projectName);
        expect(project.description).toBe(template.description);
    });

    it('should set manager information correctly', () => {
        const { project } = createProjectFromTemplate(template, projectName, startDate, manager, organizationId);

        expect(project.manager).toBe(manager.label);
        expect(project.managerId).toBe(manager.id);
    });

    it('should set organization ID', () => {
        const { project } = createProjectFromTemplate(template, projectName, startDate, manager, organizationId);

        expect(project.organizationId).toBe(organizationId);
    });

    it('should calculate due date based on template duration', () => {
        const { project } = createProjectFromTemplate(template, projectName, startDate, manager, organizationId);

        const expectedDueDate = new Date(startDate.getTime() + template.estimatedDuration * 24 * 60 * 60 * 1000);
        expect(project.dueDate).toBe(expectedDueDate.toISOString());
    });

    it('should initialize project status as Planifié', () => {
        const { project } = createProjectFromTemplate(template, projectName, startDate, manager, organizationId);

        expect(project.status).toBe('Planifié');
    });

    it('should initialize progress at 0', () => {
        const { project } = createProjectFromTemplate(template, projectName, startDate, manager, organizationId);

        expect(project.progress).toBe(0);
    });

    it('should create tasks from template', () => {
        const { project } = createProjectFromTemplate(template, projectName, startDate, manager, organizationId);

        expect(project.tasks.length).toBe(template.defaultTasks.length);
        project.tasks.forEach((task, index) => {
            expect(task.title).toBe(template.defaultTasks[index].title);
            expect(task.id).toBeTruthy();
        });
    });

    it('should create milestones from template', () => {
        const { milestones } = createProjectFromTemplate(template, projectName, startDate, manager, organizationId);

        expect(milestones.length).toBe(template.defaultMilestones.length);
        milestones.forEach((milestone, index) => {
            expect(milestone.title).toBe(template.defaultMilestones[index].title);
            expect(milestone.id).toBeTruthy();
            expect(milestone.targetDate).toBeTruthy();
        });
    });

    it('should distribute milestones evenly across project duration', () => {
        const { milestones } = createProjectFromTemplate(template, projectName, startDate, manager, organizationId);

        // Milestones should be progressively later in the project
        for (let i = 1; i < milestones.length; i++) {
            const prevDate = new Date(milestones[i - 1].targetDate);
            const currDate = new Date(milestones[i].targetDate);
            expect(currDate.getTime()).toBeGreaterThan(prevDate.getTime());
        }
    });

    it('should initialize empty related arrays', () => {
        const { project } = createProjectFromTemplate(template, projectName, startDate, manager, organizationId);

        expect(project.relatedRiskIds).toEqual([]);
        expect(project.relatedControlIds).toEqual([]);
        expect(project.relatedAssetIds).toEqual([]);
    });

    it('should set createdAt timestamp', () => {
        const beforeCreate = new Date();
        const { project } = createProjectFromTemplate(template, projectName, startDate, manager, organizationId);
        const afterCreate = new Date();

        const createdAt = new Date(project.createdAt);
        expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
        expect(createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });
});
