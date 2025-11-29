import { beforeEach, describe, expect, it } from 'bun:test';
import { configStore } from '../../../src/stores/config';

describe('configStore', () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    configStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have empty repoPath', () => {
      expect(configStore.getState().repoPath).toBe('');
    });

    it('should have empty translationsDir', () => {
      expect(configStore.getState().translationsDir).toBe('');
    });

    it('should have empty sourceLanguage', () => {
      expect(configStore.getState().sourceLanguage).toBe('');
    });

    it('should have empty targetLanguage', () => {
      expect(configStore.getState().targetLanguage).toBe('');
    });

    it('should have node-module as default parser', () => {
      expect(configStore.getState().parser).toBe('node-module');
    });

    it('should have default extensions', () => {
      const extensions = configStore.getState().extensions;
      expect(extensions).toContain('.js');
      expect(extensions).toContain('.ts');
      expect(extensions).toContain('.tsx');
      expect(extensions).toContain('.vue');
    });

    it('should have default output path', () => {
      expect(configStore.getState().outputPath).toBe('missing-translations.csv');
    });
  });

  describe('setConfig', () => {
    it('should update repoPath', () => {
      configStore.getState().setConfig({ repoPath: '/test/repo' });
      expect(configStore.getState().repoPath).toBe('/test/repo');
    });

    it('should update multiple fields at once', () => {
      configStore.getState().setConfig({
        repoPath: '/test/repo',
        sourceLanguage: 'en',
        targetLanguage: 'de',
      });

      const state = configStore.getState();
      expect(state.repoPath).toBe('/test/repo');
      expect(state.sourceLanguage).toBe('en');
      expect(state.targetLanguage).toBe('de');
    });

    it('should preserve other fields when updating', () => {
      configStore.getState().setConfig({ repoPath: '/test/repo' });
      configStore.getState().setConfig({ sourceLanguage: 'en' });

      const state = configStore.getState();
      expect(state.repoPath).toBe('/test/repo');
      expect(state.sourceLanguage).toBe('en');
    });
  });

  describe('reset', () => {
    it('should reset all fields to defaults', () => {
      configStore.getState().setConfig({
        repoPath: '/test/repo',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        parser: 'custom-parser',
      });

      configStore.getState().reset();

      const state = configStore.getState();
      expect(state.repoPath).toBe('');
      expect(state.sourceLanguage).toBe('');
      expect(state.targetLanguage).toBe('');
      expect(state.parser).toBe('node-module');
    });
  });
});
