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

  it('should show parsing source status', () => {
    analysisStore.getState().setStatus('parsing_source');

    const { lastFrame } = render(<ProgressView />);

    expect(lastFrame()).toContain('Parsing source');
  });

  it('should show parsing target status', () => {
    analysisStore.getState().setStatus('parsing_target');

    const { lastFrame } = render(<ProgressView />);

    expect(lastFrame()).toContain('Parsing target');
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
