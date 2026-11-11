'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../command-center');
const outDir = path.resolve(__dirname, '../screenshots/final');
const CHROME = process.env.CHROME_PATH;
if (!CHROME) { console.error('Set CHROME_PATH to a Chrome/Chromium binary.'); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.join(root, urlPath);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('x'); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await new Promise((r) => server.listen(8767, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const jobs = [];
  const profiles = {
    healthcare: ['overview', 'portfolio', 'revenue', 'actions', 'account', 'glossary'],
    realestate: ['overview', 'portfolio', 'revenue', 'actions', 'account', 'teamlead', 'glossary'],
    'pricing-saas': ['overview', 'portfolio', 'revenue', 'actions', 'account', 'adoption', 'glossary'],
  };
  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'laptop', width: 1280, height: 800 },
    { name: 'mobile', width: 390, height: 844 },
  ];
  for (const [profile, views] of Object.entries(profiles)) {
    for (const view of views) {
      for (const vp of viewports) {
        // full matrix only for overview; other views desktop-only to keep zip sane; mobile+laptop for overview + key views
        const keyViews = new Set(['overview', 'teamlead', 'adoption', 'glossary']);
        if (vp.name !== 'desktop' && !keyViews.has(view)) continue;
        jobs.push({ profile, view, vp });
      }
    }
  }
  for (const job of jobs) {
    const context = await browser.newContext({ viewport: { width: job.vp.width, height: job.vp.height }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:8767/', { waitUntil: 'networkidle' });
    await page.selectOption('#profileSelect', job.profile);
    await wait(350);
    if (job.view !== 'overview') {
      await page.click(`nav .navbtn[data-view="${job.view}"]`);
      await wait(350);
    }
    await page.waitForSelector('#view .panel, #view .cards, #view .chain', { timeout: 10000 });
    const name = `${job.profile}-${job.view}-${job.vp.name}.png`;
    await page.screenshot({ path: path.join(outDir, name), fullPage: true });
    console.log('wrote', name);
    await context.close();
  }
  // hero copy for README
  fs.copyFileSync(path.join(outDir, 'healthcare-overview-desktop.png'), path.resolve(__dirname, '../screenshots/command-center/healthcare-overview-desktop.png'));
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
