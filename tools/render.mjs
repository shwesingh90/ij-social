// Render slide/card HTML files to JPEG.
// CLI:    node tools/render.mjs posts/<slug>     (renders ig-N.html and li.html in that folder)
// Module: import { renderFiles } from './render.mjs'; await renderFiles([absPaths])
// Each HTML file must have one root element with id="slide" sized 1080x1350 or 1200x1200.
// Output: same name with .jpg next to it. Fails on wrong size, broken images or missing fonts.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

export async function renderFiles(files) {
  const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1500 }, deviceScaleFactor: 1 });
  let failed = 0;
  for (const f of files) {
    const abs = path.resolve(f);
    const name = path.relative(process.cwd(), abs);
    await page.goto(pathToFileURL(abs).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const el = await page.$('#slide');
    if (!el) { console.error(name + ': no #slide element'); failed++; continue; }
    const box = await el.boundingBox();
    const ok = (box.width === 1080 && box.height === 1350) || (box.width === 1200 && box.height === 1200);
    if (!ok) { console.error(`${name}: unexpected size ${box.width}x${box.height}`); failed++; continue; }
    const broken = await page.evaluate(() => [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src));
    if (broken.length) { console.error(name + ': broken images ' + broken.join(', ')); failed++; continue; }
    const fontsOk = await page.evaluate(() => document.fonts.check("800 40px 'Fraunces'") && document.fonts.check("400 20px 'Source Sans 3'"));
    if (!fontsOk) { console.error(name + ': brand fonts did not load'); failed++; continue; }
    const out = abs.replace(/\.html$/, '.jpg');
    await el.screenshot({ path: out, type: 'jpeg', quality: 92 });
    console.log(`${name} -> ${path.basename(out)} ${box.width}x${box.height} ${Math.round(fs.statSync(out).size / 1024)}KB`);
  }
  await browser.close();
  return failed === 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: node tools/render.mjs posts/<slug>'); process.exit(1); }
  const files = fs.readdirSync(dir).filter(f => /^(ig-\d+|li)\.html$/.test(f)).sort().map(f => path.join(dir, f));
  if (!files.length) { console.error('no ig-N.html or li.html in ' + dir); process.exit(1); }
  process.exit((await renderFiles(files)) ? 0 : 2);
}
