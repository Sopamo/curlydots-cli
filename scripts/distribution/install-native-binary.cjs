#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync } = require('node:fs');
const path = require('node:path');
const process = require('node:process');

const WINDOWS_ARM64_UNSUPPORTED_MESSAGE =
  'Windows ARM64 is currently unsupported because Bun cannot compile target bun-windows-arm64 as of February 7, 2026.';

const PLATFORM_PACKAGE_TARGETS = [
  {
    packageName: '@curlydots/cli-linux-x64',
    os: 'linux',
    cpu: 'x64',
    binarySubpath: 'bin/curlydots',
  },
  {
    packageName: '@curlydots/cli-linux-arm64',
    os: 'linux',
    cpu: 'arm64',
    binarySubpath: 'bin/curlydots',
  },
  {
    packageName: '@curlydots/cli-darwin-x64',
    os: 'darwin',
    cpu: 'x64',
    binarySubpath: 'bin/curlydots',
  },
  {
    packageName: '@curlydots/cli-darwin-arm64',
    os: 'darwin',
    cpu: 'arm64',
    binarySubpath: 'bin/curlydots',
  },
  {
    packageName: '@curlydots/cli-win32-x64',
    os: 'win32',
    cpu: 'x64',
    binarySubpath: 'bin/curlydots.exe',
  },
];

function resolveRuntimeTarget(platform = process.platform, arch = process.arch) {
  if (platform === 'win32' && arch === 'arm64') {
    throw new Error(WINDOWS_ARM64_UNSUPPORTED_MESSAGE);
  }

  const resolvedPlatform = platform === 'android' ? 'linux' : platform;
  const target = PLATFORM_PACKAGE_TARGETS.find(
    (candidate) => candidate.os === resolvedPlatform && candidate.cpu === arch,
  );

  if (!target) {
    throw new Error(`Unsupported platform: ${platform}/${arch}`);
  }

  return target;
}

function resolveBinaryFromInstalledPackage({
  packageRoot,
  target,
  requireResolve = require.resolve,
}) {
  const moduleSpecifier = `${target.packageName}/${target.binarySubpath}`;

  try {
    return requireResolve(moduleSpecifier, { paths: [packageRoot] });
  } catch {
    try {
      return requireResolve(moduleSpecifier);
    } catch {
      return null;
    }
  }
}

function readPackageVersion(packageRoot) {
  const manifestPath = path.join(packageRoot, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!manifest.version) {
    throw new Error(`Missing version in ${manifestPath}`);
  }

  return manifest.version;
}

function installMissingOptionalPackage({
  packageRoot,
  packageName,
  version,
  spawnSyncImpl = spawnSync,
}) {
  const result = spawnSyncImpl(
    'npm',
    [
      'install',
      '--no-save',
      '--prefer-offline',
      '--no-audit',
      '--progress=false',
      `${packageName}@${version}`,
    ],
    {
      cwd: packageRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        npm_config_global: undefined,
      },
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Failed to install fallback optional dependency ${packageName}@${version}`);
  }
}

function copyInstalledBinary({ sourcePath, destinationPath, platform = process.platform }) {
  mkdirSync(path.dirname(destinationPath), { recursive: true });
  copyFileSync(sourcePath, destinationPath);

  if (platform !== 'win32') {
    chmodSync(destinationPath, 0o755);
  }
}

function installNativeBinary({
  packageRoot = process.cwd(),
  platform = process.platform,
  arch = process.arch,
  requireResolve = require.resolve,
  spawnSyncImpl = spawnSync,
} = {}) {
  const target = resolveRuntimeTarget(platform, arch);
  const destinationPath = path.join(packageRoot, 'bin', 'curlydots.exe');

  let sourcePath = resolveBinaryFromInstalledPackage({
    packageRoot,
    target,
    requireResolve,
  });

  if (!sourcePath || !existsSync(sourcePath)) {
    const version = readPackageVersion(packageRoot);
    installMissingOptionalPackage({
      packageRoot,
      packageName: target.packageName,
      version,
      spawnSyncImpl,
    });

    sourcePath = resolveBinaryFromInstalledPackage({
      packageRoot,
      target,
      requireResolve,
    });
  }

  if (!sourcePath || !existsSync(sourcePath)) {
    throw new Error(
      `Unable to resolve native package ${target.packageName}. Reinstall without --ignore-scripts and without omitting optional dependencies.`,
    );
  }

  copyInstalledBinary({
    sourcePath,
    destinationPath,
    platform,
  });

  return {
    destinationPath,
    sourcePath,
    packageName: target.packageName,
  };
}

module.exports = {
  PLATFORM_PACKAGE_TARGETS,
  WINDOWS_ARM64_UNSUPPORTED_MESSAGE,
  copyInstalledBinary,
  installMissingOptionalPackage,
  installNativeBinary,
  resolveBinaryFromInstalledPackage,
  resolveRuntimeTarget,
};

if (require.main === module) {
  try {
    const result = installNativeBinary();
    console.log(
      `[curlydots] installed native binary from ${result.packageName} (${result.sourcePath} -> ${result.destinationPath})`,
    );
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
