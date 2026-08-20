import { selectNextPrimary, normalizeAiCode } from './ai-specialty.util';

describe('ai-specialty.util', () => {
  describe('normalizeAiCode', () => {
    it('trims and lowercases Infermedica ids', () => {
      expect(normalizeAiCode(' SP_12 ')).toBe('sp_12');
      expect(normalizeAiCode('sp_4')).toBe('sp_4');
    });
  });

  describe('selectNextPrimary', () => {
    const mapping = (
      id: string,
      opts: {
        primary?: boolean;
        active?: boolean;
        sort?: number;
        created?: number;
      },
    ) => ({
      mapping_id: id,
      is_primary: opts.primary ?? false,
      is_active: opts.active ?? true,
      sort_order: opts.sort ?? 0,
      createdAt: new Date(opts.created ?? 0),
    });

    it('keeps the active primary when present', () => {
      const next = selectNextPrimary([
        mapping('a', { sort: 0, created: 1 }),
        mapping('b', { primary: true, sort: 10, created: 2 }),
      ]);
      expect(next?.mapping_id).toBe('b');
    });

    it('ignores inactive primary and picks remaining by sort_order then createdAt', () => {
      const next = selectNextPrimary([
        mapping('inactive-primary', { primary: true, active: false, sort: 0 }),
        mapping('later', { sort: 20, created: 20 }),
        mapping('earlier', { sort: 10, created: 50 }),
      ]);
      expect(next?.mapping_id).toBe('earlier');
    });

    it('returns undefined when no active mapping remains', () => {
      expect(
        selectNextPrimary([mapping('x', { primary: true, active: false })]),
      ).toBeUndefined();
    });
  });
});
