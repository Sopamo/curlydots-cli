import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function loadPackageManifest() {
  const packagePath = path.resolve(process.cwd(), 'package.json');
  return JSON.parse(readFileSync(packagePath, 'utf8')) as {
    name: string;
    private: boolean;
    bin: Record<string, string>;
    files: string[];
    dependencies?: Record<string, string>;
    publishConfig?: {
      access?: string;
    };
  };
}

describe('distribution/package-manifest', () => {
  it('publishes under @curlydots/cli and is not private', () => {
    const manifest = loadPackageManifest();

    expect(manifest.name).toBe('@curlydots/cli');
    expect(manifest.private).toBe(false);
  });

  it('uses Node launcher as bin entrypoint', () => {
    const manifest = loadPackageManifest();

    expect(manifest.bin.curlydots).toBe('bin/curlydots.js');
  });

  it('ships binary launcher and vendor payload with public access', () => {
    const manifest = loadPackageManifest();

    expect(manifest.files).toContain('bin');
    expect(manifest.files).toContain('vendor');
    expect(manifest.publishConfig?.access).toBe('public');
  });

  it('declares react-devtools-core for Bun compile compatibility with ink', () => {
    const manifest = loadPackageManifest();

    expect(manifest.dependencies).toBeDefined();
    expect(manifest.dependencies?.['react-devtools-core']).toBeDefined();
  });
});
