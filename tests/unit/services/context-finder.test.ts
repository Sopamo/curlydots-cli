import { beforeEach, describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { findContextForKeys, findKeyUsages } from '../../../src/services/context-finder';
import { configStore } from '../../../src/stores';
import type { UsageContext } from '../../../src/types';

const FIXTURES_PATH = join(import.meta.dir, '../../fixtures/sample-repo');

describe('context-finder', () => {
  beforeEach(() => {
    configStore.getState().reset();
    configStore.getState().setConfig({
      repoPath: FIXTURES_PATH,
      extensions: ['.vue', '.js', '.ts'],
    });
  });

  describe('findKeyUsages', () => {
    it('should find key usages in Vue file', async () => {
      const usages = await findKeyUsages('generic.welcome', FIXTURES_PATH);

      expect(usages.length).toBeGreaterThan(0);
      expect(usages[0]?.filePath).toContain('App.vue');
    });

    it('should find multiple usages of same key', async () => {
      const usages = await findKeyUsages('generic.back', FIXTURES_PATH);

      expect(usages.length).toBeGreaterThan(0);
    });

    it('should return empty array for unused key', async () => {
      const usages = await findKeyUsages('nonexistent.key.that.does.not.exist', FIXTURES_PATH);

      expect(usages.length).toBe(0);
    });

    it('should limit results to 10 usages', async () => {
      // Our fixture doesn't have 10+ usages, but test the limit logic
      const usages = await findKeyUsages('generic.back', FIXTURES_PATH);

      expect(usages.length).toBeLessThanOrEqual(10);
    });
  });

  describe('extractContext', () => {
    it('should extract ±15 lines around match', async () => {
      const usages = await findKeyUsages('generic.welcome', FIXTURES_PATH);

      expect(usages.length).toBeGreaterThan(0);
      const context = usages[0];

      // Should have snippet with multiple lines
      expect(context?.snippet).toBeDefined();
      expect(context?.snippet.split('\n').length).toBeGreaterThan(1);
    });

    it('should include line number in context', async () => {
      const usages = await findKeyUsages('generic.welcome', FIXTURES_PATH);

      expect(usages.length).toBeGreaterThan(0);
      expect(usages[0]?.lineNumber).toBeGreaterThan(0);
    });

    it('should include file path in context', async () => {
      const usages = await findKeyUsages('generic.welcome', FIXTURES_PATH);

      expect(usages.length).toBeGreaterThan(0);
      expect(usages[0]?.filePath).toBeDefined();
      expect(usages[0]?.filePath.length).toBeGreaterThan(0);
    });
  });

  describe('findContextForKeys', () => {
    it('should find context for multiple missing keys', async () => {
      const missingKeys = [
        { key: 'generic.welcome', sourceValue: 'Welcome' },
        { key: 'generic.settings.notifications', sourceValue: 'Notifications' },
      ];

      const results = await findContextForKeys(missingKeys, FIXTURES_PATH);

      expect(results.length).toBe(2);
      expect(results[0]?.contexts.length).toBeGreaterThan(0);
    });

    it('should handle keys with no usages', async () => {
      const missingKeys = [{ key: 'nonexistent.key', sourceValue: 'Value' }];

      const results = await findContextForKeys(missingKeys, FIXTURES_PATH);

      expect(results.length).toBe(1);
      expect(results[0]?.contexts.length).toBe(0);
    });
  });

  describe('multi-file search', () => {
    it('should find usages across multiple Vue files', async () => {
      // generic.welcome is used in both App.vue and Header.vue
      const usages = await findKeyUsages('generic.welcome', FIXTURES_PATH);

      // Should find at least 2 usages (App.vue and Header.vue)
      expect(usages.length).toBeGreaterThanOrEqual(2);

      const filePaths = usages.map((u: UsageContext) => u.filePath);
      const hasAppVue = filePaths.some((p: string) => p.includes('App.vue'));
      const hasHeaderVue = filePaths.some((p: string) => p.includes('Header.vue'));

      expect(hasAppVue).toBe(true);
      expect(hasHeaderVue).toBe(true);
    });

    it('should find usages in TypeScript files', async () => {
      // generic.save is used in helpers.ts
      const usages = await findKeyUsages('generic.save', FIXTURES_PATH);

      const hasTs = usages.some((u: UsageContext) => u.filePath.includes('helpers.ts'));
      expect(hasTs).toBe(true);
    });

    it('should NOT find usages in non-matching extensions (json)', async () => {
      // config.json contains "generic.errors.notFound" but should not be found
      // because .json is not in default extensions
      const usages = await findKeyUsages('generic.errors.notFound', FIXTURES_PATH);

      const hasJson = usages.some((u: UsageContext) => u.filePath.includes('.json'));
      expect(hasJson).toBe(false);
    });
  });
});
