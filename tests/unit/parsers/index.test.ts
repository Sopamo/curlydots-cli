import { beforeEach, describe, expect, it } from 'bun:test';
import { clearParsers, getAvailableParsers, getParser, registerParser } from '../../../src/parsers';
import type { Parser } from '../../../src/types';

describe('parser registry', () => {
  // Mock parser for testing
  const mockParser: Parser = {
    name: 'mock-parser',
    parse: async () => new Map([['test.key', 'Test Value']]),
  };

  const anotherParser: Parser = {
    name: 'another-parser',
    parse: async () => new Map(),
  };

  beforeEach(() => {
    clearParsers();
  });

  describe('registerParser', () => {
    it('should register a parser', () => {
      registerParser(mockParser);
      expect(getParser('mock-parser')).toBe(mockParser);
    });

    it('should register multiple parsers', () => {
      registerParser(mockParser);
      registerParser(anotherParser);

      expect(getParser('mock-parser')).toBe(mockParser);
      expect(getParser('another-parser')).toBe(anotherParser);
    });

    it('should overwrite parser with same name', () => {
      const updatedParser: Parser = {
        name: 'mock-parser',
        parse: async () => new Map([['updated', 'value']]),
      };

      registerParser(mockParser);
      registerParser(updatedParser);

      expect(getParser('mock-parser')).toBe(updatedParser);
    });
  });

  describe('getParser', () => {
    it('should return undefined for unknown parser', () => {
      expect(getParser('unknown')).toBeUndefined();
    });

    it('should return registered parser', () => {
      registerParser(mockParser);
      expect(getParser('mock-parser')).toBe(mockParser);
    });
  });

  describe('getAvailableParsers', () => {
    it('should return empty array when no parsers registered', () => {
      expect(getAvailableParsers()).toEqual([]);
    });

    it('should return list of registered parser names', () => {
      registerParser(mockParser);
      registerParser(anotherParser);

      const available = getAvailableParsers();
      expect(available).toContain('mock-parser');
      expect(available).toContain('another-parser');
      expect(available.length).toBe(2);
    });
  });

  describe('clearParsers', () => {
    it('should remove all registered parsers', () => {
      registerParser(mockParser);
      registerParser(anotherParser);

      clearParsers();

      expect(getParser('mock-parser')).toBeUndefined();
      expect(getParser('another-parser')).toBeUndefined();
      expect(getAvailableParsers()).toEqual([]);
    });
  });
});
