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

  it('uses the full release pipeline with build, staging, release, smoke, and npm publish jobs', () => {
    const workflow = loadReleaseWorkflow();

    expect(workflow).toContain('jobs:');
    expect(workflow).toContain('build:');
    expect(workflow).toContain('stage-npm:');
    expect(workflow).toContain('release:');
    expect(workflow).toContain('install-smoke:');
    expect(workflow).toContain('publish-npm:');
    expect(workflow).not.toContain('Publish npm package (debug)');
    expect(workflow).toContain('uses: oven-sh/setup-bun@v2');
    expect(workflow).toContain('bun-version: 1.3.8');
    expect(workflow).toContain('runner: ubuntu-latest');
    expect(workflow).toContain('runner: ubuntu-24.04-arm');
    expect(workflow).toContain('runner: macos-latest');
    expect(workflow).toContain('runner: windows-latest');
    expect(workflow).toContain('target_triple: x86_64-unknown-linux-musl');
    expect(workflow).toContain('target_triple: aarch64-unknown-linux-musl');
    expect(workflow).toContain('target_triple: x86_64-apple-darwin');
    expect(workflow).toContain('target_triple: aarch64-apple-darwin');
    expect(workflow).toContain('target_triple: x86_64-pc-windows-msvc');
    expect(workflow).toContain('node scripts/distribution/stage-npm-package.mjs');
    expect(workflow).toContain('node scripts/distribution/release-check.mjs');
    expect(workflow).toContain('uses: softprops/action-gh-release@v2');
    expect(workflow).toContain('uses: ./.github/workflows/install-smoke.yml');
    expect(workflow).toContain('name: Remove npm token configuration');
    expect(workflow).toContain('name: Publish tarball with OIDC');
    expect(workflow).toContain(
      'npx --yes npm@latest publish "./dist/npm/package" --provenance --access public --registry https://registry.npmjs.org/',
    );
    expect(workflow).toContain('npm config delete "//registry.npmjs.org/:_authToken" --location=user || true');
  });
});
