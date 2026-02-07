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

  it('keeps publish job free from setup-node tokenized npmrc config', () => {
    const workflow = loadReleaseWorkflow();

    expect(workflow).not.toMatch(/publish-npm:[\s\S]*?registry-url:\s*https:\/\/registry\.npmjs\.org/);
    expect(workflow).toContain('name: Clear setup-node npm auth environment');
    expect(workflow).toContain('echo "NODE_AUTH_TOKEN=" >> "$GITHUB_ENV"');
    expect(workflow).toContain('echo "NPM_CONFIG_USERCONFIG=" >> "$GITHUB_ENV"');
    expect(workflow).toContain('name: Remove npm token configuration');
    expect(workflow).toContain('npm config delete "//registry.npmjs.org/:_authToken" --location=user || true');
  });
});
