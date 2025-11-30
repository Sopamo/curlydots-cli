import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  calculateCost,
  createTraceConfig,
  formatTrace,
  generateTimestamp,
  sanitizeFilename,
  writeTrace,
} from '../../../src/services/trace-writer';
import type { ReasoningTrace } from '../../../src/types';

const TEST_OUTPUT_DIR = join(import.meta.dir, '../../fixtures/trace-test-output');

describe('trace-writer', () => {
  beforeEach(() => {
    // Clean up test directory
    if (existsSync(TEST_OUTPUT_DIR)) {
      rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
    mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up after tests
    if (existsSync(TEST_OUTPUT_DIR)) {
      rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  describe('sanitizeFilename', () => {
    it('should return simple keys unchanged', () => {
      expect(sanitizeFilename('users.show_all')).toBe('users.show_all.txt');
    });

    it('should replace forward slashes with underscores', () => {
      expect(sanitizeFilename('path/to/key')).toBe('path_to_key.txt');
    });

    it('should replace backslashes with underscores', () => {
      expect(sanitizeFilename('path\\to\\key')).toBe('path_to_key.txt');
    });

    it('should replace colons with underscores', () => {
      expect(sanitizeFilename('namespace:key')).toBe('namespace_key.txt');
    });

    it('should replace multiple invalid characters', () => {
      expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j.txt');
    });

    it('should truncate very long keys with hash suffix', () => {
      const longKey = 'a'.repeat(250);
      const result = sanitizeFilename(longKey);
      expect(result.length).toBeLessThanOrEqual(210);
      expect(result).toEndWith('.txt');
      expect(result).toContain('_'); // Hash separator
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost based on GPT-5.1 pricing', () => {
      // $2/1M input, $8/1M output
      const cost = calculateCost(1_000_000, 1_000_000);
      expect(cost).toBe(10.0); // $2 + $8
    });

    it('should return small values for typical API calls', () => {
      // Typical translation: ~1000 input, ~200 output
      const cost = calculateCost(1000, 200);
      expect(cost).toBeCloseTo(0.0036, 4); // $0.002 + $0.0016
    });

    it('should return 0 for 0 tokens', () => {
      expect(calculateCost(0, 0)).toBe(0);
    });
  });

  describe('formatTrace', () => {
    const defaultTokenUsage = {
      inputTokens: 1250,
      outputTokens: 148,
      reasoningTokens: 128,
      totalTokens: 1398,
      estimatedCostUsd: 0.004184,
    };

    it('should format trace with header block and cost section', () => {
      const trace: ReasoningTrace = {
        translationKey: 'users.show_all',
        sourceValue: 'Show all users',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        timestamp: '2025-11-29T14:30:00Z',
        reasoningContent: 'This is the reasoning content.',
        translatedValue: 'Alle Benutzer anzeigen',
        codeContext: 'File: src/App.vue (line 10)\n  <span>{{ t("users.show_all") }}</span>',
        translationContext: 'users.title: "Users" → "Benutzer"',
        tokenUsage: defaultTokenUsage,
      };

      const result = formatTrace(trace);

      expect(result).toContain('=== Translation Reasoning Trace ===');
      expect(result).toContain('Key: users.show_all');
      expect(result).toContain('Source: "Show all users"');
      expect(result).toContain('Source Language: en');
      expect(result).toContain('Target Language: de');
      expect(result).toContain('Timestamp: 2025-11-29T14:30:00Z');
      expect(result).toContain('Translated: "Alle Benutzer anzeigen"');
      // Cost section
      expect(result).toContain('=== Cost ===');
      expect(result).toContain('Input Tokens: 1250');
      expect(result).toContain('Output Tokens: 148');
      expect(result).toContain('Reasoning Tokens: 128');
      expect(result).toContain('Total Tokens: 1398');
      expect(result).toContain('Estimated Cost: $0.004184');
      // Context sections
      expect(result).toContain('=== Code Context ===');
      expect(result).toContain('File: src/App.vue (line 10)');
      expect(result).toContain('=== Translation Context ===');
      expect(result).toContain('users.title: "Users" → "Benutzer"');
      expect(result).toContain('=== Reasoning ===');
      expect(result).toContain('This is the reasoning content.');
    });

    it('should handle empty reasoning with placeholder', () => {
      const trace: ReasoningTrace = {
        translationKey: 'test.key',
        sourceValue: 'Test',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        timestamp: '2025-11-29T14:30:00Z',
        reasoningContent: '',
        translatedValue: 'Test',
        codeContext: '',
        translationContext: '',
        tokenUsage: defaultTokenUsage,
      };

      const result = formatTrace(trace);

      expect(result).toContain('[No reasoning trace available');
      expect(result).toContain('[No code context available]');
      expect(result).toContain('[No translation context available]');
      // Cost section should still be present
      expect(result).toContain('=== Cost ===');
    });
  });

  describe('generateTimestamp', () => {
    it('should return filesystem-safe ISO timestamp', () => {
      const timestamp = generateTimestamp();

      // Should not contain colons (filesystem-safe)
      expect(timestamp).not.toContain(':');

      // Should be in format YYYY-MM-DDTHH-MM-SS
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
    });
  });

  describe('createTraceConfig', () => {
    it('should create trace config with correct paths', () => {
      const config = createTraceConfig(TEST_OUTPUT_DIR);

      expect(config.enabled).toBe(true);
      expect(config.outputDir).toBe(TEST_OUTPUT_DIR);
      expect(config.runTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
      expect(config.traceDir).toContain('reasoning-traces');
      expect(config.traceDir).toContain(config.runTimestamp);
    });
  });

  describe('writeTrace', () => {
    const defaultTokenUsage = {
      inputTokens: 100,
      outputTokens: 50,
      reasoningTokens: 30,
      totalTokens: 150,
      estimatedCostUsd: 0.0006,
    };

    it('should write trace file to disk', async () => {
      const config = createTraceConfig(TEST_OUTPUT_DIR);
      const trace: ReasoningTrace = {
        translationKey: 'test.key',
        sourceValue: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        timestamp: '2025-11-29T14:30:00Z',
        reasoningContent: 'Translation reasoning here.',
        translatedValue: 'Hallo',
        codeContext: '',
        translationContext: '',
        tokenUsage: defaultTokenUsage,
      };

      await writeTrace(config, trace);

      const expectedPath = join(config.traceDir, 'test.key.txt');
      expect(existsSync(expectedPath)).toBe(true);

      const content = readFileSync(expectedPath, 'utf-8');
      expect(content).toContain('Key: test.key');
      expect(content).toContain('Translation reasoning here.');
    });

    it('should create trace directory if it does not exist', async () => {
      const config = createTraceConfig(TEST_OUTPUT_DIR);
      const trace: ReasoningTrace = {
        translationKey: 'new.key',
        sourceValue: 'New',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        timestamp: '2025-11-29T14:30:00Z',
        reasoningContent: 'Reasoning.',
        translatedValue: 'Neu',
        codeContext: '',
        translationContext: '',
        tokenUsage: defaultTokenUsage,
      };

      // Directory should not exist yet
      expect(existsSync(config.traceDir)).toBe(false);

      await writeTrace(config, trace);

      // Directory should now exist
      expect(existsSync(config.traceDir)).toBe(true);
    });

    it('should handle keys with special characters', async () => {
      const config = createTraceConfig(TEST_OUTPUT_DIR);
      const trace: ReasoningTrace = {
        translationKey: 'path/to/key:special',
        sourceValue: 'Special',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        timestamp: '2025-11-29T14:30:00Z',
        reasoningContent: 'Reasoning.',
        translatedValue: 'Spezial',
        codeContext: '',
        translationContext: '',
        tokenUsage: defaultTokenUsage,
      };

      await writeTrace(config, trace);

      // File should exist with sanitized name
      const expectedPath = join(config.traceDir, 'path_to_key_special.txt');
      expect(existsSync(expectedPath)).toBe(true);
    });
  });
});
