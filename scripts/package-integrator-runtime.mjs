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
const runtimeFileName = isWindowsTarget
  ? 'mintcat_integrator.dll'
  : process.platform === 'darwin'
    ? 'libmintcat_integrator.dylib'
    : 'libmintcat_integrator.so';

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
  return path.join(releaseDir, runtimeFileName);
}

function packageRuntime() {
  const artifact = artifactPath();
  if (!existsSync(artifact)) {
    throw new Error(`runtime artifact not found: ${artifact}`);
  }

  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const version = pkg.version || '0.0.0';
  const releaseDir = path.join(root, 'release', 'integrator');
  mkdirSync(releaseDir, { recursive: true });
  const releaseName = `mintcat_integrator_${version}_x64.dll`;
  const releasePath = path.join(releaseDir, releaseName);
  copyFileSync(artifact, releasePath);

  const assetDir = path.join(srcTauri, 'assets', 'plugins');
  mkdirSync(assetDir, { recursive: true });
  const assetPath = path.join(assetDir, runtimeFileName);
  copyFileSync(releasePath, assetPath);

  console.log(`[integrator-runtime] bundled resource: ${path.relative(root, assetPath)}`);
  console.log(`[integrator-runtime] release artifact: ${path.relative(root, releasePath)} (${statSync(releasePath).size} bytes)`);
}

try {
  buildRuntime();
  packageRuntime();
} catch (error) {
  console.error('[integrator-runtime] error:', error.message || error);
  process.exit(1);
}
