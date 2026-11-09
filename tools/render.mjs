// Render every slide HTML in a post folder to JPEG.
// Usage: node tools/render.mjs posts/<slug>
// Each slide HTML must have one root element with id="slide" sized to the export
// (Instagram 1080x1350, LinkedIn 1200x1200). Output: same name with .jpg next to it.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = process.argv[2];
if (!dir) { console.error('usage: node tools/render.mjs posts/<slug>'); process.exit(1); }
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const files = fs.readdirSync(dir).filter(f => /^(ig-\d+|li)\.html$/.test(f)).sort();
if (!files.length) { console.error('no ig-N.html or li.html in ' + dir); process.exit(1); }

const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1400, height: 1500 }, deviceScaleFactor: 1 });
let failed = 0;
for (const f of files) {
  const abs = path.resolve(dir, f);
  await page.goto(pathToFileURL(abs).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const el = await page.$('#slide');
  if (!el) { console.error(f + ': no #slide element'); failed++; continue; }
  const box = await el.boundingBox();
  const ok = (box.width === 1080 && box.height === 1350) || (box.width === 1200 && box.height === 1200);
  if (!ok) { console.error(`${f}: unexpected size ${box.width}x${box.height}`); failed++; continue; }
  // Fail loudly on missing images or fonts so a broken post never goes out.
  const broken = await page.evaluate(() => [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src));
  if (broken.length) { console.error(f + ': broken images ' + broken.join(', ')); failed++; continue; }
  const fontsOk = await page.evaluate(() => document.fonts.check("800 40px 'Fraunces'") && document.fonts.check("400 20px 'Source Sans 3'"));
  if (!fontsOk) { console.error(f + ': brand fonts did not load'); failed++; continue; }
  const out = abs.replace(/\.html$/, '.jpg');
  await el.screenshot({ path: out, type: 'jpeg', quality: 92 });
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`${f} -> ${path.basename(out)} ${box.width}x${box.height} ${kb}KB`);
}
await browser.close();
process.exit(failed ? 2 : 0);
