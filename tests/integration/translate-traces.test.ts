import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const TEST_FIXTURES_DIR = join(import.meta.dir, '../fixtures/traces-test');
const TEST_INPUT_CSV = join(TEST_FIXTURES_DIR, 'traces-input.csv');
const TEST_OUTPUT_CSV = join(TEST_FIXTURES_DIR, 'traces-output.csv');

// Mock OpenAI to return reasoning content and usage
const mockCreate = mock(() =>
  Promise.resolve({
    output_text: JSON.stringify({ translated_value: 'Übersetzter Text' }),
    output: [
      {
        type: 'reasoning',
        summary: [
          { text: 'This is the reasoning trace from the LLM explaining the translation decision.' },
        ],
      },
    ],
    usage: {
      input_tokens: 1000,
      output_tokens: 200,
      output_tokens_details: { reasoning_tokens: 150 },
      total_tokens: 1200,
    },
  }),
);

mock.module('openai', () => ({
  default: class {
    responses = {
      create: mockCreate,
    };
  },
}));

describe('translate-traces integration', () => {
  beforeEach(() => {
    // Clean and create test directory
    if (existsSync(TEST_FIXTURES_DIR)) {
      rmSync(TEST_FIXTURES_DIR, { recursive: true });
    }
    mkdirSync(TEST_FIXTURES_DIR, { recursive: true });
    mockCreate.mockClear();
    process.env.OPENAI_API_KEY = 'test-key-for-traces';
  });

  afterEach(() => {
    // Cleanup test files
    if (existsSync(TEST_FIXTURES_DIR)) {
      rmSync(TEST_FIXTURES_DIR, { recursive: true });
    }
  });

  it('should create trace files when --traces is enabled', async () => {
    const inputContent = `translation_key,source_value,source_language,target_language,code_context,translation_context
users.title,Users,en,de,"[]","[]"
users.show_all,Show all users,en,de,"[]","[]"`;

    await Bun.write(TEST_INPUT_CSV, inputContent);

    const { runTranslate } = await import('../../src/commands/translate');

    await runTranslate({
      inputPath: TEST_INPUT_CSV,
      outputPath: TEST_OUTPUT_CSV,
      concurrency: 1,
      force: false,
      yes: true,
      traces: true, // Enable traces
    });

    // Find the reasoning-traces directory
    const tracesBaseDir = join(TEST_FIXTURES_DIR, 'reasoning-traces');
    expect(existsSync(tracesBaseDir)).toBe(true);

    // Should have a timestamped subdirectory
    const subDirs = readdirSync(tracesBaseDir);
    expect(subDirs.length).toBe(1);

    const traceDir = join(tracesBaseDir, subDirs[0]!);

    // Should have 2 trace files (one per key)
    const traceFiles = readdirSync(traceDir);
    expect(traceFiles.length).toBe(2);

    // Check file names
    expect(traceFiles).toContain('users.title.txt');
    expect(traceFiles).toContain('users.show_all.txt');
  });

  it('should include metadata header in trace files', async () => {
    const inputContent = `translation_key,source_value,source_language,target_language,code_context,translation_context
test.key,Test Value,en,de,"[]","[]"`;

    await Bun.write(TEST_INPUT_CSV, inputContent);

    const { runTranslate } = await import('../../src/commands/translate');

    await runTranslate({
      inputPath: TEST_INPUT_CSV,
      outputPath: TEST_OUTPUT_CSV,
      concurrency: 1,
      force: false,
      yes: true,
      traces: true,
    });

    // Find the trace file
    const tracesBaseDir = join(TEST_FIXTURES_DIR, 'reasoning-traces');
    const subDirs = readdirSync(tracesBaseDir);
    const traceDir = join(tracesBaseDir, subDirs[0]!);
    const traceFile = join(traceDir, 'test.key.txt');

    const content = readFileSync(traceFile, 'utf-8');

    // Verify header content
    expect(content).toContain('=== Translation Reasoning Trace ===');
    expect(content).toContain('Key: test.key');
    expect(content).toContain('Source: "Test Value"');
    expect(content).toContain('Source Language: en');
    expect(content).toContain('Target Language: de');
    expect(content).toContain('Translated: "Übersetzter Text"');
  });

  it('should NOT create trace files when --traces is not set', async () => {
    const inputContent = `translation_key,source_value,source_language,target_language,code_context,translation_context
users.title,Users,en,de,"[]","[]"`;

    await Bun.write(TEST_INPUT_CSV, inputContent);

    const { runTranslate } = await import('../../src/commands/translate');

    await runTranslate({
      inputPath: TEST_INPUT_CSV,
      outputPath: TEST_OUTPUT_CSV,
      concurrency: 1,
      force: false,
      yes: true,
      traces: false, // Traces disabled
    });

    // reasoning-traces directory should NOT exist
    const tracesBaseDir = join(TEST_FIXTURES_DIR, 'reasoning-traces');
    expect(existsSync(tracesBaseDir)).toBe(false);
  });

  it('should create separate timestamped directories for each run', async () => {
    const inputContent = `translation_key,source_value,source_language,target_language,code_context,translation_context
key1,Value 1,en,de,"[]","[]"`;

    await Bun.write(TEST_INPUT_CSV, inputContent);

    const { runTranslate } = await import('../../src/commands/translate');

    // First run
    await runTranslate({
      inputPath: TEST_INPUT_CSV,
      outputPath: TEST_OUTPUT_CSV,
      concurrency: 1,
      force: true,
      yes: true,
      traces: true,
    });

    // Wait a second to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Second run
    await runTranslate({
      inputPath: TEST_INPUT_CSV,
      outputPath: TEST_OUTPUT_CSV,
      concurrency: 1,
      force: true,
      yes: true,
      traces: true,
    });

    const tracesBaseDir = join(TEST_FIXTURES_DIR, 'reasoning-traces');
    const subDirs = readdirSync(tracesBaseDir);

    // Should have 2 separate timestamped directories
    expect(subDirs.length).toBe(2);
  });

  it('should handle keys with special characters', async () => {
    const inputContent = `translation_key,source_value,source_language,target_language,code_context,translation_context
path/to/key,Value,en,de,"[]","[]"`;

    await Bun.write(TEST_INPUT_CSV, inputContent);

    const { runTranslate } = await import('../../src/commands/translate');

    await runTranslate({
      inputPath: TEST_INPUT_CSV,
      outputPath: TEST_OUTPUT_CSV,
      concurrency: 1,
      force: false,
      yes: true,
      traces: true,
    });

    const tracesBaseDir = join(TEST_FIXTURES_DIR, 'reasoning-traces');
    const subDirs = readdirSync(tracesBaseDir);
    const traceDir = join(tracesBaseDir, subDirs[0]!);
    const traceFiles = readdirSync(traceDir);

    // File should exist with sanitized name
    expect(traceFiles).toContain('path_to_key.txt');
  });
});
