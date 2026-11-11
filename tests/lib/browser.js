'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function which(cmd) {
  try {
    return execSync(process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)[0] || null;
  } catch {
    return null;
  }
}

function existing(p) {
  try {
    return p && fs.existsSync(p) ? p : null;
  } catch {
    return null;
  }
}

function playwrightModule() {
  try {
    return path.dirname(require.resolve('playwright/package.json'));
  } catch {
    /* continue */
  }
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    path.join(__dirname, '../../node_modules/playwright'),
    '/usr/local/lib/pnpm/5/.pnpm/playwright@1.63.0-alpha-2026-08-31/node_modules/playwright',
  ];
  for (const c of candidates) {
    if (existing(c) && existing(path.join(c, 'package.json'))) return c;
  }
  return null;
}

function bundledChromium(pwRoot) {
  if (!pwRoot) return null;
  try {
    const { chromium } = require(pwRoot);
    if (chromium && typeof chromium.executablePath === 'function') {
      const p = chromium.executablePath();
      if (existing(p)) return p;
    }
  } catch {
    /* fall through */
  }
  const bases = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(process.env.HOME || '', '.cache/ms-playwright'),
    path.join(process.env.USERPROFILE || '', 'AppData/Local/ms-playwright'),
    path.join(process.env.HOME || '', 'Library/Caches/ms-playwright'),
  ].filter(Boolean);
  for (const base of bases) {
    if (!existing(base)) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(base).filter((d) => d.startsWith('chromium'));
    } catch {
      continue;
    }
    entries.sort().reverse();
    for (const d of entries) {
      for (const g of [
        path.join(base, d, 'chrome-linux', 'chrome'),
        path.join(base, d, 'chrome-linux64', 'chrome'),
        path.join(base, d, 'chrome-win64', 'chrome.exe'),
        path.join(base, d, 'chrome-win', 'chrome.exe'),
        path.join(base, d, 'chrome-mac', 'Chromium.app/Contents/MacOS/Chromium'),
        path.join(base, d, 'chrome-mac-arm64', 'Chromium.app/Contents/MacOS/Chromium'),
      ]) {
        if (existing(g)) return g;
      }
    }
  }
  return null;
}

function commonInstallPaths() {
  const list = [
    process.env.CHROME_PATH,
    process.env.PLAYWRIGHT_CHROMIUM_PATH,
    process.env.GOOGLE_CHROME_BIN,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    path.join(process.env.HOME || '', '.cache/puppeteer/chrome'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
    'C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  ];
  for (const p of list) {
    if (!p) continue;
    if (p.includes('puppeteer') && p.endsWith('chrome') && existing(p) && fs.statSync(p).isDirectory()) {
      try {
        for (const ver of fs.readdirSync(p)) {
          for (const g of [
            path.join(p, ver, 'chrome-linux64', 'chrome'),
            path.join(p, ver, 'chrome-linux', 'chrome'),
            path.join(p, ver, 'chrome-win64', 'chrome.exe'),
          ]) {
            if (existing(g)) return g;
          }
        }
      } catch {
        /* continue */
      }
      continue;
    }
    if (existing(p)) return p;
  }
  for (const cmd of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome']) {
    const w = which(cmd);
    if (w) return w;
  }
  return null;
}

function resolveBrowser() {
  if (process.env.CHI_SKIP_BROWSER === '1') {
    return {
      playwrightModule: null,
      executablePath: null,
      skipReason: 'CHI_SKIP_BROWSER=1 — visual/file:// tests skipped (forced)',
    };
  }
  const pwRoot = playwrightModule();
  const executablePath =
    existing(process.env.CHROME_PATH) ||
    existing(process.env.PLAYWRIGHT_CHROMIUM_PATH) ||
    bundledChromium(pwRoot) ||
    commonInstallPaths();
  return {
    playwrightModule: pwRoot,
    executablePath,
    skipReason: !pwRoot
      ? 'Playwright module not found (npm i -D playwright) — visual/file:// tests skipped'
      : !executablePath
        ? 'No Chromium/Chrome binary found (set CHROME_PATH or install Chrome / npx playwright install chromium) — visual/file:// tests skipped'
        : null,
  };
}

module.exports = { resolveBrowser };
