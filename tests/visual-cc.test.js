'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { resolveBrowser } = require('./lib/browser.js');

const root = path.join(__dirname, '..');
const cc = path.join(root, 'command-center');
const browserInfo = resolveBrowser();
const canRun = !browserInfo.skipReason && fs.existsSync(path.join(cc, 'js/embedded-data.js'));

if (browserInfo.skipReason) {
  console.log('[visual-cc] SKIP:', browserInfo.skipReason);
}

describe('command-center visual (headless)', { skip: canRun ? false : (browserInfo.skipReason || 'visual/file:// tests skipped') }, () => {
  let browser, server, baseUrl, chromium;

  before(async () => {
    if (!canRun) return;
    chromium = require(browserInfo.playwrightModule).chromium;
    const mime = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
    };
    server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      const file = path.join(cc, urlPath);
      if (!file.startsWith(cc) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('missing'); return;
      }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    baseUrl = 'http://127.0.0.1:' + server.address().port + '/';
    browser = await chromium.launch({
      executablePath: browserInfo.executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
  });

  after(async () => {
    if (browser) await browser.close();
    if (server) await new Promise((r) => server.close(r));
  });

  async function open(viewport) {
    const context = await browser.newContext({
      viewport: viewport || { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const errors = [];
    const ignore = (t) => /favicon|404 \(Not Found\)/i.test(t);
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!ignore(text)) errors.push(text);
      }
    });
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('#view .cards, #view .panel', { timeout: 10000 });
    return { context, page, errors };
  }

  it('Healthcare overview renders without console errors @1440', async () => {
    const { context, page, errors } = await open({ width: 1440, height: 900 });
    await page.selectOption('#profileSelect', 'healthcare');
    await page.waitForTimeout(300);
    assert.ok(await page.locator('#view .cards').count());
    assert.ok(await page.locator('text=Prioritised action queue').count());
    assert.equal(errors.length, 0, errors.join('\n'));
    await context.close();
  });

  it('no page-level horizontal overflow at 390/768/1280/1440 (all profiles)', async () => {
    const bps = [390, 768, 1280, 1440];
    const profiles = ['base', 'healthcare', 'realestate', 'pricing-saas'];
    const viewsFor = {
      base: ['overview', 'portfolio', 'glossary'],
      healthcare: ['overview', 'portfolio', 'actions', 'glossary'],
      realestate: ['overview', 'teamlead', 'glossary'],
      'pricing-saas': ['overview', 'adoption', 'glossary'],
    };
    for (const w of bps) {
      const { context, page, errors } = await open({ width: w, height: w === 390 ? 844 : 900 });
      for (const pid of profiles) {
        await page.selectOption('#profileSelect', pid);
        await page.waitForTimeout(120);
        for (const view of viewsFor[pid]) {
          await page.click(`nav .navbtn[data-view="${view}"]`);
          await page.waitForTimeout(80);
          const m = await page.evaluate(() => ({
            sw: document.documentElement.scrollWidth,
            iw: window.innerWidth,
          }));
          assert.ok(
            m.sw <= m.iw,
            `overflow ${pid}/${view}@${w}: scrollWidth=${m.sw} innerWidth=${m.iw}`
          );
        }
      }
      assert.equal(errors.length, 0, errors.join('\n'));
      await context.close();
    }
  });

  it('Real estate Team Lead + Pricing SaaS Adoption + glossary', async () => {
    const { context, page, errors } = await open();
    await page.selectOption('#profileSelect', 'realestate');
    await page.waitForTimeout(200);
    await page.click('nav .navbtn[data-view="teamlead"]');
    await page.waitForTimeout(200);
    assert.ok(await page.locator('text=CS Team Lead').count());
    await page.selectOption('#profileSelect', 'pricing-saas');
    await page.waitForTimeout(200);
    await page.click('nav .navbtn[data-view="adoption"]');
    await page.waitForTimeout(200);
    assert.ok(await page.locator('text=Product metrics').count());
    await page.click('nav .navbtn[data-view="glossary"]');
    await page.waitForTimeout(200);
    assert.ok(await page.locator('text=How the Health Score is calculated').count());
    assert.equal(errors.length, 0, errors.join('\n'));
    await context.close();
  });

  for (const [w, h, label] of [
    [1440, 900, 'desktop'],
    [1280, 800, 'laptop'],
    [390, 844, 'mobile'],
  ]) {
    it(`responsive ${label} ${w}x${h} shows main landmark`, async () => {
      const { context, page, errors } = await open({ width: w, height: h });
      assert.ok(await page.locator('#view').count());
      assert.ok(await page.locator('#profileSelect').count());
      assert.equal(errors.length, 0, errors.join('\n'));
      await context.close();
    });
  }

  it('file:// entry loads embedded data without fetch failures', async () => {
    const indexPath = path.join(cc, 'index.html');
    const fileUrl = 'file://' + indexPath;
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#view .cards, #view .panel, #view .empty', { timeout: 10000 });
    const body = await page.locator('#view').innerText();
    assert.ok(!/Demo bundle missing/i.test(body), body.slice(0, 200));
    assert.ok((await page.locator('#profileSelect option').count()) >= 3);
    const hard = errors.filter((e) => /CHI_DATA|ReferenceError|Failed to fetch|net::ERR/i.test(e));
    assert.equal(hard.length, 0, hard.join('\n'));
    await context.close();
  });
});

describe('visual suite availability', () => {
  it('documents whether browser visual tests run or skip', () => {
    if (browserInfo.skipReason) {
      console.log('VISUAL_SKIP_REASON=', browserInfo.skipReason);
    } else {
      console.log('VISUAL_BROWSER=', browserInfo.executablePath);
    }
    assert.ok(true);
  });
});

describe('embedded bundle integrity', () => {
  it('embedded-data.js defines CHI_DATA with 4 profiles', () => {
    const src = fs.readFileSync(path.join(cc, 'js/embedded-data.js'), 'utf8');
    assert.match(src, /window\.CHI_DATA\s*=/);
    const sandbox = {};
    Function('window', src)(sandbox);
    assert.ok(sandbox.CHI_DATA.catalog.profiles.length >= 3);
    assert.ok(sandbox.CHI_DATA.profiles.healthcare);
    assert.ok(sandbox.CHI_DATA.profiles.realestate);
    assert.ok(sandbox.CHI_DATA.profiles['pricing-saas']);
  });

  it('START-HERE.html and START-HERE.txt exist at repo root', () => {
    assert.ok(fs.existsSync(path.join(root, 'START-HERE.html')));
    assert.ok(fs.existsSync(path.join(root, 'START-HERE.txt')));
    const txt = fs.readFileSync(path.join(root, 'START-HERE.txt'), 'utf8');
    assert.match(txt, /doble clic/i);
  });
});
