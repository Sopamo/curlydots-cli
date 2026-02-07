import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function loadReleaseWorkflow() {
  const workflowPath = path.resolve(process.cwd(), '.github/workflows/release.yml');
  return readFileSync(workflowPath, 'utf8');
}

describe('distribution/release-workflow', () => {
  it('grants workflow-level OIDC permissions required for trusted npm publishing', () => {
    const workflow = loadReleaseWorkflow();

    expect(workflow).toMatch(/\npermissions:\n  contents: read\n  id-token: write\n/);
  });

  it('configures setup-node with npm registry URL in publish job', () => {
    const workflow = loadReleaseWorkflow();

    expect(workflow).toMatch(
      /publish-npm:[\s\S]*?Setup Node\.js[\s\S]*?actions\/setup-node@v4[\s\S]*?registry-url:\s*https:\/\/registry\.npmjs\.org/,
    );
  });
});
