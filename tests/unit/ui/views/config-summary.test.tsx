import { describe, expect, it } from 'bun:test';
import { render } from 'ink-testing-library';
import { ConfigSummaryView } from '../../../../src/ui/views/config-summary';

describe('ConfigSummaryView', () => {
  it('renders configured translation directories', () => {
    const { lastFrame } = render(
      <ConfigSummaryView
        config={{
          repoPath: '/repo',
          translationsDirs: ['translations', 'modules/*/translations'],
          sourceLanguage: 'en',
          targetLanguage: 'de',
          parser: 'node-module',
          extensions: ['.ts'],
          outputPath: 'missing-translations.csv',
        }}
      />,
    );

    const output = lastFrame() ?? '';
    expect(output).toContain('translations, modules/*/translations');
  });
});
