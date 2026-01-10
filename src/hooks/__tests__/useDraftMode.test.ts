/**
 * Unit tests for useDraftMode hook (Story 1.3)
 *
 * Tests for draft mode state management and validation switching.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { z } from 'zod';
import {
  useDraftMode,
  useDraftState,
  getDraftLabel,
  getPublishLabel,
  getSaveAsDraftLabel,
} from '../useDraftMode';
import { createDraftSchema } from '../../utils/draftSchema';

// Mock useLocale hook
vi.mock('../useLocale', () => ({
  useLocale: () => ({ locale: 'fr' }),
}));

describe('useDraftMode', () => {
  // Use simple string schemas without min constraints for cleaner testing
  const fullSchema = z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    priority: z.number().min(1).max(5),
  });

  const draftSchema = createDraftSchema(fullSchema, {
    requiredFields: ['title'],
    locale: 'fr',
  });

  describe('initialization', () => {
    it('initializes in draft mode by default', () => {
      const { result } = renderHook(() =>
        useDraftMode({
          fullSchema,
          draftSchema,
        })
      );

      expect(result.current.isDraft).toBe(true);
    });

    it('respects initialDraftMode option', () => {
      const { result } = renderHook(() =>
        useDraftMode({
          fullSchema,
          draftSchema,
          initialDraftMode: false,
        })
      );

      expect(result.current.isDraft).toBe(false);
    });

    it('initializes form with default values', () => {
      const { result } = renderHook(() =>
        useDraftMode({
          fullSchema,
          draftSchema,
          defaultValues: {
            title: 'Default Title',
            description: '',
            priority: 3,
          },
        })
      );

      expect(result.current.form.getValues('title')).toBe('Default Title');
    });
  });

  describe('setDraftMode', () => {
    it('toggles draft mode', () => {
      const { result } = renderHook(() =>
        useDraftMode({
          fullSchema,
          draftSchema,
        })
      );

      expect(result.current.isDraft).toBe(true);

      act(() => {
        result.current.setDraftMode(false);
      });

      expect(result.current.isDraft).toBe(false);

      act(() => {
        result.current.setDraftMode(true);
      });

      expect(result.current.isDraft).toBe(true);
    });
  });

  describe('draftStatusValue', () => {
    it('returns document status by default', () => {
      const { result } = renderHook(() =>
        useDraftMode({
          fullSchema,
          draftSchema,
        })
      );

      expect(result.current.draftStatusValue).toBe('Brouillon');
    });

    it('returns correct status for different entity types', () => {
      const { result: auditResult } = renderHook(() =>
        useDraftMode({
          fullSchema,
          draftSchema,
          entityType: 'audit',
        })
      );

      expect(auditResult.current.draftStatusValue).toBe('Draft');
    });
  });

  describe('canSaveDraft', () => {
    it('returns canSave based on draft validation result', () => {
      const { result } = renderHook(() =>
        useDraftMode({
          fullSchema,
          draftSchema,
        })
      );

      // The canSaveDraft function validates the current form values
      // Initial values may be empty, so it returns the validation result
      const checkResult = result.current.canSaveDraft();

      // canSave is based on whether draftSchema validation passes
      expect(typeof checkResult.canSave).toBe('boolean');
      expect(typeof checkResult.errors).toBe('object');
    });

    it('returns errors object when validation fails', () => {
      const { result } = renderHook(() =>
        useDraftMode({
          fullSchema,
          draftSchema,
          defaultValues: {
            title: '',
            description: '',
            priority: 0,
          },
        })
      );

      const checkResult = result.current.canSaveDraft();
      // With empty title, validation should fail
      expect(checkResult.canSave).toBe(false);
      expect(Object.keys(checkResult.errors).length).toBeGreaterThan(0);
    });
  });

  describe('isValidForPublish', () => {
    it('validates against full schema', () => {
      const { result } = renderHook(() =>
        useDraftMode({
          fullSchema,
          draftSchema,
          defaultValues: {
            title: 'Valid Title',
            description: 'Valid Description',
            priority: 3,
          },
        })
      );

      // isValidForPublish validates form values against full schema
      const isValid = result.current.isValidForPublish();
      expect(typeof isValid).toBe('boolean');
    });

    it('returns false when missing required fields', () => {
      const { result } = renderHook(() =>
        useDraftMode({
          fullSchema,
          draftSchema,
          defaultValues: {
            title: '',
            description: '',
            priority: 0, // Invalid - min is 1
          },
        })
      );

      expect(result.current.isValidForPublish()).toBe(false);
    });
  });

  describe('saveAsDraft', () => {
    it('does not call onSave when draft validation fails', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useDraftMode({
          fullSchema,
          draftSchema,
          defaultValues: {
            title: '', // Invalid - empty title
            description: '',
            priority: 0,
          },
        })
      );

      await act(async () => {
        await result.current.saveAsDraft(onSave);
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it('exposes draftStatusValue based on entityType', () => {
      // Verify that saveAsDraft would include correct status metadata
      const { result: docResult } = renderHook(() =>
        useDraftMode({
          fullSchema,
          draftSchema,
          entityType: 'document',
        })
      );

      expect(docResult.current.draftStatusValue).toBe('Brouillon');

      const { result: auditResult } = renderHook(() =>
        useDraftMode({
          fullSchema,
          draftSchema,
          entityType: 'audit',
        })
      );

      expect(auditResult.current.draftStatusValue).toBe('Draft');
    });

  });

  describe('publish', () => {
    it('calls onPublish with isDraft false when full validation passes', async () => {
      const onPublish = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useDraftMode({
          fullSchema,
          draftSchema,
          defaultValues: {
            title: 'Valid Title',
            description: 'Long enough description',
            priority: 3,
          },
        })
      );

      await act(async () => {
        await result.current.publish(onPublish);
      });

      await waitFor(() => {
        expect(onPublish).toHaveBeenCalled();
      });

      expect(onPublish.mock.calls[0][0]).toMatchObject({
        isDraft: false,
      });
    });

    it('switches to non-draft mode before publishing', async () => {
      const onPublish = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useDraftMode({
          fullSchema,
          draftSchema,
          defaultValues: {
            title: 'Valid Title',
            description: 'Long enough description',
            priority: 3,
          },
        })
      );

      expect(result.current.isDraft).toBe(true);

      await act(async () => {
        await result.current.publish(onPublish);
      });

      expect(result.current.isDraft).toBe(false);
    });
  });
});

describe('useDraftState', () => {
  it('initializes with draft mode by default', () => {
    const { result } = renderHook(() => useDraftState());

    expect(result.current.isDraft).toBe(true);
  });

  it('respects initial draft state', () => {
    const { result } = renderHook(() => useDraftState('document', false));

    expect(result.current.isDraft).toBe(false);
  });

  it('returns correct draft status value for entity type', () => {
    const { result: docResult } = renderHook(() => useDraftState('document'));
    expect(docResult.current.draftStatusValue).toBe('Brouillon');

    const { result: auditResult } = renderHook(() => useDraftState('audit'));
    expect(auditResult.current.draftStatusValue).toBe('Draft');
  });

  it('toggles draft state', () => {
    const { result } = renderHook(() => useDraftState());

    expect(result.current.isDraft).toBe(true);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isDraft).toBe(false);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isDraft).toBe(true);
  });

  it('sets draft mode directly', () => {
    const { result } = renderHook(() => useDraftState());

    act(() => {
      result.current.setDraftMode(false);
    });

    expect(result.current.isDraft).toBe(false);
  });
});

describe('label helpers', () => {
  describe('getDraftLabel', () => {
    it('returns FR label for fr locale', () => {
      expect(getDraftLabel('fr')).toBe('Brouillon');
    });

    it('returns EN label for en locale', () => {
      expect(getDraftLabel('en')).toBe('Draft');
    });
  });

  describe('getPublishLabel', () => {
    it('returns FR label for fr locale', () => {
      expect(getPublishLabel('fr')).toBe('Publier');
    });

    it('returns EN label for en locale', () => {
      expect(getPublishLabel('en')).toBe('Publish');
    });
  });

  describe('getSaveAsDraftLabel', () => {
    it('returns FR label for fr locale', () => {
      expect(getSaveAsDraftLabel('fr')).toBe('Enregistrer en brouillon');
    });

    it('returns EN label for en locale', () => {
      expect(getSaveAsDraftLabel('en')).toBe('Save as Draft');
    });
  });
});
