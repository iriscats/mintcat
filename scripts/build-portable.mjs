#!/usr/bin/env node
/**
 * Windows 便携版（zip）：无需安装程序，解压后运行 mintcat.exe。
 * 与 release 相同交叉编译（cargo-xwin + x86_64-pc-windows-gnu），但关闭 NSIS 与更新产物。
 *
 * 产物：target/portable/mintcat_<version>_x64_portable.zip（内含 mintcat_<version>_x64_portable/ 目录）
 *
 * 用法：pnpm package:portable
 *
 * 说明：需本机已安装 WebView2 运行时（与安装版一致）；便携包不包含固定版 WebView2。
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'fs';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC_TAURI = join(ROOT, 'src-tauri');
const TARGET_TRIPLE = 'x86_64-pc-windows-gnu';
const RELEASE_DIR = join(SRC_TAURI, 'target', TARGET_TRIPLE, 'release');
const OO2_SRC = join(SRC_TAURI, 'assets', 'oo2core_9_win64.dll');
const INTEGRATOR_RUNTIME_SRC = join(SRC_TAURI, 'assets', 'plugins', 'mintcat_integrator.dll');
const PORTABLE_CONFIG = join(SRC_TAURI, 'tauri.portable.windows.conf.json');

function loadSigningKey() {
  const keyFile = process.env.TAURI_KEY_FILE || join(homedir(), '.tauri', 'mintcat.key');
  if (!process.env.TAURI_SIGNING_PRIVATE_KEY && existsSync(keyFile)) {
    process.env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(keyFile, 'utf8');
  }
}

function getVersion() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  return pkg.version || '0.0.0';
}

function ensureResources(releaseDir) {
  const resDir = join(releaseDir, 'resources');
  mkdirSync(resDir, { recursive: true });
  if (!existsSync(OO2_SRC)) {
    throw new Error(`未找到 Oodle DLL: ${OO2_SRC}`);
  }
  const dest = join(resDir, 'oo2core_9_win64.dll');
  copyFileSync(OO2_SRC, dest);
  console.log('[portable] 已复制:', dest);

  if (!existsSync(INTEGRATOR_RUNTIME_SRC)) {
    throw new Error(`未找到集成器运行时 DLL: ${INTEGRATOR_RUNTIME_SRC}`);
  }
  const integratorDir = join(resDir, 'plugins');
  mkdirSync(integratorDir, { recursive: true });
  const integratorDest = join(integratorDir, 'mintcat_integrator.dll');
  copyFileSync(INTEGRATOR_RUNTIME_SRC, integratorDest);
  console.log('[portable] 已复制:', integratorDest);
}

function zipPortable(releaseDir, outZip, rootDirName) {
  const exe = join(releaseDir, 'mintcat.exe');
  if (!existsSync(exe)) {
    throw new Error(`未找到可执行文件: ${exe}`);
  }
  if (existsSync(outZip)) rmSync(outZip, { force: true });

  const stageDir = join(dirname(outZip), `.${basename(outZip)}.tmp`);
  rmSync(stageDir, { recursive: true, force: true });
  mkdirSync(stageDir, { recursive: true });

  const rootDir = join(stageDir, rootDirName);
  mkdirSync(rootDir, { recursive: true });

  copyFileSync(exe, join(rootDir, 'mintcat.exe'));

  const webview2Loader = join(releaseDir, 'WebView2Loader.dll');
  if (existsSync(webview2Loader)) {
    copyFileSync(webview2Loader, join(rootDir, 'WebView2Loader.dll'));
  }

  const oodleDll = join(releaseDir, 'resources', 'oo2core_9_win64.dll');
  if (existsSync(oodleDll)) {
    copyFileSync(oodleDll, join(rootDir, 'oo2core_9_win64.dll'));
  }

  const integratorRuntime = join(releaseDir, 'resources', 'plugins', 'mintcat_integrator.dll');
  if (existsSync(integratorRuntime)) {
    const integratorDir = join(rootDir, 'plugins');
    mkdirSync(integratorDir, { recursive: true });
    copyFileSync(integratorRuntime, join(integratorDir, 'mintcat_integrator.dll'));
  }

  if (process.platform === 'win32') {
    const psRoot = rootDir.replace(/'/g, "''");
    const psOut = outZip.replace(/'/g, "''");
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -LiteralPath '${psRoot}' -DestinationPath '${psOut}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`cd "${stageDir}" && zip -q -r "${outZip}" "${rootDirName}"`, {
      stdio: 'inherit',
    });
  }

  rmSync(stageDir, { recursive: true, force: true });
  console.log('[portable] 已生成:', outZip);
}

function main() {
  loadSigningKey();

  if (!existsSync(PORTABLE_CONFIG)) {
    throw new Error(`未找到 ${PORTABLE_CONFIG}`);
  }

  const buildCmd = `pnpm exec tauri build --runner cargo-xwin --target ${TARGET_TRIPLE} --config ${JSON.stringify(PORTABLE_CONFIG)}`;
  execSync(`pnpm package:integrator-runtime`, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, INTEGRATOR_TARGET: TARGET_TRIPLE },
  });
  console.log('[portable] 构建:', buildCmd);
  execSync(buildCmd, { cwd: ROOT, stdio: 'inherit' });

  ensureResources(RELEASE_DIR);

  const version = getVersion();
  const outDir = join(ROOT, 'target', 'portable');
  mkdirSync(outDir, { recursive: true });
  const zipName = `mintcat_${version}_x64_portable.zip`;
  const outZip = join(outDir, zipName);
  const rootDirName = `mintcat_${version}_x64_portable`;
  zipPortable(RELEASE_DIR, outZip, rootDirName);

  console.log('[portable] 完成。版本:', version);
}

try {
  main();
} catch (e) {
  console.error('[portable] 错误:', e.message || e);
  process.exit(1);
}
