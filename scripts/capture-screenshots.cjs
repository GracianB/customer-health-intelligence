/**
 * Optional local helper to capture hi-res screenshots from a running n8n UI.
 * NOT required to import or run the SAMPLE DATA workflow.
 *
 * Expects environment variables (never commit secrets):
 *   N8N_BASE_URL   e.g. http://127.0.0.1:5678
 *   N8N_WORKFLOW_ID
 *   N8N_COOKIES_JSON  path to a Playwright cookies JSON you create locally
 *
 * Writes only into ../screenshots/ relative to this script.
 */
const fs = require('fs');
const path = require('path');

(async () => {
  const outDir = path.resolve(__dirname, '../screenshots');
  fs.mkdirSync(outDir, { recursive: true });

  const base = process.env.N8N_BASE_URL;
  const wfid = process.env.N8N_WORKFLOW_ID;
  const cookiesPath = process.env.N8N_COOKIES_JSON;
  if (!base || !wfid || !cookiesPath) {
    console.error('Set N8N_BASE_URL, N8N_WORKFLOW_ID, and N8N_COOKIES_JSON. Aborting.');
    process.exit(2);
  }

  // Playwright must be installed separately in your environment.
  const { chromium } = require('playwright');
  const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 2,
  });
  await context.addCookies(cookies);
  const page = await context.newPage();

  await page.goto(`${base}/workflow/${wfid}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const controls = document.querySelector('.vue-flow__controls');
    if (controls) {
      const btns = controls.querySelectorAll('button');
      if (btns[2]) btns[2].click();
    }
  });
  await page.waitForTimeout(1500);
  const canvasPath = path.join(outDir, 'canvas_hires.png');
  await page.screenshot({ path: canvasPath });
  console.log('wrote', canvasPath);

  await page.goto(`${base}/workflow/${wfid}/executions/2`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3500);
  const execPath = path.join(outDir, 'execution_success_hires.png');
  await page.screenshot({ path: execPath });
  console.log('wrote', execPath);

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
