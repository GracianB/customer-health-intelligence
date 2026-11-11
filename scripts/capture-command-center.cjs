'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '../command-center');
const outDir = path.resolve(__dirname, '../screenshots/command-center');
const CHROME = process.env.CHROME_PATH;
if (!CHROME) { console.error('Set CHROME_PATH to a Chrome/Chromium binary.'); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
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

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  await new Promise((r) => server.listen(8765, '127.0.0.1', r));
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  async function shot(profileId, view, filename, viewport) {
    const context = await browser.newContext({
      viewport: viewport || { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('#profileSelect');
    await page.selectOption('#profileSelect', profileId);
    await wait(450);
    if (view && view !== 'overview') {
      await page.click(`nav .navbtn[data-view="${view}"]`);
      await wait(400);
    }
    await page.waitForSelector('#view .panel, #view .cards, #view .chain', { timeout: 10000 });
    await wait(250);
    const dest = path.join(outDir, filename);
    await page.screenshot({ path: dest, fullPage: true });
    console.log('wrote', dest);
    await context.close();
  }

  await shot('healthcare', 'overview', 'healthcare-overview-desktop.png');
  await shot('healthcare', 'overview', 'healthcare-overview-mobile.png', { width: 390, height: 844 });
  await shot('healthcare', 'portfolio', 'healthcare-portfolio-desktop.png');
  await shot('healthcare', 'actions', 'healthcare-actions-desktop.png');
  await shot('healthcare', 'account', 'healthcare-account360-desktop.png');

  await shot('realestate', 'overview', 'realestate-overview-desktop.png');
  await shot('realestate', 'teamlead', 'realestate-teamlead-desktop.png');
  await shot('realestate', 'portfolio', 'realestate-portfolio-desktop.png');
  await shot('realestate', 'actions', 'realestate-actions-desktop.png');

  await shot('pricing-saas', 'overview', 'pricing-saas-overview-desktop.png');
  await shot('pricing-saas', 'adoption', 'pricing-saas-adoption-desktop.png');
  await shot('pricing-saas', 'account', 'pricing-saas-account360-desktop.png');
  await shot('pricing-saas', 'revenue', 'pricing-saas-revenue-desktop.png');

  await browser.close();
  server.close();
})().catch((e) => {
  console.error(e);
  try { server.close(); } catch (_) {}
  process.exit(1);
});
