/**
 * Helper utilities for the application
 */

import { useI18n } from 'vue-i18n';

/**
 * Get a translated error message
 * Uses translation keys from the generic namespace
 */
export function getErrorMessage(errorType: 'notFound' | 'serverError'): string {
  const { t } = useI18n();

  if (errorType === 'notFound') {
    return t('generic.errors.notFound');
  }

  if (errorType === 'serverError') {
    return t('generic.errors.serverError');
  }

  return t('generic.errors.notFound');
}

/**
 * Format a notification message
 */
export function formatNotification(count: number): string {
  const { t } = useI18n();
  const label = t('generic.settings.notifications');
  return `${label}: ${count}`;
}

/**
 * Get the save button label
 */
export function getSaveLabel(): string {
  const { t } = useI18n();
  return t('generic.save');
}

/**
 * Get the cancel button label
 */
export function getCancelLabel(): string {
  const { t } = useI18n();
  return t('generic.cancel');
}
