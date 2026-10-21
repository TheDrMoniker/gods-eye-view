/**
 * Browser/WebGL QA for the opt-in God’s Eye research preview.
 * Uses a synthetic GLB by default, or the locally generated City Hall GLB
 * with --real. This proves load/render/unload, NOT geographic registration.
 * Run: node scripts/qa-reconstruction-browser.mjs [--real]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { createServer } from 'vite';

const real = process.argv.includes('--real');
const port = 4187;
const url = `http://127.0.0.1:${port}/reconstruction-qa.html${real ? '?fixture=real' : ''}`;
const artifactDirectory = path.resolve('qa-artifacts/reconstruction');
const reportName = real ? 'local-city-hall' : 'synthetic';
const debug = [];
let browser;
let server;
try {
  await mkdir(artifactDirectory, { recursive: true });
  server = await createServer({
    server: { host: '127.0.0.1', port, strictPort: true },
    clearScreen: false,
    logLevel: 'error',
  });
  await server.listen();
  browser = await puppeteer.launch({
    headless: true,
    executablePath:
      process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--enable-webgl',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--window-size=1280,800',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => debug.push(error.message));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__reconQa !== undefined, {
    timeout: 90000,
  });
  await page.waitForFunction(
    () =>
      window.__reconQa?.preview?.model.ready === true ||
      window.__reconQa?.error,
    {
      timeout: 90000,
    },
  );
  // Cesium needs at least several frames after a Model transitions to ready.
  await new Promise((resolve) => setTimeout(resolve, 1400));
  const before = await page.screenshot({
    path: path.join(artifactDirectory, reportName + '-visible.png'),
  });
  const beforeStatus = await page.evaluate(() => {
    const qa = window.__reconQa;
    if (qa?.error) return { error: qa.error };
    const gl = qa.viewer.scene.context?._gl;
    return {
      fixture: qa.result.fixture,
      heightPlacement: qa.result.heightPlacement,
      glbBytes: qa.result.glbBytes,
      webgl2: qa.viewer.scene.context?.webgl2 === true,
      contextLost: gl?.isContextLost?.() === true,
      modelReady: qa.preview.model.ready === true,
      modelVisible: qa.preview.model.show === true,
      radiusMeters: qa.preview.model.boundingSphere?.radius ?? null,
      primitiveCount: qa.viewer.scene.primitives.length,
    };
  });
  await page.evaluate(() => window.__reconQa?.preview?.dispose());
  await new Promise((resolve) => setTimeout(resolve, 650));
  const after = await page.screenshot({
    path: path.join(artifactDirectory, reportName + '-removed.png'),
  });
  const afterPrimitiveCount = await page.evaluate(
    () => window.__reconQa?.viewer?.scene?.primitives?.length ?? -1,
  );
  const a = await sharp(before).removeAlpha().raw().toBuffer();
  const b = await sharp(after).removeAlpha().raw().toBuffer();
  let changedPixels = 0;
  let stronglyChangedPixels = 0;
  for (let i = 0; i < a.length; i += 3) {
    const delta =
      Math.abs(a[i] - b[i]) +
      Math.abs(a[i + 1] - b[i + 1]) +
      Math.abs(a[i + 2] - b[i + 2]);
    if (delta > 25) changedPixels++;
    if (delta > 160) stronglyChangedPixels++;
  }
  const passed =
    !beforeStatus.error &&
    beforeStatus.webgl2 &&
    !beforeStatus.contextLost &&
    beforeStatus.modelReady &&
    beforeStatus.modelVisible &&
    beforeStatus.radiusMeters > 1 &&
    beforeStatus.primitiveCount === 1 &&
    afterPrimitiveCount === 0 &&
    stronglyChangedPixels > 1500 &&
    debug.length === 0;
  const report = {
    schema: 'gods-eye-reconstruction-browser-qa/1',
    gate: 'GODS-EYE-UNIFIED-STREET-RECON-01',
    fixture: reportName,
    passed: Boolean(passed),
    beforeStatus,
    afterPrimitiveCount,
    changedPixels,
    stronglyChangedPixels,
    pageErrors: debug,
    limitations: [
      'Isolated Cesium/Vite browser fixture, not a full God’s Eye application session',
      'Ellipsoidal origin height is explicitly a test-only placeholder',
      'Generated City Hall source geometry is unvalidated and not approved for redistribution',
      'No texture rights, provider switching or measured placement is certified',
    ],
  };
  await writeFile(
    path.join(artifactDirectory, reportName + '-qa.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report));
  if (!passed) process.exitCode = 1;
} catch (error) {
  console.error('[reconstruction-browser-qa]', error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
}
