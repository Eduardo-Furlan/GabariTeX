import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 5199;
const BASE_URL = `http://localhost:${PORT}`;

async function isServerRunning(url) {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerRunning(url)) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

export async function runUiCheck(options = {}) {
  const outputDir = options.outputDir || path.resolve('docs/ui-baseline/screenshots');
  fs.mkdirSync(outputDir, { recursive: true });

  let serverProcess = null;
  const alreadyRunning = await isServerRunning(BASE_URL);

  if (!alreadyRunning) {
    console.log(`Starting Vite dev server on port ${PORT}...`);
    serverProcess = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
      stdio: 'pipe',
      detached: false,
    });
    const ready = await waitForServer(BASE_URL);
    if (!ready) {
      if (serverProcess) serverProcess.kill();
      throw new Error(`Failed to start Vite dev server on ${BASE_URL}`);
    }
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const viewports = [
    { name: '1280', width: 1280, height: 800 },
    { name: '390', width: 390, height: 844 },
  ];

  const themes = ['light', 'dark'];

  const results = {
    timestamp: new Date().toISOString(),
    overflows: [],
    flickerMetrics: [],
    screenshots: [],
  };

  try {
    for (const vp of viewports) {
      for (const theme of themes) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 2,
        });

        const page = await context.newPage();

        // Navigate and seed profile
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });

        // Apply theme
        await page.evaluate((th) => {
          if (th === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }, theme);

        await page.waitForTimeout(300);

        // Check routes
        const routesToCheck = [
          { name: 'provas', hash: '#/provas' },
          { name: 'turmas', hash: '#/turmas' },
          { name: 'criar', hash: '#/prova/exam-escola-exemplo-mat/criar' },
          { name: 'versoes', hash: '#/prova/exam-escola-exemplo-mat/versoes' },
          { name: 'imprimir', hash: '#/prova/exam-escola-exemplo-mat/imprimir' },
          { name: 'corrigir', hash: '#/prova/exam-escola-exemplo-mat/corrigir' },
          { name: 'notas', hash: '#/prova/exam-escola-exemplo-mat/notas' },
        ];

        for (const r of routesToCheck) {
          await page.goto(`${BASE_URL}/${r.hash}`, { waitUntil: 'networkidle' });
          await page.waitForTimeout(400);

          // Overflow detection
          const detectedOverflows = await page.evaluate(() => {
            const targets = document.querySelectorAll(
              'button, [role=radio], [role=tab], label, td, th, .chip, input, select'
            );
            const found = [];
            for (const el of targets) {
              if (el.scrollWidth > el.clientWidth + 1) {
                found.push({
                  tag: el.tagName,
                  text: (el.textContent || '').trim().slice(0, 30),
                  scrollWidth: el.scrollWidth,
                  clientWidth: el.clientWidth,
                  className: el.className ? String(el.className).slice(0, 50) : '',
                });
              }
            }
            return found;
          });

          if (detectedOverflows.length > 0) {
            results.overflows.push({
              viewport: vp.name,
              theme,
              route: r.name,
              items: detectedOverflows,
            });
          }

          // Idle flicker metrics (measure 1 second)
          const metrics = await page.evaluate(async () => {
            let layoutShifts = 0;
            let longTasks = 0;
            let mutations = 0;

            const observer = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                if (entry.entryType === 'layout-shift') {
                  layoutShifts++;
                } else if (entry.entryType === 'longtask') {
                  longTasks++;
                }
              }
            });

            try {
              observer.observe({ entryTypes: ['layout-shift', 'longtask'] });
            } catch {
              // Ignore if longtask/layout-shift not supported in some headless env
            }

            const root = document.getElementById('root');
            const mutObs = new MutationObserver((muts) => {
              mutations += muts.length;
            });
            if (root) {
              mutObs.observe(root, { childList: true, subtree: true, attributes: true });
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
            observer.disconnect();
            mutObs.disconnect();

            return { layoutShifts, longTasks, mutations };
          });

          results.flickerMetrics.push({
            viewport: vp.name,
            theme,
            route: r.name,
            ...metrics,
          });

          // Screenshot
          const filename = `${r.name}-${theme}-${vp.name}.png`;
          const screenshotPath = path.join(outputDir, filename);
          await page.screenshot({ path: screenshotPath, fullPage: false });
          results.screenshots.push(filename);
        }

        await context.close();
      }
    }
  } finally {
    await browser.close();
    if (serverProcess) {
      serverProcess.kill();
    }
  }

  const resultsPath = path.join(outputDir, '..', 'RESULTS.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`UI check finished. Screenshots saved to ${outputDir}.`);
  console.log(`Overflows detected: ${results.overflows.length}`);
  return results;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  runUiCheck()
    .then((r) => {
      console.log('Done!', r.screenshots.length, 'screenshots generated.');
    })
    .catch((err) => {
      console.error('Error running ui-check:', err);
      process.exit(1);
    });
}

