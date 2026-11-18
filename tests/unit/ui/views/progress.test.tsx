import { beforeEach, describe, expect, it } from 'bun:test';
import { render } from 'ink-testing-library';
import { analysisStore } from '../../../../src/stores';
import { ProgressView } from '../../../../src/ui/views/progress';

describe('ProgressView', () => {
  beforeEach(() => {
    analysisStore.getState().reset();
  });

  it('should render idle state', () => {
    const { lastFrame } = render(<ProgressView />);

    expect(lastFrame()).toContain('Translation Context Analyzer');
  });

  it('should show parsing translations status', () => {
    analysisStore.getState().setStatus('parsing_translations');

    const { lastFrame } = render(<ProgressView />);

    expect(lastFrame()).toContain('Parsing translation keys');
  });

  it('should show comparing status', () => {
    analysisStore.getState().setStatus('comparing');

    const { lastFrame } = render(<ProgressView />);

    expect(lastFrame()).toContain('Comparing');
  });

  it('should show searching context status', () => {
    analysisStore.getState().setStatus('searching_context');

    const { lastFrame } = render(<ProgressView />);

    expect(lastFrame()).toContain('Searching');
  });

  it('should show writing CSV status', () => {
    analysisStore.getState().setStatus('writing_csv');

    const { lastFrame } = render(<ProgressView />);

    expect(lastFrame()).toContain('Writing');
  });

  it('should show complete status', () => {
    analysisStore.getState().setStatus('complete');
    analysisStore.getState().setCounts(100, 90, 10);

    const { lastFrame } = render(<ProgressView />);

    expect(lastFrame()).toContain('Complete');
    expect(lastFrame()).toContain('10');
  });

  it('should show error status', () => {
    analysisStore.getState().setError('Test error message');

    const { lastFrame } = render(<ProgressView />);

    expect(lastFrame()).toContain('Error');
    expect(lastFrame()).toContain('Test error message');
  });

  it('should show progress percentage', () => {
    analysisStore.getState().setStatus('searching_context');
    analysisStore.getState().setProgress(50, 100);

    const { lastFrame } = render(<ProgressView />);

    expect(lastFrame()).toContain('50%');
  });

  it('should show current key being processed', () => {
    analysisStore.getState().setStatus('searching_context');
    analysisStore.getState().setCurrentKey('generic.welcome');

    const { lastFrame } = render(<ProgressView />);

    expect(lastFrame()).toContain('generic.welcome');
  });
});
