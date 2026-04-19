/**
 * Progress View Component
 *
 * Displays analysis progress with status, progress bar, and current key.
 */

import { Box, Text } from 'ink';
import type * as React from 'react';
import { useAnalysisStore } from '../../stores';
import type { AnalysisStatus } from '../../types';

/** Status display configuration */
const STATUS_DISPLAY: Record<AnalysisStatus, { label: string; color: string }> = {
  idle: { label: '⏳ Waiting...', color: 'gray' },
  parsing_translations: { label: '📖 Parsing translation keys...', color: 'yellow' },
  comparing: { label: '🔍 Comparing translation sets...', color: 'cyan' },
  searching_context: { label: '🔎 Searching for code context...', color: 'blue' },
  searching_translation_context: {
    label: '🔎 Searching for translation context...',
    color: 'blue',
  },
  writing_csv: { label: '📝 Writing CSV output...', color: 'magenta' },
  complete: { label: '✅ Complete!', color: 'green' },
  error: { label: '❌ Error', color: 'red' },
};

/** Progress bar width in characters */
const PROGRESS_BAR_WIDTH = 30;

/**
 * Render a text-based progress bar
 */
function ProgressBar({ progress }: { progress: number }): React.ReactElement {
  const filled = Math.round((progress / 100) * PROGRESS_BAR_WIDTH);
  const empty = PROGRESS_BAR_WIDTH - filled;

  return (
    <Box>
      <Text color="green">{'█'.repeat(filled)}</Text>
      <Text color="gray">{'░'.repeat(empty)}</Text>
      <Text> {progress}%</Text>
    </Box>
  );
}

/**
 * Main progress view component
 */
export function ProgressView(): React.ReactElement {
  const status = useAnalysisStore((s) => s.status);
  const progress = useAnalysisStore((s) => s.progress);
  const currentKey = useAnalysisStore((s) => s.currentKey);
  const sourceKeyCount = useAnalysisStore((s) => s.sourceKeyCount);
  const targetKeyCount = useAnalysisStore((s) => s.targetKeyCount);
  const missingCount = useAnalysisStore((s) => s.missingCount);
  const error = useAnalysisStore((s) => s.error);

  const statusConfig = STATUS_DISPLAY[status];

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🔍 Translation Context Analyzer
        </Text>
      </Box>

      {/* Status */}
      <Box marginBottom={1}>
        <Text color={statusConfig.color as never}>{statusConfig.label}</Text>
      </Box>

      {/* Progress bar (shown during searching) */}
      {status === 'searching_context' && (
        <Box marginBottom={1}>
          <ProgressBar progress={progress} />
        </Box>
      )}

      {/* Current key (shown during searching) */}
      {status === 'searching_context' && currentKey && (
        <Box marginBottom={1}>
          <Text color="gray">Processing: </Text>
          <Text>{currentKey}</Text>
        </Box>
      )}

      {/* Counts (shown during comparing or after) */}
      {(status === 'comparing' ||
        status === 'searching_context' ||
        status === 'writing_csv' ||
        status === 'complete') && (
        <Box flexDirection="column" marginBottom={1}>
          <Text>
            <Text color="gray">Source keys: </Text>
            <Text>{sourceKeyCount}</Text>
          </Text>
          <Text>
            <Text color="gray">Target keys: </Text>
            <Text>{targetKeyCount}</Text>
          </Text>
          <Text>
            <Text color="yellow">Missing: </Text>
            <Text bold color="yellow">
              {missingCount}
            </Text>
          </Text>
        </Box>
      )}

      {/* Error message */}
      {status === 'error' && error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      {/* Complete summary */}
      {status === 'complete' && (
        <Box marginTop={1}>
          <Text color="green">{missingCount} missing translations exported</Text>
        </Box>
      )}
    </Box>
  );
}
