import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function loadReleaseWorkflow() {
  const workflowPath = path.resolve(process.cwd(), '.github/workflows/release.yml');
  return readFileSync(workflowPath, 'utf8');
}

function loadReleaseWorkflowBackup() {
  const workflowPath = path.resolve(process.cwd(), '.github/workflows/release.yml.bak');
  return readFileSync(workflowPath, 'utf8');
}

describe('distribution/release-workflow', () => {
  it('keeps a backup of the previous release workflow', () => {
    const workflow = loadReleaseWorkflowBackup();

    expect(workflow).toContain('name: Build ${{ matrix.target_triple }}');
    expect(workflow).toContain('name: Stage npm package');
  });

  it('grants workflow-level OIDC permissions required for trusted npm publishing', () => {
    const workflow = loadReleaseWorkflow();

    expect(workflow).toMatch(/\npermissions:\n  contents: read\n  id-token: write\n/);
  });

  it('uses minimal debug publish flow without setup-node', () => {
    const workflow = loadReleaseWorkflow();

    expect(workflow).toContain('name: Publish npm package (debug)');
    expect(workflow).not.toContain('actions/setup-node@v4');
    expect(workflow).toContain('uses: actions/checkout@v4');
    expect(workflow).toContain('name: Remove npm token configuration');
    expect(workflow).toContain('name: Stamp package version from tag');
    expect(workflow).toContain('npm pkg set version="${VERSION}"');
    expect(workflow).toContain('name: Publish package with trusted publishing');
    expect(workflow).toContain(
      'npx --yes npm@latest publish --provenance --access public --registry https://registry.npmjs.org/',
    );
    expect(workflow).toContain('npm config delete "//registry.npmjs.org/:_authToken" --location=user || true');
  });
});
