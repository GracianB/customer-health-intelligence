'use strict';
// Captures the curated README / docs/screenshots gallery from the REAL rendered Command Center.
// Usage: CHROME_PATH=/path/to/chrome PLAYWRIGHT_MODULE=/path/to/playwright node scripts/capture-docs-screenshots.cjs
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'docs/screenshots');
const heroOut = path.join(root, 'docs/assets/hero-command-center.jpg');
fs.mkdirSync(outDir, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('x'); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shots = [
  ['healthcare', 'overview', 'overview-healthcare.jpg'],
  ['healthcare', 'portfolio', 'portfolio-healthcare.jpg'],
  ['healthcare', 'revenue', 'revenue-healthcare.jpg'],
  ['healthcare', 'actions', 'actions-healthcare.jpg'],
  ['healthcare', 'account', 'account360-healthcare.jpg'],
  ['realestate', 'overview', 'overview-realestate.jpg'],
  ['realestate', 'teamlead', 'teamlead-realestate.jpg'],
  ['pricing-saas', 'overview', 'overview-pricing-saas.jpg'],
  ['pricing-saas', 'adoption', 'adoption-pricing-saas.jpg'],
  ['base', 'overview', 'overview-base.jpg'],
  ['base', 'glossary', 'glossary-score.jpg'],
  ['healthcare', 'overview', 'mobile-overview-healthcare.jpg', { width: 390, height: 844 }],
];
(async () => {
  await new Promise((r) => server.listen(8768, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  for (const [profile, view, file, vp] of shots) {
    const ctx = await browser.newContext({ viewport: vp || { width: 1440, height: 900 }, deviceScaleFactor: vp ? 2 : 1.5 });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(file + ': ' + m.text()); });
    page.on('pageerror', (e) => errors.push(file + ': ' + e.message));
    await page.goto(`http://127.0.0.1:8768/command-center/?profile=${profile}`, { waitUntil: 'networkidle' });
    await wait(300);
    if (view !== 'overview') { await page.click(`nav .navbtn[data-view="${view}"]`); await wait(350); }
    await page.waitForSelector('#view .panel, #view .cards, #view .chain', { timeout: 10000 });
    await page.screenshot({ path: path.join(outDir, file), type: 'jpeg', quality: 82, fullPage: false });
    if (file === 'overview-healthcare.jpg') await page.screenshot({ path: heroOut, type: 'jpeg', quality: 85, fullPage: false });
    console.log('wrote', file);
    await ctx.close();
  }
  await browser.close();
  server.close();
  if (errors.length) { console.error('console errors:', errors); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
