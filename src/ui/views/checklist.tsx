/**
 * Checklist View Component
 *
 * Displays task checklist with completion markers and in-progress indicators.
 */

import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type * as React from 'react';
import { useAnalysisStore } from '../../stores';
import type { TaskState } from '../../types';

/**
 * Render a single task item with status marker
 */
function TaskItem({ task }: { task: TaskState }): React.ReactElement {
  let marker: React.ReactElement;
  let textColor: string;

  switch (task.status) {
    case 'complete':
      marker = <Text color="green">✓</Text>;
      textColor = 'green';
      break;
    case 'in_progress':
      marker = (
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
      );
      textColor = 'cyan';
      break;
    default:
      marker = <Text color="gray">○</Text>;
      textColor = 'gray';
  }

  return (
    <Box>
      <Box marginRight={1}>{marker}</Box>
      <Text color={textColor as never}>{task.label}</Text>
    </Box>
  );
}

/**
 * Checklist view showing all tasks with status
 */
export function ChecklistView(): React.ReactElement {
  const tasks = useAnalysisStore((s) => s.tasks);

  return (
    <Box flexDirection="column" marginBottom={1}>
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </Box>
  );
}
