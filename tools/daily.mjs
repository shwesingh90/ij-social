// Daily blog + rental listing pipeline for InvestorJoint socials.
//
//   node tools/daily.mjs discover [--max-listings 2] [--max-blogs 2]
//       Reads the public sitemaps, finds blog articles and rental listings not in
//       daily/seen.json, extracts their details and creates daily/<date>/<id>/item.json
//       (plus article.txt for blogs, photo.jpg for listings). Prints the new item dirs.
//   node tools/daily.mjs cards daily/<date>
//       Builds card.html (1080x1350) for every item dir and renders card.jpg.
//       Blog items need item.takeaways (3 short strings) filled in first.
//   node tools/daily.mjs seen daily/<date>/<id>
//       Marks one item's URL as handled in daily/seen.json.
//
// Only data shown on the public investorjoint.com.au pages is used.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SITE = 'https://investorjoint.com.au';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SEEN = path.join(ROOT, 'daily', 'seen.json');

const curl = (url, out) => {
  const args = ['-sS', '-L', '--fail', '--max-time', '30', url];
  if (out) args.push('-o', out);
  return execFileSync('curl', args, { encoding: out ? undefined : 'utf8', maxBuffer: 20 << 20 });
};
const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, ' ');
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = html => decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const meta = (html, key) => { const m = html.match(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`)); return m ? decode(m[1]) : ''; };
const ldjson = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => { try { return JSON.parse(m[1]); } catch { return null; } }).filter(Boolean);
const sydneyDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(new Date());
const readSeen = () => fs.existsSync(SEEN) ? JSON.parse(fs.readFileSync(SEEN, 'utf8')) : { blog: [], listings: [] };
const writeSeen = s => { fs.mkdirSync(path.dirname(SEEN), { recursive: true }); fs.writeFileSync(SEEN, JSON.stringify(s, null, 2) + '\n'); };
const sitemap = name => [...curl(`${SITE}/${name}`).matchAll(/<url>([\s\S]*?)<\/url>/g)].map(m => ({
  loc: (m[1].match(/<loc>(.*?)<\/loc>/) || [])[1],
  lastmod: (m[1].match(/<lastmod>(.*?)<\/lastmod>/) || [])[1] || '',
})).filter(u => u.loc);

function blogItem(url) {
  const html = curl(url);
  const ld = ldjson(html).find(j => j.datePublished) || {};
  const body = text(html);
  const head = body.match(/^(.*?) · (\d{1,2} \w{3} \d{4}) · (\d+) min read/);
  return {
    kind: 'blog', url,
    title: (meta(html, 'og:title') || '').replace(/\s*\|\s*InvestorJoint\s*$/, ''),
    description: meta(html, 'description'),
    category: head ? head[1].split(' + ').pop().trim() : '',
    readMinutes: head ? Number(head[3]) : null,
    datePublished: ld.datePublished || '',
    takeaways: [],
    _article: body,
  };
}

function listingItem(url) {
  const html = curl(url);
  const ld = ldjson(html).find(j => j['@type'] === 'RealEstateListing') || {};
  const addr = ld.about?.address || {};
  const body = text(html);
  const field = (label, next) => { const m = body.match(new RegExp(`${label} (.*?) ${next}`)); return m ? m[1].trim() : ''; };
  const details = (body.match(/Property details (.*?) About this property/) || [])[1] || '';
  const num = (label) => { const m = details.match(new RegExp(`${label} (\\d+)`)); return m ? Number(m[1]) : null; };
  return {
    kind: 'listing', url,
    headline: decode(ld.name || meta(html, 'og:title')),
    suburb: addr.addressLocality || '', state: addr.addressRegion || '', postcode: addr.postalCode || '',
    rentPerWeek: ld.offers?.price ?? null,
    available: field('Available', 'Bond'),
    bond: field('Bond', 'Bedrooms'),
    beds: num('Bedrooms'), baths: num('Bathrooms'), parking: num('Parking'),
    pets: field('Pets', 'Furnished'), furnished: (details.match(/Furnished (\w+)/) || [])[1] || '',
    datePosted: ld.datePosted || '',
    inStock: /InStock/.test(ld.offers?.availability || ''),
    photoUrl: meta(html, 'og:image'),
    description: (body.match(/About this property (.*)$/) || [])[1]?.slice(0, 1500) || '',
  };
}

// A single room / co-living / boarding listing: rent is per room, so the card must not
// present it as a whole home with N bedrooms.
const ROOM_RE = /\b(room|co-?living|share ?house|shared (house|home|accommodation)|boarding|rooming|student accommodation|flatmate)\b/i;
// Listings that restrict who may apply by a protected attribute are never promoted by
// InvestorJoint's own accounts; they are skipped and flagged to Shwe instead.
const RESTRICT_RE = /\b((fe)?male|women|men|girls?|boys?|ladies|gentlemen|christian|muslim|hindu|sikh|jewish|indian|chinese|asian|european|couples?|singles?|no (kids|children|families))\b[\s-]*(only|students? only|preferred|wanted)\b|\bonly (fe)?males?\b|\b(women|men|ladies|girls|boys) only\b/i;
function classify(it) {
  it.roomRental = ROOM_RE.test(it.headline);
  const restricted = (it.headline + ' ' + it.description).match(RESTRICT_RE);
  it.skip = restricted ? `tenant restriction in listing text ("${restricted[0]}")` : '';
  return it;
}

function discover(args) {
  const maxL = Number(args[args.indexOf('--max-listings') + 1]) || 2;
  const maxB = Number(args[args.indexOf('--max-blogs') + 1]) || 2;
  const seen = readSeen();
  const day = path.join(ROOT, 'daily', sydneyDate());
  const made = [];
  const blogs = sitemap('sitemap-blog.xml').filter(u => /\/blog\/[^/]+$/.test(u.loc) && !seen.blog.includes(u.loc))
    .sort((a, b) => a.lastmod.localeCompare(b.lastmod)).slice(0, maxB);
  const listings = sitemap('sitemap-rent.xml').filter(u => /\/rent\/[a-z]+\/[^/]+\/[^/]+$/.test(u.loc) && !seen.listings.includes(u.loc))
    .sort((a, b) => a.lastmod.localeCompare(b.lastmod));
  for (const u of blogs) {
    const it = blogItem(u.loc);
    const dir = path.join(day, 'blog-' + u.loc.split('/').pop());
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'article.txt'), it._article); delete it._article;
    fs.writeFileSync(path.join(dir, 'item.json'), JSON.stringify(it, null, 2) + '\n');
    made.push(dir);
  }
  let n = 0;
  for (const u of listings) {
    if (n >= maxL) break;
    const it = classify(listingItem(u.loc));
    if (!it.inStock || !it.photoUrl) it.skip = it.skip || 'not currently available, or no photo';
    const dir = path.join(day, 'listing-' + u.loc.split('/').pop());
    fs.mkdirSync(dir, { recursive: true });
    if (!it.skip) curl(it.photoUrl, path.join(dir, 'photo.jpg'));
    fs.writeFileSync(path.join(dir, 'item.json'), JSON.stringify(it, null, 2) + '\n');
    made.push(dir + (it.skip ? `   [SKIP: ${it.skip}]` : ''));
    if (!it.skip) n++;
  }
  console.log(made.map(d => path.relative(ROOT, d)).join('\n') || '(nothing new)');
}

const ICON = {
  bed: '<path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6"></path><path d="M3 18h18"></path><path d="M6 10V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3"></path>',
  bath: '<path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"></path><path d="M6 12V6a2 2 0 0 1 4 0"></path><line x1="7" y1="19" x2="6" y2="21"></line><line x1="17" y1="19" x2="18" y2="21"></line>',
  car: '<path d="M5 16l1.5-5a2 2 0 0 1 2-1.5h7a2 2 0 0 1 2 1.5L19 16"></path><rect x="3" y="16" width="18" height="4" rx="1"></rect><circle cx="7.5" cy="18" r="0.6"></circle><circle cx="16.5" cy="18" r="0.6"></circle>',
};
const svg = (k, c) => `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
const shell = (title, inner) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="../../../brand/brand.css"></head>
<body>${inner}</body></html>
`;
const wordmark = (dark) => `<div style="font-family:'Fraunces',Georgia,serif;font-weight:800;font-size:34px;letter-spacing:-0.5px;color:${dark ? '#F4F1F8' : '#2B2730'}">Investor<span style="color:${dark ? '#86C5EE' : '#7B3FA8'}">Joint</span></div>`;

function listingCard(it) {
  const stat = (k, v, label) => v == null ? '' : `<div style="display:flex;align-items:center;gap:14px">${svg(k, '#7B3FA8')}<div style="display:flex;flex-direction:column"><span style="font-size:40px;font-weight:700;line-height:1">${v}</span><span style="font-size:20px;color:#4F4A57">${label}</span></div></div>`;
  const chips = [it.furnished === 'Yes' ? 'Furnished' : '', it.pets && !/not/i.test(it.pets) ? 'Pets considered' : '', it.available ? `Available ${esc(it.available)}` : ''].filter(Boolean)
    .map(c => `<span style="padding:10px 20px;border-radius:999px;background:#E6DDF2;color:#2B2730;font-size:22px;font-weight:600">${c}</span>`).join('');
  return shell(`For rent – ${it.suburb}`, `
<div id="slide" style="width:1080px;height:1350px;box-sizing:border-box;background:#F4F1F8;color:#2B2730;font-family:'Source Sans 3','Segoe UI',Helvetica,sans-serif;display:flex;flex-direction:column;position:relative;overflow:hidden">
<div style="position:relative;height:760px;overflow:hidden;background:#2B2730">
<img src="photo.jpg" alt="" style="width:100%;height:100%;object-fit:cover;display:block">
<div style="position:absolute;left:56px;top:48px;font-size:22px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#FFFFFF;background:#7B3FA8;padding:12px 22px;border-radius:999px">${it.roomRental ? 'Room for rent' : 'For rent'}</div>
</div>
<div style="flex-grow:1;padding:48px 64px 56px;display:flex;flex-direction:column;gap:28px">
<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:24px">
<div style="display:flex;flex-direction:column;gap:6px;min-width:0">
<div style="font-family:'Fraunces',Georgia,serif;font-weight:800;font-size:64px;line-height:1;letter-spacing:-1.5px">${esc(it.suburb)}</div>
<div style="font-size:26px;color:#4F4A57">${esc(it.state)} ${esc(it.postcode)}</div>
</div>
<div style="text-align:right;flex-shrink:0"><span style="font-family:'Fraunces',Georgia,serif;font-weight:800;font-size:72px;color:#7B3FA8;line-height:1">$${esc(it.rentPerWeek)}</span><span style="font-size:28px;color:#4F4A57"> ${it.roomRental ? 'pw per room' : 'pw'}</span></div>
</div>
${it.roomRental
  ? `<div style="display:flex;align-items:center;gap:16px;font-size:32px;font-weight:600">${svg('bed', '#7B3FA8')}<span>A room in a ${esc(it.beds)}-bedroom${it.baths ? `, ${esc(it.baths)}-bathroom` : ''} home</span></div>`
  : `<div style="display:flex;gap:56px">${stat('bed', it.beds, it.beds === 1 ? 'Bedroom' : 'Bedrooms')}${stat('bath', it.baths, it.baths === 1 ? 'Bathroom' : 'Bathrooms')}${stat('car', it.parking, 'Parking')}</div>`}
<div style="display:flex;flex-wrap:wrap;gap:12px">${chips}</div>
<div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center">${wordmark(false)}<span style="font-size:24px;font-weight:700">Enquire at investorjoint.com.au/rent</span></div>
</div>
</div>`);
}

function blogCard(it) {
  if (!Array.isArray(it.takeaways) || it.takeaways.length !== 3) throw new Error('blog item needs exactly 3 takeaways: ' + it.url);
  const meta = [it.category, it.readMinutes ? `${it.readMinutes} min read` : ''].filter(Boolean).join(' · ');
  const pts = it.takeaways.map((t, i) => `<div style="display:flex;gap:24px;align-items:center;background:#3A3540;border:1.5px solid #57505E;border-radius:22px;padding:24px 28px"><span style="flex-shrink:0;width:60px;height:60px;border-radius:50%;background:#86C5EE;color:#2B2730;font-family:'Fraunces',Georgia,serif;font-weight:800;font-size:32px;display:flex;align-items:center;justify-content:center">${i + 1}</span><span style="font-size:36px;line-height:1.25;color:#F4F1F8">${esc(t)}</span></div>`).join('');
  const size = it.title.length > 80 ? 72 : it.title.length > 55 ? 84 : 96;
  return shell(it.title, `
<div id="slide" style="width:1080px;height:1350px;box-sizing:border-box;padding:72px;background:#2B2730;color:#F4F1F8;font-family:'Source Sans 3','Segoe UI',Helvetica,sans-serif;display:flex;flex-direction:column;gap:44px;position:relative;overflow:hidden">
<div style="position:absolute;right:-220px;top:180px;width:640px;height:980px;border-radius:320px 320px 0 0;border:3px solid #45404B"></div>
<div style="display:flex;justify-content:space-between;align-items:center;position:relative">${wordmark(true)}<span style="font-size:19px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#2B2730;background:#86C5EE;padding:9px 18px;border-radius:999px">New on the blog</span></div>
<div style="display:flex;flex-direction:column;gap:18px;position:relative">
<div style="font-size:22px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C4BDCC">${esc(meta)}</div>
<h1 style="margin:0;font-family:'Fraunces',Georgia,serif;font-weight:800;font-size:${size}px;line-height:1.02;letter-spacing:-1.5px">${esc(it.title)}</h1>
</div>
<div style="margin-top:auto;display:flex;flex-direction:column;gap:20px;position:relative"><div style="font-size:22px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#86C5EE">The short version</div>${pts}</div>
<div style="display:flex;justify-content:space-between;align-items:center;font-size:26px;position:relative"><span style="font-family:'Fraunces',Georgia,serif;font-style:italic;color:#86C5EE">Read the full article: link in bio</span><span style="font-weight:700">investorjoint.com.au/blog</span></div>
</div>`);
}

async function cards(dayDir) {
  const dirs = fs.readdirSync(dayDir).map(d => path.join(dayDir, d))
    .filter(d => fs.existsSync(path.join(d, 'item.json')) && !JSON.parse(fs.readFileSync(path.join(d, 'item.json'), 'utf8')).skip);
  for (const d of dirs) {
    const it = JSON.parse(fs.readFileSync(path.join(d, 'item.json'), 'utf8'));
    fs.writeFileSync(path.join(d, 'card.html'), it.kind === 'blog' ? blogCard(it) : listingCard(it));
  }
  const { renderFiles } = await import('./render.mjs');
  const ok = await renderFiles(dirs.map(d => path.join(d, 'card.html')));
  process.exit(ok ? 0 : 2);
}

function markSeen(dir) {
  const it = JSON.parse(fs.readFileSync(path.join(dir, 'item.json'), 'utf8'));
  const s = readSeen(); const key = it.kind === 'blog' ? 'blog' : 'listings';
  if (!s[key].includes(it.url)) s[key].push(it.url);
  writeSeen(s); console.log('seen: ' + it.url);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'discover') discover(rest);
else if (cmd === 'cards') await cards(rest[0]);
else if (cmd === 'seen') markSeen(rest[0]);
else { console.error('usage: node tools/daily.mjs discover|cards <dir>|seen <itemdir>'); process.exit(1); }
