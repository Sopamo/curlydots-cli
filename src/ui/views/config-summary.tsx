/**
 * Config Summary View Component
 *
 * Displays configuration summary at the top of the TUI.
 */

import { Box, Text } from 'ink';
import type * as React from 'react';
import type { Config } from '../../types';

interface ConfigSummaryProps {
  config: Config;
}

/**
 * Config summary showing repository and analysis settings
 */
export function ConfigSummaryView({ config }: ConfigSummaryProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1} borderStyle="single" paddingX={1}>
      <Text bold color="cyan">
        Configuration
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Text>
          <Text color="gray">Repository: </Text>
          <Text>{config.repoPath}</Text>
        </Text>
        <Text>
          <Text color="gray">Translations: </Text>
          <Text>{config.translationsDir}</Text>
        </Text>
        <Text>
          <Text color="gray">Languages: </Text>
          <Text>
            {config.sourceLanguage} → {config.targetLanguage}
          </Text>
        </Text>
        <Text>
          <Text color="gray">Parser: </Text>
          <Text>{config.parser}</Text>
        </Text>
        <Text>
          <Text color="gray">Output: </Text>
          <Text>{config.outputPath}</Text>
        </Text>
      </Box>
    </Box>
  );
}
