/**
 * Progress Bar View Component
 *
 * Displays a progress bar for tasks with progress tracking.
 */

import { Box, Text } from 'ink';
import type * as React from 'react';
import { useAnalysisStore } from '../../stores';

/** Progress bar width in characters */
const PROGRESS_BAR_WIDTH = 30;

/**
 * Render a text-based progress bar
 */
function ProgressBarInner({
  progress,
  label,
}: {
  progress: number;
  label: string;
}): React.ReactElement {
  const filled = Math.round((progress / 100) * PROGRESS_BAR_WIDTH);
  const empty = PROGRESS_BAR_WIDTH - filled;

  return (
    <Box flexDirection="column">
      <Text color="gray">{label}</Text>
      <Box>
        <Text color="green">{'█'.repeat(filled)}</Text>
        <Text color="gray">{'░'.repeat(empty)}</Text>
        <Text> {progress}%</Text>
      </Box>
    </Box>
  );
}

/**
 * Progress bar view for active long-running tasks
 *
 * Shows progress bar only for find_code_context and find_translation_context tasks
 */
export function ProgressBarView(): React.ReactElement | null {
  const tasks = useAnalysisStore((s) => s.tasks);
  const activeTaskId = useAnalysisStore((s) => s.activeTaskId);

  // Only show progress bar for specific tasks
  if (activeTaskId !== 'find_code_context' && activeTaskId !== 'find_translation_context') {
    return null;
  }

  const activeTask = tasks.find((t) => t.id === activeTaskId);
  if (!activeTask || activeTask.progress === undefined) {
    return null;
  }

  return (
    <Box marginTop={1} marginBottom={1}>
      <ProgressBarInner progress={activeTask.progress} label={activeTask.label} />
    </Box>
  );
}
