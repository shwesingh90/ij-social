// Render an InvestorJoint reel (1080x1920, 30 fps, H.264 + AAC) from reels/<slug>/reel.json.
// CLI: node tools/reel.mjs reels/<slug> [--frames t1,t2,...]
//   Writes reels/<slug>/reel.mp4 and cover.jpg (first full frame of the hook).
//   --frames only writes still JPEGs at those times (seconds) as frame-<t>.jpg, for checking.
// reel.json: { hook:{kicker,line1,accent,sub?}, points:[{title,body?}] (3-5), outro:{line1,accent,cta?}, music_seed? }
import { chromium } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;

function check(r) {
  const errs = [];
  const len = (s, max, name) => { if (!s || String(s).length > max) errs.push(`${name}: missing or longer than ${max} chars`); };
  len(r.hook?.kicker, 22, 'hook.kicker'); len(r.hook?.line1, 34, 'hook.line1'); len(r.hook?.accent, 26, 'hook.accent');
  if (r.hook?.sub) len(r.hook.sub, 80, 'hook.sub');
  const photos = (r.points || []).some(p => p.photo);
  if (!Array.isArray(r.points) || r.points.length < (photos ? 1 : 3) || r.points.length > (photos ? 8 : 5)) errs.push(photos ? 'points: need 1 to 8 listings' : 'points: need 3 to 5');
  (r.points || []).forEach((p, i) => { len(p.title, p.photo ? 22 : 40, `points[${i}].title`); if (p.body) len(p.body, 90, `points[${i}].body`); if (p.photo && !fs.existsSync(path.join(dir, p.photo))) errs.push(`points[${i}].photo: ${p.photo} not found in the reel folder`); });
  len(r.outro?.line1, 30, 'outro.line1'); len(r.outro?.accent, 26, 'outro.accent');
  return errs;
}

const dir = process.argv[2];
if (!dir) { console.error('usage: node tools/reel.mjs reels/<slug> [--frames 1,5,9]'); process.exit(1); }
const fi = process.argv.indexOf('--frames');
const stills = fi > 0 ? process.argv[fi + 1].split(',').map(Number) : null;
const reel = JSON.parse(fs.readFileSync(path.join(dir, 'reel.json'), 'utf8'));
const errs = check(reel);
if (errs.length) { console.error('reel.json problems:\n  ' + errs.join('\n  ')); process.exit(2); }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.addInitScript(([r, base]) => { window.REEL = r; window.REEL_BASE = base; }, [reel, pathToFileURL(path.resolve(dir) + '/').href]);
await page.goto(pathToFileURL(path.join(here, 'reel-template.html')).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const fontsOk = await page.evaluate(() => document.fonts.check("800 40px 'Fraunces'") && document.fonts.check("400 20px 'Source Sans 3'"));
if (!fontsOk) { console.error('brand fonts did not load'); process.exit(2); }
// Wait for every listing photo to decode before filming, or early frames come out blank.
const photoErr = await page.evaluate(async () => {
  const urls = (window.REEL.points || []).filter(p => p.photo).map(p => window.REEL_BASE + p.photo);
  const bad = [];
  await Promise.all(urls.map(u => new Promise(res => { const im = new Image(); im.onload = () => res(); im.onerror = () => { bad.push(u); res(); }; im.src = u; })));
  return bad;
});
if (photoErr.length) { console.error('photos failed to load: ' + photoErr.join(', ')); process.exit(2); }
const duration = await page.evaluate(() => window.DURATION);
const el = await page.$('#slide');

// Overflow check: every text block must sit inside the frame and the safe area (top 100, bottom 1560, right 990).
for (const t of [3.5, ...reel.points.map((_, i) => 4.2 + i * 3.9 + 3), duration - .5]) {
  await page.evaluate(x => window.seek(x), t);
  const bad = await page.evaluate(() => [...document.querySelectorAll('h1,h2,p,.sub,.cta,.url,.pill,.rent,.facts,.tag')].filter(e => {
    if (getComputedStyle(e.closest('.scene')).opacity < .5) return false;
    const b = e.getBoundingClientRect(); return b.bottom > 1560 || b.right > 1000 || b.top < 100 || e.scrollWidth > e.clientWidth + 2;
  }).map(e => e.textContent.slice(0, 40)));
  if (bad.length) { console.error(`text outside the safe area at ${t}s: ${bad.join(' | ')}`); process.exit(2); }
}

if (stills) {
  for (const t of stills) {
    await page.evaluate(x => window.seek(x), t);
    await el.screenshot({ path: path.join(dir, `frame-${t}.jpg`), type: 'jpeg', quality: 85 });
  }
  await browser.close();
  console.log('wrote stills');
  process.exit(0);
}

// Music bed
const wav = path.join(dir, '.music.wav');
execFileSync('python3', [path.join(here, 'music.py'), wav, String(duration), String(reel.music_seed ?? path.basename(dir))], { stdio: 'inherit' });

const tmp = path.join(dir, '.reel.tmp.mp4');
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
  '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
  '-r', String(FPS), '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise(res => ff.on('close', res));
const n = Math.round(duration * FPS);
for (let i = 0; i < n; i++) {
  await page.evaluate(x => window.seek(x), i / FPS);
  const buf = await el.screenshot({ type: 'jpeg', quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i === Math.round(1.6 * FPS)) fs.writeFileSync(path.join(dir, 'cover.jpg'), buf);
}
ff.stdin.end();
const code = await done;
await browser.close();
fs.rmSync(wav, { force: true });
if (code !== 0) { console.error('ffmpeg failed'); process.exit(3); }
fs.renameSync(tmp, path.join(dir, 'reel.mp4'));
console.log(`${dir}/reel.mp4 ${duration.toFixed(1)}s ${Math.round(fs.statSync(path.join(dir, 'reel.mp4')).size / 1024)}KB`);
