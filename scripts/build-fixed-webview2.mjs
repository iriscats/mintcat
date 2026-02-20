#!/usr/bin/env node
/**
 * MintCat fixed_webview2 打包脚本
 *
 * 将 WebView2 固定版本运行时内嵌到 Windows 安装包，适用于企业环境或无法安装 WebView2 的系统。
 *
 * 用法:
 *   node scripts/build-fixed-webview2.mjs [version]
 *   WEBVIEW2_VERSION=133.0.3065.92 node scripts/build-fixed-webview2.mjs
 *
 * 步骤:
 *   1. 下载 WebView2 FixedVersionRuntime（默认 133.0.3065.92）
 *   2. 解压到 src-tauri/Microsoft.WebView2.FixedVersionRuntime.x64/
 *   3. 使用 webview2.x64.json 替换 tauri.windows.conf.json
 *   4. 执行 tauri build
 *   5. 将产物重命名并加上 _fixed_webview2 后缀
 *   6. 恢复原始 tauri.windows.conf.json
 */

import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, copyFileSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC_TAURI = join(ROOT, 'src-tauri');
const WEBVIEW2_FOLDER_NAME = 'Microsoft.WebView2.FixedVersionRuntime.x64';
const WEBVIEW2_DIR = join(SRC_TAURI, WEBVIEW2_FOLDER_NAME);

// WebView2 固定版下载源：GitHub WebView2RuntimeArchive（提供 .cab，无 .zip）
const DEFAULT_VERSION = '133.0.3065.92';
const DOWNLOAD_BASE = 'https://github.com/westinyang/WebView2RuntimeArchive/releases/download';

function getVersion() {
  return process.env.WEBVIEW2_VERSION || process.argv[2] || DEFAULT_VERSION;
}

async function download(url) {
  const ext = url.endsWith('.cab') ? 'cab' : 'zip';
  const file = join(ROOT, 'target', 'webview2-fixed', `webview2-${getVersion()}.${ext}`);
  mkdirSync(dirname(file), { recursive: true });
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  const buf = await res.arrayBuffer();
  writeFileSync(file, Buffer.from(buf));
  return file;
}

/** 解压 .cab：Windows 用 expand，macOS/Linux 用 cabextract（需 brew install cabextract） */
function extractCab(cabPath, outDir) {
  mkdirSync(outDir, { recursive: true });
  if (process.platform === 'win32') {
    execSync(`expand "${cabPath}" -F:* "${outDir}"`, { stdio: 'inherit' });
  } else {
    try {
      execSync(`cabextract -d "${outDir}" "${cabPath}"`, { stdio: 'inherit' });
    } catch (e) {
      throw new Error(
        '解压 .cab 需要 cabextract。请安装后重试：brew install cabextract'
      );
    }
  }
}

function firstSubdir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const d = entries.find(e => e.isDirectory());
  return d ? join(dir, d.name) : null;
}

