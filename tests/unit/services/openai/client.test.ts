import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  createOpenAIClient,
  resetClient,
  validateApiKey,
} from '../../../../src/services/openai/client';

describe('openai/client', () => {
  let originalApiKey: string | undefined;

  beforeEach(() => {
    originalApiKey = process.env.OPENAI_API_KEY;
    resetClient();
  });

  afterEach(() => {
    if (originalApiKey) {
      process.env.OPENAI_API_KEY = originalApiKey;
    } else {
      process.env.OPENAI_API_KEY = undefined;
    }
    resetClient();
  });

  describe('createOpenAIClient', () => {
    it('should create client with API key from environment', () => {
      process.env.OPENAI_API_KEY = 'test-api-key';

      const client = createOpenAIClient();
      expect(client).toBeDefined();
    });

    it('should throw if OPENAI_API_KEY is not set', () => {
      process.env.OPENAI_API_KEY = undefined;

      expect(() => createOpenAIClient()).toThrow('OPENAI_API_KEY');
    });

    it('should return same instance on subsequent calls', () => {
      process.env.OPENAI_API_KEY = 'test-api-key';

      const client1 = createOpenAIClient();
      const client2 = createOpenAIClient();
      expect(client1).toBe(client2);
    });
  });

  describe('validateApiKey', () => {
    it('should not throw if OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'test-api-key';

      expect(() => validateApiKey()).not.toThrow();
    });

    it('should throw if OPENAI_API_KEY is not set', () => {
      process.env.OPENAI_API_KEY = undefined;

      expect(() => validateApiKey()).toThrow('OPENAI_API_KEY');
    });
  });

  // Note: translateText requires actual API calls which we skip in unit tests.
  // Integration tests with mocked responses cover the translation flow.
});
