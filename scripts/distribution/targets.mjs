export const WINDOWS_ARM64_UNSUPPORTED_MESSAGE =
  'Windows ARM64 is currently unsupported because Bun cannot compile target bun-windows-arm64 as of February 7, 2026.';

export const PLATFORM_PACKAGE_TARGETS = [
  {
    packageName: '@curlydots/cli-linux-x64',
    targetTriple: 'x86_64-unknown-linux-musl',
    bunTarget: 'bun-linux-x64',
    artifact: 'curlydots-x86_64-unknown-linux-musl.tar.gz',
    os: 'linux',
    cpu: 'x64',
    binarySubpath: 'bin/curlydots',
    binaryName: 'curlydots',
  },
  {
    packageName: '@curlydots/cli-linux-arm64',
    targetTriple: 'aarch64-unknown-linux-musl',
    bunTarget: 'bun-linux-arm64',
    artifact: 'curlydots-aarch64-unknown-linux-musl.tar.gz',
    os: 'linux',
    cpu: 'arm64',
    binarySubpath: 'bin/curlydots',
    binaryName: 'curlydots',
  },
  {
    packageName: '@curlydots/cli-darwin-x64',
    targetTriple: 'x86_64-apple-darwin',
    bunTarget: 'bun-darwin-x64',
    artifact: 'curlydots-x86_64-apple-darwin.tar.gz',
    os: 'darwin',
    cpu: 'x64',
    binarySubpath: 'bin/curlydots',
    binaryName: 'curlydots',
  },
  {
    packageName: '@curlydots/cli-darwin-arm64',
    targetTriple: 'aarch64-apple-darwin',
    bunTarget: 'bun-darwin-arm64',
    artifact: 'curlydots-aarch64-apple-darwin.tar.gz',
    os: 'darwin',
    cpu: 'arm64',
    binarySubpath: 'bin/curlydots',
    binaryName: 'curlydots',
  },
  {
    packageName: '@curlydots/cli-win32-x64',
    targetTriple: 'x86_64-pc-windows-msvc',
    bunTarget: 'bun-windows-x64',
    artifact: 'curlydots-x86_64-pc-windows-msvc.zip',
    os: 'win32',
    cpu: 'x64',
    binarySubpath: 'bin/curlydots.exe',
    binaryName: 'curlydots.exe',
  },
];

export const PLATFORM_PACKAGE_NAMES = PLATFORM_PACKAGE_TARGETS.map((target) => target.packageName);

export function resolveRuntimeTarget(platform, arch) {
  if (platform === 'win32' && arch === 'arm64') {
    throw new Error(WINDOWS_ARM64_UNSUPPORTED_MESSAGE);
  }

  const resolvedPlatform = platform === 'android' ? 'linux' : platform;
  const match = PLATFORM_PACKAGE_TARGETS.find(
    (target) => target.os === resolvedPlatform && target.cpu === arch,
  );

  if (!match) {
    throw new Error(`Unsupported platform: ${platform}/${arch}`);
  }

  return match;
}

export function findTargetByPackageName(packageName) {
  return PLATFORM_PACKAGE_TARGETS.find((target) => target.packageName === packageName) ?? null;
}

export function findTargetByTriple(targetTriple) {
  return PLATFORM_PACKAGE_TARGETS.find((target) => target.targetTriple === targetTriple) ?? null;
}
