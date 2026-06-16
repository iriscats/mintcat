#!/usr/bin/env node
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcTauri = path.join(root, 'src-tauri');
const cargoTargetDir = process.env.CARGO_TARGET_DIR || path.join(srcTauri, 'target');
const target = process.env.INTEGRATOR_TARGET || process.argv[2] || '';
const isWindowsTarget = target.includes('windows');
const builtRuntimeFileName = isWindowsTarget
  ? 'mintcat_integrator.dll'
  : process.platform === 'darwin'
    ? 'libmintcat_integrator.dylib'
    : 'libmintcat_integrator.so';
const bundledRuntimeFileName = isWindowsTarget
  ? 'mintcat_backend_runtime.dll'
  : process.platform === 'darwin'
    ? 'libmintcat_backend_runtime.dylib'
    : 'libmintcat_backend_runtime.so';

function run(command, args, options = {}) {
  console.log(`[integrator-runtime] ${command} ${args.join(' ')}`);
  execFileSync(command, args, {
    cwd: srcTauri,
    stdio: 'inherit',
    ...options,
  });
}

function buildRuntime() {
  const cargoArgs = ['build', '--release', '-p', 'mintcat-integrator-ffi'];
  if (target) {
    cargoArgs.push('--target', target);
  }

  if (isWindowsTarget && process.platform !== 'win32') {
    run('cargo', ['xwin', ...cargoArgs]);
  } else {
    run('cargo', cargoArgs);
  }
}

function artifactPath() {
  const releaseDir = target
    ? path.join(cargoTargetDir, target, 'release')
    : path.join(cargoTargetDir, 'release');
  return path.join(releaseDir, builtRuntimeFileName);
}

function packageRuntime() {
  const artifact = artifactPath();
  if (!existsSync(artifact)) {
    throw new Error(`runtime artifact not found: ${artifact}`);
  }

  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const version = pkg.version || '0.0.0';
  const releaseDir = path.join(root, 'release', 'backend-runtime');
  mkdirSync(releaseDir, { recursive: true });
  const releaseName = isWindowsTarget
    ? `mintcat_backend_runtime_${version}_x64.dll`
    : bundledRuntimeFileName.replace('backend_runtime', `backend_runtime_${version}_x64`);
  const releasePath = path.join(releaseDir, releaseName);
  copyFileSync(artifact, releasePath);

  const assetDir = path.join(srcTauri, 'assets', 'plugins');
  mkdirSync(assetDir, { recursive: true });
  const assetPath = path.join(assetDir, bundledRuntimeFileName);
  copyFileSync(releasePath, assetPath);

  console.log(`[backend-runtime] bundled resource: ${path.relative(root, assetPath)}`);
  console.log(`[backend-runtime] release artifact: ${path.relative(root, releasePath)} (${statSync(releasePath).size} bytes)`);
}

try {
  buildRuntime();
  packageRuntime();
} catch (error) {
  console.error('[backend-runtime] error:', error.message || error);
  process.exit(1);
}
