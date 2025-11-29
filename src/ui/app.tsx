/**
 * Ink App Root
 *
 * Main TUI application component that coordinates views based on analysis state.
 */

import { Box, Text } from 'ink';
import type * as React from 'react';
import { useAnalysisStore } from '../stores';
import type { Config } from '../types';
import { ChecklistView, ConfigSummaryView, ProgressBarView } from './views';

interface AppProps {
  /** Configuration to display */
  config: Config;
}

/**
 * Completion summary component
 */
function CompletionSummary({ outputPath }: { outputPath: string }): React.ReactElement {
  const sourceKeyCount = useAnalysisStore((s) => s.sourceKeyCount);
  const targetKeyCount = useAnalysisStore((s) => s.targetKeyCount);
  const missingCount = useAnalysisStore((s) => s.missingCount);

  return (
    <Box flexDirection="column" marginTop={1} borderStyle="single" paddingX={1}>
      <Text bold color="green">
        ✅ Analysis Complete
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Text>
          <Text color="gray">Source keys: </Text>
          <Text>{sourceKeyCount}</Text>
        </Text>
        <Text>
          <Text color="gray">Target keys: </Text>
          <Text>{targetKeyCount}</Text>
        </Text>
        <Text>
          <Text color="gray">Missing: </Text>
          <Text color="yellow">{missingCount}</Text>
        </Text>
        <Text>
          <Text color="gray">Output: </Text>
          <Text color="cyan">{outputPath}</Text>
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Main TUI application component
 */
export function App({ config }: AppProps): React.ReactElement {
  const status = useAnalysisStore((s) => s.status);
  const error = useAnalysisStore((s) => s.error);

  return (
    <Box flexDirection="column">
      {/* Configuration summary at top */}
      <ConfigSummaryView config={config} />

      {/* Task checklist */}
      <ChecklistView />

      {/* Progress bar for long-running tasks */}
      <ProgressBarView />

      {/* Error display */}
      {status === 'error' && error && (
        <Box marginTop={1}>
          <Text color="red">❌ Error: {error}</Text>
        </Box>
      )}

      {/* Completion summary */}
      {status === 'complete' && <CompletionSummary outputPath={config.outputPath} />}
    </Box>
  );
}
