import { describe, expect, it, mock } from 'bun:test';
import path from 'node:path';

const CLI_ROOT = path.resolve(import.meta.dir, '../../..');

async function loadPackageManifest() {
  mock.restore();
  const packagePath = path.resolve(CLI_ROOT, 'package.json');
  return JSON.parse(await Bun.file(packagePath).text()) as {
    name: string;
    private: boolean;
    bin: Record<string, string>;
    files: string[];
    repository?: {
      type?: string;
      url?: string;
    };
    dependencies?: Record<string, string>;
    publishConfig?: {
      access?: string;
    };
  };
}

describe('distribution/package-manifest', () => {
  it('publishes under @curlydots/cli and is not private', async () => {
    const manifest = await loadPackageManifest();

    expect(manifest.name).toBe('@curlydots/cli');
    expect(manifest.private).toBe(false);
  });

  it('uses native binary placeholder as bin entrypoint', async () => {
    const manifest = await loadPackageManifest();

    expect(manifest.bin.curlydots).toBe('bin/curlydots.exe');
  });

  it('ships binary placeholder and installer script with public access', async () => {
    const manifest = await loadPackageManifest();

    expect(manifest.files).toContain('bin');
    expect(manifest.files).toContain('scripts/distribution/install-native-binary.cjs');
    expect(manifest.publishConfig?.access).toBe('public');
  });

  it('declares react-devtools-core for Bun compile compatibility with ink', async () => {
    const manifest = await loadPackageManifest();

    expect(manifest.dependencies).toBeDefined();
    expect(manifest.dependencies?.['react-devtools-core']).toBeDefined();
  });

  it('declares repository metadata required for npm provenance verification', async () => {
    const manifest = await loadPackageManifest();

    expect(manifest.repository?.type).toBe('git');
    expect(manifest.repository?.url).toBe('https://github.com/Sopamo/curlydots-cli');
  });
});