function main() {
  const version = getVersion();
  const cabUrl = `${DOWNLOAD_BASE}/${version}/Microsoft.WebView2.FixedVersionRuntime.${version}.x64.cab`;
  const windowsConf = join(SRC_TAURI, 'tauri.windows.conf.json');
  const fixedConf = join(SRC_TAURI, 'webview2.x64.json');
  const backupConf = join(SRC_TAURI, 'tauri.windows.conf.json.bak');
  const mainConf = join(SRC_TAURI, 'tauri.conf.json');
  const mainConfBackup = join(SRC_TAURI, 'tauri.conf.json.bak');

  console.log('[fixed_webview2] WebView2 版本:', version);
  console.log('[fixed_webview2] 下载:', cabUrl);

  const bundleDir = join(SRC_TAURI, 'target', 'x86_64-pc-windows-gnu', 'release', 'bundle', 'nsis');

  const run = async () => {
    // 1. 下载 .cab（该仓库仅提供 .cab，无 .zip）
    const cabPath = await download(cabUrl);
    console.log('[fixed_webview2] 已下载:', cabPath);

    const stageDir = join(ROOT, 'target', 'webview2-fixed', 'stage');
    rmSync(stageDir, { recursive: true, force: true });
    mkdirSync(stageDir, { recursive: true });

    // 2. 解压 .cab
    extractCab(cabPath, stageDir);

    const targetDir = join(SRC_TAURI, WEBVIEW2_FOLDER_NAME);
    if (existsSync(targetDir)) rmSync(targetDir, { recursive: true });
    const extractedTop = firstSubdir(stageDir);
    if (extractedTop && readdirSync(stageDir, { withFileTypes: true }).length === 1) {
      renameSync(extractedTop, targetDir);
    } else {
      mkdirSync(targetDir, { recursive: true });
      for (const name of readdirSync(stageDir)) {
        renameSync(join(stageDir, name), join(targetDir, name));
      }
    }
    rmSync(stageDir, { recursive: true, force: true });
    console.log('[fixed_webview2] 已解压到:', targetDir);

    // 3. 替换配置
    if (!existsSync(fixedConf)) throw new Error(`未找到 ${fixedConf}`);
    const backupContent = readFileSync(windowsConf, 'utf8');
    writeFileSync(backupConf, backupContent);
    copyFileSync(fixedConf, windowsConf);
    console.log('[fixed_webview2] 已切换为 fixedRuntime 配置');

    // 无签名私钥时临时关闭 createUpdaterArtifacts，避免构建报错
    let needRestoreMainConf = false;
    if (!process.env.TAURI_SIGNING_PRIVATE_KEY && existsSync(mainConf)) {
      const mainJson = JSON.parse(readFileSync(mainConf, 'utf8'));
      if (mainJson.bundle?.createUpdaterArtifacts) {
        writeFileSync(mainConfBackup, readFileSync(mainConf, 'utf8'));
        mainJson.bundle.createUpdaterArtifacts = false;
        writeFileSync(mainConf, JSON.stringify(mainJson, null, 2));
        needRestoreMainConf = true;
        console.log('[fixed_webview2] 已临时关闭 createUpdaterArtifacts（未设置 TAURI_SIGNING_PRIVATE_KEY）');
      }
    }

    try {
      // 4. 构建（与 release.sh 一致：cargo-xwin + target；签名可设 TAURI_SIGNING_PRIVATE_KEY）
      const buildCmd = 'pnpm tauri build --runner cargo-xwin --target x86_64-pc-windows-gnu';
      execSync(buildCmd, { cwd: ROOT, stdio: 'inherit' });

      // 5. 重命名产物：添加 _fixed_webview2 后缀
      if (existsSync(bundleDir)) {
        const files = readdirSync(bundleDir);
        for (const f of files) {
          if (f.endsWith('-setup.exe') && !f.includes('_fixed_webview2')) {
            const base = f.replace(/-setup\.exe$/, '');
            const newBase = `${base}_fixed_webview2`;
            renameSync(join(bundleDir, f), join(bundleDir, `${newBase}-setup.exe`));
            console.log('[fixed_webview2] 重命名:', f, '->', `${newBase}-setup.exe`);
          }
          if (f.endsWith('.nsis.zip') && !f.includes('_fixed_webview2')) {
            const base = f.replace(/\.nsis\.zip$/, '');
            const newBase = `${base}_fixed_webview2`;
            renameSync(join(bundleDir, f), join(bundleDir, `${newBase}.nsis.zip`));
            console.log('[fixed_webview2] 重命名:', f, '->', `${newBase}.nsis.zip`);
          }
          if (f.endsWith('.exe.sig') && !f.includes('_fixed_webview2')) {
            const base = f.replace(/\.exe\.sig$/, '');
            const newBase = `${base}_fixed_webview2`;
            renameSync(join(bundleDir, f), join(bundleDir, `${newBase}.exe.sig`));
            console.log('[fixed_webview2] 重命名:', f, '->', `${newBase}.exe.sig`);
          }
        }
      }
    } finally {
      // 6. 恢复配置
      if (existsSync(backupConf)) {
        writeFileSync(windowsConf, readFileSync(backupConf, 'utf8'));
        rmSync(backupConf, { force: true });
        console.log('[fixed_webview2] 已恢复 tauri.windows.conf.json');
      }
      if (needRestoreMainConf && existsSync(mainConfBackup)) {
        writeFileSync(mainConf, readFileSync(mainConfBackup, 'utf8'));
        rmSync(mainConfBackup, { force: true });
        console.log('[fixed_webview2] 已恢复 tauri.conf.json');
      }
    }

    console.log('[fixed_webview2] 完成。产物目录:', bundleDir);
  };

  run().catch((e) => {
    console.error('[fixed_webview2] 错误:', e.message || e);
    process.exit(1);
  });
}

main();
