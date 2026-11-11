'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '../command-center');
const outDir = path.resolve(__dirname, '../screenshots/demo');
const CHROME = process.env.CHROME_PATH;
if (!CHROME) { console.error('Set CHROME_PATH to a Chrome/Chromium binary.'); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.join(root, urlPath);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(8766, '127.0.0.1', r));
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    recordVideo: { dir: outDir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8766/', { waitUntil: 'networkidle' });
  await page.selectOption('#profileSelect', 'healthcare');
  await wait(1800);
  await page.click('nav .navbtn[data-view="portfolio"]');
  await wait(1400);
  await page.click('nav .navbtn[data-view="actions"]');
  await wait(1400);
  await page.click('nav .navbtn[data-view="overview"]');
  await wait(1200);
  // click first account
  const first = page.locator('button.linkish').first();
  if (await first.count()) { await first.click(); await wait(1600); }
  await page.selectOption('#profileSelect', 'realestate');
  await wait(1600);
  await page.click('nav .navbtn[data-view="teamlead"]');
  await wait(2200);
  await page.click('nav .navbtn[data-view="overview"]');
  await wait(1400);
  await page.selectOption('#profileSelect', 'pricing-saas');
  await wait(1400);
  await page.click('nav .navbtn[data-view="adoption"]');
  await wait(2200);
  await page.click('nav .navbtn[data-view="overview"]');
  await wait(1200);

  await context.close();
  await browser.close();
  server.close();

  // Find webm
  const files = fs.readdirSync(outDir).filter((f) => f.endsWith('.webm'));
  if (!files.length) throw new Error('no webm');
  const webm = path.join(outDir, files.sort((a, b) => fs.statSync(path.join(outDir, b)).mtimeMs - fs.statSync(path.join(outDir, a)).mtimeMs)[0]);
  const mp4 = path.join(outDir, 'command-center-demo-v1.2.0.mp4');
  const { spawnSync } = require('child_process');
  const r = spawnSync('ffmpeg', ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(r.stderr);
    // keep webm as fallback
    fs.copyFileSync(webm, path.join(outDir, 'command-center-demo-v1.2.0.webm'));
    console.log('ffmpeg failed; kept webm');
  } else {
    console.log('wrote', mp4, fs.statSync(mp4).size);
    // cleanup random webm names except canonical
    for (const f of files) {
      if (f !== 'command-center-demo-v1.2.0.webm') fs.unlinkSync(path.join(outDir, f));
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
