#!/usr/bin/env node
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const proxyRoot = process.env.MINTCAT_PROXY_ROOT || path.join(root, 'mintcat-proxy');
const presetOrTarget = process.env.PROXY_TARGET || process.argv[2] || '';
const build = resolveBuildTarget(presetOrTarget);
const target = build.target;
const cargoTargetDir = process.env.CARGO_TARGET_DIR || path.join(proxyRoot, 'target');
const isWindowsTarget = build.platform === 'windows';
const platformName = build.platform;
const archName = build.arch;
const runtimeFileName = isWindowsTarget ? 'mintcat-proxy.exe' : 'mintcat-proxy';

function resolveBuildTarget(value) {
  const normalized = (value || '').trim().toLowerCase();
  const hostPlatform = process.platform === 'darwin'
    ? 'macos'
    : process.platform === 'win32'
      ? 'windows'
      : process.platform;
  const hostArch = process.arch === 'arm64' ? 'aarch64' : 'x64';

  switch (normalized) {
    case '':
      return { target: '', platform: hostPlatform, arch: hostArch };
    case 'windows':
    case 'win':
    case 'win-x64':
    case 'windows-x64':
      return { target: 'x86_64-pc-windows-gnu', platform: 'windows', arch: 'x64' };
    case 'mac':
    case 'macos':
      return { target: '', platform: 'macos', arch: hostArch };
    case 'mac-x64':
    case 'macos-x64':
      return { target: 'x86_64-apple-darwin', platform: 'macos', arch: 'x64' };
    case 'mac-arm64':
    case 'macos-arm64':
    case 'mac-aarch64':
    case 'macos-aarch64':
      return { target: 'aarch64-apple-darwin', platform: 'macos', arch: 'aarch64' };
    default:
      return {
        target: value,
        platform: normalized.includes('windows')
          ? 'windows'
          : normalized.includes('apple-darwin')
            ? 'macos'
            : hostPlatform,
        arch: normalized.includes('aarch64') || normalized.includes('arm64') ? 'aarch64' : 'x64',
      };
  }
}

function run(command, args, options = {}) {
  console.log(`[proxy-runtime] ${command} ${args.join(' ')}`);
  execFileSync(command, args, {
    cwd: proxyRoot,
    stdio: 'inherit',
    ...options,
  });
}

function buildRuntime() {
  if (!existsSync(path.join(proxyRoot, 'Cargo.toml'))) {
    throw new Error(`mintcat-proxy Cargo.toml not found: ${proxyRoot}`);
  }

  const cargoArgs = ['build', '--release'];
  if (target) {
    cargoArgs.push('--target', target);
  }
  run('cargo', cargoArgs);
}

function artifactPath() {
  const releaseDir = target
    ? path.join(cargoTargetDir, target, 'release')
    : path.join(cargoTargetDir, 'release');
  return path.join(releaseDir, runtimeFileName);
}

function packageRuntime() {
  const artifact = artifactPath();
  if (!existsSync(artifact)) {
    throw new Error(`proxy runtime artifact not found: ${artifact}`);
  }

  const cargoToml = readFileSync(path.join(proxyRoot, 'Cargo.toml'), 'utf8');
  const version = cargoToml.match(/version\s*=\s*"([^"]+)"/)?.[1] || '0.0.0';
  const releaseDir = path.join(root, 'release', 'proxy');
  mkdirSync(releaseDir, { recursive: true });
  const releaseName = `mintcat_proxy_${version}_${platformName}_${archName}${isWindowsTarget ? '.exe' : ''}`;
  const releasePath = path.join(releaseDir, releaseName);
  copyFileSync(artifact, releasePath);

  const assetDir = path.join(root, 'src-tauri', 'assets', 'plugins', 'proxy');
  mkdirSync(assetDir, { recursive: true });
  const assetPath = path.join(assetDir, runtimeFileName);
  copyFileSync(releasePath, assetPath);

  console.log(`[proxy-runtime] bundled resource: ${path.relative(root, assetPath)}`);
  console.log(`[proxy-runtime] release artifact: ${path.relative(root, releasePath)} (${statSync(releasePath).size} bytes)`);
}

try {
  buildRuntime();
  packageRuntime();
} catch (error) {
  console.error('[proxy-runtime] error:', error.message || error);
  process.exit(1);
}
