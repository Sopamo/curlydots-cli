import { describe, expect, it, mock } from 'bun:test';
import path from 'node:path';

const CLI_ROOT = path.resolve(import.meta.dir, '../../..');

async function loadCiWorkflow() {
  mock.restore();
  const workflowPath = path.resolve(CLI_ROOT, '.github/workflows/ci.yml');
  return Bun.file(workflowPath).text();
}

describe('distribution/ci-workflow', () => {
  it('keeps compile smoke and verifies runtime version from compiled binary', async () => {
    const workflow = await loadCiWorkflow();

    expect(workflow).toContain('name: Compile smoke via distribution script');
    expect(workflow).toContain('--bun-target bun-linux-x64');
    expect(workflow).toContain('--target-triple x86_64-unknown-linux-musl');
    expect(workflow).toContain('name: Verify compiled binary version matches package version');
    expect(workflow).toContain('dist/ci-extract/curlydots --version');
    expect(workflow).toContain('Expected compiled binary version v${EXPECTED_VERSION}, got: $OUTPUT');
  });
});
