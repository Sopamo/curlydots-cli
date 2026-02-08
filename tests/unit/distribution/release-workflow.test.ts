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

    expect(workflow).toMatch(/\npermissions:\n {2}contents: read\n {2}id-token: write\n/);
  });

  it('uses the full release pipeline with build, staging, release, smoke, and npm publish jobs', () => {
    const workflow = loadReleaseWorkflow();

    expect(workflow).toContain('jobs:');
    expect(workflow).toContain('build:');
    expect(workflow).toContain('stage-packages:');
    expect(workflow).toContain('release:');
    expect(workflow).toContain('publish-npm:');
    expect(workflow).toContain('install-smoke:');
    expect(workflow).toContain('uses: oven-sh/setup-bun@v2');
    expect(workflow).toContain('bun-version: 1.3.8');
    expect(workflow).toContain('name: Sync package version from release tag');
    expect(workflow).toContain('npm pkg set "version=${VERSION}"');
    expect(workflow).toContain('name: Build ${{ matrix.platform_id }}');
    expect(workflow).toContain('runner: ubuntu-latest');
    expect(workflow).toContain('runner: ubuntu-24.04-arm');
    expect(workflow).toContain('runner: macos-latest');
    expect(workflow).toContain('runner: windows-latest');
    expect(workflow).toContain('platform_id: linux-x64');
    expect(workflow).toContain('platform_id: linux-arm64');
    expect(workflow).toContain('platform_id: darwin-x64');
    expect(workflow).toContain('platform_id: darwin-arm64');
    expect(workflow).toContain('platform_id: win32-x64');
    expect(workflow).toContain('target_triple: x86_64-unknown-linux-musl');
    expect(workflow).toContain('target_triple: aarch64-unknown-linux-musl');
    expect(workflow).toContain('target_triple: x86_64-apple-darwin');
    expect(workflow).toContain('target_triple: aarch64-apple-darwin');
    expect(workflow).toContain('target_triple: x86_64-pc-windows-msvc');
    expect(workflow).toContain('node scripts/distribution/stage-platform-packages.mjs');
    expect(workflow).toContain('node scripts/distribution/stage-main-package.mjs');
    expect(workflow).toContain('node scripts/distribution/release-check.mjs');
    expect(workflow).toContain('uses: softprops/action-gh-release@v2');
    expect(workflow).toContain('uses: ./.github/workflows/install-smoke.yml');
    expect(workflow).toContain('name: Publish platform npm packages with OIDC');
    expect(workflow).toContain('name: Publish main npm package with OIDC');
    expect(workflow).toContain('platform-packages-metadata.json');
    expect(workflow).toContain('main-package-metadata.json');
    expect(workflow).toContain(
      'npx --yes npm@latest publish "dist/npm/$tarball" --provenance --access public --registry https://registry.npmjs.org/',
    );
    expect(workflow).toContain(
      'npx --yes npm@latest publish "dist/npm/${MAIN_TARBALL}" --provenance --access public --registry https://registry.npmjs.org/',
    );
  });
});
