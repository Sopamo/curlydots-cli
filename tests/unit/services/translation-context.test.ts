import { describe, expect, it } from 'bun:test';
import {
  extractNouns,
  findTranslationContextForKey,
  findTranslationExamples,
} from '../../../src/services/translation-context';
import type { TranslationContextExample } from '../../../src/types';

describe('translation-context', () => {
  describe('extractNouns', () => {
    it('should extract nouns from simple sentence', () => {
      const nouns = extractNouns('Show all users');
      expect(nouns).toContain('users');
    });

    it('should extract multiple nouns', () => {
      const nouns = extractNouns('Delete selected notifications from settings');
      expect(nouns.length).toBeGreaterThanOrEqual(2);
      expect(nouns).toContain('notifications');
      expect(nouns).toContain('settings');
    });

    it('should normalize nouns to lowercase', () => {
      const nouns = extractNouns('Welcome User');
      const hasLowercase = nouns.every((n: string) => n === n.toLowerCase());
      expect(hasLowercase).toBe(true);
    });

    it('should return empty array for text without nouns', () => {
      const nouns = extractNouns('Go back');
      // "Go" and "back" are not nouns
      expect(nouns.length).toBe(0);
    });

    it('should deduplicate repeated nouns', () => {
      const nouns = extractNouns('User settings for user profile');
      const userCount = nouns.filter((n: string) => n === 'user').length;
      expect(userCount).toBeLessThanOrEqual(1);
    });

    it('should handle empty string', () => {
      const nouns = extractNouns('');
      expect(nouns).toEqual([]);
    });
  });

  describe('findTranslationExamples', () => {
    const sourceTranslations = new Map([
      ['admin.delete_users', 'Delete all users'],
      ['admin.show_users', 'Show all users'],
      ['admin.user_count', 'User count'],
      ['settings.notifications', 'Notifications'],
      ['settings.notification_settings', 'Notification settings'],
      ['generic.save', 'Save'],
      ['generic.cancel', 'Cancel'],
    ]);

    const targetTranslations = new Map([
      ['admin.delete_users', 'Alle Benutzer:innen löschen'],
      ['admin.show_users', 'Alle Benutzer:innen anzeigen'],
      ['admin.user_count', 'Benutzeranzahl'],
      ['settings.notifications', 'Benachrichtigungen'],
      ['settings.notification_settings', 'Benachrichtigungseinstellungen'],
      ['generic.save', 'Speichern'],
      ['generic.cancel', 'Abbrechen'],
    ]);

    it('should find examples for nouns in source value', () => {
      const nouns = ['users'];
      const examples = findTranslationExamples(nouns, sourceTranslations, targetTranslations);

      expect(examples.length).toBeGreaterThan(0);
      expect(examples[0]?.noun).toBe('users');
      expect(examples[0]?.targetValue).toContain('Benutzer');
    });

    it('should prioritize one example per noun first', () => {
      const nouns = ['users', 'notifications'];
      const examples = findTranslationExamples(nouns, sourceTranslations, targetTranslations, 10);

      // Should have at least one example for each noun
      const nounsWithExamples = new Set(examples.map((e: TranslationContextExample) => e.noun));
      expect(nounsWithExamples.has('users')).toBe(true);
      expect(nounsWithExamples.has('notifications')).toBe(true);
    });

    it('should limit to maxExamples', () => {
      const nouns = ['users'];
      const examples = findTranslationExamples(nouns, sourceTranslations, targetTranslations, 2);

      expect(examples.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array for nouns not in translations', () => {
      const nouns = ['elephants'];
      const examples = findTranslationExamples(nouns, sourceTranslations, targetTranslations);

      expect(examples.length).toBe(0);
    });

    it('should include sourceKey, sourceValue, and targetValue', () => {
      const nouns = ['users'];
      const examples = findTranslationExamples(nouns, sourceTranslations, targetTranslations);

      expect(examples.length).toBeGreaterThan(0);
      const example = examples[0] as TranslationContextExample;
      expect(example.sourceKey).toBeDefined();
      expect(example.sourceValue).toBeDefined();
      expect(example.targetValue).toBeDefined();
      expect(example.noun).toBe('users');
    });

    it('should not include keys that are not translated', () => {
      const partialTarget = new Map([
        ['admin.delete_users', 'Alle Benutzer:innen löschen'],
        // admin.show_users is NOT translated
      ]);

      const nouns = ['users'];
      const examples = findTranslationExamples(nouns, sourceTranslations, partialTarget);

      // Should only include keys that have translations
      const keys = examples.map((e: TranslationContextExample) => e.sourceKey);
      expect(keys).not.toContain('admin.show_users');
    });
  });

  describe('findTranslationContextForKey', () => {
    const sourceTranslations = new Map([
      ['admin.delete_users', 'Delete all users'],
      ['admin.show_users', 'Show all users'],
      ['settings.notifications', 'Notifications'],
    ]);

    const targetTranslations = new Map([
      ['admin.delete_users', 'Alle Benutzer:innen löschen'],
      ['settings.notifications', 'Benachrichtigungen'],
    ]);

    it('should find context for a missing key based on its source value', () => {
      // admin.show_users is missing (not in targetTranslations)
      const sourceValue = 'Show all users';
      const examples = findTranslationContextForKey(
        sourceValue,
        sourceTranslations,
        targetTranslations,
      );

      expect(examples.length).toBeGreaterThan(0);
      // Should find "users" noun example from admin.delete_users
      expect(examples.some((e: TranslationContextExample) => e.noun === 'users')).toBe(true);
    });

    it('should return empty array for source value with no matching nouns', () => {
      const sourceValue = 'Go back';
      const examples = findTranslationContextForKey(
        sourceValue,
        sourceTranslations,
        targetTranslations,
      );

      expect(examples.length).toBe(0);
    });
  });
});
