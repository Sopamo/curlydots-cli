import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function loadCiWorkflow() {
  const workflowPath = path.resolve(process.cwd(), '.github/workflows/ci.yml');
  return readFileSync(workflowPath, 'utf8');
}

describe('distribution/ci-workflow', () => {
  it('keeps compile smoke and verifies runtime version from compiled binary', () => {
    const workflow = loadCiWorkflow();

    expect(workflow).toContain('name: Compile smoke via distribution script');
    expect(workflow).toContain('--bun-target bun-linux-x64');
    expect(workflow).toContain('--target-triple x86_64-unknown-linux-musl');
    expect(workflow).toContain('name: Verify compiled binary version matches package version');
    expect(workflow).toContain('dist/ci-extract/curlydots --version');
    expect(workflow).toContain('Expected compiled binary version v${EXPECTED_VERSION}, got: $OUTPUT');
  });
});
