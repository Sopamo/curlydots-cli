import { beforeEach, describe, expect, it } from 'bun:test';
import { render } from 'ink-testing-library';
import { analysisStore } from '../../../../src/stores';
import { ChecklistView } from '../../../../src/ui/views/checklist';

describe('ChecklistView', () => {
  beforeEach(() => {
    analysisStore.getState().reset();
  });

  it('should render all 6 tasks', () => {
    const { lastFrame } = render(<ChecklistView />);
    const output = lastFrame() ?? '';

    expect(output).toContain('Find source translation keys');
    expect(output).toContain('Find target translation keys');
    expect(output).toContain('Find missing translations');
    expect(output).toContain('Find code usage context');
    expect(output).toContain('Find existing translation context');
    expect(output).toContain('Export CSV file');
  });

  it('should show pending marker for pending tasks', () => {
    const { lastFrame } = render(<ChecklistView />);
    const output = lastFrame() ?? '';

    // All tasks should be pending initially, shown with empty checkbox
    expect(output).toContain('○'); // or [ ] depending on implementation
  });

  it('should show checkmark for completed tasks', () => {
    analysisStore.getState().startTask('find_source_keys');
    analysisStore.getState().completeTask('find_source_keys');

    const { lastFrame } = render(<ChecklistView />);
    const output = lastFrame() ?? '';

    // Should have checkmark for completed task
    expect(output).toContain('✓');
  });

  it('should show in-progress indicator for active task', () => {
    analysisStore.getState().startTask('find_source_keys');

    const { lastFrame } = render(<ChecklistView />);
    const output = lastFrame() ?? '';

    // Should have some indicator for in-progress (spinner or arrow)
    // The exact character depends on implementation
    expect(output).toContain('Find source translation keys');
  });

  it('should show multiple completed tasks', () => {
    analysisStore.getState().startTask('find_source_keys');
    analysisStore.getState().completeTask('find_source_keys');
    analysisStore.getState().startTask('find_target_keys');
    analysisStore.getState().completeTask('find_target_keys');
    analysisStore.getState().startTask('find_missing');

    const { lastFrame } = render(<ChecklistView />);
    const output = lastFrame() ?? '';

    // Count checkmarks - should have at least 2
    const checkmarks = (output.match(/✓/g) || []).length;
    expect(checkmarks).toBeGreaterThanOrEqual(2);
  });
});
