import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function loadInstallSmokeWorkflow() {
  const workflowPath = path.resolve(process.cwd(), '.github/workflows/install-smoke.yml');
  return readFileSync(workflowPath, 'utf8');
}

describe('distribution/install-smoke-workflow', () => {
  it('uses pwsh for Windows install and verification steps', () => {
    const workflow = loadInstallSmokeWorkflow();

    expect(workflow).toContain('name: Install CurlyDots globally from npm registry (with retry, Windows)');
    expect(workflow).toContain("if: runner.os == 'Windows'");
    expect(workflow).toContain('shell: pwsh');
    expect(workflow).toContain('for ($attempt = 1; $attempt -le 15; $attempt++)');
    expect(workflow).toContain('name: Verify version command (Windows)');
    expect(workflow).toContain('name: Verify help command (Windows)');
    expect(workflow).toContain('& $nativeBin --version');
    expect(workflow).toContain('& $nativeBin --help');
  });

  it('keeps native binary checks on both Unix and Windows', () => {
    const workflow = loadInstallSmokeWorkflow();

    expect(workflow).toContain('name: Verify command resolves to native binary on Unix');
    expect(workflow).toContain('file -L "$BIN_PATH"');
    expect(workflow).toContain('name: Verify command resolves to native binary on Windows');
    expect(workflow).toContain('Join-Path (npm root -g) "@curlydots/cli/bin/curlydots.exe"');
    expect(workflow).toContain('Expected Windows PE executable header (MZ)');
  });
});
