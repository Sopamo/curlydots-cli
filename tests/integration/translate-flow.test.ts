import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const TEST_FIXTURES_DIR = join(import.meta.dir, '../fixtures');
const TEST_INPUT_CSV = join(TEST_FIXTURES_DIR, 'integration-input.csv');
const TEST_OUTPUT_CSV = join(TEST_FIXTURES_DIR, 'integration-output.csv');

// Mock OpenAI to avoid actual API calls
const mockCreate = mock(() =>
  Promise.resolve({
    output_text: JSON.stringify({ translated_value: 'Übersetzter Text' }),
    output: [
      {
        type: 'reasoning',
        summary: [{ text: 'Mock reasoning trace for testing.' }],
      },
    ],
    usage: {
      input_tokens: 500,
      output_tokens: 100,
      output_tokens_details: { reasoning_tokens: 80 },
      total_tokens: 600,
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

describe('translate-flow integration', () => {
  beforeEach(() => {
    if (!existsSync(TEST_FIXTURES_DIR)) {
      mkdirSync(TEST_FIXTURES_DIR, { recursive: true });
    }
    mockCreate.mockClear();
    // Set up mock API key
    process.env.OPENAI_API_KEY = 'test-key-for-integration';
  });

  afterEach(() => {
    // Cleanup test files
    for (const file of [TEST_INPUT_CSV, TEST_OUTPUT_CSV]) {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    }
  });

  it('should translate CSV file end-to-end', async () => {
    // Create input CSV
    const inputContent = `translation_key,source_value,source_language,target_language,code_context,translation_context
users.title,Users,en,de,"[]","[]"
users.show_all,Show all users,en,de,"[]","[]"`;

    await Bun.write(TEST_INPUT_CSV, inputContent);

    // Import and run translate (dynamic import after mocking)
    const { runTranslate } = await import('../../src/commands/translate');

    await runTranslate({
      inputPath: TEST_INPUT_CSV,
      outputPath: TEST_OUTPUT_CSV,
      concurrency: 1,
      force: false,
      yes: true, // Skip confirmation
      traces: false,
    });

    // Verify output file exists
    expect(existsSync(TEST_OUTPUT_CSV)).toBe(true);

    // Verify output content
    const outputContent = await Bun.file(TEST_OUTPUT_CSV).text();
    expect(outputContent).toContain('translated_value');
    expect(outputContent).toContain('Übersetzter Text');

    // Verify API was called for each row
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('should skip rows with existing translated_value', async () => {
    const inputContent = `translation_key,source_value,source_language,target_language,code_context,translation_context,translated_value
key1,Value 1,en,de,"[]","[]","Already translated"
key2,Value 2,en,de,"[]","[]",""`;

    await Bun.write(TEST_INPUT_CSV, inputContent);

    const { runTranslate } = await import('../../src/commands/translate');

    await runTranslate({
      inputPath: TEST_INPUT_CSV,
      outputPath: TEST_OUTPUT_CSV,
      concurrency: 1,
      force: false,
      yes: true,
      traces: false,
    });

    // Should only call API for the row without translated_value
    expect(mockCreate).toHaveBeenCalledTimes(1);

    // Output should preserve the already translated value
    const outputContent = await Bun.file(TEST_OUTPUT_CSV).text();
    expect(outputContent).toContain('Already translated');
  });

  it('should force re-translate all rows with --force', async () => {
    const inputContent = `translation_key,source_value,source_language,target_language,code_context,translation_context,translated_value
key1,Value 1,en,de,"[]","[]","Old translation"
key2,Value 2,en,de,"[]","[]","Another old one"`;

    await Bun.write(TEST_INPUT_CSV, inputContent);

    const { runTranslate } = await import('../../src/commands/translate');

    await runTranslate({
      inputPath: TEST_INPUT_CSV,
      outputPath: TEST_OUTPUT_CSV,
      concurrency: 1,
      force: true, // Force re-translate
      yes: true,
      traces: false,
    });

    // Should call API for both rows
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('should preserve original row order in output', async () => {
    const inputContent = `translation_key,source_value,source_language,target_language,code_context,translation_context
key_c,Value C,en,de,"[]","[]"
key_a,Value A,en,de,"[]","[]"
key_b,Value B,en,de,"[]","[]"`;

    await Bun.write(TEST_INPUT_CSV, inputContent);

    const { runTranslate } = await import('../../src/commands/translate');

    await runTranslate({
      inputPath: TEST_INPUT_CSV,
      outputPath: TEST_OUTPUT_CSV,
      concurrency: 5, // Parallel execution
      force: false,
      yes: true,
      traces: false,
    });

    const outputContent = await Bun.file(TEST_OUTPUT_CSV).text();
    const lines = outputContent.trim().split('\n');

    // Header + 3 data rows
    expect(lines.length).toBe(4);

    // Verify order is preserved (key_c, key_a, key_b)
    expect(lines[1]).toContain('key_c');
    expect(lines[2]).toContain('key_a');
    expect(lines[3]).toContain('key_b');
  });

  it('should add translated_value as last column', async () => {
    const inputContent = `translation_key,source_value,source_language,target_language,code_context,translation_context
key1,Value,en,de,"[]","[]"`;

    await Bun.write(TEST_INPUT_CSV, inputContent);

    const { runTranslate } = await import('../../src/commands/translate');

    await runTranslate({
      inputPath: TEST_INPUT_CSV,
      outputPath: TEST_OUTPUT_CSV,
      concurrency: 1,
      force: false,
      yes: true,
      traces: false,
    });

    const outputContent = await Bun.file(TEST_OUTPUT_CSV).text();
    const headerLine = outputContent.split('\n')[0];
    const headers = headerLine?.split(',') || [];

    // translated_value should be the last header
    expect(headers[headers.length - 1]).toContain('translated_value');
  });

  it('should handle empty CSV gracefully', async () => {
    const inputContent =
      'translation_key,source_value,source_language,target_language,code_context,translation_context';

    await Bun.write(TEST_INPUT_CSV, inputContent);

    const { runTranslate } = await import('../../src/commands/translate');

    // Should not throw, just complete with no translations
    await expect(
      runTranslate({
        inputPath: TEST_INPUT_CSV,
        outputPath: TEST_OUTPUT_CSV,
        concurrency: 1,
        force: false,
        yes: true,
        traces: false,
      }),
    ).resolves.toBeUndefined();

    // No API calls for empty file
    expect(mockCreate).toHaveBeenCalledTimes(0);
  });
});
